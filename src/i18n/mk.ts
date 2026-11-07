// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/mk';
import {sheetLanguage} from './base';

const mk = sheetLanguage({
  code: 'mk',
  label: 'Македонски',
  locales: ['mk'],
  countries,
  continents: {EU: 'Европа', AS: 'Азија', AF: 'Африка', NA: 'Северна Америка', SA: 'Јужна Америка', OC: 'Океанија'},
  world: 'Свет',
  titlePrefix: 'Главни градови',
  subtitle: 'Напишете го главниот град на секоја држава.',
  colCountry: 'Држава',
  colAnswer: 'Главен град',
  colResult: 'Резултат',
  scoreWord: 'Поени',
  readWord: 'прочитано',
});

export default mk;
