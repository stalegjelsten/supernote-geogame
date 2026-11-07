// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/cs';
import menu from './menu/cs';
import {sheetLanguage} from './base';

const cs = sheetLanguage({
  code: 'cs',
  label: 'Čeština',
  locales: ['cs'],
  countries,
  continents: {EU: 'Evropa', AS: 'Asie', AF: 'Afrika', NA: 'Severní Amerika', SA: 'Jižní Amerika', OC: 'Oceánie'},
  world: 'svět',
  titlePrefix: 'Hlavní města',
  subtitle: 'Napište hlavní město každé země.',
  colCountry: 'Země',
  colAnswer: 'Hlavní město',
  colResult: 'Výsledek',
  scoreWord: 'Body',
  readWord: 'přečteno',
  menu,
});

export default cs;
