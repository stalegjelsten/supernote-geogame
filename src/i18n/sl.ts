// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/sl';
import {sheetLanguage} from './base';

const sl = sheetLanguage({
  code: 'sl',
  label: 'Slovenščina',
  locales: ['sl'],
  countries,
  continents: {EU: 'Evropa', AS: 'Azija', AF: 'Afrika', NA: 'Severna Amerika', SA: 'Južna Amerika', OC: 'Oceanija'},
  world: 'svet',
  titlePrefix: 'Glavna mesta',
  subtitle: 'Napišite glavno mesto vsake države.',
  colCountry: 'Država',
  colAnswer: 'Glavno mesto',
  colResult: 'Rezultat',
  scoreWord: 'Točke',
  readWord: 'prebrano',
});

export default sl;
