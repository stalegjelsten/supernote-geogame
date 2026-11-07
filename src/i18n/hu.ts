// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/hu';
import {sheetLanguage} from './base';

const hu = sheetLanguage({
  code: 'hu',
  label: 'Magyar',
  locales: ['hu'],
  countries,
  continents: {EU: 'Európa', AS: 'Ázsia', AF: 'Afrika', NA: 'Észak-Amerika', SA: 'Dél-Amerika', OC: 'Óceánia'},
  world: 'Világ',
  titlePrefix: 'Fővárosok',
  subtitle: 'Írd be minden ország fővárosát.',
  colCountry: 'Ország',
  colAnswer: 'Főváros',
  colResult: 'Eredmény',
  scoreWord: 'Pontok',
  readWord: 'olvasva',
});

export default hu;
