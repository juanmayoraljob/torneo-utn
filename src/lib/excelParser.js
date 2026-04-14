import * as XLSX from 'xlsx';

const normalize = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');

const aliases = {
  local: ['local', 'equipo local', 'team local', 'home'],
  visitante: ['visitante', 'equipo visitante', 'away', 'visit'],
  golesLocal: ['gol local', 'goles local', 'gl', 'home goals', 'score local'],
  golesVisitante: ['gol visitante', 'goles visitante', 'gv', 'away goals', 'score visitante'],
  horario: ['horario', 'hora', 'hs', 'time'],
  cancha: ['cancha', 'estadio', 'sede', 'venue'],
  fecha: ['fecha', 'jornada', 'round', 'matchday'],
  equipo: ['equipo', 'club', 'team'],
  pj: ['pj', 'partidos', 'jugados'],
  g: ['g', 'ganados', 'wins'],
  e: ['e', 'empatados', 'draws'],
  p: ['p', 'perdidos', 'losses'],
  gf: ['gf', 'goles a favor', 'goals for'],
  gc: ['gc', 'goles contra', 'goals against'],
  dif: ['dif', 'diferencia', '+/-', 'goal diff'],
  pts: ['pts', 'puntos', 'points'],
  jugador: ['jugador', 'nombre', 'player'],
  goles: ['goles', 'gol', 'goals'],
  fairPlay: ['fair play', 'fp', 'puntos fair play', 'fairplay'],
};

const parseNumber = (value, fallback = 0) => {
  if (value === null || value === undefined || value === '') return fallback;
  const numeric = Number(String(value).replace(',', '.'));
  return Number.isNaN(numeric) ? fallback : numeric;
};

const asString = (value, fallback = '') => {
  if (value === null || value === undefined) return fallback;
  const str = String(value).trim();
  return str || fallback;
};

const buildKeyMap = (row) => {
  const map = new Map();
  Object.keys(row || {}).forEach((key) => {
    map.set(normalize(key), key);
  });
  return map;
};

const getField = (row, keyAliases, fallback = '') => {
  const map = buildKeyMap(row);
  for (const alias of keyAliases) {
    const sourceKey = map.get(normalize(alias));
    if (sourceKey && row[sourceKey] !== undefined && row[sourceKey] !== '') {
      return row[sourceKey];
    }
  }
  return fallback;
};

const sortBy = (array, iteratees) =>
  [...array].sort((a, b) => {
    for (const iteratee of iteratees) {
      const result = iteratee(a, b);
      if (result !== 0) return result;
    }
    return 0;
  });

const matchSheet = (sheetNames, candidates) =>
  sheetNames.find((name) => candidates.some((candidate) => normalize(name).includes(candidate)));

const cleanRows = (rows) => rows.filter((row) => Object.values(row).some((v) => String(v ?? '').trim() !== ''));

const parseResults = (rows) =>
  cleanRows(rows).map((row, idx) => ({
    id: `res-${idx + 1}`,
    round: getField(row, aliases.fecha, 'Fecha actual'),
    homeTeam: String(getField(row, aliases.local, 'Local')),
    awayTeam: String(getField(row, aliases.visitante, 'Visitante')),
    homeGoals: parseNumber(getField(row, aliases.golesLocal, 0)),
    awayGoals: parseNumber(getField(row, aliases.golesVisitante, 0)),
    venue: String(getField(row, aliases.cancha, '')),
    kickoff: String(getField(row, aliases.horario, '')),
  }));

const parseStandings = (rows) =>
  sortBy(
    cleanRows(rows).map((row, idx) => ({
      id: `pos-${idx + 1}`,
      team: String(getField(row, aliases.equipo, `Equipo ${idx + 1}`)),
      pj: parseNumber(getField(row, aliases.pj, 0)),
      g: parseNumber(getField(row, aliases.g, 0)),
      e: parseNumber(getField(row, aliases.e, 0)),
      p: parseNumber(getField(row, aliases.p, 0)),
      gf: parseNumber(getField(row, aliases.gf, 0)),
      gc: parseNumber(getField(row, aliases.gc, 0)),
      dif: parseNumber(getField(row, aliases.dif, 0)),
      pts: parseNumber(getField(row, aliases.pts, 0)),
    })),
    [
      (a, b) => b.pts - a.pts,
      (a, b) => b.dif - a.dif,
      (a, b) => b.gf - a.gf,
      (a, b) => a.team.localeCompare(b.team),
    ],
  );

const parseFixture = (rows) =>
  sortBy(
    cleanRows(rows).map((row, idx) => ({
      id: `fix-${idx + 1}`,
      round: String(getField(row, aliases.fecha, 'Próxima fecha')),
      kickoff: String(getField(row, aliases.horario, 'A confirmar')),
      venue: String(getField(row, aliases.cancha, 'Sede a confirmar')),
      homeTeam: String(getField(row, aliases.local, 'Local')),
      awayTeam: String(getField(row, aliases.visitante, 'Visitante')),
    })),
    [(a, b) => a.kickoff.localeCompare(b.kickoff)],
  );

const parseScorers = (rows) =>
  sortBy(
    cleanRows(rows).map((row, idx) => ({
      id: `sc-${idx + 1}`,
      player: String(getField(row, aliases.jugador, `Jugador ${idx + 1}`)),
      team: String(getField(row, aliases.equipo, 'Sin equipo')),
      goals: parseNumber(getField(row, aliases.goles, 0)),
    })),
    [(a, b) => b.goals - a.goals, (a, b) => a.player.localeCompare(b.player)],
  );

const parseFairPlay = (rows) =>
  sortBy(
    cleanRows(rows).map((row, idx) => ({
      id: `fp-${idx + 1}`,
      team: String(getField(row, aliases.equipo, `Equipo ${idx + 1}`)),
      points: parseNumber(getField(row, aliases.fairPlay, getField(row, aliases.pts, 0))),
    })),
    [(a, b) => a.points - b.points, (a, b) => a.team.localeCompare(b.team)],
  );

const getRows = (workbook, sheetName) => {
  if (!sheetName || !workbook.Sheets[sheetName]) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
};

const getRowsAoa = (workbook, sheetName) => {
  if (!sheetName || !workbook.Sheets[sheetName]) return [];
  return XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1, defval: '' });
};

const newCategoryData = () => ({
  rounds: [],
  results: [],
  standings: [],
  fixture: [],
  scorers: [],
  fairPlay: [],
});

const ensureCategory = (categories, category) => {
  if (!category) return null;
  if (!categories[category]) categories[category] = newCategoryData();
  return categories[category];
};

const parseSanctionsTable = (rows) => {
  const headerIndex = rows.findIndex((row) => row.some((cell) => normalize(cell).includes('nombre')));
  if (headerIndex < 0) return [];

  return rows
    .slice(headerIndex + 1)
    .filter((row) => asString(row[0]) && asString(row[1]))
    .map((row, idx) => ({
      id: `san-${idx + 1}`,
      name: asString(row[0]),
      team: asString(row[1]),
      category: asString(row[2]),
      expulsionDate: asString(row[3]),
      article: asString(row[4]),
      sanction: asString(row[5]),
      until: asString(row[6]),
    }));
};

const parseDivisionResultsTable = (rows) => {
  const firstRow = rows[0] || [];
  const firstDataRow = rows[1] || [];
  const round = asString(firstRow[3], 'Fecha actual');
  const category = asString(firstDataRow[0]);

  const results = [];
  let byeTeam = '';

  rows.slice(1).forEach((row) => {
    const token = normalize(row[6]);
    if (token === 'vs') {
      results.push({
        id: `res-${category}-${results.length + 1}`,
        round: `Fecha ${round}`,
        homeTeam: asString(row[1], 'Local'),
        awayTeam: asString(row[8], 'Visitante'),
        homeGoals: parseNumber(row[5], 0),
        awayGoals: parseNumber(row[7], 0),
        venue: '',
        kickoff: '',
      });
    }
    if (normalize(row[6]) === 'libre') {
      byeTeam = asString(row[8]);
    }
  });

  return { category, round: `Fecha ${round}`, results, byeTeam };
};

const parseStandingsTable = (rows, category) =>
  rows
    .slice(2)
    .filter((row) => Number.isFinite(parseNumber(row[0], NaN)) && asString(row[1]))
    .map((row, idx) => ({
      id: `pos-${category}-${idx + 1}`,
      team: asString(row[1]),
      pts: parseNumber(row[2], 0),
      pj: parseNumber(row[3], 0),
      g: parseNumber(row[4], 0),
      e: parseNumber(row[5], 0),
      p: parseNumber(row[6], 0),
      gf: parseNumber(row[7], 0),
      gc: parseNumber(row[8], 0),
      dif: parseNumber(row[9], 0),
    }));

const parseScorersTable = (rows, category) =>
  rows
    .slice(2)
    .filter((row) => Number.isFinite(parseNumber(row[0], NaN)) && asString(row[1]))
    .map((row, idx) => ({
      id: `sc-${category}-${idx + 1}`,
      player: asString(row[1], `Jugador ${idx + 1}`),
      team: asString(row[2], 'Sin equipo'),
      goals: parseNumber(row[3], 0),
    }));

const parseFairPlayTable = (rows, category) =>
  rows
    .slice(2)
    .filter((row) => Number.isFinite(parseNumber(row[0], NaN)) && asString(row[1]))
    .map((row, idx) => ({
      id: `fp-${category}-${idx + 1}`,
      team: asString(row[1], `Equipo ${idx + 1}`),
      points: parseNumber(row[2], 0),
    }));

const parseFixtureTable = (rows, category) => {
  const round = asString(rows?.[0]?.[3], 'Próxima fecha');
  const fixture = [];
  let byeTeam = '';

  rows.slice(2).forEach((row) => {
    const first = normalize(row[0]);
    if (!first && !asString(row[2]) && !asString(row[6]) && !asString(row[5])) return;

    if (first === 'libre') {
      byeTeam = asString(row[1]);
      return;
    }

    const awayTeam = asString(row[6] || row[5]);
    if (!asString(row[2]) || !awayTeam) return;

    fixture.push({
      id: `fix-${category}-${fixture.length + 1}`,
      round: `Fecha ${round}`,
      kickoff: asString(row[1], 'A confirmar'),
      venue: `Cancha ${asString(row[0], '-')}`,
      homeTeam: asString(row[2], 'Local'),
      awayTeam,
    });
  });

  return { fixture, byeTeam, round: `Fecha ${round}` };
};

const isConvertedTableWorkbook = (workbook) =>
  workbook.SheetNames.length >= 10 && workbook.SheetNames.every((name) => /^Table\s+\d+$/i.test(name));

const parseConvertedWorkbook = (workbook) => {
  const categories = {};
  const sanctions = [];
  let currentCategory = 'A';
  const byes = { A: [], B: [], C: [] };

  workbook.SheetNames.forEach((sheetName) => {
    const rows = getRowsAoa(workbook, sheetName);
    const topText = normalize(rows.slice(0, 3).flat().join(' '));

    if (!rows.length) return;

    if (topText.includes('nombre') && topText.includes('division') && topText.includes('sancion')) {
      sanctions.push(...parseSanctionsTable(rows));
      return;
    }

    if (topText.includes('division') && rows.some((row) => normalize(row[6]) === 'vs')) {
      const parsed = parseDivisionResultsTable(rows);
      if (parsed.category) {
        currentCategory = parsed.category;
        const categoryData = ensureCategory(categories, currentCategory);
        categoryData.results = parsed.results;
        categoryData.rounds = [...new Set([...categoryData.rounds, parsed.round])];
        if (parsed.byeTeam) byes[currentCategory].push({ round: parsed.round, team: parsed.byeTeam });
      }
      return;
    }

    const categoryData = ensureCategory(categories, currentCategory);
    if (!categoryData) return;

    if (topText.includes('tabla de goleadores')) {
      categoryData.scorers = parseScorersTable(rows, currentCategory);
      return;
    }

    if (topText.includes('tabla de posiciones')) {
      categoryData.standings = parseStandingsTable(rows, currentCategory);
      return;
    }

    if (topText.includes('fair-play') || topText.includes('fair play')) {
      categoryData.fairPlay = parseFairPlayTable(rows, currentCategory);
      return;
    }

    if (topText.includes('proxima fecha')) {
      const parsed = parseFixtureTable(rows, currentCategory);
      categoryData.fixture = parsed.fixture;
      categoryData.rounds = [...new Set([...categoryData.rounds, parsed.round])];
      if (parsed.byeTeam) byes[currentCategory].push({ round: parsed.round, team: parsed.byeTeam });
    }
  });

  const categoryOrder = Object.keys(categories).sort();
  const defaultCategory = categoryOrder[0] || 'A';
  const defaultData = categories[defaultCategory] || newCategoryData();

  return {
    meta: {
      fileName: '',
      loadedAt: new Date().toISOString(),
      sheets: workbook.SheetNames,
    },
    categoryOrder,
    categories,
    sanctions,
    byes,
    rounds: defaultData.rounds,
    results: defaultData.results,
    standings: defaultData.standings,
    fixture: defaultData.fixture,
    scorers: defaultData.scorers,
    fairPlay: defaultData.fairPlay,
  };
};

const isFixtureGridWorkbook = (workbook) => {
  if (workbook.SheetNames.length < 1 || workbook.SheetNames.length > 4) return false;
  if (!workbook.SheetNames.every((name) => /^Table\s+\d+$/i.test(name))) return false;

  return workbook.SheetNames.some((sheetName) => {
    const rows = getRowsAoa(workbook, sheetName);
    return rows.some((row) => row.some((cell) => /^fecha\s*\d+$/i.test(String(cell).trim())));
  });
};

const parseFixtureBlock = (rows, startRow, baseCol, category) => {
  const label = asString(rows[startRow]?.[baseCol]);
  if (!/^fecha\s*\d+$/i.test(label)) {
    return { round: '', fixture: [], byeTeam: '' };
  }

  const round = label.replace(/\s+/g, ' ').trim();
  const fixture = [];
  let byeTeam = '';

  for (let r = startRow + 3; r < Math.min(startRow + 10, rows.length); r += 1) {
    const row = rows[r] || [];
    const homeTeam = asString(row[baseCol + 3]);
    const vsToken = normalize(row[baseCol + 4]);
    const awayTeam = asString(row[baseCol + 5]);

    if (vsToken === 'vs' && homeTeam && awayTeam) {
      fixture.push({
        id: `fix-${category}-${round}-${fixture.length + 1}`,
        round,
        kickoff: asString(row[baseCol + 1], 'A confirmar'),
        venue: `Cancha ${asString(row[baseCol], '-')}`,
        homeTeam,
        awayTeam,
      });
      continue;
    }

    if (!vsToken && homeTeam && !awayTeam) {
      byeTeam = homeTeam;
    }
  }

  return { round, fixture, byeTeam };
};

const parseFixtureGridWorkbook = (workbook) => {
  const categories = {};
  const byes = { A: [], B: [], C: [] };
  const categoryMap = ['A', 'B', 'C'];

  workbook.SheetNames.forEach((sheetName, index) => {
    const category = categoryMap[index] || `CAT-${index + 1}`;
    const rows = getRowsAoa(workbook, sheetName);
    const categoryData = ensureCategory(categories, category);

    const starts = [];
    rows.forEach((row, ri) => {
      row.forEach((cell, ci) => {
        if (/^fecha\s*\d+$/i.test(asString(cell))) starts.push({ row: ri, col: ci });
      });
    });

    starts.forEach(({ row, col }) => {
      const parsed = parseFixtureBlock(rows, row, col, category);
      if (!parsed.round) return;
      categoryData.fixture.push(...parsed.fixture);
      categoryData.rounds = [...new Set([...categoryData.rounds, parsed.round])];
      if (parsed.byeTeam) {
        if (!byes[category]) byes[category] = [];
        byes[category].push({ round: parsed.round, team: parsed.byeTeam });
      }
    });
  });

  const categoryOrder = Object.keys(categories).sort();
  const defaultCategory = categoryOrder[0] || 'A';
  const defaultData = categories[defaultCategory] || newCategoryData();

  return {
    meta: {
      fileName: '',
      loadedAt: new Date().toISOString(),
      sheets: workbook.SheetNames,
    },
    categoryOrder,
    categories,
    sanctions: [],
    byes,
    rounds: defaultData.rounds,
    results: defaultData.results,
    standings: defaultData.standings,
    fixture: defaultData.fixture,
    scorers: defaultData.scorers,
    fairPlay: defaultData.fairPlay,
  };
};

export const parseTournamentWorkbook = (arrayBuffer) => {
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });

  if (isConvertedTableWorkbook(workbook)) {
    return parseConvertedWorkbook(workbook);
  }

  if (isFixtureGridWorkbook(workbook)) {
    return parseFixtureGridWorkbook(workbook);
  }

  const sheets = workbook.SheetNames;

  const resultSheet = matchSheet(sheets, ['resultado', 'fecha actual', 'partido']);
  const standingsSheet = matchSheet(sheets, ['posicion', 'tabla', 'stand']);
  const fixtureSheet = matchSheet(sheets, ['proxima', 'fixture', 'siguiente']);
  const scorersSheet = matchSheet(sheets, ['goleador', 'scorer']);
  const fairPlaySheet = matchSheet(sheets, ['fair play', 'fairplay']);

  const results = parseResults(getRows(workbook, resultSheet));
  const standings = parseStandings(getRows(workbook, standingsSheet));
  const fixture = parseFixture(getRows(workbook, fixtureSheet));
  const scorers = parseScorers(getRows(workbook, scorersSheet));
  const fairPlay = parseFairPlay(getRows(workbook, fairPlaySheet));

  const rounds = [...new Set(results.map((item) => item.round || 'Fecha actual'))];

  return {
    meta: {
      fileName: '',
      loadedAt: new Date().toISOString(),
      sheets,
    },
    rounds,
    results,
    standings,
    fixture,
    scorers,
    fairPlay,
  };
};
