/**
 * Placement of the worksheet on the page, in Android pixels.
 *
 * Everything is proportional to the page size, so the same code works on
 * Manta (1920×2560), Nomad and A5X (1404×1872) and A6X. Margins and row height also have
 * a minimum in pixels: Nomad has the same pixel density as Manta (~300 ppi),
 * so the toolbar is just as many pixels wide there, but the page is much smaller.
 * Both "New sheet" and "Correct sheet" use this function, so the rows
 * are always where grading expects them.
 */

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface SheetLayout {
  title: Rect;
  subtitle: Rect;
  /** x positions for vertical lines: left edge, column divider, right edge. */
  columnX: [number, number, number, number];
  /** y positions for horizontal lines, from the top of the heading row. */
  lineY: number[];
  header: {country: Rect; answer: Rect; result: Rect};
  rows: Array<{country: Rect; answer: Rect; result: Rect; band: {top: number; bottom: number}}>;
  score: Rect;
  fontSize: number;
  smallFontSize: number;
}

const r = (v: number) => Math.round(v);

/**
 * Layout versions. Correction must compute exactly the same layout the sheet was made with,
 * so old versions are kept and recognized from where the country names are (see guessLayoutVersion).
 *  1: 6 % side margin (up to and including 0.6.2).
 *  2: Safe margins, so the toolbar doesn't cover the table when it is docked
 *     left, right or at the top (0.6.3–0.7.0).
 *  3: Like 2, but with a minimum in pixels, so the margins hold on Nomad too (from 0.7.1).
 *     On Manta, 2 and 3 give the same layout.
 */
export type LayoutVersion = 1 | 2 | 3;
export const CURRENT_LAYOUT: LayoutVersion = 3;

/** Smallest margin in pixels toward the toolbar (about 120–140 px wide on Manta and Nomad). */
export const SAFE_MARGIN_MIN_PX = 150;

const MARGINS: Record<LayoutVersion, {side: number; top: number; minPx: number}> = {
  1: {side: 0.06, top: 0.035, minPx: 0},
  // The toolbar on Manta is about 120–140 px wide out of 1920; 9 % gives some breathing room.
  2: {side: 0.09, top: 0.065, minPx: 0},
  3: {side: 0.09, top: 0.065, minPx: SAFE_MARGIN_MIN_PX},
};

/** Lowest row height in pixels, so there is room to write (about 7 mm at 300 ppi). */
export const MIN_ROW_PX = 84;
/** At most this many rows per page, even on large screens. */
export const MAX_ROWS = 20;

export function computeLayout(page: Size, rowCount: number, version: LayoutVersion = CURRENT_LAYOUT): SheetLayout {
  const {width: W, height: H} = page;
  const m = MARGINS[version];
  const marginX = Math.max(W * m.side, m.minPx);
  const left = marginX;
  const right = W - marginX;
  const tableW = right - left;

  const titleTop = Math.max(H * m.top, m.minPx);
  const titleH = H * 0.035;
  const subtitleH = H * 0.02;
  const tableTop = titleTop + titleH + subtitleH + H * 0.02;
  const scoreH = H * 0.03;
  const tableBottomLimit = H * 0.95 - scoreH;

  const headerH = H * 0.03;
  const rowH = Math.min(H * 0.05, (tableBottomLimit - tableTop - headerH) / Math.max(rowCount, 1));

  // Country | Capital (write here, wide) | Result (narrow)
  const c0 = left;
  const c1 = left + tableW * 0.3;
  const c2 = left + tableW * 0.8;
  const c3 = right;

  const pad = Math.max(6, W * 0.006);
  const cell = (x0: number, x1: number, y0: number, y1: number): Rect => ({
    left: r(x0 + pad),
    top: r(y0 + pad),
    right: r(x1 - pad),
    bottom: r(y1 - pad),
  });

  const lineY: number[] = [r(tableTop), r(tableTop + headerH)];
  const rows: SheetLayout['rows'] = [];
  for (let i = 0; i < rowCount; i++) {
    const y0 = tableTop + headerH + i * rowH;
    const y1 = y0 + rowH;
    lineY.push(r(y1));
    rows.push({
      country: cell(c0, c1, y0, y1),
      answer: cell(c1, c2, y0, y1),
      result: cell(c2, c3, y0, y1),
      band: {top: r(y0), bottom: r(y1)},
    });
  }
  const tableBottom = tableTop + headerH + rowCount * rowH;

  return {
    title: {left: r(left), top: r(titleTop), right: r(right), bottom: r(titleTop + titleH)},
    subtitle: {
      left: r(left),
      top: r(titleTop + titleH),
      right: r(right),
      bottom: r(titleTop + titleH + subtitleH),
    },
    columnX: [r(c0), r(c1), r(c2), r(c3)],
    lineY,
    header: {
      country: cell(c0, c1, tableTop, tableTop + headerH),
      answer: cell(c1, c2, tableTop, tableTop + headerH),
      result: cell(c2, c3, tableTop, tableTop + headerH),
    },
    rows,
    score: {
      left: r(left),
      top: r(tableBottom + H * 0.01),
      right: r(right),
      bottom: r(tableBottom + H * 0.01 + scoreH),
    },
    // A minimum in pixels keeps the text legible on small pages (Nomad), as long as the row has room.
    fontSize: r(Math.min(rowH * 0.42, Math.max(W * 0.022, 30))),
    smallFontSize: r(Math.min(rowH * 0.32, Math.max(W * 0.017, 26))),
  };
}

/** Line height as a fraction of the font size. */
export const LINE_HEIGHT = 1.35;

/**
 * Font size that makes the text (possibly several lines with \n) fit in the cell,
 * in both width and height.
 */
/** Full widths: CJK, kana, hangul and full-width punctuation. */
const WIDE = /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/;

/** Cyrillic and Greek letters that are extra wide (ш, щ, ж, ю, м, ы, ф, ω …). */
const EXTRA_WIDE = /[шщжюмыфШЩЖЮМЫФωΩΨψΦφ]/;
/** Capital letters in Cyrillic and Greek script. */
const UPPER_CYRL_GREEK = /[\u0391-\u03a9\u0400-\u042f\u0460-\u0481\u048a-\u04c0\u04d0-\u04fe]/;
/** Cyrillic, Greek, Armenian and Georgian: wider than Latin letters in the same script. */
const CYRL_GREEK = /[\u0370-\u03ff\u0400-\u052f\u0531-\u0587\u10a0-\u10ff]/;

/**
 * Approximate width of a line in em: Latin characters are about 0.55 × the font size,
 * Cyrillic and Greek 0.62–0.85, wide characters (Chinese, Japanese, Korean) about 1.
 */
export function textWidthEm(line: string): number {
  let w = 0;
  for (const ch of line) {
    if (WIDE.test(ch)) {
      w += 1;
    } else if (EXTRA_WIDE.test(ch)) {
      w += 0.85;
    } else if (UPPER_CYRL_GREEK.test(ch)) {
      w += 0.72;
    } else if (CYRL_GREEK.test(ch)) {
      w += 0.62;
    } else {
      w += 0.55;
    }
  }
  return w;
}

export function fitFontSize(text: string, cell: Rect, maxSize: number): number {
  const lines = text.split('\n');
  const longest = Math.max(...lines.map(textWidthEm), 0.55);
  const width = cell.right - cell.left;
  const height = cell.bottom - cell.top;
  const fitW = width / longest;
  const fitH = height / (lines.length * LINE_HEIGHT);
  return Math.max(12, Math.round(Math.min(maxSize, fitW, fitH)));
}

/**
 * Text boxes are drawn from the top of the rectangle. To center the text
 * vertically in the cell we make a shorter rectangle around the cell's midline.
 */
export function centeredTextRect(text: string, cell: Rect, fontSize: number): Rect {
  const lines = text.split('\n').length;
  const h = Math.min(cell.bottom - cell.top, Math.ceil(lines * fontSize * LINE_HEIGHT));
  const mid = (cell.top + cell.bottom) / 2;
  const top = Math.round(mid - h / 2);
  return {left: cell.left, top, right: cell.right, bottom: top + h};
}

/**
 * Finds which layout version an existing sheet was made with, from where the
 * country names (left column) begin.
 */
export function guessLayoutVersion(page: Size, rowCount: number, countryLefts: number[]): LayoutVersion {
  if (!countryLefts.length) {
    return CURRENT_LAYOUT;
  }
  const minLeft = Math.min(...countryLefts);
  // Newest first, so it wins when two versions give the same layout (Manta: 2 and 3).
  const versions = (Object.keys(MARGINS).map(Number) as LayoutVersion[]).sort((a, b) => b - a);
  let best = CURRENT_LAYOUT;
  let bestD = Infinity;
  for (const v of versions) {
    const d = Math.abs(computeLayout(page, rowCount, v).rows[0].country.left - minLeft);
    if (d < bestD) {
      bestD = d;
      best = v;
    }
  }
  return best;
}

/**
 * How many countries fit on one page with a row height of at least MIN_ROW_PX.
 * Manta: 20. Nomad and A5X: fewer, since the pages are smaller.
 */
export function maxRowsPerPage(page: Size): number {
  let n = MAX_ROWS;
  while (n > 5) {
    const L = computeLayout(page, n);
    if (L.rows[0].band.bottom - L.rows[0].band.top >= MIN_ROW_PX) {
      break;
    }
    n--;
  }
  return n;
}
