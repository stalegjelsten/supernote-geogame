// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/uk';
import menu from './menu/uk';
import {sheetLanguage} from './base';

const uk = sheetLanguage({
  code: 'uk',
  label: 'Українська',
  locales: ['uk'],
  countries,
  continents: {EU: 'Європа', AS: 'Азія', AF: 'Африка', NA: 'Північна Америка', SA: 'Південна Америка', OC: 'Океанія'},
  world: 'Світ',
  titlePrefix: 'Столиці',
  subtitle: 'Напишіть столицю кожної країни.',
  colCountry: 'Країна',
  colAnswer: 'Столиця',
  colResult: 'Результат',
  scoreWord: 'Бали',
  readWord: 'розпізнано',
  menu,
});

export default uk;
