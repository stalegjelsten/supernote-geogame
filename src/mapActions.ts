/**
 * Map mode on the page: creating a map sheet and grading it.
 * The logic is in src/core/mapSheet.ts; here it is only reading and writing.
 */
import type {Language} from './i18n';
import {currentLanguage} from './i18n';
import {MAP_TOTAL_PREFIXES, mapTexts} from './i18n/map';
import {hotSeatTexts} from './i18n/hotseat';
import {gameTagOf, handoverDrafts} from './actions';
import {
  passFirstPage,
  passPageCount,
  passPageIndex,
  playerAt,
  sharedCount,
  sumScores,
  type Game,
  type GameTag,
  type PlayerScore,
} from './core/hotseat';
import {MAX_POINTS} from './core/scoring';
import type {Rect} from './core/layout';
import {inside, type Point} from './core/marks';
import {
  MAP_SHEET_COUNT,
  gradeMap,
  mapAssetName,
  mapLayoutFor,
  mapMeta,
  mapSheetDrafts,
  parseEntry,
  parseMapTitle,
  pickFairMapCountries,
  pickMapCountries,
  type MapEntry,
  type MapEntryStyle,
  type MapTarget,
  type MapSheetInfo,
} from './core/mapSheet';
import type {Region} from './core/sheet';
import type {Level} from './core/fairDraw';
import {MAP_ASSETS} from './sdk/mapAssets';
import {
  TYPE_GEO,
  TYPE_PICTURE,
  TYPE_STROKE,
  TYPE_TEXT,
  bundledImagePath,
  currentPage,
  deleteElements,
  ensurePermissions,
  getPageElements,
  insertBlankPages,
  insertDrafts,
  jumpToPage,
  pageRefAt,
  saveNote,
  strokePointsAll,
  type PageElement,
  type PageRef,
} from './sdk/notes';
import {recordResults, trainingOrder} from './actions';
import {mapPointsScore, type Attempt, type Skill} from './core/stats';
import type {Strategy} from './core/training';

/** The skill a map sheet practices. */
export const skillOfTarget = (target: MapTarget): Skill =>
  target === 'country' ? 'mapCountry' : 'mapCapital';

export type Progress = (message: string) => void;

async function mapPicturePath(region: Region): Promise<string> {
  // MAP_ASSETS makes sure the images are included in the bundle (see mapAssets.ts).
  const file = mapMeta(region).file as keyof typeof MAP_ASSETS;
  try {
    if (!MAP_ASSETS[file]) {
      throw new Error(file);
    }
    return await bundledImagePath(mapAssetName(region));
  } catch (e) {
    throw new Error(
      mapTexts(currentLanguage()).errors.mapFile((e as Error).message),
    );
  }
}

export interface MapSheetOptions {
  /** Number of cities (see MAP_COUNTS). */
  count: number;
  /** What the list gives: city and country, only the city, or only the country. */
  style: MapEntryStyle;
  /** What should be marked: capitals (points by distance) or countries (right/wrong). */
  target: MapTarget;
  /** Level by familiarity; mixed if not specified. */
  level?: Level;
  /** How the countries are chosen (see core/training.ts). Default: random. */
  strategy?: Strategy;
}

/** Creates a map sheet on this page or on a new page after it. */
export async function createMapSheet(
  lang: Language,
  region: Region,
  where: 'here' | 'newPage',
  progress: Progress,
  options: MapSheetOptions = {
    count: MAP_SHEET_COUNT,
    style: 'both',
    target: 'capital',
  },
  game?: Game,
): Promise<{count: number; pages: number}> {
  await ensurePermissions();
  const ui = currentLanguage();
  const ref = await currentPage();
  const path = await mapPicturePath(region);
  const multi = game && game.players > 1 ? game : undefined;
  const count =
    multi?.mode === 'shared'
      ? sharedCount(options.count, multi.players)
      : options.count;
  // Taking turns: fair draw (the training mode is for a single player and is not used there).
  const countries =
    multi?.mode === 'shared'
      ? pickFairMapCountries(
          lang,
          region,
          count,
          multi.players,
          options.target,
          Math.random,
          undefined,
          options.level,
        )
      : pickMapCountries(
          lang,
          region,
          count,
          Math.random,
          undefined,
          await trainingOrder(
            skillOfTarget(options.target),
            options.strategy ?? 'random',
          ),
          options.level,
          options.target,
        );
  if (multi?.mode === 'pass') {
    return createPassMapGame(ref, lang, region, countries, path, options, multi.players, where, progress);
  }
  const tag: GameTag | undefined = multi
    ? {mode: 'shared', player: 0, players: multi.players}
    : undefined;
  let page = ref;
  if (where === 'newPage') {
    progress(ui.progress.newPages(1));
    await insertBlankPages(ref, ref.page + 1, 1);
    page = {...ref, page: ref.page + 1};
  }
  progress(ui.progress.drawing);
  await insertDrafts(
    page,
    mapSheetDrafts(
      page.size,
      lang,
      region,
      countries,
      path,
      options.style,
      options.target,
      tag,
    ),
  );
  if (page.page !== ref.page) {
    await jumpToPage(page.page);
  }
  await saveNote();
  return {count: countries.length, pages: 1};
}

/** Pass around: one map sheet per player with the same cities, and a "hand over" page in between. */
async function createPassMapGame(
  ref: PageRef,
  lang: Language,
  region: Region,
  countries: ReturnType<typeof pickMapCountries>,
  path: string,
  options: MapSheetOptions,
  players: number,
  where: 'here' | 'newPage',
  progress: Progress,
): Promise<{count: number; pages: number}> {
  const ui = currentLanguage();
  const total = passPageCount(players, 1);
  const first = where === 'here' ? ref.page : ref.page + 1;
  const newPages = where === 'here' ? total - 1 : total;
  if (newPages > 0) {
    progress(ui.progress.newPages(newPages));
    await insertBlankPages(ref, ref.page + 1, newPages);
  }
  let drawn = 0;
  for (let p = 1; p <= players; p++) {
    progress(ui.progress.drawingPage(++drawn, total));
    const page = {...ref, page: passPageIndex(first, p, 1, 1)};
    const tag: GameTag = {mode: 'pass', player: p, players};
    await insertDrafts(
      page,
      mapSheetDrafts(page.size, lang, region, countries, path, options.style, options.target, tag),
    );
    if (p < players) {
      progress(ui.progress.drawingPage(++drawn, total));
      await insertDrafts({...ref, page: passPageIndex(first, p, 2, 1)}, handoverDrafts(ref.size, lang, p + 1));
    }
  }
  if (first !== ref.page) {
    await jumpToPage(first);
  }
  await saveNote();
  return {count: countries.length, pages: total};
}

function mapInfo(elements: PageElement[]): MapSheetInfo | null {
  for (const e of elements) {
    const text = e.type === TYPE_TEXT ? e.textBox?.textContentFull : null;
    const info = text ? parseMapTitle(text) : null;
    if (info) {
      return info;
    }
  }
  return null;
}

/** Is this a map sheet? Used by the menu to choose the right grading. */
export function isMapSheet(elements: PageElement[]): boolean {
  return mapInfo(elements) !== null;
}

/** The actual placement of the map image. Falls back to the layout if the image does not exist as an element. */
function findMapRect(
  elements: PageElement[],
  region: Region,
  fallback: Rect,
): Rect {
  const file = mapAssetName(region);
  const pictures = elements.filter(
    e => e.type === TYPE_PICTURE && e.picture?.rect,
  );
  const area = (r: Rect) => (r.right - r.left) * (r.bottom - r.top);
  const named = pictures.find(e => e.picture!.picturePath?.endsWith(file));
  const biggest = [...pictures].sort(
    (a, b) => area(b.picture!.rect) - area(a.picture!.rect),
  )[0];
  const pic = named ?? biggest;
  return pic && area(pic.picture!.rect) > 0 ? pic.picture!.rect : fallback;
}

const centerOf = (r: Rect): Point => ({
  x: (r.left + r.right) / 2,
  y: (r.top + r.bottom) / 2,
});

function boxCenter(points: Point[]): Point | null {
  if (!points.length) {
    return null;
  }
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  return {
    x: (Math.min(...xs) + Math.max(...xs)) / 2,
    y: (Math.min(...ys) + Math.max(...ys)) / 2,
  };
}

export interface MapGradeSummary {
  /** Points (capitals) or number of correct (countries). */
  points: number;
  max: number;
  target: MapTarget;
  /** Multiplayer: points per player. */
  players?: PlayerScore[];
  /** Pass around: players whose map sheet was not found. */
  missing?: number[];
}

/**
 * Grades the map sheet on the current page. Returns null if the page is not a map sheet.
 * @param scope 'set' grades all the players' map sheets when the device has been passed around.
 */
export async function gradeMapSheet(
  progress: Progress,
  scope: 'page' | 'set' = 'page',
): Promise<MapGradeSummary | null> {
  await ensurePermissions();
  const ui = currentLanguage();
  const ref = await currentPage();
  progress(ui.progress.readingPage);
  const elements = await getPageElements(ref);
  const info = mapInfo(elements);
  if (!info) {
    return null;
  }
  const tag = gameTagOf(elements);
  if (tag?.mode === 'pass' && scope === 'set') {
    return gradePassMapGame(ref, info, tag, progress);
  }
  return gradeMapPage(ref, elements, info, tag, progress);
}

async function gradePassMapGame(
  ref: PageRef,
  info: MapSheetInfo,
  tag: GameTag,
  progress: Progress,
): Promise<MapGradeSummary> {
  const ui = currentLanguage();
  const first = passFirstPage(ref.page, tag.player, 1, 1);
  const scores: PlayerScore[] = [];
  const missing: number[] = [];
  for (let p = 1; p <= tag.players; p++) {
    const pageIndex = passPageIndex(first, p, 1, 1);
    try {
      if (pageIndex < 0) {
        throw new Error('page');
      }
      const pref = pageIndex === ref.page ? ref : await pageRefAt(ref, pageIndex);
      const elements = await getPageElements(pref);
      const pinfo = mapInfo(elements);
      const ptag = gameTagOf(elements);
      if (
        !pinfo ||
        pinfo.region !== info.region ||
        pinfo.target !== info.target ||
        ptag?.mode !== 'pass' ||
        ptag.player !== p ||
        ptag.players !== tag.players
      ) {
        throw new Error('page');
      }
      const prefix = `${hotSeatTexts(ui).player(p)} · `;
      const g = await gradeMapPage(pref, elements, pinfo, null, m => progress(prefix + m));
      scores.push({player: p, points: g.points, max: g.max});
    } catch {
      missing.push(p);
    }
  }
  const players = sumScores(scores);
  return {
    points: players.reduce((a, s) => a + s.points, 0),
    max: players.reduce((a, s) => a + s.max, 0),
    target: info.target,
    players,
    missing,
  };
}

async function gradeMapPage(
  ref: PageRef,
  elements: PageElement[],
  info: MapSheetInfo,
  tag: GameTag | null,
  progress: Progress,
): Promise<MapGradeSummary> {
  const ui = currentLanguage();
  const {lang, region, target} = info;
  const t = mapTexts(lang);

  // The list: "3. Oslo (Norway)".
  const entries: MapEntry[] = [];
  for (const e of elements) {
    const text = e.type === TYPE_TEXT ? e.textBox?.textContentFull : null;
    const parsed = text ? parseEntry(text, lang) : null;
    if (parsed && !entries.some(x => x.n === parsed.n)) {
      entries.push(parsed);
    }
  }
  if (!entries.length) {
    throw new Error(mapTexts(ui).errors.noEntries);
  }
  const count = Math.max(...entries.map(e => e.n));
  const L = mapLayoutFor(ref.size, region, count);
  progress(mapTexts(ui).progress.findingMap);
  const mapRect = findMapRect(elements, region, L.map);

  progress(mapTexts(ui).progress.findingMarks);
  const strokes = elements
    .filter(e => e.type === TYPE_STROKE)
    .sort((a, b) => a.numInPage - b.numInPage);
  const points = await strokePointsAll(strokes);
  const mapStrokes: Point[][] = [];
  const skipped: boolean[] = Array.from({length: count}, () => false);
  points.forEach(pts => {
    const c = boxCenter(pts);
    if (!c) {
      return;
    }
    if (inside(c, mapRect)) {
      mapStrokes.push(pts);
      return;
    }
    const k = L.entries.findIndex(en => inside(c, en.band));
    if (k >= 0) {
      skipped[k] = true;
    }
  });

  const grade = gradeMap(
    ref.size,
    lang,
    region,
    mapRect,
    entries,
    mapStrokes,
    skipped,
    target,
  );

  // Remove results from an earlier grading: geometry and text on the map,
  // score texts and checks/crosses in the list, the total and the note.
  // The boxes in front of the names are outside the score cells and are left in place.
  const pad = 6;
  const mapArea = {
    left: mapRect.left - pad,
    top: mapRect.top - pad,
    right: mapRect.right + pad,
    bottom: mapRect.bottom + pad,
  };
  const resultCells = [...L.entries.map(en => en.points), L.total, L.note];
  const old = elements
    .filter(e => {
      if (e.type === TYPE_GEO && e.geometry?.points?.length) {
        const pts = e.geometry.points;
        return (
          pts.every(p => inside(p, mapArea)) ||
          L.entries.some(en => pts.every(p => inside(p, en.points)))
        );
      }
      if (e.type === TYPE_TEXT && e.textBox?.textContentFull) {
        const c = centerOf(e.textBox.textRect);
        const s = e.textBox.textContentFull;
        return (
          inside(c, mapRect) ||
          resultCells.some(cell => inside(c, cell)) ||
          MAP_TOTAL_PREFIXES.some(prefix => s.startsWith(prefix)) ||
          s.startsWith(t.totalPrefix) ||
          s.startsWith(t.countryTotalPrefix)
        );
      }
      return false;
    })
    .map(e => e.numInPage);
  await deleteElements(ref, old);

  // Shared sheet: the players took the cities in turn (no. 1 = player 1, no. 2 = player 2 …).
  let players: PlayerScore[] | undefined;
  let drafts = grade.drafts;
  if (tag?.mode === 'shared') {
    const countryMode = target === 'country';
    players = sumScores(
      grade.results.map(r => ({
        player: playerAt(r.n - 1, tag.players),
        points: countryMode ? (r.correct ? 1 : 0) : r.points,
        max: countryMode ? 1 : MAX_POINTS,
      })),
    );
    const totalText = countryMode
      ? t.countryTotal(grade.points, grade.max)
      : t.total(grade.points, grade.max);
    const prefix = countryMode ? t.countryTotalPrefix : t.totalPrefix;
    const line = `${prefix} ${hotSeatTexts(lang).scoreLine(players)}`;
    drafts = drafts.map(d =>
      d.kind === 'text' && d.text === totalText ? {...d, text: line} : d,
    );
  }

  progress(ui.progress.writingResults);
  await insertDrafts(ref, drafts);
  await saveNote();
  // Statistics: cities that were skipped count as "could not";
  // cities without a mark are not included (the mark may have fallen outside the map).
  const attempts: Attempt[] = grade.results.flatMap(r =>
    r.assignment.kind === 'missing'
      ? []
      : [
          {
            code: r.country.code,
            score:
              target === 'country'
                ? r.correct
                  ? 1
                  : 0
                : mapPointsScore(r.points),
          },
        ],
  );
  // Statistics only for a single player; on multiplayer sheets the answers belong to several.
  if (!tag) {
    await recordResults(
      ref.notePath,
      skillOfTarget(target),
      attempts,
      grade.results.map(r => r.country.code),
    );
  }
  return {points: grade.points, max: grade.max, target, players};
}
