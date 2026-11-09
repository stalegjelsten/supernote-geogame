/**
 * Label mode: "write the names on the map".
 *
 * Most countries are far too small on the map to write their name inside them, so each
 * country on the sheet gets a dot and a leader line out to a writing box in a column beside
 * the map (left or right). The boxes are placed as close to the height of their country as
 * possible, and the lines are kept from crossing each other. Grading reads box by box, as on
 * the outline sheet, so no guessing is needed about which strokes belong to which name.
 *
 * Pure logic without the SDK. The layout depends only on page size, region and countries,
 * so grading can compute it again from the key at the bottom of the sheet.
 */
import {CONTINENTS, type CountryCode} from '../data/countries';
import {MAPS} from '../data/maps';
import {getLanguage, type Language} from '../i18n';
import {labelTexts} from '../i18n/label';
import {countriesIn, countryIn, type Country} from './countries';
import {busyness, countryLabel} from './countryCells';
import type {Draft, DraftPoint} from './draft';
import {familiarity, levelPool, type Level} from './fairDraw';
import {MIN_ROW_PX, centeredTextRect, fitFontSize, titleFontSize, type Rect, type Size} from './layout';
import {markColor, markLayout, markStrokes, strokeAsPolygon} from './marks';
import type {MatchResult} from './match';
import {decodeCountryCodes, encodeCountryCodes, gradeCountryName, verdictMark} from './outlineSheet';
import {regionName, shuffle, type CountryOrder, type Region} from './sheet';
import {isSheetId} from './sheetId';

/** Number of countries on a sheet. */
export const LABEL_COUNTS = [10, 15, 20] as const;
export const LABEL_DEFAULT_COUNT = 10;

/** The world map is too wide to leave room for boxes on both sides, so only the continents. */
export const LABEL_REGIONS: Region[] = [...CONTINENTS];

const r = (v: number) => Math.round(v);

/**
 * 'leader': leader lines from the countries to writing boxes beside the map (large pages).
 * 'numbered': numbers on the map and a numbered list of writing lines below it (small pages,
 * where boxes beside the map would leave both the map and the boxes too small).
 */
export type LabelStyle = 'leader' | 'numbered';

/** Pages narrower than this (Nomad, A5X, A6X: 1404 px) get the numbered style. */
const NUMBERED_BELOW_WIDTH = 1600;

export const labelStyleFor = (page: Size): LabelStyle =>
  page.width < NUMBERED_BELOW_WIDTH ? 'numbered' : 'leader';

/**
 * The choices of number of countries for a page. On small pages the list below the map takes
 * so much room with 20 that the map gets too small, so they stop at 15.
 */
export const labelCountsFor = (page: Size): number[] =>
  labelStyleFor(page) === 'numbered' ? LABEL_COUNTS.filter(c => c <= 15) : [...LABEL_COUNTS];

export interface LabelSlot {
  code: CountryCode;
  /** The writing box ('leader': drawn as a box; 'numbered': a line along its bottom). */
  box: Rect;
  /** Where the result goes after grading (just below the box). */
  result: Rect;
  /** Strokes with their middle here count as the answer in this box. */
  band: Rect;
  /** The dot in the country, in page coordinates. */
  anchor: DraftPoint;
  /** The line to draw from the dot: to the box ('leader'), to a number placed away from the dot, or none. */
  line: [DraftPoint, DraftPoint] | null;
  /** 'numbered': the number on the map. */
  tag?: Rect;
  /** 'numbered': the number before the writing line. */
  number?: Rect;
}

export interface LabelLayout {
  style: LabelStyle;
  title: Rect;
  subtitle: Rect;
  map: Rect;
  /** In the same order as the countries in the key. */
  slots: LabelSlot[];
  score: Rect;
  /** The hidden key (small, bottom left). */
  key: Rect;
  fontSize: number;
  smallFontSize: number;
}

interface Frame {
  title: Rect;
  subtitle: Rect;
  map: Rect;
  /** x range of the box columns. */
  leftCol: [number, number];
  rightCol: [number, number];
  /** Vertical room for the boxes. */
  top: number;
  bottom: number;
  boxH: number;
  resultH: number;
  slotGap: number;
  colGap: number;
  score: Rect;
  key: Rect;
  fontSize: number;
  smallFontSize: number;
}

/** Everything except where the boxes go: margins, map and the two columns. */
function frame(page: Size, region: Region): Frame {
  const {width: W, height: H} = page;
  // Same safe margins as the other sheets, so the toolbar doesn't cover anything.
  const margin = Math.max(W * 0.09, 150);
  const left = margin;
  const right = W - margin;
  const titleTop = Math.max(H * 0.065, 150);
  const titleH = H * 0.035;
  const subtitleH = H * 0.04;
  const top = titleTop + titleH + subtitleH + H * 0.012;
  const scoreH = H * 0.03;
  const bottom = H * 0.95 - scoreH;
  const colW = W * 0.16;
  const colGap = W * 0.02;
  const boxH = Math.max(H * 0.04, 70);
  const fontSize = r(Math.max(Math.min(boxH * 0.38, W * 0.02), 24));
  const smallFontSize = r(Math.max(fontSize * 0.8, 20));
  const resultH = fontSize * 1.5;
  const slotGap = Math.max(H * 0.006, 10);

  const m = MAPS[region];
  const aspect = m.width / m.height;
  const maxW = right - left - 2 * (colW + colGap);
  const maxH = bottom - top;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  const mapLeft = left + colW + colGap + (maxW - w) / 2;
  const mapTop = top + (maxH - h) / 2;
  const scoreTop = bottom + H * 0.01;
  return {
    title: {left: r(left), top: r(titleTop), right: r(right), bottom: r(titleTop + titleH)},
    subtitle: {left: r(left), top: r(titleTop + titleH), right: r(right), bottom: r(top - H * 0.012)},
    map: {left: r(mapLeft), top: r(mapTop), right: r(mapLeft + w), bottom: r(mapTop + h)},
    leftCol: [r(left), r(left + colW)],
    rightCol: [r(right - colW), r(right)],
    top,
    bottom,
    boxH,
    resultH,
    slotGap,
    colGap,
    score: {left: r(left), top: r(scoreTop), right: r(right), bottom: r(scoreTop + scoreH)},
    key: {left: r(left), top: r(scoreTop), right: r(right), bottom: r(scoreTop + scoreH)},
    fontSize,
    smallFontSize,
  };
}

/** How many boxes fit in one column. */
function perColumn(f: Frame): number {
  const slot = f.boxH + f.resultH + f.slotGap;
  return Math.floor((f.bottom - f.top + f.slotGap) / slot);
}

/** The most countries a sheet for this page and region can hold. */
export function labelCapacity(page: Size, region: Region): number {
  // The numbered list takes room from the map instead, so there is no fixed limit.
  return labelStyleFor(page) === 'numbered' ? Infinity : 2 * perColumn(frame(page, region));
}

/** The dot for a country in page coordinates, or null if the map has no point for it. */
function anchorOf(region: Region, map: Rect, code: CountryCode): DraftPoint | null {
  const p = countryLabel(region, code);
  if (!p) {
    return null;
  }
  const m = MAPS[region];
  return {
    x: r(map.left + (p.x / m.width) * (map.right - map.left)),
    y: r(map.top + (p.y / m.height) * (map.bottom - map.top)),
  };
}

/**
 * Tops of `n` boxes as close to the wished tops as possible, in order, at least `slot` apart,
 * between `min` and `max` (the last box ends at most at `max`).
 */
export function spreadTops(wished: number[], slot: number, min: number, max: number): number[] {
  const n = wished.length;
  const tops = wished.map(w => Math.min(Math.max(w, min), max - slot));
  for (let i = 1; i < n; i++) {
    tops[i] = Math.max(tops[i], tops[i - 1] + slot);
  }
  if (n && tops[n - 1] + slot > max) {
    tops[n - 1] = max - slot;
    for (let i = n - 2; i >= 0; i--) {
      tops[i] = Math.min(tops[i], tops[i + 1] - slot);
    }
  }
  return tops;
}

/** Do the segments a–b and c–d cross (touching ends do not count)? */
export function segmentsCross(a: DraftPoint, b: DraftPoint, c: DraftPoint, d: DraftPoint): boolean {
  const o = (p: DraftPoint, q: DraftPoint, s: DraftPoint) => Math.sign((q.x - p.x) * (s.y - p.y) - (q.y - p.y) * (s.x - p.x));
  return o(a, b, c) * o(a, b, d) < 0 && o(c, d, a) * o(c, d, b) < 0;
}

/**
 * Which anchor goes to which port, so no two leader lines cross. Starts with the order by
 * height and swaps the ends of crossing pairs; each swap makes the total length shorter, so
 * it ends, and the shortest assignment never has crossings.
 */
function uncross(anchors: DraftPoint[], ports: DraftPoint[]): number[] {
  const of = anchors.map((_, i) => i);
  for (let round = 0; round < 200; round++) {
    let swapped = false;
    for (let i = 0; i < ports.length; i++) {
      for (let j = i + 1; j < ports.length; j++) {
        if (segmentsCross(anchors[of[i]], ports[i], anchors[of[j]], ports[j])) {
          [of[i], of[j]] = [of[j], of[i]];
          swapped = true;
        }
      }
    }
    if (!swapped) {
      break;
    }
  }
  return of;
}

export function labelLayout(
  page: Size,
  region: Region,
  codes: readonly CountryCode[],
  style: LabelStyle = labelStyleFor(page),
): LabelLayout {
  return style === 'numbered'
    ? numberedLayout(page, region, codes)
    : leaderLayout(page, region, codes);
}

function leaderLayout(page: Size, region: Region, codes: readonly CountryCode[]): LabelLayout {
  const f = frame(page, region);
  const cap = perColumn(f);
  const mid = (f.map.left + f.map.right) / 2;
  const anchors = codes.map(c => {
    const a = anchorOf(region, f.map, c);
    if (!a) {
      throw new Error(`No point on the map for ${c}`);
    }
    return a;
  });

  // The western half of the countries go to the left column, the eastern half to the right,
  // so the columns are about equally long (the countries are seldom spread evenly on the map).
  // An odd one out goes to the side of the middle of the map it lies on.
  const byX = codes.map((_, i) => i).sort((a, b) => anchors[a].x - anchors[b].x || a - b);
  let nLeft = Math.floor(codes.length / 2);
  if (codes.length % 2 && anchors[byX[nLeft]].x < mid) {
    nLeft++;
  }
  nLeft = Math.min(Math.max(nLeft, codes.length - cap), cap);
  const left = byX.slice(0, nLeft);
  const right = byX.slice(nLeft);

  const slot = f.boxH + f.resultH + f.slotGap;
  const slots: LabelSlot[] = new Array(codes.length);
  for (const [side, members] of [['left', left], ['right', right]] as const) {
    const sorted = [...members].sort((a, b) => anchors[a].y - anchors[b].y);
    // The box (without the result strip) centered at the height of the country, if there is room.
    const tops = spreadTops(
      sorted.map(i => anchors[i].y - f.boxH / 2),
      slot,
      f.top,
      f.bottom,
    );
    const [x0, x1] = side === 'left' ? f.leftCol : f.rightCol;
    const boxes = tops.map(t => ({left: x0, top: r(t), right: x1, bottom: r(t + f.boxH)}));
    const ports = boxes.map(b => ({x: side === 'left' ? b.right : b.left, y: r((b.top + b.bottom) / 2)}));
    const order = uncross(
      sorted.map(i => anchors[i]),
      ports,
    );
    boxes.forEach((box, k) => {
      const i = sorted[order[k]];
      const pad = f.colGap * 0.4;
      const t = tops[k];
      slots[i] = {
        code: codes[i],
        box,
        result: {left: box.left, top: box.bottom, right: box.right, bottom: r(t + f.boxH + f.resultH)},
        // From halfway up the gap above to halfway down the gap below, rounded the same way on
        // both sides of a gap, so neighbouring bands never overlap.
        band: {
          left: r(box.left - pad),
          top: r(t - f.slotGap / 2),
          right: r(box.right + pad),
          bottom: r(t + slot - f.slotGap / 2),
        },
        anchor: anchors[i],
        line: [anchors[i], ports[k]],
      };
    });
  }
  return {
    style: 'leader',
    title: f.title,
    subtitle: f.subtitle,
    map: f.map,
    slots,
    score: f.score,
    key: f.key,
    fontSize: f.fontSize,
    smallFontSize: f.smallFontSize,
  };
}

// ---------------------------------------------------------------------------
// The numbered style (small pages)

/** Columns in the list below the map: two for a short list, three for a long one. */
export const numberedColumns = (count: number) => (count <= 10 ? 2 : 3);

const overlapsRect = (a: Rect, b: Rect) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** How many steps farther from its dot a number may go to get one level quieter background. */
const BUSY_COST = 3;

/** Does the segment a–b pass through the rectangle (checked at points a few pixels apart)? */
function segmentHitsRect(a: DraftPoint, b: DraftPoint, rect: Rect): boolean {
  const steps = Math.max(2, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3));
  for (let s = 0; s <= steps; s++) {
    const x = a.x + ((b.x - a.x) * s) / steps;
    const y = a.y + ((b.y - a.y) * s) / steps;
    if (x > rect.left && x < rect.right && y > rect.top && y < rect.bottom) {
      return true;
    }
  }
  return false;
}

/** The point on the edge of `b` nearest to `p`. */
function nearestOn(b: Rect, p: DraftPoint): DraftPoint {
  return {x: r(Math.min(Math.max(p.x, b.left), b.right)), y: r(Math.min(Math.max(p.y, b.top), b.bottom))};
}

/**
 * Where the number for each dot goes on the map: right next to the dot if there is room,
 * otherwise farther out (with a line back to the dot). A number may not cover any dot or any
 * other number, and must be on the map. Greedy, in the order of the dots from left to right.
 */
export function placeTags(
  anchors: DraftPoint[],
  sizes: Array<{w: number; h: number}>,
  map: Rect,
  dot: number,
  busy: (tag: Rect) => number = () => 0,
): Array<{tag: Rect; far: boolean}> {
  const dots = anchors.map(a => ({left: a.x - dot * 1.6, top: a.y - dot * 1.6, right: a.x + dot * 1.6, bottom: a.y + dot * 1.6}));
  const placed: Rect[] = [];
  const lines: Array<[DraftPoint, DraftPoint]> = [];
  const out: Array<{tag: Rect; far: boolean}> = new Array(anchors.length);
  // Right, left, above, below, then the corners.
  const dirs: Array<[number, number]> = [[1, 0], [-1, 0], [0, -1], [0, 1], [1, -1], [-1, -1], [1, 1], [-1, 1]];
  const order = anchors.map((_, i) => i).sort((a, b) => anchors[a].x - anchors[b].x || a - b);
  for (const i of order) {
    const a = anchors[i];
    const {w, h} = sizes[i];
    let chosen: Rect | null = null;
    let far = false;
    // First with all rules; if that finds no room, a line may pass a number or a dot
    // (crowded sheets only), but lines never cross each other. Among the places that are
    // allowed, a quiet one (no borders or coast behind the number) is worth going a few
    // steps farther from the dot for.
    for (const strict of [true, false]) {
      let best: {t: Rect; step: number; score: number} | null = null;
      for (let step = 0; step < 12; step++) {
        const d = dot * 2 + step * h * 0.7;
        for (const [dx, dy] of dirs) {
          const cx = a.x + dx * (w / 2 + d);
          const cy = a.y + dy * (h / 2 + d);
          const t = {left: r(cx - w / 2), top: r(cy - h / 2), right: r(cx + w / 2), bottom: r(cy + h / 2)};
          // Gray sea behind black digits reads fine; borders and coasts through them do not.
          const score = step + (busy(t) === 2 ? BUSY_COST : 0);
          if (best && score >= best.score) {
            continue;
          }
          const onMap = t.left >= map.left && t.right <= map.right && t.top >= map.top && t.bottom <= map.bottom;
          if (
            !onMap ||
            dots.some((o, k) => k !== i && overlapsRect(o, t)) ||
            placed.some(o => overlapsRect(o, t)) ||
            (strict && lines.some(([p, q]) => segmentHitsRect(p, q, t)))
          ) {
            continue;
          }
          // A number away from its dot gets a line, which may not cross another line or run
          // through another number or dot.
          const end = nearestOn(t, a);
          if (
            step > 0 &&
            (lines.some(([p, q]) => segmentsCross(a, end, p, q)) ||
              (strict &&
                (placed.some(o => segmentHitsRect(a, end, o)) ||
                  dots.some((o, k) => k !== i && segmentHitsRect(a, end, o)))))
          ) {
            continue;
          }
          best = {t, step, score};
        }
      }
      if (best) {
        chosen = best.t;
        far = best.step > 0;
        if (far) {
          lines.push([a, nearestOn(best.t, a)]);
        }
        break;
      }
    }
    // No room anywhere near: right of the dot anyway (seldom; only on very crowded sheets).
    const tag = chosen ?? {left: r(a.x + dot * 2), top: r(a.y - h / 2), right: r(a.x + dot * 2 + w), bottom: r(a.y + h / 2)};
    placed.push(tag);
    out[i] = {tag, far};
  }
  return out;
}

function numberedLayout(page: Size, region: Region, codes: readonly CountryCode[]): LabelLayout {
  const {width: W, height: H} = page;
  const margin = Math.max(W * 0.09, 150);
  const left = margin;
  const right = W - margin;
  const titleTop = Math.max(H * 0.065, 150);
  const titleH = H * 0.035;
  const subtitleH = H * 0.04;
  const top = titleTop + titleH + subtitleH + H * 0.012;
  const scoreH = H * 0.03;
  const bottom = H * 0.95 - scoreH;
  // Every pixel the list takes is taken from the map, so the rows are as tight as writing
  // allows: the same height as a table row (MIN_ROW_PX, about 7 mm), and a strip just tall
  // enough for the result in the small font.
  const rowH = Math.max(H * 0.036, MIN_ROW_PX);
  const fontSize = r(Math.max(Math.min(rowH * 0.38, W * 0.022), 24));
  const smallFontSize = r(Math.max(fontSize * 0.8, 20));
  const resultH = smallFontSize * 1.25;
  const cellH = rowH + resultH;
  const n = codes.length;
  const cols = numberedColumns(n);
  const rows = Math.ceil(n / cols);
  const listTop = bottom - rows * cellH;
  const gap = H * 0.008;

  const m = MAPS[region];
  const aspect = m.width / m.height;
  const maxW = right - left;
  const maxH = listTop - gap - top;
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  const mapLeft = left + (maxW - w) / 2;
  const map = {left: r(mapLeft), top: r(top), right: r(mapLeft + w), bottom: r(top + h)};

  const anchors = codes.map(c => {
    const a = anchorOf(region, map, c);
    if (!a) {
      throw new Error(`No point on the map for ${c}`);
    }
    return a;
  });
  const tagFont = tagFontSize(page);
  const sizes = codes.map((_, i) => ({w: r(String(i + 1).length * tagFont * 0.62 + tagFont * 0.4), h: r(tagFont * 1.25)}));
  // How busy the map is behind a number, in the map image's pixels, with a little margin.
  const sx = m.width / (map.right - map.left);
  const sy = m.height / (map.bottom - map.top);
  const busy = (t: Rect) =>
    busyness(region, {
      left: (t.left - map.left) * sx - 3,
      top: (t.top - map.top) * sy - 3,
      right: (t.right - map.left) * sx + 3,
      bottom: (t.bottom - map.top) * sy + 3,
    });
  const tags = placeTags(anchors, sizes, map, dotRadius(page), busy);

  const cw = (right - left) / cols;
  const numW = fontSize * 2.2;
  const pad = Math.max(8, W * 0.008);
  const slots: LabelSlot[] = codes.map((code, k) => {
    // Down the columns: 1–5 in the first, 6–10 in the second …
    const col = Math.floor(k / rows);
    const row = k % rows;
    const x0 = left + col * cw;
    const x1 = x0 + cw;
    const y0 = listTop + row * cellH;
    const box = {left: r(x0 + numW), top: r(y0), right: r(x1 - pad * 2), bottom: r(y0 + rowH)};
    const {tag, far} = tags[k];
    return {
      code,
      box,
      result: {left: box.left, top: box.bottom, right: box.right, bottom: r(y0 + cellH)},
      band: {left: r(x0), top: r(y0), right: r(x1), bottom: r(y0 + cellH)},
      anchor: anchors[k],
      line: far ? [anchors[k], nearestOn(tag, anchors[k])] : null,
      tag,
      number: {left: r(x0), top: box.top, right: box.left, bottom: box.bottom},
    };
  });
  const scoreTop = bottom + H * 0.01;
  return {
    style: 'numbered',
    title: {left: r(left), top: r(titleTop), right: r(right), bottom: r(titleTop + titleH)},
    subtitle: {left: r(left), top: r(titleTop + titleH), right: r(right), bottom: r(top - H * 0.012)},
    map,
    slots,
    score: {left: r(left), top: r(scoreTop), right: r(right), bottom: r(scoreTop + scoreH)},
    key: {left: r(left), top: r(scoreTop), right: r(right), bottom: r(scoreTop + scoreH)},
    fontSize,
    smallFontSize,
  };
}

/** Radius of the dots, and font size of the numbers on the map. */
const dotRadius = (page: Size) => Math.max(5, page.width * 0.0035);
const tagFontSize = (page: Size) => r(Math.max(22, page.width * 0.017));

// ---------------------------------------------------------------------------
// The hidden key

/** "ID l1.nb.EU.KFUDQ….<sheet id>": language, region and the countries in box order. */
export const LABEL_KEY_PREFIX = 'ID l1.';

export function labelKey(lang: Language, region: Region, codes: readonly CountryCode[], sheetId?: string): string {
  return `${LABEL_KEY_PREFIX}${lang.code}.${region}.${encodeCountryCodes(codes)}` + (sheetId ? `.${sheetId}` : '');
}

export interface LabelSheetInfo {
  lang: Language;
  region: Region;
  codes: CountryCode[];
  sheetId?: string;
}

export function parseLabelKey(text: string): LabelSheetInfo | null {
  const t = text.trim();
  if (!t.startsWith(LABEL_KEY_PREFIX)) {
    return null;
  }
  const m = t.slice(LABEL_KEY_PREFIX.length).match(/^([A-Za-z-]+)\.([A-Z]{2,3})\.([A-Z]+)(?:\.([0-9a-z]+))?$/);
  const lang = m ? getLanguage(m[1]) : undefined;
  const region = m?.[2] as Region | undefined;
  const codes = m ? decodeCountryCodes(m[3]) : null;
  if (!m || !lang || !region || !LABEL_REGIONS.includes(region) || !codes) {
    return null;
  }
  return m[4] && isSheetId(m[4]) ? {lang, region, codes, sheetId: m[4]} : {lang, region, codes};
}

export function labelTitle(lang: Language, region: Region, count: number): string {
  return `${labelTexts(lang).titlePrefix} – ${regionName(region, lang)} (${count})`;
}

// ---------------------------------------------------------------------------
// Choosing countries

/**
 * How far apart the dots must be (share of the map width). The numbered style has a smaller
 * map and numbers that need room next to the dots, so it needs more space between them.
 */
export const labelSeparation = (page: Size) => (labelStyleFor(page) === 'numbered' ? 0.05 : 0.035);

/**
 * Draws `count` countries from the region that have a point on the map, at the chosen level,
 * in the order `order` gives. Countries whose dots would lie closer than `minSeparation`
 * (share of the map width) are avoided, so the dots don't end up on top of each other.
 */
export function pickLabelCountries(
  lang: Language,
  region: Region,
  count: number,
  random: () => number = Math.random,
  order: CountryOrder = pool => shuffle(pool, random),
  level: Level = 'mixed',
  minSeparation = 0.035,
): Country[] {
  const m = MAPS[region];
  const pool = order(
    levelPool(
      countriesIn(lang).filter(c => c.continent === region && countryLabel(region, c.code)),
      level,
      count,
      c => familiarity(c.code, 'country'),
      1.5,
    ),
  );
  const minPx = minSeparation * m.width;
  const chosen: Country[] = [];
  const spots: DraftPoint[] = [];
  for (const c of pool) {
    if (chosen.length >= count) {
      break;
    }
    const p = countryLabel(region, c.code)!;
    if (spots.every(q => Math.hypot(p.x - q.x, p.y - q.y) >= minPx)) {
      chosen.push(c);
      spots.push(p);
    }
  }
  // Fill up with half the distance; if that is still too close (the small islands in the
  // Caribbean), the sheet gets fewer countries rather than dots on top of each other.
  for (const c of pool) {
    if (chosen.length >= count) {
      break;
    }
    const p = countryLabel(region, c.code)!;
    if (!chosen.includes(c) && spots.every(q => Math.hypot(p.x - q.x, p.y - q.y) >= minPx / 2)) {
      chosen.push(c);
      spots.push(p);
    }
  }
  return chosen;
}

// ---------------------------------------------------------------------------
// Drawing

/** Stroke width for everything the plugin draws (see LINE_WIDTH in actions.ts). */
const LINE_WIDTH = 200;
const MARK_WIDTH = 300;
const COLOR_BLACK = 0;
const COLOR_DARK_GRAY = 0x9d;

/** A small closed circle around `c`. */
function circle(c: DraftPoint, radius: number, steps = 12): DraftPoint[] {
  const out = Array.from({length: steps + 1}, (_, s) => ({
    x: r(c.x + radius * Math.cos((s / steps) * Math.PI * 2)),
    y: r(c.y + radius * Math.sin((s / steps) * Math.PI * 2)),
  }));
  return out;
}

const rectPath = (b: Rect): DraftPoint[] => [
  {x: b.left, y: b.top},
  {x: b.right, y: b.top},
  {x: b.right, y: b.bottom},
  {x: b.left, y: b.bottom},
  {x: b.left, y: b.top},
];

/** Everything drawn when a label sheet is created. */
export function labelSheetDrafts(
  page: Size,
  lang: Language,
  region: Region,
  codes: readonly CountryCode[],
  picturePath: string,
  sheetId?: string,
): Draft[] {
  const L = labelLayout(page, region, codes);
  const t = labelTexts(lang);
  const title = labelTitle(lang, region, codes.length);
  const drafts: Draft[] = [
    {kind: 'picture', path: picturePath, rect: L.map},
    {
      kind: 'text',
      text: title,
      rect: L.title,
      fontSize: titleFontSize(title, L.title, Math.round(L.fontSize * 1.6)),
      bold: true,
      locked: true,
    },
    {
      kind: 'text',
      text: L.style === 'numbered' ? t.subtitleNumbered : t.subtitle,
      rect: L.subtitle,
      fontSize: L.smallFontSize,
      locked: true,
    },
  ];
  const dot = dotRadius(page);
  const tagFont = tagFontSize(page);
  L.slots.forEach((s, i) => {
    if (L.style === 'numbered') {
      // The writing line, the number before it and the number on the map.
      drafts.push({
        kind: 'line',
        a: {x: s.box.left, y: s.box.bottom},
        b: {x: s.box.right, y: s.box.bottom},
        color: COLOR_DARK_GRAY,
        width: LINE_WIDTH,
      });
      const label = `${i + 1}.`;
      drafts.push({
        kind: 'text',
        text: label,
        rect: centeredTextRect(label, s.number!, L.fontSize),
        fontSize: L.fontSize,
        bold: true,
        locked: true,
      });
      drafts.push({kind: 'text', text: String(i + 1), rect: s.tag!, fontSize: tagFont, bold: true, locked: true});
    } else {
      drafts.push({kind: 'path', points: rectPath(s.box), color: COLOR_BLACK, width: LINE_WIDTH});
    }
    if (s.line) {
      drafts.push({kind: 'line', a: s.line[0], b: s.line[1], color: COLOR_BLACK, width: LINE_WIDTH});
    }
    // Two rings make the dot look filled.
    drafts.push({kind: 'path', points: circle(s.anchor, dot), color: COLOR_BLACK, width: LINE_WIDTH});
    drafts.push({kind: 'path', points: circle(s.anchor, dot * 0.45, 8), color: COLOR_BLACK, width: LINE_WIDTH});
  });
  drafts.push({
    kind: 'text',
    text: labelKey(lang, region, codes, sheetId),
    rect: L.key,
    fontSize: Math.max(16, Math.round(L.smallFontSize * 0.7)),
    align: 0,
    locked: true,
  });
  return drafts;
}

// ---------------------------------------------------------------------------
// Grading

export interface GradedLabel {
  index: number;
  country: Country;
  recognized: string;
  result: MatchResult;
}

export function gradeLabel(country: Country, recognized: string, lang: Language): MatchResult {
  return gradeCountryName(country, recognized, lang);
}

/** The result under each box (mark and, unless right, the answer) and the score at the bottom. */
export function labelResultDrafts(
  page: Size,
  lang: Language,
  region: Region,
  codes: readonly CountryCode[],
  graded: GradedLabel[],
): Draft[] {
  const L = labelLayout(page, region, codes);
  const drafts: Draft[] = [];
  for (const g of graded) {
    const cell = L.slots[g.index].result;
    const kind = verdictMark(g.result)!;
    const {mark, text} = markLayout(cell, kind);
    for (const stroke of markStrokes(kind, mark, g.index + 1)) {
      drafts.push({kind: 'path', points: strokeAsPolygon(stroke), color: markColor(kind), width: MARK_WIDTH});
    }
    if (g.result.verdict !== 'correct') {
      const name = countryIn(lang, g.country.code).name;
      const fontSize = fitFontSize(name, text, L.smallFontSize);
      drafts.push({
        kind: 'text',
        text: name,
        rect: centeredTextRect(name, text, fontSize),
        fontSize,
        bold: g.result.verdict === 'close',
      });
    }
  }
  const points = graded.filter(g => g.result.verdict === 'correct' || g.result.verdict === 'close').length;
  drafts.push({
    kind: 'text',
    text: labelTexts(lang).score(points, codes.length),
    rect: L.score,
    fontSize: Math.round(L.fontSize * 1.2),
    bold: true,
    align: 2,
  });
  return drafts;
}
