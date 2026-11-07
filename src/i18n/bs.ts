// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/bs';
import menu from './menu/bs';
import {sheetLanguage} from './base';

const bs = sheetLanguage({
  code: 'bs',
  label: 'Bosanski',
  locales: ['bs'],
  countries,
  continents: {EU: 'Evropa', AS: 'Azija', AF: 'Afrika', NA: 'Sjeverna Amerika', SA: 'Južna Amerika', OC: 'Okeanija'},
  world: 'Svijet',
  titlePrefix: 'Glavni gradovi',
  subtitle: 'Napišite glavni grad svake države.',
  colCountry: 'Država',
  colAnswer: 'Glavni grad',
  colResult: 'Rezultat',
  scoreWord: 'Bodovi',
  readWord: 'pročitano',
  menu,
});

export default bs;
