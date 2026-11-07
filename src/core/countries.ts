/**
 * Countries in a given language, built from the language-independent data and the language files.
 */
import {CONTINENT_OF, COUNTRY_CODES, type Continent, type CountryCode} from '../data/countries';
import {LANGUAGES, type Language} from '../i18n';

export interface Country {
  code: CountryCode;
  /** The language the names are in. */
  lang: string;
  name: string;
  capital: string;
  continent: Continent;
  alternatives: string[];
}

export function countryIn(lang: Language, code: CountryCode): Country {
  const [name, capital, alternatives] = lang.countries[code];
  return {code, lang: lang.code, name, capital, continent: CONTINENT_OF[code], alternatives: [...(alternatives ?? [])]};
}

const cache = new Map<string, {list: Country[]; byName: Map<string, Country>}>();

function indexFor(lang: Language) {
  let idx = cache.get(lang.code);
  if (!idx) {
    const list = COUNTRY_CODES.map(code => countryIn(lang, code));
    idx = {list, byName: new Map(list.map(c => [c.name, c]))};
    cache.set(lang.code, idx);
  }
  return idx;
}

export function countriesIn(lang: Language): Country[] {
  return indexFor(lang).list;
}

/**
 * Finds a country by its name as written on the sheet. The sheet's language is tried first,
 * then the other included languages.
 */
export function findCountryByName(name: string, preferred?: Language): Country | undefined {
  const key = name.trim();
  const order = preferred ? [preferred, ...LANGUAGES.filter(l => l.code !== preferred.code)] : LANGUAGES;
  for (const lang of order) {
    const found = indexFor(lang).byName.get(key);
    if (found) {
      return found;
    }
  }
  return undefined;
}

/**
 * Picks the language a sheet is written in among the candidates from the heading:
 * the language in which most of the texts on the page are country names. On a tie,
 * the first candidate wins.
 */
export function pickSheetLanguage(texts: string[], candidates: Language[]): Language {
  let best = candidates[0];
  let bestHits = -1;
  for (const lang of candidates) {
    const byName = indexFor(lang).byName;
    const hits = texts.filter(t => byName.has(t.trim())).length;
    if (hits > bestHits) {
      best = lang;
      bestHits = hits;
    }
  }
  return best;
}
