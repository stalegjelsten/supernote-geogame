// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/gl';
import {sheetLanguage} from './base';

const gl = sheetLanguage({
  code: 'gl',
  label: 'Galego',
  locales: ['gl'],
  countries,
  continents: {EU: 'Europa', AS: 'Asia', AF: 'África', NA: 'América do Norte', SA: 'América do Sur', OC: 'Oceanía'},
  world: 'Mundo',
  titlePrefix: 'Capitais',
  subtitle: 'Escribe a capital de cada país.',
  colCountry: 'País',
  colAnswer: 'Capital',
  colResult: 'Resultado',
  scoreWord: 'Puntos',
  readWord: 'lido',
});

export default gl;
