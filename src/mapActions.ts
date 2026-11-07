/**
 * Kartmodus på siden: lage et kartark og rette det.
 * Logikken ligger i src/core/mapSheet.ts; her er bare lesing og skriving.
 */
import type {Language} from './i18n';
import {currentLanguage} from './i18n';
import {MAP_TOTAL_PREFIXES, mapTexts} from './i18n/map';
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
  pickMapCountries,
  type MapEntry,
  type MapEntryStyle,
  type MapTarget,
  type MapSheetInfo,
} from './core/mapSheet';
import type {Region} from './core/sheet';
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
  saveNote,
  strokePointsAll,
  type PageElement,
} from './sdk/notes';

export type Progress = (message: string) => void;

async function mapPicturePath(region: Region): Promise<string> {
  // MAP_ASSETS sørger for at bildene er med i bundelen (se mapAssets.ts).
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
  /** Antall byer (se MAP_COUNTS). */
  count: number;
  /** Hva lista oppgir: by og land, bare byen eller bare landet. */
  style: MapEntryStyle;
  /** Hva som skal merkes: hovedsteder (poeng etter avstand) eller land (riktig/galt). */
  target: MapTarget;
}

/** Lager et kartark på denne siden eller en ny side etter den. */
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
): Promise<{count: number}> {
  await ensurePermissions();
  const ui = currentLanguage();
  const ref = await currentPage();
  const path = await mapPicturePath(region);
  const countries = pickMapCountries(lang, region, options.count);
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
    ),
  );
  if (page.page !== ref.page) {
    await jumpToPage(page.page);
  }
  await saveNote();
  return {count: countries.length};
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

/** Er dette et kartark? Brukes av menyen for å velge riktig retting. */
export function isMapSheet(elements: PageElement[]): boolean {
  return mapInfo(elements) !== null;
}

/** Kartbildets faktiske plassering. Faller tilbake på layouten hvis bildet ikke finnes som element. */
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
  /** Poeng (hovedsteder) eller antall riktige (land). */
  points: number;
  max: number;
  target: MapTarget;
}

/**
 * Retter kartarket på siden du står på. Returnerer null hvis siden ikke er et kartark.
 */
export async function gradeMapSheet(
  progress: Progress,
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
  const {lang, region, target} = info;
  const t = mapTexts(lang);

  // Lista: «3. Oslo (Norge)».
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

  // Fjern resultater fra en tidligere retting: geometri og tekst på kartet,
  // poengtekster og haker/kryss i lista, totalsummen og merknaden.
  // Rutene foran navnene ligger utenfor poengcellene og blir stående.
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

  progress(ui.progress.writingResults);
  await insertDrafts(ref, grade.drafts);
  await saveNote();
  return {points: grade.points, max: grade.max, target};
}
