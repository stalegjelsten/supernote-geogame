import {countryIn, findCountryByName, pickSheetLanguage, type Country} from './core/countries';
import {currentLanguage, type Language} from './i18n';
import {assignToRows, boxOf, nearestRow} from './core/grouping';
import {splitByRows} from './core/lines';
import {inside, markColor, markLayout, markStrokes, strokeAsPolygon} from './core/marks';
import {
  centeredTextRect,
  computeLayout,
  fitFontSize,
  guessLayoutVersion,
  maxRowsPerPage,
  type Rect,
  type Size,
} from './core/layout';
import {
  gradeAnswer,
  isPoint,
  isResultText,
  parseSheetTitle,
  pickCountries,
  resultMark,
  resultText,
  sheetTitle,
  splitIntoPages,
  type Region,
  type SheetInfo,
} from './core/sheet';
import {
  COLOR_BLACK,
  COLOR_DARK_GRAY,
  TYPE_STROKE,
  TYPE_GEO,
  TYPE_TEXT,
  currentPage,
  deleteElements,
  ensurePermissions,
  getPageElements,
  insertBlankPages,
  insertDrafts,
  jumpToPage,
  pageRefAt,
  recognize,
  saveNote,
  strokePointsAll,
  type Draft,
  type PageElement,
  type PageRef,
} from './sdk/notes';
import {computeStats, sheetKey, verdictScore, type Attempt, type Skill} from './core/stats';
import {orderForTraining, type Strategy} from './core/training';
import {loadRecords, saveRecord} from './sdk/statsStore';

/** Strekbredde for tabellinjer; se kommentaren i createSheet. */
const LINE_WIDTH = 200;

/** Strekbredde for rettemerkene (litt tykkere enn tabellinjene). Aldri under 200; se LINE_WIDTH. */
const MARK_WIDTH = 300;

export type Progress = (message: string) => void;

/**
 * Rekkefølgen land skal trekkes i for en treningsmodus, eller undefined for
 * vanlig tilfeldig trekning. Leser statistikken for ferdigheten.
 */
export async function trainingOrder(
  skill: Skill,
  strategy: Strategy,
): Promise<((pool: Country[]) => Country[]) | undefined> {
  if (strategy === 'random') {
    return undefined;
  }
  const stats = computeStats(await loadRecords(), skill);
  const now = Date.now();
  return pool => orderForTraining(pool, stats, strategy, now);
}

/** Lagrer resultatene fra en rettet side. Feil i lagringen stopper aldri rettingen. */
export async function recordResults(notePath: string, skill: Skill, attempts: Attempt[]): Promise<void> {
  if (!attempts.length) {
    return;
  }
  const key = sheetKey(notePath, skill, attempts.map(a => a.code));
  await saveRecord({skill, time: Date.now(), key, attempts});
}

/** Antall elementer på siden, så UI-et kan advare før det skrives over en side med innhold. */
export async function countElementsOnPage(): Promise<number> {
  await ensurePermissions();
  const ref = await currentPage();
  return (await getPageElements(ref)).length;
}

/** Tekst som er loddrett midtstilt i cellen og krympet til den får plass. */
function cellText(
  text: string,
  cell: Rect,
  maxSize: number,
  opts: {bold?: boolean; locked?: boolean; align?: 0 | 1 | 2} = {},
): Draft {
  const fontSize = fitFontSize(text, cell, maxSize);
  return {kind: 'text', text, rect: centeredTextRect(text, cell, fontSize), fontSize, ...opts};
}

/** Alle elementene for én side av et arbeidsark. */
function sheetDrafts(size: Size, lang: Language, title: string, countries: Country[]): Draft[] {
  const L = computeLayout(size, countries.length);
  const drafts: Draft[] = [];

  // Tabellinjer. Alle har penWidth 200: med bredde 100 lagrer enheten hver linje
  // som ~90 kB (mot ~0,5 kB), og siden skrives på nytt ved hver lagring, så notatet
  // vokser raskt. Indre linjer skilles ut med mørk grå farge i stedet for tynnere strek.
  const [x0, x1, x2, x3] = L.columnX;
  const top = L.lineY[0];
  const bottom = L.lineY[L.lineY.length - 1];
  L.lineY.forEach((y, i) => {
    const outer = i === 0 || i === 1 || i === L.lineY.length - 1;
    drafts.push({
      kind: 'line',
      a: {x: x0, y},
      b: {x: x3, y},
      color: outer ? COLOR_BLACK : COLOR_DARK_GRAY,
      width: LINE_WIDTH,
    });
  });
  [x0, x1, x2, x3].forEach((x, i) => {
    const outer = i === 0 || i === 3;
    drafts.push({
      kind: 'line',
      a: {x, y: top},
      b: {x, y: bottom},
      color: outer ? COLOR_BLACK : COLOR_DARK_GRAY,
      width: LINE_WIDTH,
    });
  });

  drafts.push({
    kind: 'text',
    text: title,
    rect: L.title,
    fontSize: Math.round(L.fontSize * 1.4),
    bold: true,
    locked: true,
  });
  drafts.push({
    kind: 'text',
    text: lang.sheet.subtitle,
    rect: L.subtitle,
    fontSize: L.smallFontSize,
    locked: true,
  });
  const h = L.header;
  drafts.push(cellText(lang.sheet.colCountry, h.country, L.smallFontSize, {bold: true, locked: true}));
  drafts.push(cellText(lang.sheet.colAnswer, h.answer, L.smallFontSize, {bold: true, locked: true}));
  drafts.push(cellText(lang.sheet.colResult, h.result, L.smallFontSize, {bold: true, locked: true}));
  countries.forEach((c, i) => {
    drafts.push(cellText(c.name, L.rows[i].country, L.fontSize, {locked: true}));
  });
  return drafts;
}

export interface CreateSummary {
  countries: number;
  pages: number;
}

/**
 * Lager et arbeidsark på språket `lang`, fordelt på flere sider hvis det er mer enn 20 land.
 * `strategy` velger landene (se core/training.ts); 'random' trekker tilfeldig.
 * @param where 'here' = første side på nåværende side, resten på nye sider etter den;
 *   'newPage' = alle sidene på nye sider rett etter nåværende side.
 */
export async function createSheet(
  lang: Language,
  region: Region,
  count: number,
  where: 'here' | 'newPage',
  progress: Progress,
  strategy: Strategy = 'random',
): Promise<CreateSummary> {
  await ensurePermissions();
  const ref = await currentPage();
  const ui = currentLanguage();
  const order = await trainingOrder('capital', strategy);
  const countries = pickCountries(lang, region, count, Math.random, order);
  // Færre land per side på mindre sider (Nomad, A5X), så radene blir høye nok til å skrive i.
  const chunks = splitIntoPages(countries, maxRowsPerPage(ref.size));

  const firstPage = where === 'here' ? ref.page : ref.page + 1;
  const newPages = where === 'here' ? chunks.length - 1 : chunks.length;
  if (newPages > 0) {
    progress(ui.progress.newPages(newPages));
    await insertBlankPages(ref, ref.page + 1, newPages);
  }

  for (const [k, chunk] of chunks.entries()) {
    progress(chunks.length > 1 ? ui.progress.drawingPage(k + 1, chunks.length) : ui.progress.drawing);
    const page = {...ref, page: firstPage + k};
    const title = sheetTitle(lang, region, chunk.length, k + 1, chunks.length);
    await insertDrafts(page, sheetDrafts(ref.size, lang, title, chunk));
  }
  if (firstPage !== ref.page) {
    await jumpToPage(firstPage);
  }
  await saveNote();
  return {countries: countries.length, pages: chunks.length};
}

export interface PageScore {
  part: number;
  points: number;
  total: number;
}

export interface GradeSummary {
  points: number;
  total: number;
  pages: PageScore[];
}

/** Finner overskriften på en side og leser språk og «side k av n». */
function sheetInfo(elements: PageElement[]): SheetInfo | null {
  for (const e of elements) {
    const text = e.type === TYPE_TEXT ? e.textBox?.textContentFull : null;
    const info = text ? parseSheetTitle(text) : null;
    if (info) {
      return info;
    }
  }
  return null;
}

/** Språket arket er skrevet på: overskriften gir kandidatene, landnavnene avgjør. */
function sheetLanguageOf(elements: PageElement[], info: SheetInfo): Language {
  if (info.candidates.length === 1) {
    return info.lang;
  }
  const texts = elements.flatMap(e => (e.type === TYPE_TEXT && e.textBox?.textContentFull ? [e.textBox.textContentFull] : []));
  return pickSheetLanguage(texts, info.candidates);
}

/**
 * Retter siden du står på, eller alle sidene i settet den hører til.
 */
export async function gradeSheet(scope: 'page' | 'set', progress: Progress): Promise<GradeSummary> {
  await ensurePermissions();
  const ui = currentLanguage();
  const ref = await currentPage();
  progress(ui.progress.readingPage);
  const elements = await getPageElements(ref);
  const info = sheetInfo(elements);
  if (!info) {
    throw new Error(ui.errors.noSheet);
  }

  const lang = sheetLanguageOf(elements, info);
  if (scope === 'page' || info.parts === 1) {
    const {points, total} = await gradePage(ref, elements, lang, progress);
    return {points, total, pages: [{part: info.part, points, total}]};
  }

  // Sidene i et sett ligger etter hverandre: side 1 er (nåværende - part + 1).
  const first = ref.page - (info.part - 1);
  const pages: PageScore[] = [];
  for (let k = 0; k < info.parts; k++) {
    const pageIndex = first + k;
    const label = ui.progress.pagePrefix(k + 1, info.parts);
    const pref = pageIndex === ref.page ? ref : await pageRefAt(ref, pageIndex);
    const els = pageIndex === ref.page ? elements : await getPageElements(pref);
    const pinfo = sheetInfo(els);
    if (!pinfo || pinfo.parts !== info.parts || pinfo.part !== k + 1 || !pinfo.candidates.includes(lang)) {
      // Siden er flyttet eller slettet; hopp over den i stedet for å rette feil side.
      continue;
    }
    const {points: p, total: t} = await gradePage(pref, els, lang, m => progress(label + m));
    pages.push({part: k + 1, points: p, total: t});
  }
  const points = pages.reduce((a, p) => a + p.points, 0);
  const total = pages.reduce((a, p) => a + p.total, 0);
  return {points, total, pages};
}

async function gradePage(
  ref: PageRef,
  elements: PageElement[],
  lang: Language,
  progress: Progress,
): Promise<{points: number; total: number; attempts: Attempt[]}> {
  const ui = currentLanguage();
  const texts = elements.filter(e => e.type === TYPE_TEXT && e.textBox?.textContentFull);

  // Landene står i venstre kolonne. Vi finner dem på navn (arkets språk først)
  // og regner ut layouten på nytt. Fasit og resultater skrives på arkets språk.
  const countryBoxes: Array<{country: Country; el: PageElement}> = [];
  for (const e of texts) {
    const c = findCountryByName(e.textBox!.textContentFull!, lang);
    if (c) {
      countryBoxes.push({country: countryIn(lang, c.code), el: e});
    }
  }
  if (!countryBoxes.length) {
    throw new Error(ui.errors.noCountries);
  }
  const version = guessLayoutVersion(
    ref.size,
    countryBoxes.length,
    countryBoxes.map(b => b.el.textBox!.textRect.left),
  );
  const L = computeLayout(ref.size, countryBoxes.length, version);
  const rowCountry: Array<Country | undefined> = L.rows.map(() => undefined);
  for (const {country, el} of countryBoxes) {
    const row = nearestRow(el.textBox!.textRect, L.rows);
    if (row >= 0) {
      rowCountry[row] = country;
    }
  }

  progress(ui.progress.findingInk);
  const strokes = elements.filter(e => e.type === TYPE_STROKE);
  const boxes = (await strokePointsAll(strokes)).map(boxOf);
  const byRow = assignToRows(boxes, L.rows, {left: L.columnX[1], right: L.columnX[2]});

  // Gjenkjenn hele svarkolonnen i ett kall og del på linjeskift.
  const rowsWithInk = rowCountry
    .map((c, i) => (c && byRow[i].length ? i : -1))
    .filter(i => i >= 0);
  let recognizedByRow: Map<number, string> | null = null;
  if (rowsWithInk.length) {
    progress(ui.progress.readingInk);
    const allInk = rowsWithInk.flatMap(i => byRow[i].map(idx => strokes[idx]));
    recognizedByRow = splitByRows(await recognize(allInk, ref.size), rowsWithInk);
  }

  const recognizeRow = async (i: number) => {
    const rowStrokes = byRow[i].map(idx => strokes[idx]);
    return rowStrokes.length ? recognize(rowStrokes, ref.size) : '';
  };

  const graded = [];
  for (const [i, country] of rowCountry.entries()) {
    if (!country) {
      continue;
    }
    let recognized = recognizedByRow?.get(i) ?? '';
    let result = gradeAnswer(country, recognized);
    // Gjenkjenn raden alene hvis samlet lesing ikke lot seg fordele på radene,
    // eller hvis svaret ble vurdert som feil (dobbeltsjekk at det ikke var en feilkobling).
    const needsOwnRead = byRow[i].length > 0 && (!recognizedByRow || result.verdict === 'wrong');
    if (needsOwnRead) {
      progress(ui.progress.rereadingRow(i + 1));
      const own = await recognizeRow(i);
      const ownResult = gradeAnswer(country, own);
      if (!recognizedByRow || ownResult.distance < result.distance) {
        recognized = own;
        result = ownResult;
      }
    }
    graded.push({row: i, country, recognized, result});
  }

  // Fjern resultater fra en tidligere retting, så arket kan rettes på nytt:
  // tekst og merker som ligger inne i resultatkolonnen, pluss poengsummen.
  const resultArea = {
    left: L.columnX[2] + 2,
    right: L.columnX[3] - 2,
    top: L.rows[0].band.top,
    bottom: L.rows[L.rows.length - 1].band.bottom,
  };
  const old = elements
    .filter(e => {
      if (e.type === TYPE_TEXT && e.textBox?.textContentFull) {
        const r = e.textBox.textRect;
        const center = {x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2};
        return inside(center, resultArea) || isResultText(e.textBox.textContentFull);
      }
      if (e.type === TYPE_GEO && e.geometry?.points?.length) {
        return e.geometry.points.every(p => inside(p, resultArea));
      }
      return false;
    })
    .map(e => e.numInPage);
  await deleteElements(ref, old);

  progress(ui.progress.writingResults);
  let points = 0;
  const drafts: Draft[] = [];
  for (const g of graded) {
    if (isPoint(g.result)) {
      points++;
    }
    const kind = resultMark(g.result);
    const {mark, text: textCell} = markLayout(L.rows[g.row].result, kind);
    for (const stroke of markStrokes(kind, mark, g.row + 1)) {
      drafts.push({kind: 'path', points: strokeAsPolygon(stroke), color: markColor(kind), width: MARK_WIDTH});
    }
    const text = resultText(g.country, g.recognized, g.result, lang);
    if (text) {
      drafts.push(cellText(text, textCell, L.fontSize, {bold: g.result.verdict !== 'wrong'}));
    }
  }
  const total = graded.length;
  drafts.push({
    kind: 'text',
    text: lang.sheet.score(points, total),
    rect: L.score,
    fontSize: Math.round(L.fontSize * 1.2),
    bold: true,
    align: 2,
  });
  await insertDrafts(ref, drafts);
  await saveNote();
  const attempts = graded.map(g => ({code: g.country.code, score: verdictScore(g.result.verdict)}));
  await recordResults(ref.notePath, 'capital', attempts);
  return {points, total, attempts};
}

/**
 * Hvor mange land som får plass per side på notatet som er åpent nå.
 * Brukes av menyen til å si hvor mange sider et ark blir. Null hvis ingen notatside er åpen.
 */
export async function rowsPerPageNow(): Promise<number | null> {
  try {
    return maxRowsPerPage((await currentPage()).size);
  } catch {
    return null;
  }
}
