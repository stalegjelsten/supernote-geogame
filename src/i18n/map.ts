/**
 * Tekst for kartmodusen («merk hovedstaden på kartet»).
 *
 * Ligger i en egen fil så kartmodusen kan bygges ut uten å endre fellestypen
 * for alle språk. Norsk og engelsk er skrevet for hånd. De andre språkene får
 * menyteksten fra menu/<kode>.ts og engelsk tekst på arket, men lista over
 * byer og land skrives på arkets språk, og
 * overskriften starter med språkets egen overskrift, så språket kjennes igjen
 * ved retting.
 */
import {fmt, thousands as menuThousands} from './menu/build';
import type {MenuStrings} from './menu/types';
import type {Language} from './types';

/** Hva lista på kartarket oppgir: by og land, bare byen, eller bare landet (da må du kunne hovedstaden). */
export type MapEntryStyle = 'both' | 'capital' | 'country';

export interface MapTexts {
  /** Overskriften starter med dette; brukes til å kjenne igjen et kartark og språket. */
  titlePrefix: string;
  /** Overskriften på et kartark der land (ikke hovedsteder) skal merkes. */
  countryTitlePrefix: string;
  /** Bruksanvisning for landmodusen, to linjer skilt med \n. */
  countrySubtitle: string;
  /** Starten på resultatet i landmodusen, f.eks. «Riktige land:». */
  countryTotalPrefix: string;
  countryTotal: (correct: number, total: number) => string;
  /** Bruksanvisning under overskriften, to linjer skilt med \n. */
  subtitle: (style: MapEntryStyle) => string;
  /** «3. Oslo (Norge)», eller «4. Singapore» når byen og landet heter det samme. */
  entry: (n: number, capital: string, country: string) => string;
  /** Poeng og avstand ved en oppføring etter retting. */
  points: (points: number, km: number) => string;
  skipped: string;
  missing: string;
  /** Starten på totalsummen; brukes til å fjerne den ved ny retting. */
  totalPrefix: string;
  total: (points: number, max: number) => string;
  /** Merknad om merker som ikke passet med lista (vist med «?» på kartet). */
  unusedMarks: (count: number) => string;
  /** Merknad om byer uten merke. */
  unmarked: (count: number, countries: boolean) => string;

  ui: {
    mode: string;
    modeTable: string;
    modeMap: string;
    /** Forklaring i menyen når kartmodus er valgt. */
    mapHint: string;
    /** Valget for hva lista oppgir. */
    show: string;
    showBoth: string;
    showCapital: string;
    showCountry: string;
    /** Antall byer på kartarket. */
    mapCount: string;
    /** Hva som skal merkes på kartet: hovedsteder eller land. */
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
    /** Fant ikke kartbildet i pluginmappen på enheten. */
    mapFile: (detail: string) => string;
    noEntries: string;
  };
}

/** Tusenskille med smalt mellomrom, f.eks. «10 000». */
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

function menuParts(m: MenuStrings): Pick<MapTexts, 'ui' | 'progress' | 'errors'> {
  return {
    ui: {
      mode: m.mapMode,
      modeTable: m.mapModeTable,
      modeMap: m.mapModeMap,
      mapHint: m.mapHint,
      show: m.mapShow,
      showBoth: m.mapShowBoth,
      showCapital: m.mapShowCapital,
      showCountry: m.mapShowCountry,
      mapCount: m.mapCount,
      target: m.mapTarget,
      targetCapital: m.mapTargetCapital,
      targetCountry: m.mapTargetCountry,
      made: count => fmt(m.mapMade, {count}),
      countryMade: count => fmt(m.mapCountryMade, {count}),
      result: (points, max, percent) =>
        fmt(m.mapResult, {points: menuThousands(m, points), max: menuThousands(m, max), percent}),
      countryResult: (correct, total, percent) => fmt(m.mapCountryResult, {correct, total, percent}),
    },
    progress: {
      findingMap: m.mapFindingMap,
      findingMarks: m.mapFindingMarks,
    },
    errors: {
      mapFile: detail => fmt(m.mapFile, {detail}),
      noEntries: m.mapNoEntries,
    },
  };
}

const cache = new Map<string, MapTexts>();

/** Karttekstene for et språk: egne for nb og en, ellers oversatt meny og engelsk ark med språkets egen overskrift. */
export function mapTexts(lang: Language): MapTexts {
  const own = OWN[lang.code];
  if (own) {
    return own;
  }
  let t = cache.get(lang.code);
  if (!t) {
    t = {
      ...en,
      ...(lang.menu ? menuParts(lang.menu) : {}),
      titlePrefix: `${lang.sheet.titlePrefix} · map`,
      countryTitlePrefix: `${lang.sheet.colCountry} · map`,
    };
    cache.set(lang.code, t);
  }
  return t;
}

/** Alle prefikser for totalsummen, så den kan fjernes ved ny retting uansett språk. */
export const MAP_TOTAL_PREFIXES = [
  nb.totalPrefix,
  en.totalPrefix,
  nb.countryTotalPrefix,
  en.countryTotalPrefix,
];
