// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/sv';
import {sheetLanguage} from './base';

const sv = sheetLanguage({
  code: 'sv',
  label: 'Svenska',
  locales: ['sv'],
  countries,
  continents: {EU: 'Europa', AS: 'Asien', AF: 'Afrika', NA: 'Nordamerika', SA: 'Sydamerika', OC: 'Oceanien'},
  world: 'världen',
  titlePrefix: 'Huvudstäder',
  subtitle: 'Skriv huvudstaden för varje land.',
  colCountry: 'Land',
  colAnswer: 'Huvudstad',
  colResult: 'Resultat',
  scoreWord: 'Poäng',
  readWord: 'läst',
});

export default sv;
