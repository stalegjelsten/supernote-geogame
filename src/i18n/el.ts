// Generert av scripts/gen-languages.js – rediger tabellen der.
import countries from './countries/el';
import {sheetLanguage} from './base';

const el = sheetLanguage({
  code: 'el',
  label: 'Ελληνικά',
  locales: ['el'],
  countries,
  continents: {EU: 'Ευρώπη', AS: 'Ασία', AF: 'Αφρική', NA: 'Βόρεια Αμερική', SA: 'Νότια Αμερική', OC: 'Ωκεανία'},
  world: 'Κόσμος',
  titlePrefix: 'Πρωτεύουσες',
  subtitle: 'Γράψε την πρωτεύουσα κάθε χώρας.',
  colCountry: 'Χώρα',
  colAnswer: 'Πρωτεύουσα',
  colResult: 'Αποτέλεσμα',
  scoreWord: 'Βαθμοί',
  readWord: 'διαβάστηκε',
});

export default el;
