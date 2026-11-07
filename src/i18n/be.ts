// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/be';
import {sheetLanguage} from './base';

const be = sheetLanguage({
  code: 'be',
  label: 'Беларуская',
  locales: ['be'],
  countries,
  continents: {EU: 'Еўропа', AS: 'Азія', AF: 'Афрыка', NA: 'Паўночная Амерыка', SA: 'Паўднёвая Амерыка', OC: 'Акіянія'},
  world: 'Свет',
  titlePrefix: 'Сталіцы',
  subtitle: 'Напішыце сталіцу кожнай краіны.',
  colCountry: 'Краіна',
  colAnswer: 'Сталіца',
  colResult: 'Вынік',
  scoreWord: 'Балы',
  readWord: 'прачытана',
});

export default be;
