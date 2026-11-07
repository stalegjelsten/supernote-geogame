// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/ru';
import menu from './menu/ru';
import {sheetLanguage} from './base';

const ru = sheetLanguage({
  code: 'ru',
  label: 'Русский',
  locales: ['ru'],
  countries,
  continents: {EU: 'Европа', AS: 'Азия', AF: 'Африка', NA: 'Северная Америка', SA: 'Южная Америка', OC: 'Океания'},
  world: 'весь мир',
  titlePrefix: 'Столицы',
  subtitle: 'Напишите столицу каждой страны.',
  colCountry: 'Страна',
  colAnswer: 'Столица',
  colResult: 'Результат',
  scoreWord: 'Баллы',
  readWord: 'распознано',
  menu,
});

export default ru;
