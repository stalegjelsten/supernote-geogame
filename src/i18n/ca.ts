// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/ca';
import {sheetLanguage} from './base';

const ca = sheetLanguage({
  code: 'ca',
  label: 'Català',
  locales: ['ca'],
  countries,
  continents: {EU: 'Europa', AS: 'Àsia', AF: 'Àfrica', NA: 'Amèrica del Nord', SA: 'Amèrica del Sud', OC: 'Oceania'},
  world: 'Món',
  titlePrefix: 'Capitals',
  subtitle: 'Escriu la capital de cada país.',
  colCountry: 'País',
  colAnswer: 'Capital',
  colResult: 'Resultat',
  scoreWord: 'Punts',
  readWord: 'llegit',
});

export default ca;
