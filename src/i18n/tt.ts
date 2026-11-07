// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/tt';
import menu from './menu/tt';
import {sheetLanguage} from './base';

const tt = sheetLanguage({
  code: 'tt',
  label: 'Татарча',
  locales: ['tt'],
  countries,
  continents: {EU: 'Европа', AS: 'Азия', AF: 'Африка', NA: 'Төньяк Америка', SA: 'Көньяк Америка', OC: 'Океания'},
  world: 'дөнья',
  titlePrefix: 'Башкалалар',
  subtitle: 'Һәр илнең башкаласын языгыз.',
  colCountry: 'Ил',
  colAnswer: 'Башкала',
  colResult: 'Нәтиҗә',
  scoreWord: 'Балл',
  readWord: 'укылды',
  menu,
});

export default tt;
