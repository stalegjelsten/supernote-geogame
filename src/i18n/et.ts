// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/et';
import menu from './menu/et';
import {sheetLanguage} from './base';

const et = sheetLanguage({
  code: 'et',
  label: 'Eesti',
  locales: ['et'],
  countries,
  continents: {EU: 'Euroopa', AS: 'Aasia', AF: 'Aafrika', NA: 'Põhja-Ameerika', SA: 'Lõuna-Ameerika', OC: 'Okeaania'},
  world: 'maailm',
  titlePrefix: 'Pealinnad',
  subtitle: 'Kirjuta iga riigi pealinn.',
  colCountry: 'Riik',
  colAnswer: 'Pealinn',
  colResult: 'Tulemus',
  scoreWord: 'Punktid',
  readWord: 'loetud',
  menu,
});

export default et;
