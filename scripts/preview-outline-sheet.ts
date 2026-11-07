/**
 * Preview of an outline sheet (without a device): draws the sheet the way the plugin makes it,
 * and, with "graded", the results as if some answers were written.
 *
 *   node --no-warnings --import ./scripts/ts-resolve.mjs scripts/preview-outline-sheet.ts \
 *     [region] [language] [count] [large|medium|small] [fit|bar|log] [none|some|any] [manta|nomad] [graded]
 *
 * CODES=MC,VA,SM (environment) draws exactly those countries.
 *
 * Writes build/preview/omriss-<region>.svg and .png (PNG requires rsvg-convert).
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {getLanguage} from '../src/i18n/index.ts';
import {
  gradeCountryName,
  outlineResultDrafts,
  outlineSheetDrafts,
  pickOutlineCountries,
  randomAngle,
  type OutlineRotation,
  type OutlineScale,
  type OutlineSize,
} from '../src/core/outlineSheet.ts';
import type {Draft} from '../src/core/draft.ts';
import {countryIn} from '../src/core/countries.ts';
import type {CountryCode} from '../src/data/countries.ts';
import type {Region} from '../src/core/sheet.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const [regionArg, langArg, countArg, sizeArg, scaleArg, rotArg, deviceArg, gradedArg] = process.argv.slice(2);
const region = (regionArg ?? 'EU') as Region;
const lang = getLanguage(langArg ?? 'nb')!;
const count = Number(countArg ?? 12);
const size = (sizeArg ?? 'large') as OutlineSize;
const scale = (scaleArg ?? 'fit') as OutlineScale;
const rotation = (rotArg ?? 'none') as OutlineRotation;
const small = ['nomad', 'a5x'].includes((deviceArg ?? '').toLowerCase());
const PAGE = small ? {width: 1404, height: 1872} : {width: 1920, height: 2560};

let seed = 11;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

// CODES=MC,VA,SM … draws exactly these countries.
const countries = process.env.CODES
  ? process.env.CODES.split(',').map(code => countryIn(lang, code as CountryCode))
  : pickOutlineCountries(lang, region, count, random);
const placements = countries.map(c => ({code: c.code, angle: randomAngle(rotation, random)}));
const sheet = outlineSheetDrafts(PAGE, lang, region, placements, {size, scale});
// "Answers": right, a typo, and wrong, in turn.
const graded =
  gradedArg === 'graded'
    ? countries.map((c, i) => {
        const written = i % 3 === 0 ? c.name : i % 3 === 1 ? c.name.slice(0, -1) + 'x' : 'Peru';
        return {index: i, country: c, recognized: written, result: gradeCountryName(c, written, lang)};
      })
    : [];
const results = graded.length ? outlineResultDrafts(PAGE, lang, graded, countries.length) : [];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const GRAY = (c: number) => (c === 0 ? '#000' : '#7a7a7a');
const svgOf = (d: Draft): string => {
  switch (d.kind) {
    case 'picture':
      return '';
    case 'text': {
      const anchor = d.align === 2 ? 'end' : 'start';
      const x = d.align === 2 ? d.rect.right : d.rect.left;
      return d.text
        .split('\n')
        .map(
          (l, i) =>
            `<text x="${x}" y="${d.rect.top + d.fontSize * (1 + i * 1.35)}" font-family="Helvetica, Arial, sans-serif" font-size="${
              d.fontSize
            }" font-weight="${d.bold ? 700 : 400}" text-anchor="${anchor}">${esc(l)}</text>`,
        )
        .join('');
    }
    case 'line':
      return `<line x1="${d.a.x}" y1="${d.a.y}" x2="${d.b.x}" y2="${d.b.y}" stroke="${GRAY(d.color)}" stroke-width="4"/>`;
    case 'path':
      return `<polyline points="${d.points.map(p => `${p.x},${p.y}`).join(' ')}" fill="none" stroke="${GRAY(
        d.color,
      )}" stroke-width="4" stroke-linejoin="round"/>`;
  }
};

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE.width}" height="${PAGE.height}" viewBox="0 0 ${PAGE.width} ${PAGE.height}">
<rect width="100%" height="100%" fill="#fff"/>
${[...sheet, ...results].map(svgOf).join('\n')}
</svg>`;
const dir = path.join(ROOT, 'build/preview');
fs.mkdirSync(dir, {recursive: true});
const base = path.join(dir, `omriss-${region}-${size}-${scale}-${rotation}${gradedArg === 'graded' ? '-rettet' : ''}`);
fs.writeFileSync(`${base}.svg`, svg);
const points = sheet.filter(d => d.kind === 'path').reduce((s, d) => s + (d.kind === 'path' ? d.points.length : 0), 0);
console.log(`${countries.map(c => c.name).join(', ')}\n${sheet.length} elements, ${points} outline points`);
try {
  execFileSync('rsvg-convert', ['-o', `${base}.png`, `${base}.svg`]);
  console.log(`${base}.png`);
} catch {
  console.log(`${base}.svg (rsvg-convert missing, so no PNG)`);
}
