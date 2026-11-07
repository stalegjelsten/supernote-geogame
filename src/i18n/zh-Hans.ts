// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/zh-Hans';
import menu from './menu/zh-Hans';
import {sheetLanguage} from './base';

const zhHans = sheetLanguage({
  code: 'zh-Hans',
  label: '简体中文',
  locales: ['zh', 'zh_hans', 'zh_cn', 'zh_sg'],
  countries,
  continents: {EU: '欧洲', AS: '亚洲', AF: '非洲', NA: '北美洲', SA: '南美洲', OC: '大洋洲'},
  world: '世界',
  titlePrefix: '首都',
  subtitle: '写出每个国家的首都。',
  colCountry: '国家',
  colAnswer: '首都',
  colResult: '结果',
  scoreWord: '得分',
  readWord: '识别为',
  menu,
});

export default zhHans;
