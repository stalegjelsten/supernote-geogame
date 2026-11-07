// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/lv';
import {sheetLanguage} from './base';

const lv = sheetLanguage({
  code: 'lv',
  label: 'Latviešu',
  locales: ['lv'],
  countries,
  continents: {EU: 'Eiropa', AS: 'Āzija', AF: 'Āfrika', NA: 'Ziemeļamerika', SA: 'Dienvidamerika', OC: 'Okeānija'},
  world: 'pasaule',
  titlePrefix: 'Galvaspilsētas',
  subtitle: 'Uzraksti katras valsts galvaspilsētu.',
  colCountry: 'Valsts',
  colAnswer: 'Galvaspilsēta',
  colResult: 'Rezultāts',
  scoreWord: 'Punkti',
  readWord: 'nolasīts',
});

export default lv;
