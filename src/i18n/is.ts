// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/is';
import {sheetLanguage} from './base';

const is = sheetLanguage({
  code: 'is',
  label: 'Íslenska',
  locales: ['is'],
  countries,
  continents: {EU: 'Evrópa', AS: 'Asía', AF: 'Afríka', NA: 'Norður-Ameríka', SA: 'Suður-Ameríka', OC: 'Eyjaálfa'},
  world: 'Heimurinn',
  titlePrefix: 'Höfuðborgir',
  subtitle: 'Skrifaðu höfuðborg hvers lands.',
  colCountry: 'Land',
  colAnswer: 'Höfuðborg',
  colResult: 'Niðurstaða',
  scoreWord: 'Stig',
  readWord: 'lesið',
});

export default is;
