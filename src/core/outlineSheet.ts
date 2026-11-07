/**
 * Outline mode: the outlines of some countries in a grid, and you write the name of the
 * country in each cell. Pure logic without the SDK: layout, drawing (with scaling and
 * rotation), the hidden key that says which country is in which cell, and grading.
 */
import {COUNTRY_CODES, type CountryCode} from '../data/countries';
import {OUTLINES} from '../data/outlines';
import {LANGUAGES, getLanguage, type Language} from '../i18n';
import {outlineTexts} from '../i18n/outline';
import {countriesIn, countryIn, type Country} from './countries';
import type {Draft, DraftPoint} from './draft';
import {familiarity, levelPool, type Level} from './fairDraw';
import {centeredTextRect, fitFontSize, type Rect, type Size} from './layout';
import {markColor, markLayout, markStrokes, strokeAsPolygon, type MarkKind} from './marks';
import {matchAnswer, normalizeCached, type MatchResult} from './match';
import {OUTLINE_GRID as OUTLINE_GRID_UNITS, decodeRings} from './outlineCodec';
import {regionName, shuffle, type CountryOrder, type Region} from './sheet';

/** Number of countries on a sheet, and the grid they are put in (columns × rows). */
export const OUTLINE_COUNTS = [6, 9, 12, 16, 20] as const;
export const OUTLINE_DEFAULT_COUNT = 12;
const GRID: Record<number, [number, number]> = {6: [2, 3], 9: [3, 3], 12: [3, 4], 16: [4, 4], 20: [4, 5]};

/** How large the outlines are drawn, as a share of the drawing area in the cell. */
export type OutlineSize = 'large' | 'medium' | 'small';
export const OUTLINE_SIZES: OutlineSize[] = ['large', 'medium', 'small'];
const SIZE_SHARE: Record<OutlineSize, number> = {large: 0.96, medium: 0.72, small: 0.5};

/**
 * 'fit': each country fills its cell. 'bar': the same, with a scale bar in each cell.
 * 'log': the countries are drawn in proportion to each other on a logarithmic scale
 * (see LOG_STEP), with a scale bar. A linear scale is useless as soon as a large country
 * is on the sheet: next to Russia, most of Europe would be specks.
 */
export type OutlineScale = 'fit' | 'bar' | 'log';
export const OUTLINE_SCALES: OutlineScale[] = ['fit', 'bar', 'log'];
/**
 * 'log': a country ten times shorter (largest side in km) than the largest on the sheet is
 * drawn this much smaller, as a share of the full size: 1 − 0.3 = 0.7, i.e. the large one is
 * about 1.4 times as large. A hundred times shorter gives 0.4, and so on.
 */
const LOG_STEP = 0.3;
/** 'log': no country is drawn smaller than this share of the full size. */
const LOG_MIN = 0.15;

/** Rotation: none, a little (±35°) or any angle. */
export type OutlineRotation = 'none' | 'some' | 'any';
export const OUTLINE_ROTATIONS: OutlineRotation[] = ['none', 'some', 'any'];

export interface OutlineOptions {
  count: number;
  size: OutlineSize;
  scale: OutlineScale;
  rotation: OutlineRotation;
  level?: Level;
}

export const DEFAULT_OUTLINE_OPTIONS: OutlineOptions = {
  count: OUTLINE_DEFAULT_COUNT,
  size: 'large',
  scale: 'fit',
  rotation: 'none',
};

const r = (v: number) => Math.round(v);

export interface OutlineCell {
  /** The whole cell, between the grid lines. */
  band: Rect;
  /** The number of the cell, top left. */
  number: Rect;
  /** Where the result goes after grading (top, right of the number). */
  result: Rect;
  /** Where the outline is drawn. */
  shape: Rect;
  /** The writing line. */
  lineY: number;
  lineX: [number, number];
}

export interface OutlineLayout {
  title: Rect;
  subtitle: Rect;
  columnX: number[];
  rowY: number[];
  cells: OutlineCell[];
  score: Rect;
  /** The hidden key (small, bottom right). */
  key: Rect;
  fontSize: number;
  smallFontSize: number;
}

export function outlineGrid(count: number): [number, number] {
  return GRID[count] ?? [Math.ceil(Math.sqrt(count)), Math.ceil(count / Math.ceil(Math.sqrt(count)))];
}

/** Same margins as the table (src/core/layout.ts, version 3), so the toolbar doesn't cover the grid. */
export function outlineLayout(page: Size, count: number): OutlineLayout {
  const {width: W, height: H} = page;
  const marginX = Math.max(W * 0.09, 150);
  const left = marginX;
  const right = W - marginX;
  const titleTop = Math.max(H * 0.065, 150);
  const titleH = H * 0.035;
  const subtitleH = H * 0.04;
  const gridTop = titleTop + titleH + subtitleH + H * 0.012;
  const scoreH = H * 0.03;
  const gridBottom = H * 0.95 - scoreH;
  const [cols, rows] = outlineGrid(count);
  const cw = (right - left) / cols;
  const ch = (gridBottom - gridTop) / rows;
  const fontSize = r(Math.max(Math.min(ch * 0.075, W * 0.022), 26));
  const smallFontSize = r(Math.max(Math.min(ch * 0.06, W * 0.017), 22));
  const pad = Math.max(8, W * 0.006);

  const columnX = Array.from({length: cols + 1}, (_, i) => r(left + i * cw));
  const rowY = Array.from({length: rows + 1}, (_, i) => r(gridTop + i * ch));
  const cells: OutlineCell[] = [];
  for (let k = 0; k < count; k++) {
    const c = k % cols;
    const row = Math.floor(k / cols);
    const x0 = left + c * cw;
    const y0 = gridTop + row * ch;
    const x1 = x0 + cw;
    const y1 = y0 + ch;
    const headH = Math.max(smallFontSize * 1.6, ch * 0.13);
    const writeH = Math.max(fontSize * 2.6, ch * 0.24);
    const numW = smallFontSize * 1.8;
    cells.push({
      band: {left: r(x0), top: r(y0), right: r(x1), bottom: r(y1)},
      number: {left: r(x0 + pad), top: r(y0 + pad), right: r(x0 + pad + numW), bottom: r(y0 + headH)},
      result: {left: r(x0 + pad + numW), top: r(y0 + pad), right: r(x1 - pad), bottom: r(y0 + headH)},
      shape: {left: r(x0 + pad * 2), top: r(y0 + headH), right: r(x1 - pad * 2), bottom: r(y1 - writeH)},
      lineY: r(y1 - writeH * 0.28),
      lineX: [r(x0 + pad * 3), r(x1 - pad * 3)],
    });
  }
  const gridEnd = rowY[rowY.length - 1];
  return {
    title: {left: r(left), top: r(titleTop), right: r(right), bottom: r(titleTop + titleH)},
    subtitle: {left: r(left), top: r(titleTop + titleH), right: r(right), bottom: r(titleTop + titleH + subtitleH)},
    columnX,
    rowY: rowY.slice(0, Math.ceil(count / cols) + 1),
    cells,
    score: {left: r(left), top: r(gridEnd + H * 0.01), right: r(right), bottom: r(gridEnd + H * 0.01 + scoreH)},
    key: {left: r(left), top: r(gridEnd + H * 0.01), right: r(right), bottom: r(gridEnd + H * 0.01 + scoreH)},
    fontSize,
    smallFontSize,
  };
}

// ---------------------------------------------------------------------------
// The hidden key

/**
 * The countries are written at the bottom of the sheet as a short code, so the sheet can be
 * graded without the names showing: "ID o1.nb.KFUDQ…". Each country code is shifted by its
 * position, so the code cannot be read at a glance. The language is included, since
 * the answers are graded in the sheet's language.
 */
export const KEY_PREFIX = 'ID o1.';
const A = 'A'.charCodeAt(0);

const shift = (ch: string, by: number) => String.fromCharCode(A + ((((ch.charCodeAt(0) - A + by) % 26) + 26) % 26));

export function outlineKey(lang: Language, codes: readonly CountryCode[]): string {
  const body = codes.map((code, i) => shift(code[0], 5 + i * 3) + shift(code[1], 11 + i * 7)).join('');
  return `${KEY_PREFIX}${lang.code}.${body}`;
}

export interface OutlineSheetInfo {
  lang: Language;
  codes: CountryCode[];
}

export function parseOutlineKey(text: string): OutlineSheetInfo | null {
  const t = text.trim();
  if (!t.startsWith(KEY_PREFIX)) {
    return null;
  }
  const m = t.slice(KEY_PREFIX.length).match(/^([A-Za-z-]+)\.([A-Z]+)$/);
  const lang = m ? getLanguage(m[1]) : undefined;
  if (!m || !lang || m[2].length % 2) {
    return null;
  }
  const codes: CountryCode[] = [];
  for (let i = 0; i < m[2].length / 2; i++) {
    const code = shift(m[2][2 * i], -(5 + i * 3)) + shift(m[2][2 * i + 1], -(11 + i * 7));
    if (!(COUNTRY_CODES as readonly string[]).includes(code)) {
      return null;
    }
    codes.push(code as CountryCode);
  }
  return codes.length ? {lang, codes} : null;
}

export function outlineTitle(lang: Language, region: Region, count: number): string {
  return `${outlineTexts(lang).titlePrefix} – ${regionName(region, lang)} (${count})`;
}

/** All title prefixes, so grading recognizes the sheet in every language. */
export const OUTLINE_TITLE_PREFIXES = [...new Set(LANGUAGES.map(l => outlineTexts(l).titlePrefix))];

// ---------------------------------------------------------------------------
// Choosing countries

/**
 * Draws `count` countries from the region, at the chosen level by how well known the
 * country is, in the order `order` gives (random if not given).
 */
export function pickOutlineCountries(
  lang: Language,
  region: Region,
  count: number,
  random: () => number = Math.random,
  order: CountryOrder = pool => shuffle(pool, random),
  level: Level = 'mixed',
): Country[] {
  const pool = levelPool(
    countriesIn(lang).filter(c => region === 'ALL' || c.continent === region),
    level,
    count,
    c => familiarity(c.code, 'country'),
  );
  return order(pool).slice(0, count);
}

// ---------------------------------------------------------------------------
// Drawing

/** A shape on the sheet: which country, and how it is turned. */
export interface Placement {
  code: CountryCode;
  /** Degrees clockwise. */
  angle: number;
}

export function randomAngle(rotation: OutlineRotation, random: () => number = Math.random): number {
  if (rotation === 'none') {
    return 0;
  }
  if (rotation === 'some') {
    return Math.round((random() * 2 - 1) * 35);
  }
  return Math.round(random() * 360);
}

const ringCache = new Map<CountryCode, Array<Array<[number, number]>>>();

export function outlineRings(code: CountryCode): Array<Array<[number, number]>> {
  let rings = ringCache.get(code);
  if (!rings) {
    rings = decodeRings(OUTLINES[code][3]);
    ringCache.set(code, rings);
  }
  return rings;
}

/** The size of the country in km (its largest side), used for the log scale and scale bar. */
export const outlineSizeKm = (code: CountryCode) => OUTLINES[code][0];

/** Rotates the rings about the middle of the shape. */
function rotated(code: CountryCode, angle: number): Array<Array<[number, number]>> {
  const [, w, h] = OUTLINES[code];
  const a = (angle * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  const cx = w / 2;
  const cy = h / 2;
  return outlineRings(code).map(ring =>
    ring.map(([x, y]) => [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos]),
  );
}

interface Shape {
  rings: Array<Array<[number, number]>>;
  minX: number;
  minY: number;
  /** Size of the rotated shape in grid units. */
  w: number;
  h: number;
  /** km per grid unit. */
  km: number;
}

function shapeOf(p: Placement): Shape {
  const rings = rotated(p.code, p.angle);
  const pts = rings.flat();
  const xs = pts.map(q => q[0]);
  const ys = pts.map(q => q[1]);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    rings,
    minX,
    minY,
    w: Math.max(1, Math.max(...xs) - minX),
    h: Math.max(1, Math.max(...ys) - minY),
    km: outlineSizeKm(p.code) / OUTLINE_GRID_UNITS,
  };
}

/** The rings in page coordinates, `scale` pixels per grid unit, centered in `box`. */
function placeShape(shape: Shape, box: Rect, scale: number): DraftPoint[][] {
  const bw = box.right - box.left;
  const bh = box.bottom - box.top;
  const ox = box.left + (bw - shape.w * scale) / 2 - shape.minX * scale;
  const oy = box.top + (bh - shape.h * scale) / 2 - shape.minY * scale;
  return shape.rings.map(ring => {
    const out: DraftPoint[] = [];
    for (const [x, y] of ring) {
      const q = {x: r(ox + x * scale), y: r(oy + y * scale)};
      const last = out[out.length - 1];
      if (!last || last.x !== q.x || last.y !== q.y) {
        out.push(q);
      }
    }
    // Closed explicitly, so it looks the same whether or not the device closes polygons.
    if (out.length > 1) {
      out.push({...out[0]});
    }
    return out;
  });
}

const fitScale = (shape: Shape, box: Rect) =>
  Math.min((box.right - box.left) / shape.w, (box.bottom - box.top) / shape.h);

/** The share of the full size each country gets on a logarithmic scale (see LOG_STEP). */
export function logShares(sizesKm: number[]): number[] {
  const biggest = Math.max(...sizesKm);
  return sizesKm.map(km => Math.max(LOG_MIN, 1 - LOG_STEP * Math.log10(biggest / km)));
}

export interface PlacedOutline {
  rings: DraftPoint[][];
  /** Pixels per km, for the scale bar. */
  pxPerKm: number;
}

/**
 * The outlines in page coordinates.
 * 'fit'/'bar': each shape fills `share` of its box. 'log': the largest side of each shape
 * is its log share (logShares) of a common full size, which is as large as possible while every
 * shape fits `share` of its box.
 */
export function outlineShapes(
  placements: Placement[],
  boxes: Rect[],
  share: number,
  scale: OutlineScale,
): PlacedOutline[] {
  const shapes = placements.map(shapeOf);
  const place = (s: Shape, i: number, pxPerUnit: number): PlacedOutline => ({
    rings: placeShape(s, boxes[i], pxPerUnit),
    pxPerKm: pxPerUnit / s.km,
  });
  if (scale !== 'log') {
    return shapes.map((s, i) => place(s, i, fitScale(s, boxes[i]) * share));
  }
  // Pixels per grid unit for shape i is full × shares[i] / OUTLINE_GRID (the largest side
  // before rotation is OUTLINE_GRID units).
  const shares = logShares(placements.map(p => outlineSizeKm(p.code)));
  const full = Math.min(...shapes.map((s, i) => (fitScale(s, boxes[i]) * share * OUTLINE_GRID_UNITS) / shares[i]));
  return shapes.map((s, i) => place(s, i, (full * shares[i]) / OUTLINE_GRID_UNITS));
}

/** A round length for the scale bar (1, 2 or 5 times a power of ten) no longer than `maxKm`. */
export function roundKm(maxKm: number): number {
  const p = Math.pow(10, Math.floor(Math.log10(maxKm)));
  return [5, 2, 1].map(f => f * p).find(v => v <= maxKm) ?? p;
}

/** Scale bar in the bottom right of `box`: a line with end ticks, and the length to the left of it. */
function scaleBarDrafts(box: Rect, pxPerKm: number, fontSize: number): Draft[] {
  const km = roundKm((0.3 * (box.right - box.left)) / pxPerKm);
  const len = r(km * pxPerKm);
  const y = r(box.bottom - fontSize * 0.5);
  const x1 = box.right;
  const x0 = x1 - len;
  const tick = r(fontSize * 0.3);
  // Below 1 km (Vatican City, Monaco) in metres; 1000 * 0.05 is not exact in floating point.
  const label = km >= 1 ? `${km} km` : `${Math.round(km * 1000)} m`;
  return [
    {kind: 'line', a: {x: x0, y}, b: {x: x1, y}, color: COLOR_BLACK, width: LINE_WIDTH},
    {kind: 'line', a: {x: x0, y: y - tick}, b: {x: x0, y: y + tick}, color: COLOR_BLACK, width: LINE_WIDTH},
    {kind: 'line', a: {x: x1, y: y - tick}, b: {x: x1, y: y + tick}, color: COLOR_BLACK, width: LINE_WIDTH},
    {
      kind: 'text',
      text: label,
      rect: {left: box.left, top: r(y - fontSize * 0.85), right: r(x0 - fontSize * 0.4), bottom: r(y + fontSize * 0.6)},
      fontSize,
      align: 2,
      locked: true,
    },
  ];
}

/** Stroke width of the outlines and grid (see LINE_WIDTH in actions.ts on why not thinner). */
const LINE_WIDTH = 200;
const COLOR_BLACK = 0;
const COLOR_DARK_GRAY = 0x9d;

export function outlineSheetDrafts(
  size: Size,
  lang: Language,
  region: Region,
  placements: Placement[],
  options: Pick<OutlineOptions, 'size' | 'scale'>,
): Draft[] {
  const L = outlineLayout(size, placements.length);
  const t = outlineTexts(lang);
  const drafts: Draft[] = [];
  const top = L.rowY[0];
  const bottom = L.rowY[L.rowY.length - 1];
  const x0 = L.columnX[0];
  const x1 = L.columnX[L.columnX.length - 1];
  L.rowY.forEach((y, i) => {
    const outer = i === 0 || i === L.rowY.length - 1;
    drafts.push({kind: 'line', a: {x: x0, y}, b: {x: x1, y}, color: outer ? COLOR_BLACK : COLOR_DARK_GRAY, width: LINE_WIDTH});
  });
  L.columnX.forEach((x, i) => {
    const outer = i === 0 || i === L.columnX.length - 1;
    drafts.push({kind: 'line', a: {x, y: top}, b: {x, y: bottom}, color: outer ? COLOR_BLACK : COLOR_DARK_GRAY, width: LINE_WIDTH});
  });

  const title = outlineTitle(lang, region, placements.length);
  drafts.push({
    kind: 'text',
    text: title,
    rect: L.title,
    fontSize: fitFontSize(title, L.title, Math.round(L.fontSize * 1.5)),
    bold: true,
    locked: true,
  });
  drafts.push({kind: 'text', text: t.subtitle, rect: L.subtitle, fontSize: L.smallFontSize, locked: true});

  const withBar = options.scale !== 'fit';
  const barFont = Math.max(18, Math.round(L.smallFontSize * 0.8));
  // With a scale bar, the bottom of the drawing area is kept for it.
  const areas = L.cells
    .slice(0, placements.length)
    .map(c => (withBar ? {...c.shape, bottom: r(c.shape.bottom - barFont * 1.4)} : c.shape));
  const boxes = areas.map(a => (options.scale === 'log' ? squareIn(a) : a));
  const shapes = outlineShapes(placements, boxes, SIZE_SHARE[options.size], options.scale);
  placements.forEach((_, i) => {
    const cell = L.cells[i];
    drafts.push({
      kind: 'text',
      text: String(i + 1),
      rect: cell.number,
      fontSize: L.smallFontSize,
      bold: true,
      locked: true,
    });
    for (const ring of shapes[i].rings) {
      if (ring.length >= 3) {
        drafts.push({kind: 'path', points: ring, color: COLOR_BLACK, width: LINE_WIDTH});
      }
    }
    if (withBar) {
      drafts.push(...scaleBarDrafts({...cell.shape, top: areas[i].bottom}, shapes[i].pxPerKm, barFont));
    }
    drafts.push({
      kind: 'line',
      a: {x: cell.lineX[0], y: cell.lineY},
      b: {x: cell.lineX[1], y: cell.lineY},
      color: COLOR_DARK_GRAY,
      width: LINE_WIDTH,
    });
  });

  drafts.push({
    kind: 'text',
    text: outlineKey(lang, placements.map(p => p.code)),
    rect: L.key,
    fontSize: Math.max(16, Math.round(L.smallFontSize * 0.7)),
    align: 0,
    locked: true,
  });
  return drafts;
}

/**
 * On a logarithmic scale, every country is fitted to the same square (the largest one that
 * fits in the cell), so its size does not depend on the shape of the cell.
 */
function squareIn(box: Rect): Rect {
  const side = Math.min(box.right - box.left, box.bottom - box.top);
  const cx = (box.left + box.right) / 2;
  const cy = (box.top + box.bottom) / 2;
  return {left: r(cx - side / 2), top: r(cy - side / 2), right: r(cx + side / 2), bottom: r(cy + side / 2)};
}

// ---------------------------------------------------------------------------
// Grading

const rejectedCache = new Map<string, Set<string>>();

/** All country names in the language, normalized; writing another country is never "almost". */
function otherCountryNames(lang: Language): Set<string> {
  let s = rejectedCache.get(lang.code);
  if (!s) {
    s = new Set(countriesIn(lang).map(c => normalizeCached(c.name)));
    rejectedCache.set(lang.code, s);
  }
  return s;
}

const ENGLISH = getLanguage('en')!;

/**
 * Grades a written country name. The name in the sheet's language is the answer key; the
 * English name is also accepted. The names of other countries are never accepted as "almost".
 */
export function gradeCountryName(country: Country, recognized: string, lang: Language): MatchResult {
  const english = countryIn(ENGLISH, country.code).name;
  const accepted = [...new Set([country.name, english])];
  const own = new Set(accepted.map(normalizeCached));
  const rejected = new Set([...otherCountryNames(lang)].filter(n => !own.has(n)));
  return matchAnswer(recognized, accepted, rejected);
}

export function verdictMark(result: MatchResult): MarkKind | null {
  if (result.verdict === 'correct') {
    return 'check';
  }
  if (result.verdict === 'close') {
    return 'almost';
  }
  return 'cross';
}

export interface GradedCell {
  index: number;
  country: Country;
  recognized: string;
  result: MatchResult;
}

/** Stroke width of the grading marks (as MARK_WIDTH in actions.ts). */
const MARK_WIDTH = 300;

/** The result for each cell (mark and, unless right, the answer) and the score at the bottom. */
export function outlineResultDrafts(size: Size, lang: Language, graded: GradedCell[], count: number): Draft[] {
  const L = outlineLayout(size, count);
  const t = outlineTexts(lang);
  const drafts: Draft[] = [];
  for (const g of graded) {
    const cell = L.cells[g.index];
    const kind = verdictMark(g.result)!;
    const {mark, text} = markLayout(cell.result, kind);
    for (const stroke of markStrokes(kind, mark, g.index + 1)) {
      drafts.push({kind: 'path', points: strokeAsPolygon(stroke), color: markColor(kind), width: MARK_WIDTH});
    }
    if (g.result.verdict !== 'correct') {
      const fontSize = fitFontSize(g.country.name, text, L.fontSize);
      drafts.push({
        kind: 'text',
        text: g.country.name,
        rect: centeredTextRect(g.country.name, text, fontSize),
        fontSize,
        bold: g.result.verdict === 'close',
      });
    }
  }
  const points = graded.filter(g => g.result.verdict === 'correct' || g.result.verdict === 'close').length;
  drafts.push({
    kind: 'text',
    text: t.score(points, count),
    rect: L.score,
    fontSize: Math.round(L.fontSize * 1.2),
    bold: true,
    align: 2,
  });
  return drafts;
}

export const OUTLINE_SCORE_PREFIXES = [...new Set(LANGUAGES.map(l => outlineTexts(l).scorePrefix))];
