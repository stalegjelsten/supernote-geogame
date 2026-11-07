#!/usr/bin/env node
/**
 * Generates the language files for the languages Supernote can recognize handwriting in
 * (https://support.supernote.com/handwriting-recognition), except nb and en,
 * which are written by hand.
 *
 *   node scripts/gen-languages.js
 *
 * Sources:
 * - Country and continent names: CLDR via Intl.DisplayNames in Node (full ICU).
 * - Capitals: Wikidata labels, stored in scripts/data/capitals-wikidata.json
 *   (fetched with wbgetentities for the capital (P36) of each country).
 *   If a language lacks a label, the fallback languages in `wd` are tried, then 'mul' and 'en'.
 * - Cities that are de facto also capitals (seat of government, several official capitals):
 *   Wikidata labels in scripts/data/co-capitals-wikidata.json. They are accepted as answers
 *   in the language itself and in English. Former capitals are not listed there.
 * - The sheet texts in the table below are translated by hand.
 *
 * Writes src/i18n/countries/<code>.ts and src/i18n/<code>.ts. Which languages are
 * bundled is still controlled by LANGUAGES in src/i18n/index.ts.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const I18N = path.join(ROOT, 'src/i18n');

// [code, name, device locales, CLDR locale, Wikidata fallbacks, title, subtitle, Country, Capital, Result, Score, "read"]
const TABLE = [
  ['af', 'Afrikaans', ['af'], 'af', ['af', 'nl'], 'Hoofstede', 'Skryf die hoofstad van elke land.', 'Land', 'Hoofstad', 'Resultaat', 'Punte', 'gelees'],
  ['sq', 'Shqip', ['sq'], 'sq', ['sq'], 'Kryeqytetet', 'Shkruaj kryeqytetin e çdo vendi.', 'Vendi', 'Kryeqyteti', 'Rezultati', 'Pikë', 'lexuar'],
  ['hy', 'Հայերեն', ['hy'], 'hy', ['hy'], 'Մայրաքաղաքներ', 'Գրեք յուրաքանչյուր երկրի մայրաքաղաքը։', 'Երկիր', 'Մայրաքաղաք', 'Արդյունք', 'Միավոր', 'կարդացվեց'],
  ['az', 'Azərbaycan dili', ['az'], 'az', ['az'], 'Paytaxtlar', 'Hər ölkənin paytaxtını yazın.', 'Ölkə', 'Paytaxt', 'Nəticə', 'Xal', 'oxundu'],
  ['eu', 'Euskara', ['eu'], 'eu', ['eu', 'es'], 'Hiriburuak', 'Idatzi herrialde bakoitzaren hiriburua.', 'Herrialdea', 'Hiriburua', 'Emaitza', 'Puntuak', 'irakurria'],
  ['be', 'Беларуская', ['be'], 'be', ['be', 'be-tarask', 'ru'], 'Сталіцы', 'Напішыце сталіцу кожнай краіны.', 'Краіна', 'Сталіца', 'Вынік', 'Балы', 'прачытана'],
  ['bs', 'Bosanski', ['bs'], 'bs', ['bs', 'sh', 'hr'], 'Glavni gradovi', 'Napišite glavni grad svake države.', 'Država', 'Glavni grad', 'Rezultat', 'Bodovi', 'pročitano'],
  ['bg', 'Български', ['bg'], 'bg', ['bg'], 'Столици', 'Напишете столицата на всяка държава.', 'Държава', 'Столица', 'Резултат', 'Точки', 'прочетено'],
  ['ca', 'Català', ['ca'], 'ca', ['ca', 'es'], 'Capitals', 'Escriu la capital de cada país.', 'País', 'Capital', 'Resultat', 'Punts', 'llegit'],
  ['ceb', 'Binisaya', ['ceb'], 'ceb', ['ceb', 'tl'], 'Mga Kaulohan', 'Isulat ang kaulohan sa matag nasod.', 'Nasod', 'Kaulohan', 'Resulta', 'Puntos', 'nabasa'],
  ['zh-Hans', '简体中文', ['zh', 'zh_hans', 'zh_cn', 'zh_sg'], 'zh-Hans', ['zh-hans', 'zh-cn', 'zh'], '首都', '写出每个国家的首都。', '国家', '首都', '结果', '得分', '识别为'],
  ['zh-Hant', '繁體中文', ['zh_hant', 'zh_tw', 'zh_hk', 'zh_mo'], 'zh-Hant', ['zh-hant', 'zh-tw', 'zh-hk', 'zh'], '首都', '寫出每個國家的首都。', '國家', '首都', '結果', '得分', '辨識為'],
  ['hr', 'Hrvatski', ['hr'], 'hr', ['hr', 'sh'], 'Glavni gradovi', 'Napišite glavni grad svake države.', 'Država', 'Glavni grad', 'Rezultat', 'Bodovi', 'pročitano'],
  ['cs', 'Čeština', ['cs'], 'cs', ['cs'], 'Hlavní města', 'Napište hlavní město každé země.', 'Země', 'Hlavní město', 'Výsledek', 'Body', 'přečteno'],
  ['da', 'Dansk', ['da'], 'da', ['da'], 'Hovedstæder', 'Skriv hovedstaden for hvert land.', 'Land', 'Hovedstad', 'Resultat', 'Point', 'læst'],
  ['nl', 'Nederlands', ['nl'], 'nl', ['nl'], 'Hoofdsteden', 'Schrijf de hoofdstad van elk land op.', 'Land', 'Hoofdstad', 'Resultaat', 'Punten', 'gelezen'],
  ['et', 'Eesti', ['et'], 'et', ['et'], 'Pealinnad', 'Kirjuta iga riigi pealinn.', 'Riik', 'Pealinn', 'Tulemus', 'Punktid', 'loetud'],
  ['fil', 'Filipino', ['fil', 'tl'], 'fil', ['tl'], 'Mga Kabisera', 'Isulat ang kabisera ng bawat bansa.', 'Bansa', 'Kabisera', 'Resulta', 'Puntos', 'nabasa'],
  ['fi', 'Suomi', ['fi'], 'fi', ['fi'], 'Pääkaupungit', 'Kirjoita jokaisen maan pääkaupunki.', 'Maa', 'Pääkaupunki', 'Tulos', 'Pisteet', 'luettu'],
  ['fr', 'Français', ['fr'], 'fr', ['fr'], 'Capitales', 'Écris la capitale de chaque pays.', 'Pays', 'Capitale', 'Résultat', 'Points', 'lu'],
  ['gl', 'Galego', ['gl'], 'gl', ['gl', 'pt', 'es'], 'Capitais', 'Escribe a capital de cada país.', 'País', 'Capital', 'Resultado', 'Puntos', 'lido'],
  ['ka', 'ქართული', ['ka'], 'ka', ['ka'], 'დედაქალაქები', 'დაწერეთ თითოეული ქვეყნის დედაქალაქი.', 'ქვეყანა', 'დედაქალაქი', 'შედეგი', 'ქულა', 'წაკითხულია'],
  ['de', 'Deutsch', ['de'], 'de', ['de'], 'Hauptstädte', 'Schreibe die Hauptstadt jedes Landes.', 'Land', 'Hauptstadt', 'Ergebnis', 'Punkte', 'gelesen'],
  ['el', 'Ελληνικά', ['el'], 'el', ['el'], 'Πρωτεύουσες', 'Γράψε την πρωτεύουσα κάθε χώρας.', 'Χώρα', 'Πρωτεύουσα', 'Αποτέλεσμα', 'Βαθμοί', 'διαβάστηκε'],
  ['hu', 'Magyar', ['hu'], 'hu', ['hu'], 'Fővárosok', 'Írd be minden ország fővárosát.', 'Ország', 'Főváros', 'Eredmény', 'Pontok', 'olvasva'],
  ['is', 'Íslenska', ['is'], 'is', ['is'], 'Höfuðborgir', 'Skrifaðu höfuðborg hvers lands.', 'Land', 'Höfuðborg', 'Niðurstaða', 'Stig', 'lesið'],
  ['id', 'Bahasa Indonesia', ['id', 'in'], 'id', ['id', 'ms'], 'Ibu Kota', 'Tulis ibu kota setiap negara.', 'Negara', 'Ibu kota', 'Hasil', 'Skor', 'terbaca'],
  ['ga', 'Gaeilge', ['ga'], 'ga', ['ga'], 'Príomhchathracha', 'Scríobh príomhchathair gach tíre.', 'Tír', 'Príomhchathair', 'Toradh', 'Pointí', 'léite'],
  ['it', 'Italiano', ['it'], 'it', ['it'], 'Capitali', 'Scrivi la capitale di ogni paese.', 'Paese', 'Capitale', 'Risultato', 'Punti', 'letto'],
  ['ja', '日本語', ['ja'], 'ja', ['ja'], '首都', '各国の首都を書いてください。', '国', '首都', '結果', '得点', '認識'],
  ['kk', 'Қазақ тілі', ['kk'], 'kk', ['kk-cyrl', 'kk', 'ru'], 'Астаналар', 'Әр елдің астанасын жазыңыз.', 'Ел', 'Астана', 'Нәтиже', 'Ұпай', 'оқылды'],
  ['ko', '한국어', ['ko'], 'ko', ['ko'], '수도', '각 나라의 수도를 쓰세요.', '나라', '수도', '결과', '점수', '인식'],
  ['lv', 'Latviešu', ['lv'], 'lv', ['lv'], 'Galvaspilsētas', 'Uzraksti katras valsts galvaspilsētu.', 'Valsts', 'Galvaspilsēta', 'Rezultāts', 'Punkti', 'nolasīts'],
  ['lt', 'Lietuvių', ['lt'], 'lt', ['lt'], 'Sostinės', 'Parašykite kiekvienos šalies sostinę.', 'Šalis', 'Sostinė', 'Rezultatas', 'Taškai', 'perskaityta'],
  ['mk', 'Македонски', ['mk'], 'mk', ['mk'], 'Главни градови', 'Напишете го главниот град на секоја држава.', 'Држава', 'Главен град', 'Резултат', 'Поени', 'прочитано'],
  ['mg', 'Malagasy', ['mg'], 'mg', ['mg', 'fr'], 'Renivohitra', 'Soraty ny renivohitry ny firenena tsirairay.', 'Firenena', 'Renivohitra', 'Vokatra', 'Isa', 'voavaky'],
  ['ms', 'Bahasa Melayu', ['ms'], 'ms', ['ms', 'id'], 'Ibu Negara', 'Tulis ibu negara bagi setiap negara.', 'Negara', 'Ibu negara', 'Keputusan', 'Markah', 'dibaca'],
  ['mn', 'Монгол', ['mn'], 'mn', ['mn', 'ru'], 'Нийслэлүүд', 'Улс бүрийн нийслэлийг бичнэ үү.', 'Улс', 'Нийслэл', 'Үр дүн', 'Оноо', 'уншсан'],
  ['pl', 'Polski', ['pl'], 'pl', ['pl'], 'Stolice', 'Wpisz stolicę każdego kraju.', 'Kraj', 'Stolica', 'Wynik', 'Punkty', 'odczytano'],
  ['pt', 'Português', ['pt'], 'pt', ['pt', 'pt-br'], 'Capitais', 'Escreva a capital de cada país.', 'País', 'Capital', 'Resultado', 'Pontos', 'lido'],
  ['ro', 'Română', ['ro'], 'ro', ['ro'], 'Capitale', 'Scrie capitala fiecărei țări.', 'Țară', 'Capitală', 'Rezultat', 'Puncte', 'citit'],
  ['ru', 'Русский', ['ru'], 'ru', ['ru'], 'Столицы', 'Напишите столицу каждой страны.', 'Страна', 'Столица', 'Результат', 'Баллы', 'распознано'],
  ['sr-Cyrl', 'Српски (ћирилица)', ['sr', 'sr_cyrl'], 'sr-Cyrl', ['sr-ec', 'sr'], 'Главни градови', 'Напишите главни град сваке државе.', 'Држава', 'Главни град', 'Резултат', 'Бодови', 'прочитано'],
  ['sr-Latn', 'Srpski (latinica)', ['sr_latn'], 'sr-Latn', ['sr-el', '@sr-latn', 'sh'], 'Glavni gradovi', 'Napišite glavni grad svake države.', 'Država', 'Glavni grad', 'Rezultat', 'Bodovi', 'pročitano'],
  ['sk', 'Slovenčina', ['sk'], 'sk', ['sk'], 'Hlavné mestá', 'Napíšte hlavné mesto každej krajiny.', 'Krajina', 'Hlavné mesto', 'Výsledok', 'Body', 'prečítané'],
  ['sl', 'Slovenščina', ['sl'], 'sl', ['sl'], 'Glavna mesta', 'Napišite glavno mesto vsake države.', 'Država', 'Glavno mesto', 'Rezultat', 'Točke', 'prebrano'],
  ['es', 'Español', ['es'], 'es', ['es'], 'Capitales', 'Escribe la capital de cada país.', 'País', 'Capital', 'Resultado', 'Puntos', 'leído'],
  ['sw', 'Kiswahili', ['sw'], 'sw', ['sw'], 'Miji Mikuu', 'Andika mji mkuu wa kila nchi.', 'Nchi', 'Mji mkuu', 'Matokeo', 'Alama', 'imesomwa'],
  ['sv', 'Svenska', ['sv'], 'sv', ['sv'], 'Huvudstäder', 'Skriv huvudstaden för varje land.', 'Land', 'Huvudstad', 'Resultat', 'Poäng', 'läst'],
  ['tt', 'Татарча', ['tt'], 'tt', ['tt-cyrl', 'tt', 'ru'], 'Башкалалар', 'Һәр илнең башкаласын языгыз.', 'Ил', 'Башкала', 'Нәтиҗә', 'Балл', 'укылды'],
  ['tr', 'Türkçe', ['tr'], 'tr', ['tr'], 'Başkentler', 'Her ülkenin başkentini yazın.', 'Ülke', 'Başkent', 'Sonuç', 'Puan', 'okunan'],
  ['uk', 'Українська', ['uk'], 'uk', ['uk'], 'Столиці', 'Напишіть столицю кожної країни.', 'Країна', 'Столиця', 'Результат', 'Бали', 'розпізнано'],
  ['vi', 'Tiếng Việt', ['vi'], 'vi', ['vi'], 'Thủ đô', 'Viết thủ đô của mỗi quốc gia.', 'Quốc gia', 'Thủ đô', 'Kết quả', 'Điểm', 'đã đọc'],
];

/** Continents CLDR has no names for. */
const CONTINENT_OVERRIDES = {
  mg: {EU: 'Eoropa', AS: 'Azia', AF: 'Afrika', NA: 'Amerika Avaratra', SA: 'Amerika Atsimo', OC: 'Oseania', world: 'Izao tontolo izao'},
};

const CLDR_REGION = {EU: '150', AS: '142', AF: '002', NA: '003', SA: '005', OC: '009', world: '001'};

/** Serbian Cyrillic → Latin (fixed, unambiguous scheme). */
const SR_LATN = {
  А: 'A', Б: 'B', В: 'V', Г: 'G', Д: 'D', Ђ: 'Đ', Е: 'E', Ж: 'Ž', З: 'Z', И: 'I', Ј: 'J', К: 'K', Л: 'L', Љ: 'Lj',
  М: 'M', Н: 'N', Њ: 'Nj', О: 'O', П: 'P', Р: 'R', С: 'S', Т: 'T', Ћ: 'Ć', У: 'U', Ф: 'F', Х: 'H', Ц: 'C', Ч: 'Č',
  Џ: 'Dž', Ш: 'Š',
};
function srToLatin(s) {
  return [...s]
    .map(ch => {
      const up = SR_LATN[ch];
      if (up) {
        return up;
      }
      const lo = SR_LATN[ch.toUpperCase()];
      return lo ? lo.toLowerCase() : ch;
    })
    .join('');
}

function readCountryCodes() {
  const src = fs.readFileSync(path.join(ROOT, 'src/data/countries.ts'), 'utf8');
  return [...src.matchAll(/^ {2}([A-Z]{2}): '(EU|AS|AF|NA|SA|OC)',/gm)].map(m => ({code: m[1], continent: m[2]}));
}

function cleanLabel(s) {
  return s.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function capitalFor(labels, chain) {
  for (const l of [...chain, 'mul', 'en']) {
    if (l === '@sr-latn') {
      const cyr = labels['sr-ec'] ?? labels.sr;
      if (cyr) {
        return srToLatin(cleanLabel(cyr));
      }
      continue;
    }
    if (labels[l]) {
      return cleanLabel(labels[l]);
    }
  }
  throw new Error('missing capital');
}

const q = s => (s.includes("'") ? JSON.stringify(s) : `'${s}'`);

function main() {
  const codes = readCountryCodes();
  if (codes.length !== 197) {
    throw new Error(`found ${codes.length} countries in src/data/countries.ts`);
  }
  const caps = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/capitals-wikidata.json'), 'utf8'));
  const coCaps = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/co-capitals-wikidata.json'), 'utf8'));
  const en = Object.fromEntries(
    [...fs.readFileSync(path.join(I18N, 'countries/en.ts'), 'utf8').matchAll(/^ {2}([A-Z]{2}): \[(['"])(.*?)\2, (['"])(.*?)\4/gm)].map(
      m => [m[1], m[5]],
    ),
  );

  for (const [code, label, locales, cldr, wd, title, subtitle, colCountry, colAnswer, colResult, score, read] of TABLE) {
    const names = new Intl.DisplayNames([cldr], {type: 'region'});
    const seen = new Map();
    const lines = [];
    let last;
    for (const {code: cc, continent} of codes) {
      if (continent !== last) {
        if (last) {
          lines.push('');
        }
        lines.push(`  // ${continent}`);
        last = continent;
      }
      let name = names.of(cc);
      if (seen.has(name)) {
        throw new Error(`${code}: duplicate country name "${name}" for ${seen.get(name)} and ${cc}`);
      }
      seen.set(name, cc);
      const capital = capitalFor(caps[cc].labels, wd);
      // Also accepted: the English capital, and cities that are de facto capitals (seat of
      // government etc.) in the language itself and in English.
      const alts = [];
      for (const alt of [en[cc], ...(coCaps[cc] ?? []).flatMap(c => [capitalFor(c.labels, wd), c.en])]) {
        if (alt && alt !== capital && !alts.includes(alt)) {
          alts.push(alt);
        }
      }
      lines.push(`  ${cc}: [${q(name)}, ${q(capital)}${alts.length ? `, [${alts.map(q).join(', ')}]` : ''}],`);
    }
    fs.writeFileSync(
      path.join(I18N, `countries/${code}.ts`),
      `/**\n * ${label}: countries (CLDR) and capitals (Wikidata). English capital as an alternative.\n * Generated by scripts/gen-languages.js – edit the table or the data there.\n */\n` +
        `import type {CountryNames} from '../types';\n\nconst countries: CountryNames = {\n${lines.join('\n')}\n};\n\nexport default countries;\n`,
    );

    const over = CONTINENT_OVERRIDES[code] ?? {};
    const cont = k => over[k] ?? names.of(CLDR_REGION[k]);
    const ident = code.replace('-', '');
    fs.writeFileSync(
      path.join(I18N, `${code}.ts`),
      '// Generated by scripts/gen-languages.js – edit the table there.\n' +
        `import countries from './countries/${code}';\nimport {sheetLanguage} from './base';\n\n` +
        `const ${ident} = sheetLanguage({\n` +
        `  code: ${q(code)},\n  label: ${q(label)},\n  locales: [${locales.map(q).join(', ')}],\n  countries,\n` +
        `  continents: {EU: ${q(cont('EU'))}, AS: ${q(cont('AS'))}, AF: ${q(cont('AF'))}, NA: ${q(cont('NA'))}, SA: ${q(cont('SA'))}, OC: ${q(cont('OC'))}},\n` +
        `  world: ${q(cont('world'))},\n` +
        `  titlePrefix: ${q(title)},\n  subtitle: ${q(subtitle)},\n  colCountry: ${q(colCountry)},\n  colAnswer: ${q(colAnswer)},\n` +
        `  colResult: ${q(colResult)},\n  scoreWord: ${q(score)},\n  readWord: ${q(read)},\n});\n\nexport default ${ident};\n`,
    );
  }
  console.log(`Wrote ${TABLE.length} languages.`);
  console.log(TABLE.map(([c]) => `import ${c.replace('-', '')} from './${c}';`).join('\n'));
}

main();
