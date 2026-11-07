// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/mn';
import {sheetLanguage} from './base';

const mn = sheetLanguage({
  code: 'mn',
  label: 'Монгол',
  locales: ['mn'],
  countries,
  continents: {EU: 'Европ', AS: 'Ази', AF: 'Африк', NA: 'Хойд Америк', SA: 'Өмнөд Америк', OC: 'Номхон далайн орнууд'},
  world: 'Дэлхий',
  titlePrefix: 'Нийслэлүүд',
  subtitle: 'Улс бүрийн нийслэлийг бичнэ үү.',
  colCountry: 'Улс',
  colAnswer: 'Нийслэл',
  colResult: 'Үр дүн',
  scoreWord: 'Оноо',
  readWord: 'уншсан',
});

export default mn;
