/**
 * Placement of the map sheet on the page, in Android pixels.
 *
 * Everything is proportional to the page size (Manta 1920×2560, A5X 1404×1872 …).
 * The map gets as much room as possible: either above the list (wide maps, list in two
 * columns below) or beside it (tall maps, list in one column on the right).
 *
 * No imports except types, so the map build script can use the file directly.
 */
import type {Rect, Size} from './layout';

export interface MapEntryLayout {
  /** The box before the name: a line here means "skip". */
  box: Rect;
  /** "1. Oslo (Norway)" */
  label: Rect;
  /** Points and distance after correction. */
  points: Rect;
  /** The whole entry; strokes with a center here count as strokes in the list. */
  band: Rect;
}

export interface MapSheetLayout {
  title: Rect;
  subtitle: Rect;
  map: Rect;
  entries: MapEntryLayout[];
  /** Total after correction. */
  total: Rect;
  /** Room for a note after correction (e.g. wrong number of marks). */
  note: Rect;
  arrangement: 'below' | 'beside';
  fontSize: number;
  smallFontSize: number;
}

/**
 * Same safe margins as the table sheet (MARGINS[3] in layout.ts), so the toolbar
 * doesn't cover the sheet when it is docked left, right or at the top.
 * Repeated here because the file must not have imports except types (see the top).
 */
export const SAFE_MARGIN = {side: 0.09, top: 0.065, minPx: 150};

const r = (v: number) => Math.round(v);

function rect(left: number, top: number, right: number, bottom: number): Rect {
  return {left: r(left), top: r(top), right: r(right), bottom: r(bottom)};
}

/** Largest rectangle with aspect ratio `aspect` inside a box, centered horizontally and at the top. */
function fit(
  aspect: number,
  left: number,
  top: number,
  maxW: number,
  maxH: number,
): Rect {
  let w = maxW;
  let h = w / aspect;
  if (h > maxH) {
    h = maxH;
    w = h * aspect;
  }
  const x = left + (maxW - w) / 2;
  return {left: x, top, right: x + w, bottom: top + h};
}

/**
 * @param aspect the map image's width / height
 * @param count number of capitals in the list
 */
export function computeMapLayout(
  page: Size,
  aspect: number,
  count: number,
): MapSheetLayout {
  const {width: W, height: H} = page;
  // Minimum in pixels: on Nomad the toolbar is as wide in pixels as on Manta.
  const margin = Math.max(W * SAFE_MARGIN.side, SAFE_MARGIN.minPx);
  const left = margin;
  const right = W - margin;
  const innerW = right - left;

  const titleTop = Math.max(H * SAFE_MARGIN.top, SAFE_MARGIN.minPx);
  const titleH = H * 0.032;
  const subtitleH = H * 0.042;
  const contentTop = titleTop + titleH + subtitleH + H * 0.008;
  const footerH = H * 0.055;
  const contentBottom = H * 0.965 - footerH;
  const contentH = contentBottom - contentTop;
  const gap = H * 0.012;

  // Option 1: the list in two columns below the map.
  const belowRows = Math.ceil(count / 2);
  const belowRowH = H * 0.034;
  const belowListH = belowRows * belowRowH;
  const belowMap = fit(
    aspect,
    left,
    contentTop,
    innerW,
    contentH - belowListH - gap,
  );
  // Option 2: the list in one column to the right of the map.
  const sideListW = W * 0.27;
  const sideMap = fit(
    aspect,
    left,
    contentTop,
    innerW - sideListW - W * 0.02,
    contentH,
  );
  const area = (q: Rect) => (q.right - q.left) * (q.bottom - q.top);
  const arrangement: MapSheetLayout['arrangement'] =
    area(belowMap) >= area(sideMap) ? 'below' : 'beside';

  const entries: MapEntryLayout[] = [];
  let map: Rect;
  let listBottom: number;
  let fontSize: number;
  if (arrangement === 'below') {
    map = belowMap;
    const top = map.bottom + gap;
    const colGap = W * 0.03;
    const colW = (innerW - colGap) / 2;
    const rowH = belowRowH;
    for (let i = 0; i < count; i++) {
      // Numbered down the first column, then the second.
      const col = i < belowRows ? 0 : 1;
      const row = i % belowRows;
      const x0 = left + col * (colW + colGap);
      const y0 = top + row * rowH;
      const side = rowH * 0.56;
      const by = y0 + (rowH - side) / 2;
      const labelLeft = x0 + side + W * 0.012;
      const split = x0 + colW * 0.64;
      entries.push({
        box: rect(x0, by, x0 + side, by + side),
        label: rect(labelLeft, y0 + 2, split, y0 + rowH - 2),
        points: rect(split + W * 0.006, y0 + 2, x0 + colW, y0 + rowH - 2),
        band: rect(x0 - W * 0.01, y0, x0 + colW, y0 + rowH),
      });
    }
    listBottom = top + belowRows * rowH;
    fontSize = r(Math.min(rowH * 0.5, Math.max(W * 0.017, 28)));
  } else {
    map = {
      ...sideMap,
      left: sideMap.left - (sideMap.left - left),
      right: sideMap.right - (sideMap.left - left),
    };
    const x0 = right - sideListW;
    const rowH = Math.min(H * 0.07, contentH / count);
    for (let i = 0; i < count; i++) {
      const y0 = contentTop + i * rowH;
      const lineH = rowH * 0.45;
      const side = lineH * 0.8;
      const by = y0 + (lineH - side) / 2 + rowH * 0.05;
      const labelLeft = x0 + side + W * 0.012;
      entries.push({
        box: rect(x0, by, x0 + side, by + side),
        label: rect(
          labelLeft,
          y0 + rowH * 0.03,
          right,
          y0 + rowH * 0.03 + lineH,
        ),
        points: rect(
          labelLeft,
          y0 + rowH * 0.03 + lineH,
          right,
          y0 + rowH * 0.93,
        ),
        band: rect(x0 - W * 0.01, y0, right, y0 + rowH),
      });
    }
    listBottom = contentTop + count * rowH;
    fontSize = r(Math.min(rowH * 0.3, Math.max(W * 0.017, 28)));
  }

  const footerTop = Math.max(map.bottom, listBottom) + gap;
  return {
    title: rect(left, titleTop, right, titleTop + titleH),
    subtitle: rect(
      left,
      titleTop + titleH,
      right,
      titleTop + titleH + subtitleH,
    ),
    map: rect(map.left, map.top, map.right, map.bottom),
    entries,
    total: rect(
      left,
      footerTop,
      left + innerW * 0.45,
      footerTop + footerH * 0.6,
    ),
    note: rect(left + innerW * 0.45, footerTop, right, footerTop + footerH),
    arrangement,
    fontSize,
    smallFontSize: r(Math.max(Math.min(H * 0.0085, W * 0.0125), 22)),
  };
}

/**
 * The map's rectangle with exactly the same aspect ratio as the image.
 * Rounding to whole pixels can otherwise give a small deviation.
 */
export function mapRectFor(
  page: Size,
  imageW: number,
  imageH: number,
  count: number,
): Rect {
  return computeMapLayout(page, imageW / imageH, count).map;
}
