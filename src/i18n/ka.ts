// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/ka';
import {sheetLanguage} from './base';

const ka = sheetLanguage({
  code: 'ka',
  label: 'ქართული',
  locales: ['ka'],
  countries,
  continents: {EU: 'ევროპა', AS: 'აზია', AF: 'აფრიკა', NA: 'ჩრდილოეთ ამერიკა', SA: 'სამხრეთ ამერიკა', OC: 'ოკეანეთი'},
  world: 'მსოფლიო',
  titlePrefix: 'დედაქალაქები',
  subtitle: 'დაწერეთ თითოეული ქვეყნის დედაქალაქი.',
  colCountry: 'ქვეყანა',
  colAnswer: 'დედაქალაქი',
  colResult: 'შედეგი',
  scoreWord: 'ქულა',
  readWord: 'წაკითხულია',
});

export default ka;
