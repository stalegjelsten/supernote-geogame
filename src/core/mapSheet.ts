/**
 * Map mode: "mark the capital on the map".
 *
 * The sheet has a map of the region and a numbered list of cities. The user
 * puts one mark per city in the list's order, or strikes through the box before
 * a city to skip it. On correction, the center of each mark is converted to
 * longitude/latitude, and the distance to the correct capital gives 0–1000 points.
 *
 * Everything here is pure logic. Reading and writing on the page happens in src/actions.ts.
 */
import {CAPITAL_LONLAT} from '../data/capitals';
import {CONTINENT_OF, CONTINENTS} from '../data/countries';
import {MAPS, MAP_SHEET_COUNT} from '../data/maps';
import {LANGUAGES, type Language} from '../i18n';
import {mapTexts, type MapEntryStyle} from '../i18n/map';
import {hotSeatTexts} from '../i18n/hotseat';
import type {GameTag} from './hotseat';
import {fairDraw, familiarity, levelPool, type Level} from './fairDraw';
import {
  countriesIn,
  countryIn,
  findCountryByName,
  type Country,
} from './countries';
import type {Draft} from './draft';
import type {Rect, Size} from './layout';
import {fitFontSize, centeredTextRect, titleFontSize} from './layout';
import {computeMapLayout, type MapSheetLayout} from './mapLayout';
import {assignMarks, groupMarks, type Assignment} from './mapMarks';
import {countryLabel, hitsCountry} from './countryCells';
import {
  markColor,
  markLayout,
  markStrokes,
  strokeAsPolygon,
  type Point,
} from './marks';
import {
  haversineKm,
  lonLatToImage,
  lonLatToPage,
  pageToLonLat,
  type MapMeta,
} from './projection';
import {MAX_POINTS, mapPoints} from './scoring';
import {regionName, shuffle, type CountryOrder, type Region} from './sheet';

export {MAP_SHEET_COUNT};
export type {MapEntryStyle};

/** Number of cities you can choose for one map sheet. */
export const MAP_COUNTS = [5, 10, 15] as const;
export const MAP_ENTRY_STYLES: MapEntryStyle[] = ['both', 'capital', 'country'];

/** All regions that have maps, in the menu's order. */
export const MAP_REGIONS: Region[] = [...CONTINENTS, 'ALL'];

export function mapMeta(region: Region): MapMeta {
  return MAPS[region];
}

/** The file name the RN build gives the map image in `drawable-mdpi/` (from `assets/maps/<file>.png`). */
export function mapAssetName(region: Region): string {
  return `assets_maps_${MAPS[region].file}.png`;
}

/** Map layout for a page, with the map in exactly the image's shape. */
export function mapLayoutFor(
  page: Size,
  region: Region,
  count = MAP_SHEET_COUNT,
): MapSheetLayout {
  const m = MAPS[region];
  return computeMapLayout(page, m.width / m.height, count);
}

/** What is to be marked: the capital (points by distance) or the country (right/wrong). */
export type MapTarget = 'capital' | 'country';

function titlePrefixFor(lang: Language, target: MapTarget): string {
  const t = mapTexts(lang);
  return target === 'country' ? t.countryTitlePrefix : t.titlePrefix;
}

export function mapSheetTitle(
  lang: Language,
  region: Region,
  target: MapTarget = 'capital',
): string {
  return `${titlePrefixFor(lang, target)} – ${regionName(region, lang)}`;
}

export interface MapSheetInfo {
  lang: Language;
  region: Region;
  target: MapTarget;
}

/**
 * Recognizes the heading of a map sheet and reads language and region.
 * The longest prefix wins, so "Capitals on the map" isn't confused with the table sheet "Capitals".
 */
export function parseMapTitle(title: string): MapSheetInfo | null {
  const candidates = LANGUAGES.flatMap(lang =>
    (['capital', 'country'] as const).map(target => ({
      lang,
      target,
      prefix: titlePrefixFor(lang, target),
    })),
  )
    .filter(c => title.startsWith(c.prefix))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  for (const {lang, target, prefix} of candidates) {
    const rest = title
      .slice(prefix.length)
      .replace(/^\s*[–-]\s*/, '')
      .trim();
    const region = MAP_REGIONS.find(r => regionName(r, lang) === rest);
    if (region) {
      return {lang, region, target};
    }
  }
  return null;
}

/**
 * Draws `count` cities from the region. Cities that would lie closer to each other
 * than `minSeparation` (fraction of the map's width) are avoided, so the marks don't end up
 * on top of each other (e.g. Rome and Vatican City). Countries are tried in the order
 * `order` gives (random, or a training mode).
 */
export function pickMapCountries(
  lang: Language,
  region: Region,
  count = MAP_SHEET_COUNT,
  random: () => number = Math.random,
  minSeparation = 0.03,
  order: CountryOrder = all => shuffle(all, random),
  level: Level = 'mixed',
  target: MapTarget = 'capital',
): Country[] {
  const meta = MAPS[region];
  // The level chooses which countries are included (a bit of extra room, since cities that
  // lie too close are skipped), `order` the order they are tried in.
  const pool = order(
    levelPool(
      countriesIn(lang).filter(c => region === 'ALL' || c.continent === region),
      level,
      count,
      c => familiarity(c.code, target === 'country' ? 'country' : 'capital'),
      1.5,
    ),
  );
  const where = (c: Country) => {
    const [lon, lat] = CAPITAL_LONLAT[c.code];
    return lonLatToImage(meta, lon, lat);
  };
  const minPx = minSeparation * meta.width;
  const chosen: Country[] = [];
  const spots: Point[] = [];
  for (const c of pool) {
    if (chosen.length >= count) {
      break;
    }
    const p = where(c);
    if (spots.every(q => Math.hypot(p.x - q.x, p.y - q.y) >= minPx)) {
      chosen.push(c);
      spots.push(p);
    }
  }
  // Fill up if the distance requirement was too strict (small regions).
  for (const c of pool) {
    if (chosen.length >= count) {
      break;
    }
    if (!chosen.includes(c)) {
      chosen.push(c);
    }
  }
  return chosen;
}

/**
 * Take turns: like pickMapCountries, but distributed fairly across the players and in
 * player order. Familiarity is measured on the country when the country is to be marked, otherwise on the capital.
 */
export function pickFairMapCountries(
  lang: Language,
  region: Region,
  count: number,
  players: number,
  target: MapTarget = 'capital',
  random: () => number = Math.random,
  minSeparation = 0.03,
  level: Level = 'mixed',
): Country[] {
  const meta = MAPS[region];
  const kind = target === 'country' ? 'country' : 'capital';
  const pool = levelPool(
    countriesIn(lang).filter(c => region === 'ALL' || c.continent === region),
    level,
    count,
    c => familiarity(c.code, kind),
    1.5,
  );
  const where = (c: Country) => {
    const [lon, lat] = CAPITAL_LONLAT[c.code];
    return lonLatToImage(meta, lon, lat);
  };
  const minPx = minSeparation * meta.width;
  return fairDraw(
    pool,
    Math.floor(count / players),
    players,
    c => familiarity(c.code, kind),
    {
      random,
      compatible: (c, chosen) => {
        const p = where(c);
        return chosen.every(o => {
          const q = where(o);
          return Math.hypot(p.x - q.x, p.y - q.y) >= minPx;
        });
      },
    },
  );
}

export function entryText(
  lang: Language,
  n: number,
  c: Country,
  style: MapEntryStyle = 'both',
): string {
  switch (style) {
    case 'capital':
      return `${n}. ${c.capital}`;
    case 'country':
      return `${n}. ${c.name}`;
    default:
      return mapTexts(lang).entry(n, c.capital, c.name);
  }
}

/** Finds the country from the capital as written on the sheet (the sheet's language first). */
function findCountryByCapital(
  capital: string,
  lang: Language,
): Country | undefined {
  const key = capital.trim();
  for (const l of [lang, ...LANGUAGES.filter(x => x.code !== lang.code)]) {
    const found = countriesIn(l).find(c => c.capital === key);
    if (found) {
      return countryIn(lang, found.code);
    }
  }
  return undefined;
}

/**
 * If the font becomes too small on one line, the country in parentheses is moved down to line two.
 * `parseEntry` reads both forms.
 */
export function fitEntry(entry: string, cell: Rect, maxSize: number): string {
  const one = fitFontSize(entry, cell, maxSize);
  if (one >= maxSize * 0.8) {
    return entry;
  }
  // Preferably before the parenthesis with the country; otherwise at the space that gives the largest font.
  const paren = entry.lastIndexOf(' (');
  const spaces = [...entry.matchAll(/ /g)]
    .map(m => m.index!)
    .filter(k => k > entry.indexOf(' '));
  const candidates = paren >= 0 ? [paren] : spaces;
  let best = entry;
  let bestSize = one;
  for (const k of candidates) {
    const split = `${entry.slice(0, k)}\n${entry.slice(k + 1)}`;
    const size = fitFontSize(split, cell, maxSize);
    if (size > bestSize) {
      best = split;
      bestSize = size;
    }
  }
  return best;
}

/** Reads "3. Oslo (Norway)" (or "4. Singapore") back to number and country. */
export function parseEntry(
  text: string,
  lang: Language,
): {n: number; country: Country} | null {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  const m =
    trimmed.match(/^(\d+)\.\s+(.+)\s+\((.+)\)$/) ??
    trimmed.match(/^(\d+)\.\s+(.+)()$/);
  if (!m) {
    return null;
  }
  // "3. Oslo (Norway)" → the country in parentheses; "3. Norway" → the country; "3. Oslo" → the city.
  const found = m[3]
    ? findCountryByName(m[3], lang)
    : findCountryByName(m[2], lang) ?? findCountryByCapital(m[2], lang);
  if (!found) {
    return null;
  }
  return {n: Number(m[1]), country: countryIn(lang, found.code)};
}

/** Stroke width for everything the plugin draws. Stay at 200 or more (file size). */
export const MAP_LINE_WIDTH = 200;
/** The correction marks (ring and line) are a bit thicker, like the correction marks in table mode. */
export const MAP_MARK_WIDTH = 300;
export const COLOR_BLACK = 0;
export const COLOR_DARK_GRAY = 0x9d;

function textDraft(
  t: string,
  cell: Rect,
  maxSize: number,
  opts: {bold?: boolean; locked?: boolean; align?: 0 | 1 | 2} = {},
): Draft {
  const fontSize = fitFontSize(t, cell, maxSize);
  return {
    kind: 'text',
    text: t,
    rect: centeredTextRect(t, cell, fontSize),
    fontSize,
    ...opts,
  };
}

/**
 * The instructions under the heading. Multiplayer: the first line gets
 * the label ("Player 2 of 3 · …" or "Duel for 2 · …"), the second line is as before.
 */
export function mapSubtitle(
  lang: Language,
  style: MapEntryStyle,
  target: MapTarget,
  tag?: GameTag,
): string {
  const t = mapTexts(lang);
  const base = target === 'country' ? t.countrySubtitle : t.subtitle(style);
  if (!tag) {
    return base;
  }
  const [first, ...rest] = base.split('\n');
  const hs = hotSeatTexts(lang);
  const line =
    tag.mode === 'pass'
      ? hs.mapPass(tag.player, tag.players, first)
      : hs.mapShared(tag.players);
  return [line, ...rest].join('\n');
}

/** Everything drawn when a map sheet is created: heading, instructions, map image, boxes and list. */
export function mapSheetDrafts(
  page: Size,
  lang: Language,
  region: Region,
  countries: Country[],
  picturePath: string,
  style: MapEntryStyle = 'both',
  target: MapTarget = 'capital',
  tag?: GameTag,
): Draft[] {
  const L = mapLayoutFor(page, region, countries.length);
  const subtitle = mapSubtitle(lang, style, target, tag);
  const title = mapSheetTitle(lang, region, target);
  // In country mode only the country is in the list.
  const listStyle: MapEntryStyle = target === 'country' ? 'country' : style;
  const drafts: Draft[] = [
    {kind: 'picture', path: picturePath, rect: L.map},
    {
      kind: 'text',
      text: title,
      rect: L.title,
      fontSize: titleFontSize(title, L.title, Math.round(L.fontSize * 1.4)),
      bold: true,
      locked: true,
    },
    {
      kind: 'text',
      text: subtitle,
      rect: L.subtitle,
      fontSize: L.smallFontSize,
      locked: true,
    },
  ];
  countries.forEach((c, i) => {
    const e = L.entries[i];
    const b = e.box;
    drafts.push({
      kind: 'path',
      points: [
        {x: b.left, y: b.top},
        {x: b.right, y: b.top},
        {x: b.right, y: b.bottom},
        {x: b.left, y: b.bottom},
        {x: b.left, y: b.top},
      ],
      color: COLOR_DARK_GRAY,
      width: MAP_LINE_WIDTH,
    });
    drafts.push(
      textDraft(
        fitEntry(entryText(lang, i + 1, c, listStyle), e.label, L.fontSize),
        e.label,
        L.fontSize,
        {locked: true},
      ),
    );
  });
  return drafts;
}

/** Deterministic "random" number in [-1, 1]. */
function wobble(seed: number, i: number): number {
  const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

/** A hand-drawn ring around `c`: slightly uneven, and the end goes a bit past the start. */
export function ringStroke(c: Point, radius: number, seed = 0): Point[] {
  const steps = 16;
  const start = wobble(seed, 1) * Math.PI;
  const out: Point[] = [];
  for (let s = 0; s <= steps; s++) {
    const a = start + (s / steps) * Math.PI * 2.15;
    const r = radius * (1 + 0.08 * wobble(seed, s + 2));
    out.push({x: c.x + r * Math.cos(a), y: c.y + r * Math.sin(a)});
  }
  return out;
}

export interface MapEntry {
  n: number;
  country: Country;
}

export interface EntryResult {
  n: number;
  country: Country;
  assignment: Assignment;
  /** The guess on the page and on the globe, if the city was marked. */
  guess?: Point;
  distanceKm?: number;
  points: number;
  /** Country mode: was the mark in the right country? */
  correct?: boolean;
  /** Correct placement on the page. */
  truth: Point;
}

export interface MapGrade {
  results: EntryResult[];
  points: number;
  max: number;
  marks: number;
  /** Marks that were not matched to any city (assumed extra strokes). */
  unused: number[];
  target: MapTarget;
  /** Note about wrong number of marks, or null. */
  note: string | null;
  drafts: Draft[];
}

/**
 * Corrects a map sheet.
 * @param mapRect where the map image actually lies on the page
 * @param mapStrokes the strokes on the map, in drawing order, in page coordinates
 * @param skipped for each entry (index n-1): is the box struck through?
 */
export function gradeMap(
  page: Size,
  lang: Language,
  region: Region,
  mapRect: Rect,
  entries: MapEntry[],
  mapStrokes: Point[][],
  skipped: boolean[],
  target: MapTarget = 'capital',
): MapGrade {
  const meta = MAPS[region];
  const countryMode = target === 'country';
  const rw = mapRect.right - mapRect.left;
  const rh = mapRect.bottom - mapRect.top;
  const toImage = (p: Point) => ({
    x: ((p.x - mapRect.left) / rw) * meta.width,
    y: ((p.y - mapRect.top) / rh) * meta.height,
  });
  const fromImage = (p: Point) => ({
    x: mapRect.left + (p.x / meta.width) * rw,
    y: mapRect.top + (p.y / meta.height) * rh,
  });
  /** The answer point on the page: the capital, or a point well inside the country. */
  const truthOf = (e: MapEntry): Point => {
    if (countryMode) {
      const lbl = countryLabel(region, e.country.code);
      if (lbl) {
        return fromImage(lbl);
      }
    }
    const [lon, lat] = CAPITAL_LONLAT[e.country.code];
    return lonLatToPage(meta, mapRect, lon, lat);
  };
  /** Tolerance in country mode: 12 image pixels (about 1 mm on Manta). */
  const tolerance = 12;
  const hit = (mark: Point, e: MapEntry) =>
    hitsCountry(region, e.country.code, toImage(mark), tolerance);
  const t = mapTexts(lang);
  const count = Math.max(...entries.map(e => e.n));
  const L = mapLayoutFor(page, region, count);
  const sorted = [...entries].sort((a, b) => a.n - b.n);
  const marks = groupMarks(mapStrokes);
  // Lost points if mark `mark` is matched to entry `entry` (index in `sorted`).
  const marksLonLat = marks.map(mk =>
    pageToLonLat(meta, mapRect, mk.center.x, mk.center.y),
  );
  const truths = sorted.map(truthOf);
  const truthsLonLat = truths.map(p => pageToLonLat(meta, mapRect, p.x, p.y));
  const lost = (mark: number, entry: number) => {
    if (countryMode && hit(marks[mark].center, sorted[entry])) {
      return 0;
    }
    const far =
      MAX_POINTS -
      mapPoints(
        haversineKm(marksLonLat[mark], truthsLonLat[entry]),
        meta.scaleKm,
      );
    // In country mode a miss always costs more than a hit, but proximity still counts for the matching.
    return countryMode ? 100 + 0.9 * far : far;
  };
  const {byEntry, unused} = assignMarks(
    marks.length,
    sorted.map(e => !!skipped[e.n - 1]),
    lost,
  );

  const W = page.width;
  const ringR = Math.max(10, W * 0.009);
  const labelFont = Math.round(Math.max(16, W * 0.012));
  const drafts: Draft[] = [];
  const results: EntryResult[] = [];
  let points = 0;

  sorted.forEach((e, i) => {
    const a = byEntry[i];
    const truth = truths[i];
    const truthLL = truthsLonLat[i];
    const r: EntryResult = {
      n: e.n,
      country: e.country,
      assignment: a,
      points: 0,
      truth,
    };
    if (a.kind === 'mark') {
      const guess = marks[a.mark].center;
      const ll = pageToLonLat(meta, mapRect, guess.x, guess.y);
      r.guess = guess;
      r.distanceKm = haversineKm(ll, truthLL);
      if (countryMode) {
        r.correct = hit(guess, e);
        r.points = r.correct ? 1 : 0;
      } else {
        r.points = mapPoints(r.distanceKm, meta.scaleKm);
      }
      points += r.points;
      // Line from the guess to the edge of the ring around the correct place.
      const dx = truth.x - guess.x;
      const dy = truth.y - guess.y;
      const d = Math.hypot(dx, dy);
      if (d > ringR * 1.6 && !r.correct) {
        const end = {
          x: truth.x - (dx / d) * ringR,
          y: truth.y - (dy / d) * ringR,
        };
        drafts.push({
          kind: 'line',
          a: {x: Math.round(guess.x), y: Math.round(guess.y)},
          b: {x: Math.round(end.x), y: Math.round(end.y)},
          color: COLOR_DARK_GRAY,
          width: MAP_MARK_WIDTH,
        });
      }
    }
    results.push(r);

    // Points or right/wrong at the entry in the list.
    const cell = L.entries[e.n - 1]?.points;
    if (cell) {
      if (countryMode && a.kind === 'mark') {
        const kind = r.correct ? 'check' : 'cross';
        const {mark} = markLayout(cell, kind);
        for (const stroke of markStrokes(kind, mark, e.n)) {
          drafts.push({
            kind: 'path',
            points: strokeAsPolygon(stroke),
            color: markColor(kind),
            width: MAP_MARK_WIDTH,
          });
        }
      } else {
        const s =
          a.kind === 'mark'
            ? t.points(r.points, Math.round(r.distanceKm!))
            : a.kind === 'skipped'
            ? t.skipped
            : t.missing;
        drafts.push(textDraft(s, cell, L.fontSize, {bold: a.kind === 'mark'}));
      }
    }

    // A correct country needs no answer mark on the map.
    if (r.correct) {
      return;
    }
    // Correct placement: a hand-drawn ring and the number from the list.
    drafts.push({
      kind: 'path',
      points: strokeAsPolygon(ringStroke(truth, ringR, e.n)),
      color: COLOR_BLACK,
      width: MAP_MARK_WIDTH,
    });
    const label = String(e.n);
    const lw = Math.ceil(label.length * labelFont * 0.62) + 8;
    const lh = Math.ceil(labelFont * 1.35);
    let lx = truth.x + ringR * 0.9;
    if (lx + lw > mapRect.right - 4) {
      lx = truth.x - ringR * 0.9 - lw;
    }
    let ly = truth.y - ringR * 0.9 - lh;
    if (ly < mapRect.top + 4) {
      ly = truth.y + ringR * 0.9;
    }
    drafts.push({
      kind: 'text',
      text: label,
      rect: {
        left: Math.round(lx),
        top: Math.round(ly),
        right: Math.round(lx + lw),
        bottom: Math.round(ly + lh),
      },
      fontSize: labelFont,
      bold: true,
    });
  });

  const max = countryMode ? sorted.length : sorted.length * MAX_POINTS;
  drafts.push({
    kind: 'text',
    text: countryMode ? t.countryTotal(points, max) : t.total(points, max),
    rect: L.total,
    fontSize: Math.round(L.fontSize * 1.15),
    bold: true,
  });
  // Unused marks get a "?" next to them, so you can see which stroke was discarded.
  for (const k of unused) {
    const c = marks[k].center;
    const w = Math.ceil(labelFont * 0.8) + 8;
    const h = Math.ceil(labelFont * 1.35);
    let x = c.x + ringR * 0.6;
    if (x + w > mapRect.right - 4) {
      x = c.x - ringR * 0.6 - w;
    }
    const y = Math.max(mapRect.top + 4, c.y - h - ringR * 0.3);
    drafts.push({
      kind: 'text',
      text: '?',
      rect: {
        left: Math.round(x),
        top: Math.round(y),
        right: Math.round(x + w),
        bottom: Math.round(y + h),
      },
      fontSize: labelFont,
      bold: true,
    });
  }
  const missing = byEntry.filter(a => a.kind === 'missing').length;
  const lines = [
    unused.length ? t.unusedMarks(unused.length) : '',
    missing ? t.unmarked(missing, countryMode) : '',
  ].filter(Boolean);
  const note = lines.length ? lines.join('\n') : null;
  if (note) {
    drafts.push(textDraft(note, L.note, L.smallFontSize));
  }
  return {
    results,
    points,
    max,
    marks: marks.length,
    unused,
    target,
    note,
    drafts,
  };
}

/** All countries in a region have a capital with coordinates (used in tests). */
export function capitalsIn(region: Region) {
  return (
    Object.keys(CAPITAL_LONLAT) as Array<keyof typeof CAPITAL_LONLAT>
  ).filter(c => region === 'ALL' || CONTINENT_OF[c] === region);
}
