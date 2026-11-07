/**
 * Outline mode on the page: creating an outline sheet and grading it.
 * The logic is in src/core/outlineSheet.ts; here it is only reading and writing.
 */
import type {Language} from './i18n';
import {currentLanguage} from './i18n';
import {countryIn} from './core/countries';
import {boxOf} from './core/grouping';
import {inside} from './core/marks';
import {isResultText} from './core/sheet';
import {verdictScore} from './core/stats';
import type {Strategy} from './core/training';
import {
  DEFAULT_OUTLINE_OPTIONS,
  OUTLINE_SCORE_PREFIXES,
  gradeCountryName,
  outlineLayout,
  outlineResultDrafts,
  outlineSheetDrafts,
  parseOutlineKey,
  pickOutlineCountries,
  randomAngle,
  type GradedCell,
  type OutlineOptions,
  type OutlineSheetInfo,
} from './core/outlineSheet';
import type {Region} from './core/sheet';
import {recordResults, trainingOrder} from './actions';
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

/** Creates an outline sheet on this page or on a new page after it. */
export async function createOutlineSheet(
  lang: Language,
  region: Region,
  where: 'here' | 'newPage',
  progress: Progress,
  options: OutlineOptions = DEFAULT_OUTLINE_OPTIONS,
  strategy: Strategy = 'random',
): Promise<{count: number}> {
  await ensurePermissions();
  const ui = currentLanguage();
  const ref = await currentPage();
  const countries = pickOutlineCountries(
    lang,
    region,
    options.count,
    Math.random,
    await trainingOrder('outline', strategy),
    options.level,
  );
  const placements = countries.map(c => ({code: c.code, angle: randomAngle(options.rotation)}));
  let page = ref;
  if (where === 'newPage') {
    progress(ui.progress.newPages(1));
    await insertBlankPages(ref, ref.page + 1, 1);
    page = {...ref, page: ref.page + 1};
  }
  progress(ui.progress.drawing);
  await insertDrafts(page, outlineSheetDrafts(page.size, lang, region, placements, options));
  if (page.page !== ref.page) {
    await jumpToPage(page.page);
  }
  await saveNote();
  return {count: countries.length};
}

function outlineInfo(elements: PageElement[]): OutlineSheetInfo | null {
  for (const e of elements) {
    const text = e.type === TYPE_TEXT ? e.textBox?.textContentFull : null;
    const info = text ? parseOutlineKey(text) : null;
    if (info) {
      return info;
    }
  }
  return null;
}

export interface OutlineGradeSummary {
  correct: number;
  total: number;
}

/** Grades the outline sheet on the current page. Returns null if the page is not an outline sheet. */
export async function gradeOutlineSheet(progress: Progress): Promise<OutlineGradeSummary | null> {
  await ensurePermissions();
  const ui = currentLanguage();
  const ref = await currentPage();
  progress(ui.progress.readingPage);
  const elements = await getPageElements(ref);
  const info = outlineInfo(elements);
  if (!info) {
    return null;
  }
  const {lang, codes} = info;
  const L = outlineLayout(ref.size, codes.length);

  // The handwriting in each cell: every stroke whose middle is inside the cell.
  progress(ui.progress.findingInk);
  const strokes = elements.filter(e => e.type === TYPE_STROKE);
  const boxes = (await strokePointsAll(strokes)).map(boxOf);
  const byCell: PageElement[][] = L.cells.map(() => []);
  boxes.forEach((b, i) => {
    if (!b) {
      return;
    }
    const c = {x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2};
    const k = L.cells.findIndex(cell => inside(c, cell.band));
    if (k >= 0) {
      byCell[k].push(strokes[i]);
    }
  });

  progress(ui.progress.readingInk);
  const graded: GradedCell[] = [];
  for (const [k, code] of codes.entries()) {
    const country = countryIn(lang, code);
    const recognized = byCell[k].length ? await recognize(byCell[k], ref.size) : '';
    graded.push({index: k, country, recognized, result: gradeCountryName(country, recognized, lang)});
  }

  // Remove results from an earlier grading: marks and text in the result strips, and the score.
  const old = elements
    .filter(e => {
      if (e.type === TYPE_TEXT && e.textBox?.textContentFull) {
        const r = e.textBox.textRect;
        const c = {x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2};
        const s = e.textBox.textContentFull;
        return (
          L.cells.some(cell => inside(c, cell.result)) ||
          OUTLINE_SCORE_PREFIXES.some(p => s.startsWith(p)) ||
          isResultText(s)
        );
      }
      if (e.type === TYPE_GEO && e.geometry?.points?.length) {
        const pts = e.geometry.points;
        return L.cells.some(cell => pts.every(p => inside(p, cell.result)));
      }
      return false;
    })
    .map(e => e.numInPage);
  await deleteElements(ref, old);

  progress(ui.progress.writingResults);
  await insertDrafts(ref, outlineResultDrafts(ref.size, lang, graded, codes.length));
  await saveNote();
  await recordResults(
    ref.notePath,
    'outline',
    graded.map(g => ({code: g.country.code, score: verdictScore(g.result.verdict)})),
  );
  const correct = graded.filter(g => g.result.verdict === 'correct' || g.result.verdict === 'close').length;
  return {correct, total: codes.length};
}
