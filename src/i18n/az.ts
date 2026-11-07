// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/az';
import {sheetLanguage} from './base';

const az = sheetLanguage({
  code: 'az',
  label: 'Azərbaycan dili',
  locales: ['az'],
  countries,
  continents: {EU: 'Avropa', AS: 'Asiya', AF: 'Afrika', NA: 'Şimali Amerika', SA: 'Cənubi Amerika', OC: 'Okeaniya'},
  world: 'Dünya',
  titlePrefix: 'Paytaxtlar',
  subtitle: 'Hər ölkənin paytaxtını yazın.',
  colCountry: 'Ölkə',
  colAnswer: 'Paytaxt',
  colResult: 'Nəticə',
  scoreWord: 'Xal',
  readWord: 'oxundu',
});

export default az;
