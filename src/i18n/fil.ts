// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/fil';
import menu from './menu/fil';
import {sheetLanguage} from './base';

const fil = sheetLanguage({
  code: 'fil',
  label: 'Filipino',
  locales: ['fil', 'tl'],
  countries,
  continents: {EU: 'Europe', AS: 'Asya', AF: 'Africa', NA: 'Hilagang Amerika', SA: 'Timog Amerika', OC: 'Oceania'},
  world: 'mundo',
  titlePrefix: 'Mga Kabisera',
  subtitle: 'Isulat ang kabisera ng bawat bansa.',
  colCountry: 'Bansa',
  colAnswer: 'Kabisera',
  colResult: 'Resulta',
  scoreWord: 'Puntos',
  readWord: 'nabasa',
  menu,
});

export default fil;
