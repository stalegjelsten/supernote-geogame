/**
 * Plassering av arbeidsarket på siden, i Android-piksler.
 *
 * Alt er proporsjonalt med sidestørrelsen, så samme kode fungerer på
 * Manta (1920×2560), Nomad og A5X (1404×1872) og A6X. Marger og radhøyde har i
 * tillegg et minimum i piksler: Nomad har samme pikseltetthet som Manta (~300 ppi),
 * så verktøylinja er like mange piksler bred der, men siden er mye mindre.
 * Både «Nytt ark» og «Rett ark» bruker denne funksjonen, slik at radene
 * alltid ligger der grading forventer dem.
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
  /** x-posisjoner for loddrette linjer: venstre kant, kolonneskiller, høyre kant. */
  columnX: [number, number, number, number];
  /** y-posisjoner for vannrette linjer, fra toppen av overskriftsraden. */
  lineY: number[];
  header: {country: Rect; answer: Rect; result: Rect};
  rows: Array<{country: Rect; answer: Rect; result: Rect; band: {top: number; bottom: number}}>;
  score: Rect;
  fontSize: number;
  smallFontSize: number;
}

const r = (v: number) => Math.round(v);

/**
 * Layoutversjoner. Retting må regne ut nøyaktig samme layout som arket ble laget med,
 * så gamle versjoner beholdes og gjenkjennes ut fra hvor landnavnene står (se guessLayoutVersion).
 *  1: 6 % sidemarg (til og med 0.6.2).
 *  2: Sikre marger, så verktøylinja ikke dekker tabellen når den er festet til
 *     venstre, høyre eller toppen (0.6.3–0.7.0).
 *  3: Som 2, men med minimum i piksler, så margene holder også på Nomad (fra 0.7.1).
 *     På Manta gir 2 og 3 samme layout.
 */
export type LayoutVersion = 1 | 2 | 3;
export const CURRENT_LAYOUT: LayoutVersion = 3;

/** Minste marg i piksler mot verktøylinja (ca. 120–140 px bred på Manta og Nomad). */
export const SAFE_MARGIN_MIN_PX = 150;

const MARGINS: Record<LayoutVersion, {side: number; top: number; minPx: number}> = {
  1: {side: 0.06, top: 0.035, minPx: 0},
  // Verktøylinja på Manta er ca. 120–140 px bred av 1920; 9 % gir litt luft.
  2: {side: 0.09, top: 0.065, minPx: 0},
  3: {side: 0.09, top: 0.065, minPx: SAFE_MARGIN_MIN_PX},
};

/** Laveste radhøyde i piksler, så det er plass til å skrive (ca. 7 mm ved 300 ppi). */
export const MIN_ROW_PX = 84;
/** Høyst så mange rader per side, også på store skjermer. */
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

  // Land | Hovedstad (skriv her, bred) | Resultat (smal)
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
    // Et minimum i piksler holder teksten lesbar på små sider (Nomad), så lenge raden har plass.
    fontSize: r(Math.min(rowH * 0.42, Math.max(W * 0.022, 30))),
    smallFontSize: r(Math.min(rowH * 0.32, Math.max(W * 0.017, 26))),
  };
}

/** Linjehøyde som andel av skriftstørrelsen. */
const LINE_HEIGHT = 1.35;

/**
 * Skriftstørrelse som får teksten (evt. flere linjer med \n) til å passe i cellen,
 * både i bredden og i høyden.
 */
/** Fulle bredder: CJK, kana, hangul og fullbredde tegnsetting. */
const WIDE = /[\u1100-\u11ff\u2e80-\u9fff\uac00-\ud7af\uf900-\ufaff\uff00-\uffef]/;

/**
 * Omtrentlig bredde på en linje i em: vanlige tegn er ca. 0,55 × skriftstørrelsen,
 * brede tegn (kinesisk, japansk, koreansk) ca. 1.
 */
export function textWidthEm(line: string): number {
  let w = 0;
  for (const ch of line) {
    w += WIDE.test(ch) ? 1 : 0.55;
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
 * Tekstbokser tegnes fra toppen av rektangelet. For å midtstille teksten
 * loddrett i cellen lager vi et lavere rektangel rundt cellens midtlinje.
 */
export function centeredTextRect(text: string, cell: Rect, fontSize: number): Rect {
  const lines = text.split('\n').length;
  const h = Math.min(cell.bottom - cell.top, Math.ceil(lines * fontSize * LINE_HEIGHT));
  const mid = (cell.top + cell.bottom) / 2;
  const top = Math.round(mid - h / 2);
  return {left: cell.left, top, right: cell.right, bottom: top + h};
}

/**
 * Finner hvilken layoutversjon et eksisterende ark ble laget med, ut fra hvor
 * landnavnene (venstre kolonne) begynner.
 */
export function guessLayoutVersion(page: Size, rowCount: number, countryLefts: number[]): LayoutVersion {
  if (!countryLefts.length) {
    return CURRENT_LAYOUT;
  }
  const minLeft = Math.min(...countryLefts);
  // Nyeste først, så den vinner når to versjoner gir samme layout (Manta: 2 og 3).
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
 * Hvor mange land som får plass på én side med radhøyde på minst MIN_ROW_PX.
 * Manta: 20. Nomad og A5X: færre, siden sidene er mindre.
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
