// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/ga';
import menu from './menu/ga';
import {sheetLanguage} from './base';

const ga = sheetLanguage({
  code: 'ga',
  label: 'Gaeilge',
  locales: ['ga'],
  countries,
  continents: {EU: 'an Eoraip', AS: 'an Áise', AF: 'an Afraic', NA: 'Meiriceá Thuaidh', SA: 'Meiriceá Theas', OC: 'an Aigéine'},
  world: 'an Domhan',
  titlePrefix: 'Príomhchathracha',
  subtitle: 'Scríobh príomhchathair gach tíre.',
  colCountry: 'Tír',
  colAnswer: 'Príomhchathair',
  colResult: 'Toradh',
  scoreWord: 'Pointí',
  readWord: 'léite',
  menu,
});

export default ga;
