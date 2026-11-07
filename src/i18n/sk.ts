// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/sk';
import {sheetLanguage} from './base';

const sk = sheetLanguage({
  code: 'sk',
  label: 'Slovenčina',
  locales: ['sk'],
  countries,
  continents: {EU: 'Európa', AS: 'Ázia', AF: 'Afrika', NA: 'Severná Amerika', SA: 'Južná Amerika', OC: 'Oceánia'},
  world: 'svet',
  titlePrefix: 'Hlavné mestá',
  subtitle: 'Napíšte hlavné mesto každej krajiny.',
  colCountry: 'Krajina',
  colAnswer: 'Hlavné mesto',
  colResult: 'Výsledok',
  scoreWord: 'Body',
  readWord: 'prečítané',
});

export default sk;
