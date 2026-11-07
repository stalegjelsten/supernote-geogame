// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/sq';
import {sheetLanguage} from './base';

const sq = sheetLanguage({
  code: 'sq',
  label: 'Shqip',
  locales: ['sq'],
  countries,
  continents: {EU: 'Evropë', AS: 'Azi', AF: 'Afrikë', NA: 'Amerika e Veriut', SA: 'Amerika e Jugut', OC: 'Oqeani'},
  world: 'Bota',
  titlePrefix: 'Kryeqytetet',
  subtitle: 'Shkruaj kryeqytetin e çdo vendi.',
  colCountry: 'Vendi',
  colAnswer: 'Kryeqyteti',
  colResult: 'Rezultati',
  scoreWord: 'Pikë',
  readWord: 'lexuar',
});

export default sq;
