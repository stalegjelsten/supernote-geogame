import {countryIn, findCountryByName, pickSheetLanguage, type Country} from './core/countries';
import {currentLanguage, type Language} from './i18n';
import type {Level} from './core/fairDraw';
import {hotSeatTexts} from './i18n/hotseat';
import {capitalNotes} from './i18n/notes';
import {isNotesText, planNotes} from './core/notes';
import {
  parseGameTag,
  parseRowLabel,
  passFirstPage,
  passPageCount,
  passPageIndex,
  playerAt,
  rowLabel,
  sharedCount,
  sumScores,
  type Game,
  type GameTag,
  type PlayerScore,
} from './core/hotseat';
import {assignToRows, boxOf, nearestRow} from './core/grouping';
import {splitByRows} from './core/lines';
import {isBlankTemplate} from './core/template';
import {inside, markColor, markLayout, markStrokes, strokeAsPolygon} from './core/marks';
import {
  centeredTextRect,
  computeLayout,
  fitFontSize,
  guessLayoutVersion,
  maxRowsPerPage,
  textWidthEm,
  titleFontSize,
  type SheetLayout,
  type Rect,
  type Size,
} from './core/layout';
import {
  gradeAnswer,
  isPoint,
  isResultText,
  parseSheetTitle,
  pickCountries,
  pickFairCountries,
  regionSize,
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
  pageTemplateName,
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
import type {CountryCode} from './data/countries';

/** Stroke width for table lines; see the comment in createSheet. */
const LINE_WIDTH = 200;

/** Stroke width for the grading marks (slightly thicker than the table lines). Never below 200; see LINE_WIDTH. */
const MARK_WIDTH = 300;

export type Progress = (message: string) => void;

/**
 * The order countries should be drawn in for a training mode, or undefined for
 * a plain random draw. Reads the statistics for the skill.
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

/**
 * Saves the results from a graded page. A saving error never stops the grading.
 * `sheetCodes` are all the countries on the page and make up the sheet key; pass them when
 * some countries are left out of `attempts` (unmarked cities on a map), so grading again
 * with other cities marked still replaces the earlier result.
 */
export async function recordResults(
  notePath: string,
  skill: Skill,
  attempts: Attempt[],
  sheetCodes: readonly CountryCode[] = attempts.map(a => a.code),
): Promise<void> {
  if (!attempts.length) {
    return;
  }
  const key = sheetKey(notePath, skill, sheetCodes);
  await saveRecord({skill, time: Date.now(), key, attempts});
}

/**
 * Where a new sheet should be created: on the current page if it is empty and has a white
 * or no template, otherwise on a new page after it.
 */
export async function sheetTarget(): Promise<'here' | 'newPage'> {
  await ensurePermissions();
  const ref = await currentPage();
  if ((await getPageElements(ref)).length > 0) {
    return 'newPage';
  }
  return isBlankTemplate(await pageTemplateName(ref)) ? 'here' : 'newPage';
}

/** Text that is vertically centered in the cell and shrunk until it fits. */
function cellText(
  text: string,
  cell: Rect,
  maxSize: number,
  opts: {bold?: boolean; locked?: boolean; align?: 0 | 1 | 2} = {},
): Draft {
  const fontSize = fitFontSize(text, cell, maxSize);
  return {kind: 'text', text, rect: centeredTextRect(text, cell, fontSize), fontSize, ...opts};
}

/** All the elements for one page of a worksheet. */
function sheetDrafts(
  size: Size,
  lang: Language,
  title: string,
  countries: Country[],
  game?: {tag: GameTag; rowPlayers?: number[]},
): Draft[] {
  const L = computeLayout(size, countries.length);
  const drafts: Draft[] = [];

  // Table lines. All have penWidth 200: with width 100 the device stores each line
  // as ~90 kB (versus ~0.5 kB), and the page is rewritten on every save, so the note
  // grows quickly. Inner lines are set apart with dark gray color instead of a thinner stroke.
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
    fontSize: titleFontSize(title, L.title, Math.round(L.fontSize * 1.4)),
    bold: true,
    locked: true,
  });
  const hs = hotSeatTexts(lang);
  const subtitle = !game
    ? lang.sheet.subtitle
    : game.tag.mode === 'pass'
    ? hs.tablePass(game.tag.player, game.tag.players)
    : hs.tableShared(game.tag.players);
  drafts.push({
    kind: 'text',
    text: subtitle,
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
    // Shared sheet: the number of the player who should answer, at the far left of the answer box.
    const player = game?.rowPlayers?.[i];
    if (player) {
      const a = L.rows[i].answer;
      const cell = {...a, right: a.left + Math.round(L.smallFontSize * 1.2)};
      drafts.push(cellText(rowLabel(player), cell, L.smallFontSize, {bold: true, locked: true}));
    }
  });
  return drafts;
}

/** The page between two players when the device is passed around. */
export function handoverDrafts(size: Size, lang: Language, player: number): Draft[] {
  const hs = hotSeatTexts(lang);
  const L = computeLayout(size, 1);
  const left = L.title.left;
  const right = L.title.right;
  const mid = Math.round(size.height * 0.42);
  const big = Math.round(L.fontSize * 1.8);
  return [
    {
      kind: 'text',
      text: hs.handover(player),
      rect: {left, top: mid, right, bottom: mid + Math.round(big * 1.6)},
      fontSize: big,
      bold: true,
      align: 1,
      locked: true,
    },
    {
      kind: 'text',
      text: hs.handoverHint,
      rect: {left, top: mid + Math.round(big * 1.8), right, bottom: mid + Math.round(big * 1.8 + L.smallFontSize * 2.8)},
      fontSize: L.smallFontSize,
      align: 1,
      locked: true,
    },
  ];
}

export interface CreateSummary {
  countries: number;
  pages: number;
}

/**
 * Creates a worksheet in the language `lang`, spread over several pages if there are more than 20 countries.
 * `strategy` picks the countries (see core/training.ts); 'random' draws at random.
 * @param where 'here' = first page on the current page, the rest on new pages after it;
 *   'newPage' = all pages on new pages right after the current page.
 */
export async function createSheet(
  lang: Language,
  region: Region,
  count: number,
  where: 'here' | 'newPage',
  progress: Progress,
  game?: Game,
  strategy: Strategy = 'random',
  level: Level = 'mixed',
): Promise<CreateSummary> {
  await ensurePermissions();
  const ref = await currentPage();
  const ui = currentLanguage();
  const multi = game && game.players > 1 ? game : undefined;
  const n = multi?.mode === 'shared' ? sharedCount(count, multi.players, regionSize(region)) : count;
  // Taking turns: each player gets their own countries, drawn so everyone gets roughly equally familiar
  // ones (the training mode is not used there, since the players have different statistics).
  const countries =
    multi?.mode === 'shared'
      ? pickFairCountries(lang, region, n, multi.players, Math.random, level)
      : pickCountries(lang, region, n, Math.random, await trainingOrder('capital', strategy), level);
  // Fewer countries per page on smaller pages (Nomad, A5X), so the rows are tall enough to write in.
  const chunks = splitIntoPages(countries, maxRowsPerPage(ref.size));
  if (multi?.mode === 'pass') {
    return createPassGame(ref, lang, region, chunks, multi.players, where, progress);
  }

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
    // Shared sheet: the players take turns, counted over the whole set (page 2 continues where page 1 left off).
    const before = chunks.slice(0, k).reduce((a, c) => a + c.length, 0);
    const shared = multi
      ? {
          tag: {mode: 'shared' as const, player: 0, players: multi.players},
          rowPlayers: chunk.map((_, i) => playerAt(before + i, multi.players)),
        }
      : undefined;
    await insertDrafts(page, sheetDrafts(ref.size, lang, title, chunk, shared));
  }
  if (firstPage !== ref.page) {
    await jumpToPage(firstPage);
  }
  await saveNote();
  return {countries: countries.length, pages: chunks.length};
}

/** Pass around: the same countries for everyone, each player on their own pages, with a "hand over" page in between. */
async function createPassGame(
  ref: PageRef,
  lang: Language,
  region: Region,
  chunks: Country[][],
  players: number,
  where: 'here' | 'newPage',
  progress: Progress,
): Promise<CreateSummary> {
  const ui = currentLanguage();
  const parts = chunks.length;
  const total = passPageCount(players, parts);
  const firstPage = where === 'here' ? ref.page : ref.page + 1;
  const newPages = where === 'here' ? total - 1 : total;
  if (newPages > 0) {
    progress(ui.progress.newPages(newPages));
    await insertBlankPages(ref, ref.page + 1, newPages);
  }
  let drawn = 0;
  for (let p = 1; p <= players; p++) {
    for (const [k, chunk] of chunks.entries()) {
      progress(ui.progress.drawingPage(++drawn, total));
      const page = {...ref, page: passPageIndex(firstPage, p, k + 1, parts)};
      const title = sheetTitle(lang, region, chunk.length, k + 1, parts);
      const tag = {mode: 'pass' as const, player: p, players};
      await insertDrafts(page, sheetDrafts(ref.size, lang, title, chunk, {tag}));
    }
    if (p < players) {
      progress(ui.progress.drawingPage(++drawn, total));
      const page = {...ref, page: passPageIndex(firstPage, p, parts + 1, parts)};
      await insertDrafts(page, handoverDrafts(ref.size, lang, p + 1));
    }
  }
  if (firstPage !== ref.page) {
    await jumpToPage(firstPage);
  }
  await saveNote();
  return {countries: chunks.reduce((a, c) => a + c.length, 0), pages: total};
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
  /** Multiplayer: points per player. */
  players?: PlayerScore[];
  /** Pass around: players for whom no pages were found. */
  missing?: number[];
}

/** Finds the multiplayer label ("Player 2 of 3", "Duel for 2"). */
export function gameTagOf(elements: PageElement[]): GameTag | null {
  for (const e of elements) {
    const text = e.type === TYPE_TEXT ? e.textBox?.textContentFull : null;
    const tag = text ? parseGameTag(text) : null;
    if (tag) {
      return tag;
    }
  }
  return null;
}

/** Finds the heading on a page and reads the language and "page k of n". */
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

/** The language the sheet is written in: the heading gives the candidates, the country names decide. */
function sheetLanguageOf(elements: PageElement[], info: SheetInfo): Language {
  if (info.candidates.length === 1) {
    return info.lang;
  }
  const texts = elements.flatMap(e => (e.type === TYPE_TEXT && e.textBox?.textContentFull ? [e.textBox.textContentFull] : []));
  return pickSheetLanguage(texts, info.candidates);
}

/**
 * Grades the current page, or all the pages in the set it belongs to.
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
  const tag = gameTagOf(elements);
  if (tag?.mode === 'pass' && scope === 'set') {
    return gradePassGame(ref, info, tag, lang, progress);
  }
  if (scope === 'page' || info.parts === 1) {
    const score = await gradePage(ref, elements, lang, progress, tag);
    return {
      points: score.points,
      total: score.total,
      pages: [{part: info.part, points: score.points, total: score.total}],
      players: score.players,
    };
  }

  // The pages in a set follow one another: page 1 is (current - part + 1).
  const first = ref.page - (info.part - 1);
  const pages: PageScore[] = [];
  const playerScores: PlayerScore[] = [];
  for (let k = 0; k < info.parts; k++) {
    const pageIndex = first + k;
    const label = ui.progress.pagePrefix(k + 1, info.parts);
    const pref = pageIndex === ref.page ? ref : await pageRefAt(ref, pageIndex);
    const els = pageIndex === ref.page ? elements : await getPageElements(pref);
    const pinfo = sheetInfo(els);
    if (!pinfo || pinfo.parts !== info.parts || pinfo.part !== k + 1 || !pinfo.candidates.includes(lang)) {
      // The page has been moved or deleted; skip it instead of grading the wrong page.
      continue;
    }
    const score = await gradePage(pref, els, lang, m => progress(label + m), tag);
    pages.push({part: k + 1, points: score.points, total: score.total});
    playerScores.push(...(score.players ?? []));
  }
  const points = pages.reduce((a, p) => a + p.points, 0);
  const total = pages.reduce((a, p) => a + p.total, 0);
  return {points, total, pages, players: tag ? sumScores(playerScores) : undefined};
}

/** Pass around: grades all the players' pages and sums per player. */
async function gradePassGame(
  ref: PageRef,
  info: SheetInfo,
  tag: GameTag,
  lang: Language,
  progress: Progress,
): Promise<GradeSummary> {
  const ui = currentLanguage();
  const first = passFirstPage(ref.page, tag.player, info.part, info.parts);
  const scores: PlayerScore[] = [];
  const pages: PageScore[] = [];
  const missing: number[] = [];
  for (let p = 1; p <= tag.players; p++) {
    let found = false;
    for (let k = 1; k <= info.parts; k++) {
      const pageIndex = passPageIndex(first, p, k, info.parts);
      if (pageIndex < 0) {
        continue;
      }
      let pref: PageRef;
      let els: PageElement[];
      try {
        pref = pageIndex === ref.page ? ref : await pageRefAt(ref, pageIndex);
        els = await getPageElements(pref);
      } catch {
        continue;
      }
      const pinfo = sheetInfo(els);
      const ptag = gameTagOf(els);
      if (
        !pinfo ||
        pinfo.parts !== info.parts ||
        pinfo.part !== k ||
        !pinfo.candidates.includes(lang) ||
        ptag?.mode !== 'pass' ||
        ptag.player !== p ||
        ptag.players !== tag.players
      ) {
        continue;
      }
      const label = `${hotSeatTexts(ui).player(p)} · ` + (info.parts > 1 ? ui.progress.pagePrefix(k, info.parts) : '');
      const score = await gradePage(pref, els, lang, m => progress(label + m));
      scores.push({player: p, points: score.points, max: score.total});
      pages.push({part: k, points: score.points, total: score.total});
      found = true;
    }
    if (!found) {
      missing.push(p);
    }
  }
  const players = sumScores(scores);
  return {
    points: players.reduce((a, s) => a + s.points, 0),
    total: players.reduce((a, s) => a + s.max, 0),
    pages,
    players,
    missing,
  };
}

async function gradePage(
  ref: PageRef,
  elements: PageElement[],
  lang: Language,
  progress: Progress,
  tag?: GameTag | null,
): Promise<{points: number; total: number; players?: PlayerScore[]}> {
  const ui = currentLanguage();
  const texts = elements.filter(e => e.type === TYPE_TEXT && e.textBox?.textContentFull);

  // The countries are in the left column. We find them by name (the sheet's language first)
  // and recompute the layout. The answer key and results are written in the sheet's language.
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

  // Shared sheet: the number in the answer box says which player the row belongs to.
  const rowPlayer: Array<number | undefined> = L.rows.map(() => undefined);
  if (tag?.mode === 'shared') {
    for (const e of texts) {
      const k = parseRowLabel(e.textBox!.textContentFull!, tag.players);
      const r = e.textBox!.textRect;
      if (k && r.left >= L.columnX[1] - 4 && r.right <= L.columnX[2]) {
        const row = nearestRow(r, L.rows);
        if (row >= 0) {
          rowPlayer[row] = k;
        }
      }
    }
  }

  progress(ui.progress.findingInk);
  const strokes = elements.filter(e => e.type === TYPE_STROKE);
  const boxes = (await strokePointsAll(strokes)).map(boxOf);
  const byRow = assignToRows(boxes, L.rows, {left: L.columnX[1], right: L.columnX[2]});

  // Recognize the whole answer column in one call and split on line breaks.
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
    // Recognize the row alone if the combined reading could not be split across the rows,
    // or if the answer was judged wrong (double-check that it was not a mismatch).
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

  // Remove results from an earlier grading, so the sheet can be graded again:
  // text and marks inside the result column, plus the score.
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
        const t = e.textBox.textContentFull;
        return inside(center, resultArea) || isResultText(t) || isNotesText(t);
      }
      if (e.type === TYPE_GEO && e.geometry?.points?.length) {
        return e.geometry.points.every(p => inside(p, resultArea));
      }
      return false;
    })
    .map(e => e.numInPage);
  await deleteElements(ref, old);

  progress(ui.progress.writingResults);
  const points = graded.filter(g => isPoint(g.result)).length;
  const total = graded.length;
  let players: PlayerScore[] | undefined;
  let scoreText = lang.sheet.score(points, total);
  if (tag?.mode === 'shared') {
    players = sumScores(
      graded.map(g => ({
        player: rowPlayer[g.row] ?? playerAt(g.row, tag.players),
        points: isPoint(g.result) ? 1 : 0,
        max: 1,
      })),
    );
    scoreText = `${lang.sheet.scorePrefix} ${hotSeatTexts(lang).scoreLine(players)}`;
  }
  const scoreFont = Math.round(L.fontSize * 1.2);

  // Notes about capitals (mix-ups, multiple capitals) as footnotes at the bottom.
  const noteTexts = capitalNotes(lang);
  const noteItems = graded.flatMap(g => {
    const note = noteTexts[g.country.code];
    return note ? [{row: g.row, text: note, important: g.result.verdict !== 'correct'}] : [];
  });
  const notes = noteItems.length ? planNotes(noteItems, notesArea(L, ref.size, scoreText, scoreFont), L.smallFontSize, NOTE_MIN_FONT) : null;

  const drafts: Draft[] = [];
  for (const g of graded) {
    const kind = resultMark(g.result);
    const {mark, text: textCell} = markLayout(L.rows[g.row].result, kind);
    for (const stroke of markStrokes(kind, mark, g.row + 1)) {
      drafts.push({kind: 'path', points: strokeAsPolygon(stroke), color: markColor(kind), width: MARK_WIDTH});
    }
    const marker = notes?.markers.get(g.row);
    const base = resultText(g.country, g.recognized, g.result, lang);
    // The footnote number goes after the capital (first line), or alone for a correct answer.
    const text = marker ? (base ? base.replace(/^([^\n]*)/, `$1 ${marker}`) : marker) : base;
    if (text) {
      drafts.push(cellText(text, textCell, L.fontSize, {bold: g.result.verdict !== 'wrong'}));
    }
  }
  if (notes) {
    drafts.push({kind: 'text', text: notes.text, rect: notes.rect, fontSize: notes.fontSize, align: 0});
  }
  drafts.push({
    kind: 'text',
    text: scoreText,
    rect: L.score,
    fontSize: scoreFont,
    bold: true,
    align: 2,
  });
  await insertDrafts(ref, drafts);
  await saveNote();
  // Statistics only for a single player; on multiplayer sheets the answers belong to several.
  if (!tag) {
    const attempts = graded.map(g => ({code: g.country.code, score: verdictScore(g.result.verdict)}));
    await recordResults(ref.notePath, 'capital', attempts);
  }
  return {points, total, players};
}

/** Smallest font size for the footnotes (about 1.7 mm on Manta). */
const NOTE_MIN_FONT = 20;

/**
 * The space for the footnotes: to the left of the score and down toward the bottom of the page.
 * If it becomes too narrow next to the score (long score line on multiplayer sheets),
 * the space below it is used instead.
 */
function notesArea(L: SheetLayout, size: Size, scoreText: string, scoreFont: number): Rect {
  const bottom = Math.round(size.height * 0.985);
  const width = L.score.right - L.score.left;
  const besideRight = Math.round(L.score.right - textWidthEm(scoreText) * scoreFont - L.fontSize);
  if (besideRight - L.score.left >= width * 0.45) {
    return {left: L.score.left, top: L.score.top, right: besideRight, bottom};
  }
  return {left: L.score.left, top: L.score.bottom, right: L.score.right, bottom};
}

/**
 * How many countries fit per page on the note that is open now.
 * Used by the menu to say how many pages a sheet will be. Null if no note page is open.
 */
export async function rowsPerPageNow(): Promise<number | null> {
  try {
    return maxRowsPerPage((await currentPage()).size);
  } catch {
    return null;
  }
}
