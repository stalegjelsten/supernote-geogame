/**
 * Short notes on capitals that are often confused with another city, or where the
 * country has several capitals. Shown as a footnote at the bottom of the table sheet when grading.
 *
 * Only Norwegian and English are written; the other languages get English text, like
 * the map mode (see map.ts). Keep each note short (preferably under 60 characters), so
 * several fit on a full page.
 */
import type {CountryCode} from '../data/countries';
import type {Language} from './types';

export type CapitalNotes = Partial<Record<CountryCode, string>>;

const nb: CapitalNotes = {
  // Europe
  DE: 'Bonn var hovedstad i Vest-Tyskland 1949–1990.',
  NL: 'Regjeringen og nasjonalforsamlingen sitter i Haag.',
  CH: 'Har ingen offisiell hovedstad; Bern er forbundsby.',
  RU: 'St. Petersburg var hovedstad fram til 1918.',
  ME: 'Cetinje er den gamle kongelige hovedstaden.',
  TR: 'Istanbul er største by; Ankara siden 1923.',
  // Asia
  AE: 'Dubai er største by, men ikke hovedstad.',
  CN: 'Shanghai er største by.',
  IN: 'Kolkata var hovedstad fram til 1911.',
  ID: 'Nusantara på Borneo bygges som ny hovedstad.',
  IL: 'Omstridt status; de fleste ambassadene er i Tel Aviv.',
  PS: 'Krevd hovedstad; regjeringen sitter i Ramallah.',
  JP: 'Kyoto var hovedstad fram til 1869.',
  KZ: 'Almaty var hovedstad til 1997 og er største by.',
  MY: 'Regjeringen sitter i Putrajaya.',
  MM: 'Yangon var hovedstad til 2005 og er største by.',
  PK: 'Karachi var hovedstad til 1959 og er største by.',
  PH: 'Quezon City er største by (hovedstad 1948–1976).',
  LK: 'Colombo er største by og handelshovedstad.',
  VN: 'Ho Chi Minh-byen er største by.',
  YE: 'Sanaa styres av houthiene; regjeringen sitter i Aden.',
  // Africa
  BJ: 'Regjeringen sitter i Cotonou, største by.',
  BI: 'Bujumbura var hovedstad til 2019, nå økonomisk hovedstad.',
  CI: 'Abidjan er største by og regjeringssete.',
  EG: 'Regjeringen flytter til en ny administrativ hovedstad.',
  CM: 'Douala er største by.',
  MA: 'Casablanca er største by.',
  NG: 'Lagos var hovedstad til 1991 og er største by.',
  SZ: 'Lobamba er kongelig og lovgivende hovedstad.',
  ZA: 'Tre hovedsteder: Pretoria, Kapp og Bloemfontein.',
  TZ: 'Dar es Salaam var hovedstad til 1996 og er største by.',
  // North and Central America
  BZ: 'Belize City var hovedstad til 1970 og er største by.',
  CA: 'Toronto er største by.',
  US: 'New York er største by.',
  // South America
  BO: 'Sucre er grunnlovsfestet; regjeringen sitter i La Paz.',
  BR: 'Rio de Janeiro var hovedstad til 1960.',
  CL: 'Nasjonalforsamlingen sitter i Valparaíso.',
  EC: 'Guayaquil er største by.',
  // Oceania
  AU: 'Sydney er største by; Melbourne var midlertidig hovedstad.',
  NR: 'Har ingen offisiell hovedstad; regjeringen sitter i Yaren.',
  NZ: 'Auckland er største by (hovedstad til 1865).',
  PW: 'Koror var hovedstad til 2006 og er største by.',
};

const en: CapitalNotes = {
  // Europe
  DE: 'Bonn was capital of West Germany 1949–1990.',
  NL: 'Government and parliament sit in The Hague.',
  CH: 'No official capital; Bern is the federal city.',
  RU: 'Saint Petersburg was capital until 1918.',
  ME: 'Cetinje is the old royal capital.',
  TR: 'Istanbul is the largest city; Ankara since 1923.',
  // Asia
  AE: 'Dubai is the largest city, but not the capital.',
  CN: 'Shanghai is the largest city.',
  IN: 'Kolkata was capital until 1911.',
  ID: 'Nusantara on Borneo is being built as the new capital.',
  IL: 'Status disputed; most embassies are in Tel Aviv.',
  PS: 'Claimed capital; the government sits in Ramallah.',
  JP: 'Kyoto was capital until 1869.',
  KZ: 'Almaty was capital until 1997 and is the largest city.',
  MY: 'The government sits in Putrajaya.',
  MM: 'Yangon was capital until 2005 and is the largest city.',
  PK: 'Karachi was capital until 1959 and is the largest city.',
  PH: 'Quezon City is the largest city (capital 1948–1976).',
  LK: 'Colombo is the largest city and commercial capital.',
  VN: 'Ho Chi Minh City is the largest city.',
  YE: 'Sanaa is held by the Houthis; the government sits in Aden.',
  // Africa
  BJ: 'The government sits in Cotonou, the largest city.',
  BI: 'Bujumbura was capital until 2019; now the economic capital.',
  CI: 'Abidjan is the largest city and seat of government.',
  EG: 'The government is moving to a New Administrative Capital.',
  CM: 'Douala is the largest city.',
  MA: 'Casablanca is the largest city.',
  NG: 'Lagos was capital until 1991 and is the largest city.',
  SZ: 'Lobamba is the royal and legislative capital.',
  ZA: 'Three capitals: Pretoria, Cape Town and Bloemfontein.',
  TZ: 'Dar es Salaam was capital until 1996 and is the largest city.',
  // North and Central America
  BZ: 'Belize City was capital until 1970 and is the largest city.',
  CA: 'Toronto is the largest city.',
  US: 'New York is the largest city.',
  // South America
  BO: 'Sucre is the constitutional capital; the government sits in La Paz.',
  BR: 'Rio de Janeiro was capital until 1960.',
  CL: 'Congress sits in Valparaíso.',
  EC: 'Guayaquil is the largest city.',
  // Oceania
  AU: 'Sydney is the largest city; Melbourne was the temporary capital.',
  NR: 'No official capital; the government sits in Yaren.',
  NZ: 'Auckland is the largest city (capital until 1865).',
  PW: 'Koror was capital until 2006 and is the largest city.',
};

const OWN: Record<string, CapitalNotes> = {nb, en};

/** The notes in the sheet's language, with English as fallback. */
export function capitalNotes(lang: Language): CapitalNotes {
  return OWN[lang.code] ?? en;
}

/** For tests: all languages that have their own notes. */
export const ALL_CAPITAL_NOTES: Record<string, CapitalNotes> = OWN;
