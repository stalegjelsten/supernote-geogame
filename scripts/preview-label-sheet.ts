/**
 * Preview of a label sheet ("name the countries on the map") without a device: draws the
 * sheet the way the plugin makes it, writes some made-up answers in the boxes and grades them
 * with the same code as the plugin (the "recognized" text is the made-up answer).
 *
 *   node --no-warnings --import ./scripts/ts-resolve.mjs scripts/preview-label-sheet.ts [region] [language] [count] [manta|nomad] [answers]
 *
 * Without the fifth argument "answers" only the blank sheet is drawn.
 * Writes build/preview/navnekart-<region>-<count>.svg and .png (PNG requires rsvg-convert).
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {MAPS} from '../src/data/maps.ts';
import {getLanguage} from '../src/i18n/index.ts';
import {countryIn} from '../src/core/countries.ts';
import {
  gradeLabel,
  labelLayout,
  labelResultDrafts,
  labelSeparation,
  labelSheetDrafts,
  pickLabelCountries,
  type GradedLabel,
} from '../src/core/labelSheet.ts';
import type {Draft} from '../src/core/draft.ts';
import type {Region} from '../src/core/sheet.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const region = (process.argv[2] ?? 'EU') as Region;
const lang = getLanguage(process.argv[3] ?? 'nb')!;
const count = Number(process.argv[4] ?? 10);
const small = ['nomad', 'a5x'].includes((process.argv[5] ?? '').toLowerCase());
const withAnswers = process.argv[6] === 'answers';
const PAGE = small ? {width: 1404, height: 1872} : {width: 1920, height: 2560};

let seed = 11;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const codes = pickLabelCountries(lang, region, count, random, undefined, 'mixed', labelSeparation(PAGE)).map(c => c.code);
const file = path.join(ROOT, `assets/maps/${MAPS[region].file}.png`);
const sheet = labelSheetDrafts(PAGE, lang, region, codes, file, 'abc123');
const L = labelLayout(PAGE, region, codes);

// Made-up answers: most right, one misspelt, one wrong, one empty.
const answers = codes.map((c, i) => {
  const name = countryIn(lang, c).name;
  if (i % 7 === 3) {
    return name.slice(0, -1) + 'x';
  }
  if (i % 7 === 5) {
    return countryIn(lang, codes[(i + 1) % codes.length]).name;
  }
  if (i % 7 === 6) {
    return '';
  }
  return name;
});
const graded: GradedLabel[] = codes.map((c, i) => {
  const country = countryIn(lang, c);
  return {index: i, country, recognized: answers[i], result: gradeLabel(country, answers[i], lang)};
});
const results = withAnswers ? labelResultDrafts(PAGE, lang, region, codes, graded) : [];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const GRAY = (c: number) => (c === 0 ? '#000' : '#7a7a7a');
const svgOf = (d: Draft): string => {
  switch (d.kind) {
    case 'picture': {
      const data = fs.readFileSync(d.path).toString('base64');
      const {left, top, right, bottom} = d.rect;
      return `<image x="${left}" y="${top}" width="${right - left}" height="${bottom - top}" preserveAspectRatio="none" href="data:image/png;base64,${data}"/>`;
    }
    case 'text': {
      const anchor = d.align === 2 ? 'end' : 'start';
      const x = d.align === 2 ? d.rect.right : d.rect.left;
      return d.text
        .split('\n')
        .map(
          (l, i) =>
            `<text x="${x}" y="${d.rect.top + d.fontSize * (1 + i * 1.35)}" font-family="Helvetica, Arial, sans-serif" font-size="${d.fontSize}" font-weight="${d.bold ? 700 : 400}" text-anchor="${anchor}">${esc(l)}</text>`,
        )
        .join('');
    }
    case 'line':
      return `<line x1="${d.a.x}" y1="${d.a.y}" x2="${d.b.x}" y2="${d.b.y}" stroke="${GRAY(d.color)}" stroke-width="3" stroke-linecap="round"/>`;
    case 'path':
      return `<polyline points="${d.points.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${GRAY(d.color)}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
};
// The answers in a "handwriting" font, in blue so they stand apart from what the plugin draws.
const hand = withAnswers
  ? L.slots
      .map((s, i) => {
        const b = s.box;
        const size = Math.round((b.bottom - b.top) * 0.42);
        return `<text x="${b.left + 12}" y="${b.bottom - size * 0.55}" font-family="Bradley Hand, Comic Sans MS, cursive" font-size="${size}" fill="#1a4fd0" textLength="${Math.min(
          b.right - b.left - 24,
          answers[i].length * size * 0.55,
        )}" lengthAdjust="spacingAndGlyphs">${esc(answers[i])}</text>`;
      })
      .join('\n')
  : '';

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE.width}" height="${PAGE.height}" viewBox="0 0 ${PAGE.width} ${PAGE.height}">
<rect width="100%" height="100%" fill="#fff"/>
${sheet.map(svgOf).join('\n')}
${hand}
${results.map(svgOf).join('\n')}
</svg>`;

const out = path.join(ROOT, 'build/preview');
fs.mkdirSync(out, {recursive: true});
const base = path.join(out, `navnekart-${MAPS[region].file}-${count}${small ? '-nomad' : ''}${withAnswers ? '-rettet' : ''}`);
fs.writeFileSync(`${base}.svg`, svg);
try {
  execFileSync('rsvg-convert', ['-o', `${base}.png`, `${base}.svg`]);
  console.log(`${base}.png`);
} catch {
  console.log(`${base}.svg (rsvg-convert missing, so no PNG)`);
}
