import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  Clock,
  Heart,
  Shield,
  Target,
  Trophy,
  Upload,
} from 'lucide-react';
import { parseTournamentWorkbook } from './lib/excelParser';
import { sampleTournamentData } from './lib/sampleData';

const tabs = [
  { id: 'inicio', label: 'Inicio', icon: Trophy },
  { id: 'posiciones', label: 'Tabla', icon: BarChart3 },
  { id: 'fixture', label: 'Fixture', icon: CalendarDays },
  { id: 'proxima', label: 'Próxima', icon: Clock },
  { id: 'goleadores', label: 'Goleadores', icon: Target },
  { id: 'fairplay', label: 'Fair Play', icon: Heart },
  { id: 'sanciones', label: 'Sanciones', icon: AlertTriangle },
];

const resultsExcelUrl = import.meta.env.VITE_RESULTS_EXCEL_URL || import.meta.env.VITE_AUTO_EXCEL_URL;
const fixtureExcelUrl = import.meta.env.VITE_FIXTURE_EXCEL_URL;
const refreshMs = Number(import.meta.env.VITE_AUTO_REFRESH_MS || 120000);
const allowManualUpload = import.meta.env.VITE_ENABLE_MANUAL_UPLOAD === 'true';
const emptyCategory = { rounds: [], results: [], standings: [], fixture: [], scorers: [], fairPlay: [] };
const emptyTournamentData = {
  meta: {
    fileName: '',
    loadedAt: new Date().toISOString(),
    sheets: [],
  },
  rounds: [],
  results: [],
  standings: [],
  fixture: [],
  scorers: [],
  fairPlay: [],
  categoryOrder: ['A', 'B', 'C'],
  categories: {
    A: { ...emptyCategory },
    B: { ...emptyCategory },
    C: { ...emptyCategory },
  },
  sanctions: [],
  byes: { A: [], B: [], C: [] },
};
const fixtureStorageKey = 'torneo_fixture_once_v1';

const normalizeToken = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const roundNumber = (round) => {
  const match = String(round || '').match(/(\d+)/);
  return match ? Number(match[1]) : 999;
};

const normalizeExcelUrl = (url) => {
  try {
    const parsed = new URL(url);

    const spreadsheetsMatch = parsed.pathname.match(/\/spreadsheets\/d\/([^/]+)/i);
    if (spreadsheetsMatch?.[1]) {
      return `https://docs.google.com/spreadsheets/d/${spreadsheetsMatch[1]}/export?format=xlsx`;
    }

    const driveFileMatch = parsed.pathname.match(/\/file\/d\/([^/]+)/i);
    if (driveFileMatch?.[1]) {
      return `https://drive.google.com/uc?export=download&id=${driveFileMatch[1]}`;
    }

    return url;
  } catch {
    return url;
  }
};

const readStoredFixture = () => {
  try {
    const raw = localStorage.getItem(fixtureStorageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.categories) return null;
    return parsed;
  } catch {
    return null;
  }
};

const TeamChip = ({ name }) => (
  <div className="team-chip">
    <div className="team-avatar">
      {name
        .split(' ')
        .slice(0, 2)
        .map((piece) => piece[0])
        .join('')
        .toUpperCase()}
    </div>
    <span className="team-name">{name}</span>
  </div>
);

const SectionTitle = ({ title, subtitle }) => (
  <div>
    <h2 className="section-title">{title}</h2>
    {subtitle ? <p className="section-sub">{subtitle}</p> : null}
  </div>
);

export default function App() {
  const shouldBootFromRemote = Boolean(resultsExcelUrl || fixtureExcelUrl);
  const initialData = shouldBootFromRemote ? emptyTournamentData : sampleTournamentData;

  const [activeTab, setActiveTab] = useState('inicio');
  const [data, setData] = useState(initialData);
  const [fixtureData, setFixtureData] = useState(() => readStoredFixture());
  const [selectedCategory, setSelectedCategory] = useState(initialData.categoryOrder?.[0] || 'General');
  const [selectedTeam, setSelectedTeam] = useState('Todos');
  const [selectedRound, setSelectedRound] = useState(initialData.rounds[0] || 'Fecha actual');
  const [selectedFixtureRound, setSelectedFixtureRound] = useState('');
  const [playerSearch, setPlayerSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState(
    shouldBootFromRemote
      ? 'Cargando datos desde archivos remotos...'
      : 'Usando datos demo. Subí tu Excel para actualizar.',
  );

  const categoryThemeClass = useMemo(() => {
    if (selectedCategory === 'B') return 'theme-B';
    if (selectedCategory === 'C') return 'theme-C';
    return 'theme-A';
  }, [selectedCategory]);


  const categoryOptions = useMemo(() => {
    const merged = new Set([...(data.categoryOrder || []), ...(fixtureData?.categoryOrder || [])]);
    if (merged.size > 0) return [...merged].sort();
    return ['General'];
  }, [data.categoryOrder, fixtureData?.categoryOrder]);

  const categoryData = useMemo(() => {
    if (data.categories?.[selectedCategory]) return data.categories[selectedCategory];
    return {
      rounds: data.rounds || [],
      results: data.results || [],
      standings: data.standings || [],
      fixture: data.fixture || [],
      scorers: data.scorers || [],
      fairPlay: data.fairPlay || [],
    };
  }, [data, selectedCategory]);

  const fixtureCategoryData = useMemo(() => {
    if (fixtureData?.categories?.[selectedCategory]) return fixtureData.categories[selectedCategory];
    return emptyCategory;
  }, [fixtureData, selectedCategory]);

  const teams = useMemo(() => {
    const fromStandings = (categoryData.standings || []).map((item) => item.team);
    const fromMatches = (categoryData.results || []).flatMap((match) => [match.homeTeam, match.awayTeam]);
    return ['Todos', ...new Set([...fromStandings, ...fromMatches])];
  }, [categoryData]);

  const filteredResults = useMemo(() => {
    return (categoryData.results || []).filter((match) => {
      const roundOk = selectedRound ? match.round === selectedRound : true;
      const teamOk =
        selectedTeam === 'Todos' || match.homeTeam === selectedTeam || match.awayTeam === selectedTeam;
      return roundOk && teamOk;
    });
  }, [categoryData.results, selectedRound, selectedTeam]);

  const filteredStandings = useMemo(() => {
    if (selectedTeam === 'Todos') return categoryData.standings || [];
    return (categoryData.standings || []).filter((row) => row.team === selectedTeam);
  }, [categoryData.standings, selectedTeam]);

  const filteredFixture = useMemo(() => {
    return (categoryData.fixture || []).filter((match) => {
      if (selectedTeam === 'Todos') return true;
      return match.homeTeam === selectedTeam || match.awayTeam === selectedTeam;
    });
  }, [categoryData.fixture, selectedTeam]);

  const fullFilteredFixture = useMemo(() => {
    return (fixtureCategoryData.fixture || []).filter((match) => {
      const roundOk = selectedFixtureRound ? match.round === selectedFixtureRound : true;
      const teamOk =
        selectedTeam === 'Todos' || match.homeTeam === selectedTeam || match.awayTeam === selectedTeam;
      return roundOk && teamOk;
    });
  }, [fixtureCategoryData.fixture, selectedFixtureRound, selectedTeam]);

  const fixtureRoundOptions = useMemo(() => {
    const rounds = [...new Set((fixtureCategoryData.fixture || []).map((match) => match.round).filter(Boolean))];
    return rounds.sort((a, b) => roundNumber(a) - roundNumber(b));
  }, [fixtureCategoryData.fixture]);

  const fixtureWithResults = useMemo(() => {
    const results = categoryData.results || [];

    return fullFilteredFixture.map((fixture) => {
      const fixtureRound = normalizeToken(fixture.round);
      const fixtureHome = normalizeToken(fixture.homeTeam);
      const fixtureAway = normalizeToken(fixture.awayTeam);

      const found = results.find((result) => {
        const resultRound = normalizeToken(result.round);
        const resultHome = normalizeToken(result.homeTeam);
        const resultAway = normalizeToken(result.awayTeam);

        const sameRound = fixtureRound && resultRound ? fixtureRound === resultRound : true;
        const sameOrder = resultHome === fixtureHome && resultAway === fixtureAway;
        const inverseOrder = resultHome === fixtureAway && resultAway === fixtureHome;
        return sameRound && (sameOrder || inverseOrder);
      });

      if (!found) return { ...fixture, played: false };

      const sameOrder =
        normalizeToken(found.homeTeam) === fixtureHome && normalizeToken(found.awayTeam) === fixtureAway;

      return {
        ...fixture,
        played: true,
        homeGoals: sameOrder ? found.homeGoals : found.awayGoals,
        awayGoals: sameOrder ? found.awayGoals : found.homeGoals,
      };
    });
  }, [fullFilteredFixture, categoryData.results]);

  const filteredScorers = useMemo(() => {
    return (categoryData.scorers || []).filter((row) => {
      const teamOk = selectedTeam === 'Todos' || row.team === selectedTeam;
      const searchOk = row.player.toLowerCase().includes(playerSearch.toLowerCase());
      return teamOk && searchOk;
    });
  }, [categoryData.scorers, selectedTeam, playerSearch]);

  const filteredFairPlay = useMemo(() => {
    if (selectedTeam === 'Todos') return categoryData.fairPlay || [];
    return (categoryData.fairPlay || []).filter((row) => row.team === selectedTeam);
  }, [categoryData.fairPlay, selectedTeam]);

  const filteredSanctions = useMemo(() => {
    const all = data.sanctions || [];
    return all.filter((row) => {
      const categoryOk = selectedCategory === 'General' || !row.category || row.category === selectedCategory;
      const teamOk = selectedTeam === 'Todos' || row.team === selectedTeam;
      return categoryOk && teamOk;
    });
  }, [data.sanctions, selectedCategory, selectedTeam]);

  const applyWorkbook = async (arrayBuffer, fileName = 'archivo.xlsx') => {
    const parsed = parseTournamentWorkbook(arrayBuffer);
    const nextCategory = parsed.categoryOrder?.[0] || 'General';
    const nextCategoryData = parsed.categories?.[nextCategory] || emptyCategory;
    setData({
      ...parsed,
      meta: {
        ...parsed.meta,
        fileName,
        loadedAt: new Date().toISOString(),
      },
    });
    setSelectedCategory(nextCategory);
    setSelectedTeam('Todos');
    setSelectedRound(nextCategoryData.rounds[0] || parsed.rounds?.[0] || 'Fecha actual');
    setMessage(`Datos cargados desde ${fileName}`);
  };

  useEffect(() => {
    const nextRound = categoryData.rounds?.[0] || 'Fecha actual';
    setSelectedRound(nextRound);
    setSelectedTeam('Todos');
  }, [selectedCategory]);

  useEffect(() => {
    if (fixtureRoundOptions.length === 0) {
      setSelectedFixtureRound('');
      return;
    }

    setSelectedFixtureRound((current) => (fixtureRoundOptions.includes(current) ? current : fixtureRoundOptions[0]));
  }, [fixtureRoundOptions]);

  const onUploadExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      await applyWorkbook(buffer, file.name);
    } catch (error) {
      setMessage('No se pudo parsear el Excel. Verificá la estructura de hojas.');
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const onUploadFixtureExcel = async (event) => {
    const file = event.target.files?.[0];
    if (!file || fixtureData) return;

    setIsLoading(true);
    try {
      const buffer = await file.arrayBuffer();
      const parsed = parseTournamentWorkbook(buffer);
      const payload = {
        categoryOrder: parsed.categoryOrder || [],
        categories: parsed.categories || {},
        byes: parsed.byes || {},
        meta: {
          fileName: file.name,
          loadedAt: new Date().toISOString(),
        },
      };
      setFixtureData(payload);
      localStorage.setItem(fixtureStorageKey, JSON.stringify(payload));
      setMessage(`Fixture cargado una sola vez desde ${file.name}`);
    } catch (error) {
      setMessage('No se pudo cargar el Excel de fixture.');
    } finally {
      setIsLoading(false);
      event.target.value = '';
    }
  };

  const fetchResultsFromUrl = async (url, sourceLabel = 'remoto.xlsx') => {
    if (!url) return;
    const requestUrl = normalizeExcelUrl(url);
    setIsLoading(true);
    try {
      const response = await fetch(requestUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('No disponible');
      const buffer = await response.arrayBuffer();
      await applyWorkbook(buffer, sourceLabel);
    } catch (error) {
      setMessage('No se pudo actualizar automáticamente, se mantienen datos actuales.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFixtureFromUrlOnce = async (url) => {
    if (!url || fixtureData) return;
    const requestUrl = normalizeExcelUrl(url);
    setIsLoading(true);
    try {
      const response = await fetch(requestUrl, { cache: 'no-store' });
      if (!response.ok) throw new Error('No disponible');
      const buffer = await response.arrayBuffer();
      const parsed = parseTournamentWorkbook(buffer);
      const payload = {
        categoryOrder: parsed.categoryOrder || [],
        categories: parsed.categories || {},
        byes: parsed.byes || {},
        meta: {
          fileName: url.split('/').pop() || 'fixture.xlsx',
          loadedAt: new Date().toISOString(),
        },
      };
      setFixtureData(payload);
      localStorage.setItem(fixtureStorageKey, JSON.stringify(payload));
      setMessage(`Fixture cargado automáticamente desde ${payload.meta.fileName}`);
    } catch {
      setMessage('No se pudo cargar automáticamente el fixture.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (resultsExcelUrl) {
      fetchResultsFromUrl(resultsExcelUrl, resultsExcelUrl.split('/').pop() || 'resultados.xlsx');
    }
    if (fixtureExcelUrl) {
      fetchFixtureFromUrlOnce(fixtureExcelUrl);
    }

    if (!resultsExcelUrl) return;
    const timer = setInterval(
      () => fetchResultsFromUrl(resultsExcelUrl, resultsExcelUrl.split('/').pop() || 'resultados.xlsx'),
      Math.max(refreshMs, 15000),
    );
    return () => clearInterval(timer);
  }, []);

  return (
    <div className={categoryThemeClass}>
      <div className="app-shell">
        {/* ── Sidebar (desktop) ── */}
        <aside className="sidebar">
          <div className="sidebar-brand">
            <p className="accent-text text-[10px] font-semibold uppercase tracking-widest opacity-70">Torneo UTN</p>
            <h1 className="text-lg font-bold text-white leading-tight">Apertura 2026</h1>
          </div>

          <nav className="flex flex-col gap-1 flex-1">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button key={tab.id} onClick={() => setActiveTab(tab.id)} data-active={activeTab === tab.id} className="sidebar-link">
                  <Icon size={16} strokeWidth={2} />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto flex flex-col gap-3 border-t border-white/[.06] pt-4">
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Categoría</label>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="select-control w-full">
                {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block mb-1.5">Equipo</label>
              <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="select-control w-full">
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            {allowManualUpload && (
              <div className="flex gap-2">
                <label className="btn flex-1 cursor-pointer text-center text-xs">
                  <Upload size={14} /> Res.
                  <input type="file" accept=".xlsx,.xls" onChange={onUploadExcel} className="hidden" />
                </label>
                <label className={`btn flex-1 cursor-pointer text-center text-xs ${fixtureData ? 'opacity-50 pointer-events-none' : ''}`}>
                  <Upload size={14} /> Fix.
                  <input type="file" accept=".xlsx,.xls" onChange={onUploadFixtureExcel} className="hidden" disabled={Boolean(fixtureData)} />
                </label>
              </div>
            )}
          </div>
        </aside>

        {/* ── Main column ── */}
        <div className="flex flex-col min-h-dvh">
          {/* Mobile top bar */}
          <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[.06] bg-slate-950/90 backdrop-blur-md px-4 py-3 md:hidden">
            <div>
              <p className="accent-text text-[9px] font-semibold uppercase tracking-widest opacity-70">Torneo UTN</p>
              <h1 className="text-base font-bold text-white">Apertura 2026</h1>
            </div>
            <div className="filter-bar">
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="select-control text-xs py-1.5 px-2">
                {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
              <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="select-control text-xs py-1.5 px-2 max-w-[110px]">
                {teams.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </header>

          <main className="flex-1 p-4 pb-24 md:p-6 md:pb-6 space-y-5 max-w-5xl w-full mx-auto">
            {/* ── Tab: Inicio ── */}
        {activeTab === 'inicio' && (
              <section className="tab-enter space-y-4">
                <div className="section-header">
                  <SectionTitle title="Últimos resultados" subtitle="Fecha actual e historial" />
                  <select value={selectedRound} onChange={(event) => setSelectedRound(event.target.value)} className="select-control">
                    {(categoryData.rounds || []).map((round) => (
                      <option key={round} value={round}>{round}</option>
                    ))}
                  </select>
                </div>

                {filteredResults.length === 0 ? (
                  <div className="empty-state">
                    <Shield size={40} />
                    <p className="text-sm">No hay partidos para el filtro seleccionado.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredResults.map((match) => (
                      <article key={match.id} className="match-card">
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                          <span>{match.kickoff || 'Horario a confirmar'}</span>
                          <div className="flex items-center gap-2">
                            <span>{match.venue || 'Cancha a confirmar'}</span>
                            <span className="badge badge-accent">Final</span>
                          </div>
                        </div>
                        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                          <TeamChip name={match.homeTeam} />
                          <div className="text-center text-xl font-bold accent-text">
                            {match.homeGoals} - {match.awayGoals}
                          </div>
                          <div className="justify-self-end">
                            <TeamChip name={match.awayTeam} />
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Tab: Posiciones ── */}
        {activeTab === 'posiciones' && (
              <section className="tab-enter space-y-4">
                <SectionTitle title="Tabla de posiciones" subtitle="Ordenada por puntos" />
                <div className="table-wrap">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th><th>Equipo</th><th>PJ</th><th>G</th><th>E</th><th>P</th><th>GF</th><th>GC</th><th>DIF</th><th>PTS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredStandings.map((row, index) => (
                        <tr key={row.id}>
                          <td><span className={`rank-badge ${index < 3 ? 'rank-top' : 'rank-normal'}`}>{index + 1}</span></td>
                          <td className="font-medium text-slate-100">{row.team}</td>
                          <td>{row.pj}</td><td>{row.g}</td><td>{row.e}</td><td>{row.p}</td>
                          <td>{row.gf}</td><td>{row.gc}</td>
                          <td className={row.dif >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{row.dif}</td>
                          <td className="font-semibold accent-text">{row.pts}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

        {/* ── Tab: Fixture ── */}
            {activeTab === 'fixture' && (
              <section className="tab-enter space-y-4">
                <div className="section-header">
                  <SectionTitle title="Fixture del torneo" subtitle={fixtureData ? 'Calendario completo cargado' : 'Cargá el Excel de fixture una sola vez'} />
                  {fixtureData && (
                    <select value={selectedFixtureRound} onChange={(e) => setSelectedFixtureRound(e.target.value)} className="select-control">
                      {fixtureRoundOptions.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  )}
                </div>

                {!fixtureData ? (
                  <div className="empty-state">
                    <CalendarDays size={40} />
                    <p className="text-sm">Usá el botón "Cargar fixture (1 vez)" para habilitar esta pestaña.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {fixtureWithResults.map((match) => (
                      <article key={match.id} className="match-card">
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                          <span className="badge badge-default">{match.round}</span>
                          <div className="flex items-center gap-2">
                            <span>{match.kickoff} · {match.venue}</span>
                            {match.played ? <span className="badge badge-success">Final</span> : <span className="badge badge-default">Programado</span>}
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <TeamChip name={match.homeTeam} />
                          {match.played ? (
                            <div className="text-base font-bold accent-text">{match.homeGoals} - {match.awayGoals}</div>
                          ) : (
                            <Shield size={16} className="text-slate-600" />
                          )}
                          <TeamChip name={match.awayTeam} />
                        </div>
                      </article>
                    ))}

                    {(fixtureData.byes?.[selectedCategory] || [])
                      .filter((item) => (selectedFixtureRound ? item.round === selectedFixtureRound : true))
                      .map((item, idx) => (
                        <article key={`fixture-bye-${idx}`} className="match-card border-l-2" style={{ borderLeftColor: 'rgb(var(--accent))' }}>
                          <p className="text-sm text-slate-300">
                            <span className="badge badge-accent mr-2">{item.round}</span>
                            <span className="text-slate-500">Jornada libre:</span>{' '}
                            <span className="font-semibold accent-text">{item.team}</span>
                          </p>
                        </article>
                      ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Tab: Próxima ── */}
            {activeTab === 'proxima' && (
              <section className="tab-enter space-y-4">
                <SectionTitle title="Próxima fecha" subtitle="Fixture por horario" />
                {filteredFixture.length === 0 ? (
                  <div className="empty-state">
                    <Clock size={40} />
                    <p className="text-sm">No hay próximos partidos programados.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filteredFixture.map((match) => (
                      <article key={match.id} className="match-card">
                        <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
                          <span className="badge badge-default">{match.round}</span>
                          <span>{match.kickoff} · {match.venue}</span>
                        </div>
                        <div className="flex items-center justify-between gap-2 text-sm">
                          <TeamChip name={match.homeTeam} />
                          <Shield size={16} className="text-slate-600" />
                          <TeamChip name={match.awayTeam} />
                        </div>
                      </article>
                    ))}

                    {(data.byes?.[selectedCategory] || []).map((item, idx) => (
                      <article key={`bye-${idx}`} className="match-card border-l-2" style={{ borderLeftColor: 'rgb(var(--accent))' }}>
                        <p className="text-sm text-slate-300">
                          <span className="badge badge-default mr-2">{item.round}</span>
                          Libre: <span className="font-semibold accent-text">{item.team}</span>
                        </p>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* ── Tab: Goleadores ── */}
            {activeTab === 'goleadores' && (
              <section className="tab-enter space-y-4">
                <div className="section-header">
                  <SectionTitle title="Tabla de goleadores" subtitle="Orden descendente" />
                  <input value={playerSearch} onChange={(e) => setPlayerSearch(e.target.value)} placeholder="Buscar jugador…" className="input-control w-48" />
                </div>
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>#</th><th>Jugador</th><th>Equipo</th><th>Goles</th></tr></thead>
                    <tbody>
                      {filteredScorers.map((row, idx) => (
                        <tr key={row.id}>
                          <td><span className={`rank-badge ${idx < 3 ? 'rank-top' : 'rank-normal'}`}>{idx + 1}</span></td>
                          <td className="font-medium text-slate-100">{row.player}</td>
                          <td className="text-slate-400">{row.team}</td>
                          <td className="font-semibold text-amber-300">{row.goals}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Tab: Fair Play ── */}
            {activeTab === 'fairplay' && (
              <section className="tab-enter space-y-4">
                <SectionTitle title="Fair Play" subtitle="De mejor a peor" />
                <div className="table-wrap">
                  <table className="data-table">
                    <thead><tr><th>#</th><th>Equipo</th><th>Puntos FP</th></tr></thead>
                    <tbody>
                      {filteredFairPlay.map((row, idx) => (
                        <tr key={row.id}>
                          <td><span className={`rank-badge ${idx < 3 ? 'rank-top' : 'rank-normal'}`}>{idx + 1}</span></td>
                          <td className="font-medium text-slate-100">{row.team}</td>
                          <td className="font-semibold text-emerald-400">{row.points}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Tab: Sanciones ── */}
            {activeTab === 'sanciones' && (
              <section className="tab-enter space-y-4">
                <SectionTitle title="Sanciones" subtitle="Registro disciplinario" />
                {filteredSanctions.length === 0 ? (
                  <div className="empty-state">
                    <AlertTriangle size={40} />
                    <p className="text-sm">No hay sanciones registradas.</p>
                  </div>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr><th>Nombre</th><th>Equipo</th><th>Div.</th><th>Expulsión</th><th>Artículo</th><th>Sanción</th><th>Hasta</th></tr>
                      </thead>
                      <tbody>
                        {filteredSanctions.map((row) => (
                          <tr key={row.id}>
                            <td className="font-medium text-slate-100">{row.name}</td>
                            <td className="text-slate-400">{row.team}</td>
                            <td><span className="badge badge-default">{row.category}</span></td>
                            <td>{row.expulsionDate}</td>
                            <td>{row.article}</td>
                            <td className="text-rose-400">{row.sanction}</td>
                            <td>{row.until}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}
          </main>
        </div>
      </div>

      {/* ── Mobile Bottom Nav ── */}
      <nav className="mobile-nav">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} data-active={activeTab === tab.id} className="mobile-nav-btn">
              <Icon size={18} strokeWidth={2} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {isLoading && (
        <div className="loading-toast">
          <div className="h-3 w-3 rounded-full border-2 border-current border-t-transparent animate-spin" />
          Actualizando…
        </div>
      )}
    </div>
  );
}
