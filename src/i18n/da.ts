// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/da';
import menu from './menu/da';
import {sheetLanguage} from './base';

const da = sheetLanguage({
  code: 'da',
  label: 'Dansk',
  locales: ['da'],
  countries,
  continents: {EU: 'Europa', AS: 'Asien', AF: 'Afrika', NA: 'Nordamerika', SA: 'Sydamerika', OC: 'Oceanien'},
  world: 'Verden',
  titlePrefix: 'Hovedstæder',
  subtitle: 'Skriv hovedstaden for hvert land.',
  colCountry: 'Land',
  colAnswer: 'Hovedstad',
  colResult: 'Resultat',
  scoreWord: 'Point',
  readWord: 'læst',
  menu,
});

export default da;
