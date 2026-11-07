/**
 * Text for the map mode ("mark the capital on the map").
 *
 * Kept in its own file so the map mode can grow without changing the shared type
 * for all languages. Norwegian and English are written by hand. The other languages
 * get English text, but the list of cities and countries is written in the sheet's
 * language, and the title starts with the language's own title, so the language is
 * recognized when grading.
 */
import type {Language} from './types';

/** What the list on the map sheet shows: city and country, just the city, or just the country (then you must know the capital). */
export type MapEntryStyle = 'both' | 'capital' | 'country';

export interface MapTexts {
  /** The title starts with this; used to recognize a map sheet and its language. */
  titlePrefix: string;
  /** The title of a map sheet where countries (not capitals) are marked. */
  countryTitlePrefix: string;
  /** Instructions for the country mode, two lines separated by \n. */
  countrySubtitle: string;
  /** Start of the result in the country mode, e.g. "Correct countries:". */
  countryTotalPrefix: string;
  countryTotal: (correct: number, total: number) => string;
  /** Instructions below the title, two lines separated by \n. */
  subtitle: (style: MapEntryStyle) => string;
  /** "3. Oslo (Norway)", or "4. Singapore" when the city and the country share a name. */
  entry: (n: number, capital: string, country: string) => string;
  /** Points and distance next to an entry after grading. */
  points: (points: number, km: number) => string;
  skipped: string;
  missing: string;
  /** Start of the total; used to remove it when regrading. */
  totalPrefix: string;
  total: (points: number, max: number) => string;
  /** Note about marks that did not match the list (shown with "?" on the map). */
  unusedMarks: (count: number) => string;
  /** Note about cities without a mark. */
  unmarked: (count: number, countries: boolean) => string;

  ui: {
    mode: string;
    modeTable: string;
    modeMap: string;
    /** Explanation in the menu when map mode is selected. */
    mapHint: string;
    /** The choice of what the list shows. */
    show: string;
    showBoth: string;
    showCapital: string;
    showCountry: string;
    /** Number of cities on the map sheet. */
    mapCount: string;
    /** What to mark on the map: capitals or countries. */
    target: string;
    targetCapital: string;
    targetCountry: string;
    made: (count: number) => string;
    countryMade: (count: number) => string;
    result: (points: number, max: number, percent: number) => string;
    countryResult: (correct: number, total: number, percent: number) => string;
  };
  progress: {
    findingMap: string;
    findingMarks: string;
  };
  errors: {
    /** The map image was not found in the plugin folder on the device. */
    mapFile: (detail: string) => string;
    noEntries: string;
  };
}

/** Thousands separator with a narrow space, e.g. "10 000". */
function thousands(n: number, sep: string): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

const nb: MapTexts = {
  titlePrefix: 'Hovedsteder på kartet',
  countryTitlePrefix: 'Land på kartet',
  countrySubtitle:
    'Sett et kryss inne i hvert land, i samme rekkefølge som lista.\n' +
    'Vil du hoppe over et land, setter du en strek i ruta foran det. Rett siden fra World Capitals Quiz-menyen.',
  countryTotalPrefix: 'Riktige land:',
  countryTotal: (correct, total) => `Riktige land: ${correct} av ${total}`,
  subtitle: style =>
    (style === 'country'
      ? 'Sett et kryss på kartet der hovedstaden i hvert land ligger, i samme rekkefølge som lista.\n'
      : 'Sett et kryss på kartet der hver by ligger, i samme rekkefølge som lista.\n') +
    'Vil du hoppe over en, setter du en strek i ruta foran den. Rett siden fra World Capitals Quiz-menyen.',
  entry: (n, capital, country) =>
    capital === country ? `${n}. ${capital}` : `${n}. ${capital} (${country})`,
  points: (points, km) => `${points} p · ${thousands(km, ' ')} km`,
  skipped: 'hoppet over',
  missing: 'ikke merket',
  totalPrefix: 'Poeng på kartet:',
  total: (points, max) =>
    `Poeng på kartet: ${thousands(points, ' ')} av ${thousands(max, ' ')}`,
  unusedMarks: n =>
    n === 1
      ? 'Ett merke passet ikke med lista og er ikke tatt med (vist med ?).'
      : `${n} merker passet ikke med lista og er ikke tatt med (vist med ?).`,
  unmarked: (n, countries) =>
    countries
      ? n === 1
        ? 'Ett land fikk ikke noe merke.'
        : `${n} land fikk ikke noe merke.`
      : n === 1
      ? 'Én by fikk ikke noe merke.'
      : `${n} byer fikk ikke noe merke.`,
  ui: {
    mode: 'Spill',
    modeTable: 'Tabell',
    modeMap: 'Kart',
    mapHint: 'Ett kartark per gang. Merk på kartet med pennen.',
    show: 'Oppgitt i lista',
    showBoth: 'By og land',
    showCapital: 'Bare byen',
    showCountry: 'Bare landet',
    mapCount: 'Antall',
    target: 'Merk',
    targetCapital: 'Hovedsteder',
    targetCountry: 'Land',
    made: count => `Laget kartark med ${count} hovedsteder.`,
    countryMade: count => `Laget kartark med ${count} land.`,
    countryResult: (correct, total, percent) =>
      `Du fikk ${correct} av ${total} land riktig (${percent} %).`,
    result: (points, max, percent) =>
      `Du fikk ${thousands(points, ' ')} av ${thousands(
        max,
        ' ',
      )} poeng (${percent} %).`,
  },
  progress: {
    findingMap: 'Finner kartet …',
    findingMarks: 'Finner merkene på kartet …',
  },
  errors: {
    mapFile: detail => `Fant ikke kartbildet i pluginmappen (${detail}).`,
    noEntries: 'Fant ingen byer i lista på kartarket.',
  },
};

const en: MapTexts = {
  titlePrefix: 'Capitals on the map',
  countryTitlePrefix: 'Countries on the map',
  countrySubtitle:
    'Put a cross inside each country, in the same order as the list.\n' +
    'To skip a country, draw a line in the box in front of it. Grade the page from the World Capitals Quiz menu.',
  countryTotalPrefix: 'Correct countries:',
  countryTotal: (correct, total) => `Correct countries: ${correct} of ${total}`,
  subtitle: style =>
    (style === 'country'
      ? 'Put a cross on the map where the capital of each country is, in the same order as the list.\n'
      : 'Put a cross on the map where each city is, in the same order as the list.\n') +
    'To skip one, draw a line in the box in front of it. Grade the page from the World Capitals Quiz menu.',
  entry: (n, capital, country) =>
    capital === country ? `${n}. ${capital}` : `${n}. ${capital} (${country})`,
  points: (points, km) => `${points} pts · ${thousands(km, ',')} km`,
  skipped: 'skipped',
  missing: 'not marked',
  totalPrefix: 'Map score:',
  total: (points, max) =>
    `Map score: ${thousands(points, ',')} of ${thousands(max, ',')}`,
  unusedMarks: n =>
    n === 1
      ? 'One mark did not fit the list and was left out (shown with ?).'
      : `${n} marks did not fit the list and were left out (shown with ?).`,
  unmarked: (n, countries) =>
    countries
      ? n === 1
        ? 'One country got no mark.'
        : `${n} countries got no mark.`
      : n === 1
      ? 'One city got no mark.'
      : `${n} cities got no mark.`,
  ui: {
    mode: 'Game',
    modeTable: 'Table',
    modeMap: 'Map',
    mapHint:
      'One map sheet at a time. Mark on the map with the pen.',
    show: 'Shown in the list',
    showBoth: 'City and country',
    showCapital: 'City only',
    showCountry: 'Country only',
    mapCount: 'How many',
    target: 'Mark',
    targetCapital: 'Capitals',
    targetCountry: 'Countries',
    made: count => `Made a map sheet with ${count} capitals.`,
    countryMade: count => `Made a map sheet with ${count} countries.`,
    countryResult: (correct, total, percent) =>
      `You got ${correct} of ${total} countries right (${percent} %).`,
    result: (points, max, percent) =>
      `You got ${thousands(points, ',')} of ${thousands(
        max,
        ',',
      )} points (${percent} %).`,
  },
  progress: {
    findingMap: 'Finding the map …',
    findingMarks: 'Finding the marks on the map …',
  },
  errors: {
    mapFile: detail =>
      `Could not find the map image in the plugin folder (${detail}).`,
    noEntries: 'No cities found in the list on the map sheet.',
  },
};

const OWN: Record<string, MapTexts> = {nb, en};

const cache = new Map<string, MapTexts>();

/** The map texts for a language: own texts for nb and en, otherwise English with the language's own title. */
export function mapTexts(lang: Language): MapTexts {
  const own = OWN[lang.code];
  if (own) {
    return own;
  }
  let t = cache.get(lang.code);
  if (!t) {
    t = {
      ...en,
      titlePrefix: `${lang.sheet.titlePrefix} · map`,
      countryTitlePrefix: `${lang.sheet.colCountry} · map`,
    };
    cache.set(lang.code, t);
  }
  return t;
}

/** All prefixes for the total, so it can be removed when regrading in any language. */
export const MAP_TOTAL_PREFIXES = [
  nb.totalPrefix,
  en.totalPrefix,
  nb.countryTotalPrefix,
  en.countryTotalPrefix,
];
