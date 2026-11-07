/**
 * Land på et bestemt språk, bygget fra de språkuavhengige dataene og språkfilene.
 */
import {CONTINENT_OF, COUNTRY_CODES, type Continent, type CountryCode} from '../data/countries';
import {LANGUAGES, type Language} from '../i18n';

export interface Country {
  code: CountryCode;
  /** Språket navnene er på. */
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
 * Finner et land på navnet slik det står på arket. Arkets språk prøves først,
 * deretter de andre inkluderte språkene.
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
 * Velger språket et ark er skrevet på blant kandidatene fra overskriften:
 * det språket der flest av tekstene på siden er landnavn. Ved likt antall
 * vinner den første kandidaten.
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
