// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/eu';
import {sheetLanguage} from './base';

const eu = sheetLanguage({
  code: 'eu',
  label: 'Euskara',
  locales: ['eu'],
  countries,
  continents: {EU: 'Europa', AS: 'Asia', AF: 'Afrika', NA: 'Ipar Amerika', SA: 'Hego Amerika', OC: 'Ozeania'},
  world: 'Mundua',
  titlePrefix: 'Hiriburuak',
  subtitle: 'Idatzi herrialde bakoitzaren hiriburua.',
  colCountry: 'Herrialdea',
  colAnswer: 'Hiriburua',
  colResult: 'Emaitza',
  scoreWord: 'Puntuak',
  readWord: 'irakurria',
});

export default eu;
