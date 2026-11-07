/**
 * Kartmodus: «merk hovedstaden på kartet».
 *
 * Arket har et kart over regionen og en nummerert liste med byer. Brukeren
 * setter ett merke per by i listens rekkefølge, eller streker over ruta foran
 * en by for å hoppe over den. Ved retting regnes midten av hvert merke om til
 * lengde/bredde, og avstanden til riktig hovedstad gir 0–1000 poeng.
 *
 * Alt her er ren logikk. Lesing og skriving på siden skjer i src/actions.ts.
 */
import {CAPITAL_LONLAT} from '../data/capitals';
import {CONTINENT_OF, CONTINENTS} from '../data/countries';
import {MAPS, MAP_SHEET_COUNT} from '../data/maps';
import {LANGUAGES, type Language} from '../i18n';
import {mapTexts, type MapEntryStyle} from '../i18n/map';
import {hotSeatTexts} from '../i18n/hotseat';
import type {GameTag} from './hotseat';
import {
  countriesIn,
  countryIn,
  findCountryByName,
  type Country,
} from './countries';
import type {Draft} from './draft';
import type {Rect, Size} from './layout';
import {fitFontSize, centeredTextRect} from './layout';
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

/** Antall byer man kan velge for ett kartark. */
export const MAP_COUNTS = [5, 10, 15] as const;
export const MAP_ENTRY_STYLES: MapEntryStyle[] = ['both', 'capital', 'country'];

/** Alle regionene som har kart, i menyens rekkefølge. */
export const MAP_REGIONS: Region[] = [...CONTINENTS, 'ALL'];

export function mapMeta(region: Region): MapMeta {
  return MAPS[region];
}

/** Filnavnet RN-byggingen gir kartbildet i `drawable-mdpi/` (fra `assets/maps/<fil>.png`). */
export function mapAssetName(region: Region): string {
  return `assets_maps_${MAPS[region].file}.png`;
}

/** Kartlayout for en side, med kartet i nøyaktig bildets form. */
export function mapLayoutFor(
  page: Size,
  region: Region,
  count = MAP_SHEET_COUNT,
): MapSheetLayout {
  const m = MAPS[region];
  return computeMapLayout(page, m.width / m.height, count);
}

/** Hva som skal merkes: hovedstaden (poeng etter avstand) eller landet (riktig/galt). */
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
 * Kjenner igjen overskriften på et kartark og leser språk og region.
 * Lengste prefiks vinner, så «Hovedsteder på kartet» ikke forveksles med tabellarket «Hovedsteder».
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
 * Trekker `count` byer fra regionen. Byer som ville ligget nærmere hverandre
 * enn `minSeparation` (andel av kartets bredde) unngås, så merkene ikke havner
 * oppå hverandre (f.eks. Roma og Vatikanstaten). Landene prøves i rekkefølgen
 * `order` gir (tilfeldig, eller en treningsmodus).
 */
export function pickMapCountries(
  lang: Language,
  region: Region,
  count = MAP_SHEET_COUNT,
  random: () => number = Math.random,
  minSeparation = 0.03,
  order: CountryOrder = all => shuffle(all, random),
): Country[] {
  const meta = MAPS[region];
  const pool = order(
    countriesIn(lang).filter(c => region === 'ALL' || c.continent === region),
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
  // Fyll opp hvis kravet til avstand ble for strengt (små regioner).
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

/** Finner landet ut fra hovedstaden slik den står på arket (arkets språk først). */
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
 * Blir skriften for liten på én linje, flyttes landet i parentes ned på linje to.
 * `parseEntry` leser begge formene.
 */
export function fitEntry(entry: string, cell: Rect, maxSize: number): string {
  const one = fitFontSize(entry, cell, maxSize);
  if (one >= maxSize * 0.8) {
    return entry;
  }
  // Helst før parentesen med landet; ellers ved mellomrommet som gir størst skrift.
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

/** Leser «3. Oslo (Norge)» (eller «4. Singapore») tilbake til nummer og land. */
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
  // «3. Oslo (Norge)» → landet i parentes; «3. Norge» → landet; «3. Oslo» → byen.
  const found = m[3]
    ? findCountryByName(m[3], lang)
    : findCountryByName(m[2], lang) ?? findCountryByCapital(m[2], lang);
  if (!found) {
    return null;
  }
  return {n: Number(m[1]), country: countryIn(lang, found.code)};
}

/** Strekbredde for alt pluginen tegner. Hold deg på 200 eller mer (filstørrelse). */
export const MAP_LINE_WIDTH = 200;
/** Rettemerkene (ring og strek) er litt tykkere, som rettemerkene i tabellmodusen. */
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
 * Bruksanvisningen under overskriften. Flerspiller: første linje får
 * merkelappen («Spiller 2 av 3 · …» eller «Duell for 2 · …»), andre linje er som før.
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

/** Alt som tegnes når et kartark lages: overskrift, bruksanvisning, kartbilde, ruter og liste. */
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
  // I landmodusen står bare landet i lista.
  const listStyle: MapEntryStyle = target === 'country' ? 'country' : style;
  const drafts: Draft[] = [
    {kind: 'picture', path: picturePath, rect: L.map},
    {
      kind: 'text',
      text: mapSheetTitle(lang, region, target),
      rect: L.title,
      fontSize: Math.round(L.fontSize * 1.4),
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

/** Deterministisk «tilfeldig» tall i [-1, 1]. */
function wobble(seed: number, i: number): number {
  const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453;
  return (v - Math.floor(v)) * 2 - 1;
}

/** En håndtegnet ring rundt `c`: litt ujevn, og slutten går litt forbi starten. */
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
  /** Gjetningen på siden og på kloden, hvis byen ble merket. */
  guess?: Point;
  distanceKm?: number;
  points: number;
  /** Landmodusen: lå merket i riktig land? */
  correct?: boolean;
  /** Riktig plassering på siden. */
  truth: Point;
}

export interface MapGrade {
  results: EntryResult[];
  points: number;
  max: number;
  marks: number;
  /** Merker som ikke ble koblet til noen by (antatt ekstra streker). */
  unused: number[];
  target: MapTarget;
  /** Merknad om feil antall merker, eller null. */
  note: string | null;
  drafts: Draft[];
}

/**
 * Retter et kartark.
 * @param mapRect der kartbildet faktisk ligger på siden
 * @param mapStrokes strøkene på kartet, i tegnerekkefølge, i sidekoordinater
 * @param skipped for hver oppføring (indeks n-1): er ruta strøket over?
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
  /** Fasitpunktet på siden: hovedstaden, eller et punkt godt inne i landet. */
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
  /** Slingringsmonn i landmodusen: 12 bildepiksler (ca. 1 mm på Manta). */
  const tolerance = 12;
  const hit = (mark: Point, e: MapEntry) =>
    hitsCountry(region, e.country.code, toImage(mark), tolerance);
  const t = mapTexts(lang);
  const count = Math.max(...entries.map(e => e.n));
  const L = mapLayoutFor(page, region, count);
  const sorted = [...entries].sort((a, b) => a.n - b.n);
  const marks = groupMarks(mapStrokes);
  // Tapte poeng hvis merke `mark` kobles til oppføring `entry` (indeks i `sorted`).
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
    // I landmodusen koster et bom alltid mer enn et treff, men nærhet teller fortsatt for koblingen.
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
      // Strek fra gjetningen til kanten av ringen rundt riktig sted.
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

    // Poeng eller riktig/galt ved oppføringen i lista.
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

    // Et riktig land trenger ingen fasit på kartet.
    if (r.correct) {
      return;
    }
    // Riktig plassering: en håndtegnet ring og nummeret fra lista.
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
  // Ubrukte merker får et «?» ved siden av seg, så man ser hvilken strek som ble forkastet.
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

/** Alle land i en region har en hovedstad med koordinater (brukes i tester). */
export function capitalsIn(region: Region) {
  return (
    Object.keys(CAPITAL_LONLAT) as Array<keyof typeof CAPITAL_LONLAT>
  ).filter(c => region === 'ALL' || CONTINENT_OF[c] === region);
}
