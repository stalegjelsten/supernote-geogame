// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/ceb';
import {sheetLanguage} from './base';

const ceb = sheetLanguage({
  code: 'ceb',
  label: 'Binisaya',
  locales: ['ceb'],
  countries,
  continents: {EU: 'Europe', AS: 'Asia', AF: 'Africa', NA: 'North America', SA: 'South America', OC: 'Oceania'},
  world: 'kalibotan',
  titlePrefix: 'Mga Kaulohan',
  subtitle: 'Isulat ang kaulohan sa matag nasod.',
  colCountry: 'Nasod',
  colAnswer: 'Kaulohan',
  colResult: 'Resulta',
  scoreWord: 'Puntos',
  readWord: 'nabasa',
});

export default ceb;
