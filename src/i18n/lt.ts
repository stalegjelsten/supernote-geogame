// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/lt';
import {sheetLanguage} from './base';

const lt = sheetLanguage({
  code: 'lt',
  label: 'Lietuvių',
  locales: ['lt'],
  countries,
  continents: {EU: 'Europa', AS: 'Azija', AF: 'Afrika', NA: 'Šiaurės Amerika', SA: 'Pietų Amerika', OC: 'Okeanija'},
  world: 'pasaulis',
  titlePrefix: 'Sostinės',
  subtitle: 'Parašykite kiekvienos šalies sostinę.',
  colCountry: 'Šalis',
  colAnswer: 'Sostinė',
  colResult: 'Rezultatas',
  scoreWord: 'Taškai',
  readWord: 'perskaityta',
});

export default lt;
