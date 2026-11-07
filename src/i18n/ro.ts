// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/ro';
import menu from './menu/ro';
import {sheetLanguage} from './base';

const ro = sheetLanguage({
  code: 'ro',
  label: 'Română',
  locales: ['ro'],
  countries,
  continents: {EU: 'Europa', AS: 'Asia', AF: 'Africa', NA: 'America de Nord', SA: 'America de Sud', OC: 'Oceania'},
  world: 'Lume',
  titlePrefix: 'Capitale',
  subtitle: 'Scrie capitala fiecărei țări.',
  colCountry: 'Țară',
  colAnswer: 'Capitală',
  colResult: 'Rezultat',
  scoreWord: 'Puncte',
  readWord: 'citit',
  menu,
});

export default ro;
