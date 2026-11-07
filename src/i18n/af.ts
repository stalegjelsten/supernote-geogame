// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/af';
import {sheetLanguage} from './base';

const af = sheetLanguage({
  code: 'af',
  label: 'Afrikaans',
  locales: ['af'],
  countries,
  continents: {EU: 'Europa', AS: 'Asië', AF: 'Afrika', NA: 'Noord-Amerika', SA: 'Suid-Amerika', OC: 'Oseanië'},
  world: 'wêreld',
  titlePrefix: 'Hoofstede',
  subtitle: 'Skryf die hoofstad van elke land.',
  colCountry: 'Land',
  colAnswer: 'Hoofstad',
  colResult: 'Resultaat',
  scoreWord: 'Punte',
  readWord: 'gelees',
});

export default af;
