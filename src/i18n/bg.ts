// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/bg';
import {sheetLanguage} from './base';

const bg = sheetLanguage({
  code: 'bg',
  label: 'Български',
  locales: ['bg'],
  countries,
  continents: {EU: 'Европа', AS: 'Азия', AF: 'Африка', NA: 'Северноамерикански континент', SA: 'Южна Америка', OC: 'Океания'},
  world: 'свят',
  titlePrefix: 'Столици',
  subtitle: 'Напишете столицата на всяка държава.',
  colCountry: 'Държава',
  colAnswer: 'Столица',
  colResult: 'Резултат',
  scoreWord: 'Точки',
  readWord: 'прочетено',
});

export default bg;
