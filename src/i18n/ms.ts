// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/ms';
import menu from './menu/ms';
import {sheetLanguage} from './base';

const ms = sheetLanguage({
  code: 'ms',
  label: 'Bahasa Melayu',
  locales: ['ms'],
  countries,
  continents: {EU: 'Eropah', AS: 'Asia', AF: 'Afrika', NA: 'Amerika Utara', SA: 'Amerika Selatan', OC: 'Oceania'},
  world: 'Dunia',
  titlePrefix: 'Ibu Negara',
  subtitle: 'Tulis ibu negara bagi setiap negara.',
  colCountry: 'Negara',
  colAnswer: 'Ibu negara',
  colResult: 'Keputusan',
  scoreWord: 'Markah',
  readWord: 'dibaca',
  menu,
});

export default ms;
