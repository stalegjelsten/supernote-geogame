// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/kk';
import menu from './menu/kk';
import {sheetLanguage} from './base';

const kk = sheetLanguage({
  code: 'kk',
  label: 'Қазақ тілі',
  locales: ['kk'],
  countries,
  continents: {EU: 'Еуропа', AS: 'Азия', AF: 'Африка', NA: 'Солтүстік Америка', SA: 'Оңтүстік Америка', OC: 'Океания'},
  world: 'әлем',
  titlePrefix: 'Астаналар',
  subtitle: 'Әр елдің астанасын жазыңыз.',
  colCountry: 'Ел',
  colAnswer: 'Астана',
  colResult: 'Нәтиже',
  scoreWord: 'Ұпай',
  readWord: 'оқылды',
  menu,
});

export default kk;
