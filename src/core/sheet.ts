import {CONTINENT_OF, COUNTRY_CODES, type Continent, type CountryCode} from '../data/countries';
import {ENGLISH, LANGUAGES, type Language} from '../i18n';
import {countriesIn, type Country} from './countries';
import type {MarkKind} from './marks';
import {matchAnswer, normalizeCached, type MatchResult} from './match';

/** Emojier fra tidligere versjoner; kjennes igjen og fjernes ved ny retting. */
const LEGACY_MARKS = ['✅', '❌'];

/**
 * Alt som starter slik regnes som resultater og fjernes ved ny retting,
 * på alle inkluderte språk og fra eldre versjoner.
 */
export const RESULT_PREFIXES = [
  ...LEGACY_MARKS,
  ...LANGUAGES.flatMap(l => [l.sheet.scorePrefix, ...(l.sheet.legacyResultPrefixes ?? [])]),
];

export type Region = Continent | 'ALL';

export function regionName(region: Region, lang: Language): string {
  return region === 'ALL' ? lang.world : lang.continents[region];
}

/** Høyst så mange land per side; flere enn dette deles på flere sider. */
export const MAX_PER_PAGE = 20;

export function sheetTitle(lang: Language, region: Region, count: number, part = 1, parts = 1): string {
  const base = `${lang.sheet.titlePrefix} – ${regionName(region, lang)} (${count})`;
  return parts > 1 ? base + lang.sheet.partSuffix(part, parts) : base;
}

export interface SheetInfo {
  part: number;
  parts: number;
  /** Mest sannsynlige språk ut fra overskriften alene. */
  lang: Language;
  /**
   * Alle språk overskriften kan være skrevet på, best først. Flere språk deler
   * overskrift (f.eks. «Capitales» på fransk og spansk, «首都» på kinesisk og
   * japansk); da avgjøres språket av landnavnene på siden.
   */
  candidates: Language[];
}

/** Kjenner igjen en overskrift på et av de inkluderte språkene og leser «side k av n». */
export function parseSheetTitle(title: string): SheetInfo | null {
  const scored = LANGUAGES.filter(l => title.startsWith(l.sheet.titlePrefix))
    .map(l => {
      const rest = title.slice(l.sheet.titlePrefix.length);
      const regions = [l.world, ...Object.values(l.continents)];
      const regionHit = regions.some(r => rest.startsWith(` – ${r} (`));
      return {l, score: (regionHit ? 1000 : 0) + l.sheet.titlePrefix.length};
    })
    .sort((a, b) => b.score - a.score);
  if (!scored.length) {
    return null;
  }
  const candidates = scored.map(x => x.l);
  const lang = candidates[0];
  const m = title.match(lang.sheet.partPattern);
  if (!m) {
    return {part: 1, parts: 1, lang, candidates};
  }
  const part = Number(m[1]);
  const parts = Number(m[2]);
  return part >= 1 && part <= parts ? {part, parts, lang, candidates} : null;
}

/** Fordeler landene jevnt på så få sider som mulig, med høyst `max` per side. */
export function splitIntoPages<T>(items: T[], max = MAX_PER_PAGE): T[][] {
  if (!items.length) {
    return [];
  }
  const pages = Math.ceil(items.length / max);
  const out: T[][] = [];
  let start = 0;
  for (let i = 0; i < pages; i++) {
    // Fordel resten slik at de første sidene får én ekstra.
    const size = Math.floor(items.length / pages) + (i < items.length % pages ? 1 : 0);
    out.push(items.slice(start, start + size));
    start += size;
  }
  return out;
}

/** Antall land i en region. */
export function regionSize(region: Region): number {
  return COUNTRY_CODES.filter(c => region === 'ALL' || CONTINENT_OF[c] === region).length;
}

/** Trekker `count` tilfeldige land fra regionen. `random` kan byttes ut i tester. */
export function pickCountries(
  lang: Language,
  region: Region,
  count: number,
  random: () => number = Math.random,
): Country[] {
  const pool = countriesIn(lang).filter(c => region === 'ALL' || c.continent === region);
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

function answersIn(lang: Language, code: CountryCode): string[] {
  const [, capital, alternatives] = lang.countries[code];
  return [capital, ...(alternatives ?? [])];
}

/**
 * Svar som godtas med noen skrivefeil: hovedstaden og alternativene på arkets
 * språk, og på engelsk.
 */
export function acceptedAnswers(country: Country): string[] {
  const english = ENGLISH && ENGLISH.code !== country.lang ? answersIn(ENGLISH, country.code) : [];
  return [...new Set([country.capital, ...country.alternatives, ...english])];
}

let allAnswers: Map<CountryCode, string[]> | null = null;

/** Hovedstaden og alternativene på alle inkluderte språk. */
function answersAllLanguages(code: CountryCode): string[] {
  if (!allAnswers) {
    allAnswers = new Map(
      COUNTRY_CODES.map(c => [c, [...new Set(LANGUAGES.flatMap(l => answersIn(l, c)))]]),
    );
  }
  return allAnswers.get(code)!;
}

const rejectedCache = new Map<CountryCode, Set<string>>();

/**
 * Hovedsteder i andre land, på alle språk og normalisert: skriver du en av dem
 * nøyaktig, er svaret feil. Svar som også er riktige for dette landet, tas ut.
 */
function otherCapitals(country: Country): Set<string> {
  let set = rejectedCache.get(country.code);
  if (!set) {
    const own = new Set(answersAllLanguages(country.code).map(normalizeCached));
    set = new Set();
    for (const code of COUNTRY_CODES) {
      if (code !== country.code) {
        for (const a of answersAllLanguages(code)) {
          const n = normalizeCached(a);
          if (!own.has(n)) {
            set.add(n);
          }
        }
      }
    }
    rejectedCache.set(country.code, set);
  }
  return set;
}

/**
 * Riktig hovedstad på arkets språk, alternativene og engelsk godtas med noen
 * skrivefeil. Hovedstaden på et hvilket som helst annet inkludert språk godtas
 * når den er skrevet riktig.
 */
export function gradeAnswer(country: Country, recognized: string): MatchResult {
  return matchAnswer(recognized, acceptedAnswers(country), otherCapitals(country), answersAllLanguages(country.code));
}

/** Hvilket håndtegnet merke en rad får: svart hake, grå hake med spørsmålstegn (nesten) eller kryss. */
export function resultMark(result: MatchResult): MarkKind {
  switch (result.verdict) {
    case 'correct':
      return 'check';
    case 'close':
      return 'almost';
    default:
      return 'cross';
  }
}

/**
 * Teksten ved siden av merket, på arkets språk.
 * Riktig: ingen tekst. Nesten og blank: riktig stavemåte/fasit.
 * Feil: fasit, og hva gjenkjenningen leste på en egen linje.
 */
export function resultText(country: Country, recognized: string, result: MatchResult, lang: Language): string {
  const read = recognized.trim().replace(/\s+/g, ' ');
  switch (result.verdict) {
    case 'correct':
      return '';
    case 'close':
    case 'blank':
      return country.capital;
    default:
      return `${country.capital}\n${lang.sheet.read(read)}`;
  }
}

export function isResultText(text: string): boolean {
  return RESULT_PREFIXES.some(p => text.startsWith(p));
}

/** «Nesten» teller som riktig i poengsummen. */
export function isPoint(result: MatchResult): boolean {
  return result.verdict === 'correct' || result.verdict === 'close';
}
