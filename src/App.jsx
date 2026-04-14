import { useEffect, useMemo, useState } from 'react';
import {
  Ban,
  CalendarDays,
  Medal,
  Moon,
  Shield,
  ShieldCheck,
  Sun,
  Trophy,
  Upload,
  Users,
} from 'lucide-react';
import { parseTournamentWorkbook } from './lib/excelParser';
import { sampleTournamentData } from './lib/sampleData';

const tabs = [
  { id: 'inicio', label: 'Inicio', icon: Trophy },
  { id: 'posiciones', label: 'Tabla', icon: Medal },
  { id: 'fixture', label: 'Fixture', icon: CalendarDays },
  { id: 'proxima', label: 'Próxima', icon: CalendarDays },
  { id: 'goleadores', label: 'Goleadores', icon: Users },
  { id: 'fairplay', label: 'Fair Play', icon: ShieldCheck },
  { id: 'sanciones', label: 'Sanciones', icon: Ban },
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
  <div className="flex items-center gap-2">
    <div className="grid h-8 w-8 place-items-center rounded-full bg-slate-800 text-xs font-bold text-cyan-300 ring-1 ring-slate-700">
      {name
        .split(' ')
        .slice(0, 2)
        .map((piece) => piece[0])
        .join('')
        .toUpperCase()}
    </div>
    <span className="text-sm font-medium text-slate-100">{name}</span>
  </div>
);

const SectionTitle = ({ title, subtitle }) => (
  <div className="mb-3">
    <h2 className="text-lg font-semibold text-white">{title}</h2>
    {subtitle ? <p className="text-xs text-slate-400">{subtitle}</p> : null}
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
  const [selectedFixtureRound, setSelectedFixtureRound] = useState('Todas');
  const [playerSearch, setPlayerSearch] = useState('');
  const [isDark, setIsDark] = useState(true);
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

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark);
  }, [isDark]);

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
      const roundOk = selectedFixtureRound === 'Todas' || match.round === selectedFixtureRound;
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
      setSelectedFixtureRound('Todas');
      return;
    }

    setSelectedFixtureRound((current) =>
      current === 'Todas' || fixtureRoundOptions.includes(current) ? current : fixtureRoundOptions[0],
    );
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
    <div className={`mx-auto min-h-screen max-w-5xl px-4 pb-24 pt-4 text-slate-100 md:px-6 ${categoryThemeClass}`}>
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-16 top-10 h-52 w-52 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="absolute -right-16 top-24 h-52 w-52 rounded-full bg-emerald-500/10 blur-3xl" />
      </div>

      <header className="mb-4 card fade-in sticky top-3 z-20">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="accent-text text-xs uppercase tracking-[0.22em]">Torneo UTN Sábados</p>
            <h1 className="text-xl font-bold text-white md:text-2xl">Apertura 2026</h1>
            <p className="mt-1 text-xs text-slate-400">
              {message} · Última actualización:{' '}
              {new Date(data.meta.loadedAt).toLocaleString('es-AR', { hour12: false })}
            </p>
            <p className="mt-1">
              <span className="badge accent-border accent-text">Categoría {selectedCategory}</span>
            </p>
          </div>
          <button
            onClick={() => setIsDark((prev) => !prev)}
            className="btn-soft p-2"
            aria-label="Cambiar modo"
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2 md:grid-cols-[auto_1fr_auto_auto_auto]">
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20"
          >
            {categoryOptions.map((category) => (
              <option key={category} value={category}>
                Categoría {category}
              </option>
            ))}
          </select>

          <select
            value={selectedTeam}
            onChange={(event) => setSelectedTeam(event.target.value)}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-white/20"
          >
            {teams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>

          {allowManualUpload ? (
            <label className="btn-soft inline-flex cursor-pointer items-center justify-center gap-2">
              <Upload size={16} />
              Cargar Excel
              <input type="file" accept=".xlsx,.xls" onChange={onUploadExcel} className="hidden" />
            </label>
          ) : null}

          {allowManualUpload ? (
            <label
              className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
                fixtureData
                  ? 'cursor-not-allowed border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                  : 'btn-soft cursor-pointer'
              }`}
            >
              <Upload size={16} />
              {fixtureData ? 'Fixture cargado' : 'Cargar fixture (1 vez)'}
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={onUploadFixtureExcel}
                className="hidden"
                disabled={Boolean(fixtureData)}
              />
            </label>
          ) : null}

          {resultsExcelUrl ? (
            <button
              onClick={() =>
                fetchResultsFromUrl(resultsExcelUrl, resultsExcelUrl.split('/').pop() || 'resultados.xlsx')
              }
              className="btn-soft"
            >
              Actualizar
            </button>
          ) : null}
        </div>
      </header>

      <nav className="mb-4 hidden gap-2 rounded-2xl border border-white/10 bg-slate-900/40 p-2 backdrop-blur md:flex">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm transition ${
                activeTab === tab.id
                  ? 'chip-active border-cyan-500/40'
                  : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </nav>

      <main className="space-y-4 pb-6">
        {activeTab === 'inicio' && (
          <section className="card tab-enter">
            <div className="mb-4 flex items-center justify-between gap-3">
              <SectionTitle title="Últimos resultados" subtitle="Fecha actual e historial" />
              <select
                value={selectedRound}
                onChange={(event) => setSelectedRound(event.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
              >
                {(categoryData.rounds || []).map((round) => (
                  <option key={round} value={round}>
                    {round}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              {filteredResults.length === 0 ? (
                <p className="text-sm text-slate-400">No hay partidos para el filtro seleccionado.</p>
              ) : (
                filteredResults.map((match) => {
                  return (
                    <article key={match.id} className="match-card">
                      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                        <span>{match.kickoff || 'Horario a confirmar'}</span>
                        <div className="flex items-center gap-2">
                          <span>{match.venue || 'Cancha a confirmar'}</span>
                          <span className="badge accent-border accent-text">Final</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                        <TeamChip name={match.homeTeam} />
                        <div className="text-center text-xl font-bold text-slate-200">
                          {match.homeGoals} - {match.awayGoals}
                        </div>
                        <div className="justify-self-end">
                          <TeamChip name={match.awayTeam} />
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        )}

        {activeTab === 'posiciones' && (
          <section className="card tab-enter">
            <SectionTitle title="Tabla de posiciones" subtitle="Ordenada por puntos" />
            <div className="table-scroll">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Equipo</th>
                    <th>PJ</th>
                    <th>G</th>
                    <th>E</th>
                    <th>P</th>
                    <th>GF</th>
                    <th>GC</th>
                    <th>DIF</th>
                    <th>PTS</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStandings.map((row, index) => (
                    <tr key={row.id} className="border-b border-slate-800/70 last:border-none">
                      <td>
                        <span
                          className={`badge ${
                            index < 3
                              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                              : 'border-slate-700 bg-slate-800 text-slate-300'
                          }`}
                        >
                          {index + 1}
                        </span>
                      </td>
                      <td className="font-medium text-slate-100">{row.team}</td>
                      <td>{row.pj}</td>
                      <td>{row.g}</td>
                      <td>{row.e}</td>
                      <td>{row.p}</td>
                      <td>{row.gf}</td>
                      <td>{row.gc}</td>
                      <td className={row.dif >= 0 ? 'text-emerald-300' : 'text-rose-300'}>{row.dif}</td>
                      <td className="font-semibold text-cyan-300">{row.pts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'fixture' && (
          <section className="card tab-enter">
            <SectionTitle
              title="Fixture del torneo"
              subtitle={fixtureData ? 'Calendario completo cargado' : 'Cargá el Excel de fixture una sola vez'}
            />

            {!fixtureData ? (
              <p className="text-sm text-slate-400">Usá el botón “Cargar fixture (1 vez)” para habilitar esta pestaña.</p>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-end">
                  <select
                    value={selectedFixtureRound}
                    onChange={(event) => setSelectedFixtureRound(event.target.value)}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs"
                  >
                    <option value="Todas">Todas las fechas</option>
                    {fixtureRoundOptions.map((round) => (
                      <option key={round} value={round}>
                        {round}
                      </option>
                    ))}
                  </select>
                </div>

                {fixtureWithResults.map((match) => (
                  <article key={match.id} className="match-card">
                    <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                      <span className="badge">{match.round}</span>
                      <div className="flex items-center gap-2">
                        <span>
                          {match.kickoff} · {match.venue}
                        </span>
                        {match.played ? <span className="badge border-emerald-500/40 text-emerald-300">Final</span> : <span className="badge">Programado</span>}
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <TeamChip name={match.homeTeam} />
                      {match.played ? (
                        <div className="text-base font-bold text-cyan-300">
                          {match.homeGoals} - {match.awayGoals}
                        </div>
                      ) : (
                        <Shield size={16} className="text-slate-500" />
                      )}
                      <TeamChip name={match.awayTeam} />
                    </div>
                  </article>
                ))}

                {(fixtureData.byes?.[selectedCategory] || [])
                  .filter((item) => selectedFixtureRound === 'Todas' || item.round === selectedFixtureRound)
                  .map((item, idx) => (
                  <article key={`fixture-bye-${idx}`} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                    <p className="text-sm text-slate-300">
                      <span className="badge mr-2">{item.round}</span>
                      Libre: <span className="font-semibold text-cyan-300">{item.team}</span>
                    </p>
                  </article>
                  ))}
              </div>
            )}
          </section>
        )}

        {activeTab === 'proxima' && (
          <section className="card tab-enter">
            <SectionTitle title="Próxima fecha" subtitle="Fixture por horario" />
            <div className="space-y-3">
              {filteredFixture.map((match) => (
                <article key={match.id} className="match-card">
                  <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
                    <span className="badge">{match.round}</span>
                    <span>
                      {match.kickoff} · {match.venue}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <TeamChip name={match.homeTeam} />
                    <Shield size={16} className="text-slate-500" />
                    <TeamChip name={match.awayTeam} />
                  </div>
                </article>
              ))}

              {(data.byes?.[selectedCategory] || []).map((item, idx) => (
                <article key={`bye-${idx}`} className="rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <p className="text-sm text-slate-300">
                    <span className="badge mr-2">{item.round}</span>
                    Libre: <span className="font-semibold text-cyan-300">{item.team}</span>
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        {activeTab === 'goleadores' && (
          <section className="card tab-enter">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <SectionTitle title="Tabla de goleadores" subtitle="Orden descendente" />
              <input
                value={playerSearch}
                onChange={(event) => setPlayerSearch(event.target.value)}
                placeholder="Buscar jugador"
                className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none ring-cyan-500 focus:ring"
              />
            </div>
            <div className="table-scroll">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Jugador</th>
                    <th>Equipo</th>
                    <th>Goles</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredScorers.map((row, idx) => (
                    <tr key={row.id} className="border-b border-slate-800/70 last:border-none">
                      <td>{idx + 1}</td>
                      <td className="font-medium text-slate-100">{row.player}</td>
                      <td>{row.team}</td>
                      <td className="font-semibold text-amber-300">{row.goals}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'fairplay' && (
          <section className="card tab-enter">
            <SectionTitle title="Fair Play" subtitle="De mejor a peor" />
            <div className="table-scroll">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Equipo</th>
                    <th>Puntos FP</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFairPlay.map((row, idx) => (
                    <tr key={row.id} className="border-b border-slate-800/70 last:border-none">
                      <td>{idx + 1}</td>
                      <td className="font-medium text-slate-100">{row.team}</td>
                      <td className="font-semibold text-emerald-300">{row.points}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'sanciones' && (
          <section className="card tab-enter">
            <SectionTitle title="Sanciones" subtitle="Registro disciplinario" />
            <div className="table-scroll">
              <table className="table-base">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Equipo</th>
                    <th>Div.</th>
                    <th>Expulsión</th>
                    <th>Artículo</th>
                    <th>Sanción</th>
                    <th>Hasta</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSanctions.map((row) => (
                    <tr key={row.id} className="border-b border-slate-800/70 last:border-none">
                      <td className="font-medium text-slate-100">{row.name}</td>
                      <td>{row.team}</td>
                      <td>{row.category}</td>
                      <td>{row.expulsionDate}</td>
                      <td>{row.article}</td>
                      <td>{row.sanction}</td>
                      <td>{row.until}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-slate-950/90 px-3 py-2 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-5xl grid-cols-7 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex flex-col items-center gap-1 rounded-lg px-1 py-1 text-[11px] transition ${
                  active ? 'accent-bg-soft accent-text' : 'text-slate-400 hover:bg-white/[0.06]'
                }`}
              >
                <Icon size={16} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      {isLoading ? (
        <div className="fixed right-3 top-3 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
          Actualizando datos...
        </div>
      ) : null}
    </div>
  );
}
