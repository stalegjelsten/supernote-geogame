// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/mg';
import menu from './menu/mg';
import {sheetLanguage} from './base';

const mg = sheetLanguage({
  code: 'mg',
  label: 'Malagasy',
  locales: ['mg'],
  countries,
  continents: {EU: 'Eoropa', AS: 'Azia', AF: 'Afrika', NA: 'Amerika Avaratra', SA: 'Amerika Atsimo', OC: 'Oseania'},
  world: 'Izao tontolo izao',
  titlePrefix: 'Renivohitra',
  subtitle: 'Soraty ny renivohitry ny firenena tsirairay.',
  colCountry: 'Firenena',
  colAnswer: 'Renivohitra',
  colResult: 'Vokatra',
  scoreWord: 'Isa',
  readWord: 'voavaky',
  menu,
});

export default mg;
