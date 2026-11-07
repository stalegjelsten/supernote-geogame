// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/nl';
import menu from './menu/nl';
import {sheetLanguage} from './base';

const nl = sheetLanguage({
  code: 'nl',
  label: 'Nederlands',
  locales: ['nl'],
  countries,
  continents: {EU: 'Europa', AS: 'Azië', AF: 'Afrika', NA: 'Noord-Amerika', SA: 'Zuid-Amerika', OC: 'Oceanië'},
  world: 'wereld',
  titlePrefix: 'Hoofdsteden',
  subtitle: 'Schrijf de hoofdstad van elk land op.',
  colCountry: 'Land',
  colAnswer: 'Hoofdstad',
  colResult: 'Resultaat',
  scoreWord: 'Punten',
  readWord: 'gelezen',
  menu,
});

export default nl;
