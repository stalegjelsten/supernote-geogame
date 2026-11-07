// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/de';
import {sheetLanguage} from './base';

const de = sheetLanguage({
  code: 'de',
  label: 'Deutsch',
  locales: ['de'],
  countries,
  continents: {EU: 'Europa', AS: 'Asien', AF: 'Afrika', NA: 'Nordamerika', SA: 'Südamerika', OC: 'Ozeanien'},
  world: 'Welt',
  titlePrefix: 'Hauptstädte',
  subtitle: 'Schreibe die Hauptstadt jedes Landes.',
  colCountry: 'Land',
  colAnswer: 'Hauptstadt',
  colResult: 'Ergebnis',
  scoreWord: 'Punkte',
  readWord: 'gelesen',
});

export default de;
