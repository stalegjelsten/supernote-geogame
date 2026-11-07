// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/vi';
import menu from './menu/vi';
import {sheetLanguage} from './base';

const vi = sheetLanguage({
  code: 'vi',
  label: 'Tiếng Việt',
  locales: ['vi'],
  countries,
  continents: {EU: 'Châu Âu', AS: 'Châu Á', AF: 'Châu Phi', NA: 'Bắc Mỹ', SA: 'Nam Mỹ', OC: 'Châu Đại Dương'},
  world: 'Thế giới',
  titlePrefix: 'Thủ đô',
  subtitle: 'Viết thủ đô của mỗi quốc gia.',
  colCountry: 'Quốc gia',
  colAnswer: 'Thủ đô',
  colResult: 'Kết quả',
  scoreWord: 'Điểm',
  readWord: 'đã đọc',
  menu,
});

export default vi;
