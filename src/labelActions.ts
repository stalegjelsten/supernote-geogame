/**
 * Label mode on the page: creating a "name the countries on the map" sheet and grading it.
 * The logic is in src/core/labelSheet.ts; here it is only reading and writing.
 */
import type {Language} from './i18n';
import {currentLanguage} from './i18n';
import {countryIn} from './core/countries';
import type {Level} from './core/fairDraw';
import {boxOf} from './core/grouping';
import {
  LABEL_COUNTS,
  LABEL_DEFAULT_COUNT,
  gradeLabel,
  labelColumns,
  labelCountsFor,
  labelLayout,
  labelResultDrafts,
  labelSeparation,
  labelStyleFor,
  labelSheetDrafts,
  parseLabelKey,
  pickLabelCountries,
  type GradedLabel,
  type LabelSheetInfo,
} from './core/labelSheet';
import {splitByRows} from './core/lines';
import {inside} from './core/marks';
import {isResultText} from './core/sheet';
import type {Region} from './core/sheet';
import {newSheetId} from './core/sheetId';
import type {Strategy} from './core/training';
import {labelTexts} from './i18n/label';
import {answeredOnly, recordResults, trainingOrder} from './actions';
import {mapPicturePath} from './mapActions';
import {
  TYPE_GEO,
  TYPE_STROKE,
  TYPE_TEXT,
  currentPage,
  deleteElements,
  ensurePermissions,
  getPageElements,
  insertBlankPages,
  insertDrafts,
  jumpToPage,
  recognize,
  saveNote,
  strokePointsAll,
  type PageElement,
} from './sdk/notes';

export type Progress = (message: string) => void;

/** The statistics: naming a country from where it lies on the map is a skill of its own. */
const SKILL = 'label' as const;

export interface LabelOptions {
  count: number;
  level?: Level;
}

/** Creates a label sheet on this page or on a new page after it. */
export async function createLabelSheet(
  lang: Language,
  region: Region,
  where: 'here' | 'newPage',
  progress: Progress,
  options: LabelOptions = {count: LABEL_DEFAULT_COUNT},
  strategy: Strategy = 'random',
): Promise<{count: number}> {
  await ensurePermissions();
  const ui = currentLanguage();
  const ref = await currentPage();
  const path = await mapPicturePath(region);
  // The menu offers only what fits the page, but a sheet made from an older menu is capped too.
  const count = Math.min(options.count, Math.max(...labelCountsFor(ref.size)));
  const countries = pickLabelCountries(
    lang,
    region,
    count,
    Math.random,
    await trainingOrder(SKILL, strategy),
    options.level,
    labelSeparation(ref.size),
  );
  let page = ref;
  if (where === 'newPage') {
    progress(ui.progress.newPages(1));
    await insertBlankPages(ref, ref.page + 1, 1);
    page = {...ref, page: ref.page + 1};
  }
  progress(ui.progress.drawing);
  await insertDrafts(
    page,
    labelSheetDrafts(
      page.size,
      lang,
      region,
      countries.map(c => c.code),
      path,
      newSheetId(),
    ),
    // The dots and numbers are drawn where the map should be.
    {exactPictures: true},
  );
  if (page.page !== ref.page) {
    await jumpToPage(page.page);
  }
  await saveNote();
  return {count: countries.length};
}

function labelInfo(elements: PageElement[]): LabelSheetInfo | null {
  for (const e of elements) {
    const text = e.type === TYPE_TEXT ? e.textBox?.textContentFull : null;
    const info = text ? parseLabelKey(text) : null;
    if (info) {
      return info;
    }
  }
  return null;
}

/** The choices of number of countries for the page that is open now (all of them if unknown). */
export async function labelCountsNow(): Promise<number[]> {
  try {
    return labelCountsFor((await currentPage()).size);
  } catch {
    return [...LABEL_COUNTS];
  }
}

export interface LabelGradeSummary {
  correct: number;
  total: number;
}

/** Grades the label sheet on the current page. Returns null if the page is not a label sheet. */
export async function gradeLabelSheet(
  progress: Progress,
): Promise<LabelGradeSummary | null> {
  await ensurePermissions();
  const ui = currentLanguage();
  const ref = await currentPage();
  progress(ui.progress.readingPage);
  const elements = await getPageElements(ref);
  const info = labelInfo(elements);
  if (!info) {
    return null;
  }
  const {lang, region, codes} = info;
  // The layout the sheet was drawn with, also for sheets made under older rules.
  const style = labelStyleFor(ref.size, info.version);
  const L = labelLayout(ref.size, region, codes, style, info.wide);

  // The handwriting in each box: every stroke whose middle is in the box's band.
  progress(ui.progress.findingInk);
  const strokes = elements.filter(e => e.type === TYPE_STROKE);
  const boxes = (await strokePointsAll(strokes)).map(boxOf);
  const bySlot: PageElement[][] = L.slots.map(() => []);
  boxes.forEach((b, i) => {
    if (!b) {
      return;
    }
    const c = {x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2};
    const k = L.slots.findIndex(s => inside(c, s.band));
    if (k >= 0) {
      bySlot[k].push(strokes[i]);
    }
  });

  // As on the table sheet: each recognition call costs a lot of time on the device, so each
  // column of lines is read in one call and split on the line breaks. A line is read on its
  // own only if the column could not be split, or if its answer came out wrong. A name written
  // on two lines is always read on its own, since its line break is not between two names.
  progress(ui.progress.readingInk);
  const combined = new Map<number, string>();
  for (const column of labelColumns(L)) {
    const withInk = column.filter(k => bySlot[k].length && (L.slots[k].lines ?? 1) === 1);
    if (!withInk.length) {
      continue;
    }
    const lines = splitByRows(
      await recognize(
        withInk.flatMap(k => bySlot[k]),
        ref.size,
      ),
      withInk,
    );
    lines?.forEach((text, k) => combined.set(k, text));
  }
  const graded: GradedLabel[] = [];
  for (const [k, code] of codes.entries()) {
    const country = countryIn(lang, code);
    let recognized = combined.get(k) ?? '';
    let result = gradeLabel(country, recognized, lang);
    if (bySlot[k].length && (!combined.has(k) || result.verdict === 'wrong')) {
      progress(ui.progress.rereadingRow(k + 1));
      // The two lines of a long name are one name.
      const own = (await recognize(bySlot[k], ref.size)).replace(/\s+/g, ' ').trim();
      const ownResult = gradeLabel(country, own, lang);
      if (!combined.has(k) || ownResult.distance < result.distance) {
        recognized = own;
        result = ownResult;
      }
    }
    graded.push({index: k, country, recognized, result});
  }

  // Remove results from an earlier grading: marks and text in the result strips, and the score.
  const scorePrefix = labelTexts(lang).scorePrefix;
  const old = elements
    .filter(e => {
      if (e.type === TYPE_TEXT && e.textBox?.textContentFull) {
        const r = e.textBox.textRect;
        const c = {x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2};
        const s = e.textBox.textContentFull;
        return (
          L.slots.some(slot => inside(c, slot.result)) ||
          s.startsWith(scorePrefix) ||
          isResultText(s)
        );
      }
      if (e.type === TYPE_GEO && e.geometry?.points?.length) {
        const pts = e.geometry.points;
        // The writing line lies on the top edge of the result strip (box.bottom) and stays.
        return L.slots.some(slot => pts.every(p => p.y > slot.result.top && inside(p, slot.result)));
      }
      return false;
    })
    .map(e => e.numInPage);
  await deleteElements(ref, old);

  progress(ui.progress.writingResults);
  await insertDrafts(
    ref,
    labelResultDrafts(ref.size, lang, region, codes, graded, style, info.wide),
  );
  await saveNote();
  await recordResults(
    ref.notePath,
    SKILL,
    answeredOnly(graded, g => bySlot[g.index].length > 0),
    codes,
    info.sheetId,
  );
  const correct = graded.filter(
    g => g.result.verdict === 'correct' || g.result.verdict === 'close',
  ).length;
  return {correct, total: codes.length};
}
