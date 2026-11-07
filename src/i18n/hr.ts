// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/hr';
import menu from './menu/hr';
import {sheetLanguage} from './base';

const hr = sheetLanguage({
  code: 'hr',
  label: 'Hrvatski',
  locales: ['hr'],
  countries,
  continents: {EU: 'Europa', AS: 'Azija', AF: 'Afrika', NA: 'Sjevernoamerički kontinent', SA: 'Južna Amerika', OC: 'Oceanija'},
  world: 'Svijet',
  titlePrefix: 'Glavni gradovi',
  subtitle: 'Napišite glavni grad svake države.',
  colCountry: 'Država',
  colAnswer: 'Glavni grad',
  colResult: 'Rezultat',
  scoreWord: 'Bodovi',
  readWord: 'pročitano',
  menu,
});

export default hr;
