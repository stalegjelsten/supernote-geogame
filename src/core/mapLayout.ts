/**
 * Plassering av kartarket på siden, i Android-piksler.
 *
 * Alt er proporsjonalt med sidestørrelsen (Manta 1920×2560, A5X 1404×1872 …).
 * Kartet får størst mulig plass: enten over lista (brede kart, lista i to
 * kolonner under) eller ved siden av den (høye kart, lista i én kolonne til høyre).
 *
 * Ingen import utenom typer, så byggeskriptet for kartene kan bruke filen direkte.
 */
import type {Rect, Size} from './layout';

export interface MapEntryLayout {
  /** Ruta foran navnet: en strek her betyr «hopp over». */
  box: Rect;
  /** «1. Oslo (Norge)» */
  label: Rect;
  /** Poeng og avstand etter retting. */
  points: Rect;
  /** Hele oppføringen; strøk med midtpunkt her regnes som strøk i lista. */
  band: Rect;
}

export interface MapSheetLayout {
  title: Rect;
  subtitle: Rect;
  map: Rect;
  entries: MapEntryLayout[];
  /** Totalsum etter retting. */
  total: Rect;
  /** Plass til en merknad etter retting (f.eks. feil antall merker). */
  note: Rect;
  arrangement: 'below' | 'beside';
  fontSize: number;
  smallFontSize: number;
}

/**
 * Samme trygge marger som tabellarket (MARGINS[3] i layout.ts), så verktøylinja
 * ikke dekker arket når den er festet til venstre, høyre eller i toppen.
 * Gjentatt her fordi filen ikke skal ha import utenom typer (se toppen).
 */
export const SAFE_MARGIN = {side: 0.09, top: 0.065, minPx: 150};

const r = (v: number) => Math.round(v);

function rect(left: number, top: number, right: number, bottom: number): Rect {
  return {left: r(left), top: r(top), right: r(right), bottom: r(bottom)};
}

/** Største rektangel med bredde/høyde-forholdet `aspect` inne i en boks, midtstilt vannrett og øverst. */
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
 * @param aspect kartbildets bredde / høyde
 * @param count antall hovedsteder i lista
 */
export function computeMapLayout(
  page: Size,
  aspect: number,
  count: number,
): MapSheetLayout {
  const {width: W, height: H} = page;
  // Minimum i piksler: på Nomad er verktøylinja like bred i piksler som på Manta.
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

  // Alternativ 1: lista i to kolonner under kartet.
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
  // Alternativ 2: lista i én kolonne til høyre for kartet.
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
      // Nummereres nedover i første kolonne, så i andre.
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
 * Kartets rektangel med nøyaktig samme bredde/høyde-forhold som bildet.
 * Avrundingen til hele piksler kan ellers gi et lite avvik.
 */
export function mapRectFor(
  page: Size,
  imageW: number,
  imageH: number,
  count: number,
): Rect {
  return computeMapLayout(page, imageW / imageH, count).map;
}
