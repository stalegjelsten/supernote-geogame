/**
 * Other names for countries that are accepted when the country name is written (the outline
 * sheet), in addition to the name in the sheet's language and in English. Common
 * abbreviations (USA, UK, UAE), former and official names (Burma, Swaziland,
 * Czech Republic) and everyday names in English and Norwegian (Holland, Amerika).
 * They apply on sheets in every language.
 *
 * A name must never be the name of another country in any language (checked in the tests),
 * so ambiguous short forms such as "Korea", "Congo" or "Guinea" are left out.
 */
import type {CountryCode} from './countries';

export const COUNTRY_ALIASES: Partial<Record<CountryCode, readonly string[]>> = {
  US: ['USA', 'US', 'United States of America', 'America', 'Amerika', 'De forente stater'],
  GB: ['UK', 'Great Britain', 'Britain', 'Det forente kongerike', 'Storbritannia og Nord-Irland'],
  AE: ['UAE', 'Emirates', 'Emiratene', 'Forente arabiske emirater'],
  CD: ['DRC', 'DR Congo', 'Democratic Republic of the Congo', 'Congo-Kinshasa', 'Kongo-Kinshasa', 'Den demokratiske republikken Kongo'],
  CG: ['Congo-Brazzaville', 'Republic of Congo', 'Republikken Kongo'],
  CZ: ['Czech Republic', 'Den tsjekkiske republikk', 'Tsjekkia'],
  CF: ['CAR', 'Sentralafrikanske republikk', 'Den sentralafrikanske republikken'],
  DO: ['Dominikanske republikk', 'Den dominikanske republikken'],
  NL: ['Holland'],
  VA: ['Vatican', 'Holy See', 'Vatikanet', 'Vatikanstat'],
  CI: ["Côte d'Ivoire", 'Cote dIvoire'],
  CV: ['Cabo Verde'],
  SZ: ['Swaziland'],
  TL: ['Timor-Leste', 'Østtimor'],
  MM: ['Burma'],
  MK: ['Macedonia', 'Makedonia'],
  BA: ['Bosnia', 'Bosnia og Hercegovina', 'Bosnia-Herzegovina'],
  RU: ['Russian Federation', 'Den russiske føderasjon'],
  TR: ['Türkiye', 'Turkiye'],
  FM: ['Federated States of Micronesia', 'Mikronesiaføderasjonen'],
};
