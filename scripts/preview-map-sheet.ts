/**
 * Preview of a graded map sheet (without a device): draws the sheet the way the plugin
 * makes it, adds some drawn-on marks and grades with the same code as the plugin.
 *
 *   node --no-warnings --import ./scripts/ts-resolve.mjs scripts/preview-map-sheet.ts [region] [language] [both|capital|country] [count] [manta|nomad]
 *
 * Writes build/preview/kartark-<region>.svg and .png (PNG requires rsvg-convert).
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {CAPITAL_LONLAT} from '../src/data/capitals.ts';
import {MAPS} from '../src/data/maps.ts';
import {getLanguage} from '../src/i18n/index.ts';
import {
  gradeMap,
  mapLayoutFor,
  mapSheetDrafts,
  pickMapCountries,
} from '../src/core/mapSheet.ts';
import {lonLatToPage} from '../src/core/projection.ts';
import {countryLabel} from '../src/core/countryCells.ts';
import type {Draft} from '../src/core/draft.ts';
import type {Region} from '../src/core/sheet.ts';
import type {MapEntryStyle} from '../src/i18n/map.ts';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const region = (process.argv[2] ?? 'EU') as Region;
const lang = getLanguage(process.argv[3] ?? 'nb')!;
// Third argument: both | capital | country (what the list shows), or land (country mode).
const arg = process.argv[4] ?? 'both';
const target = arg === 'land' ? 'country' : 'capital';
const style = (arg === 'land' ? 'country' : arg) as MapEntryStyle;
const count = Number(process.argv[5] ?? 10);
// Sixth argument: "nomad" (or "a5x") gives 1404×1872, otherwise Manta.
const small = ['nomad', 'a5x'].includes((process.argv[6] ?? '').toLowerCase());
const PAGE = small ? {width: 1404, height: 1872} : {width: 1920, height: 2560};
if (!MAPS[region] || !lang) {
  throw new Error(
    `Unknown region or language. Regions: ${Object.keys(MAPS).join(', ')}`,
  );
}

let seed = 7;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return (seed - 1) / 2147483646;
};

const countries = pickMapCountries(lang, region, count, random);
const file = path.join(ROOT, `assets/maps/${MAPS[region].file}.png`);
const sheet = mapSheetDrafts(
  PAGE,
  lang,
  region,
  countries,
  file,
  style,
  target,
);
const L = mapLayoutFor(PAGE, region, countries.length);
const truth = (i: number) => {
  const lbl =
    target === 'country' ? countryLabel(region, countries[i].code) : null;
  if (lbl) {
    const m = MAPS[region];
    return {
      x: L.map.left + (lbl.x / m.width) * (L.map.right - L.map.left),
      y: L.map.top + (lbl.y / m.height) * (L.map.bottom - L.map.top),
    };
  }
  return lonLatToPage(
    MAPS[region],
    L.map,
    ...CAPITAL_LONLAT[countries[i].code],
  );
};

// Simulated handwriting: crosses with varying misses, one city skipped (stroke in the box), one circle.
type P = {x: number; y: number};
const handLine = (a: P, b: P): P[] =>
  Array.from({length: 8}, (_, i) => ({
    x: a.x + ((b.x - a.x) * i) / 7 + Math.sin(i * 1.7) * 1.2,
    y: a.y + ((b.y - a.y) * i) / 7 + Math.cos(i * 1.3) * 1.2,
  }));
const cross = (c: P, r = 14): P[][] => [
  handLine({x: c.x - r, y: c.y - r}, {x: c.x + r, y: c.y + r * 0.9}),
  handLine({x: c.x + r * 0.9, y: c.y - r}, {x: c.x - r, y: c.y + r}),
];
const ring = (c: P, r = 16): P[] =>
  Array.from({length: 26}, (_, i) => ({
    x: c.x + r * Math.cos(i * 0.26),
    y: c.y + r * 0.9 * Math.sin(i * 0.26),
  }));
const offsets: Array<[number, number] | 'skip' | 'ring'> = [
  [4, -3],
  [60, 25],
  [-25, 90],
  'skip',
  [140, -60],
  [10, 12],
  'ring',
  [-210, 40],
  [30, -20],
  [-8, 6],
];
const mapStrokes: P[][] = [];
const skipped: boolean[] = [];
countries.forEach((_, i) => {
  const o = offsets[i % offsets.length];
  const t = truth(i);
  skipped.push(o === 'skip');
  if (o === 'skip') {
    return;
  }
  if (o === 'ring') {
    mapStrokes.push(ring({x: t.x - 35, y: t.y + 20}));
    return;
  }
  mapStrokes.push(...cross({x: t.x + o[0], y: t.y + o[1]}));
});
const skipStrokes = skipped.flatMap((skip, i) => {
  if (!skip) {
    return [];
  }
  const b = L.entries[i].box;
  return [
    handLine({x: b.left - 4, y: b.bottom + 3}, {x: b.right + 5, y: b.top - 4}),
  ];
});

const entries = countries.map((country, i) => ({n: i + 1, country}));
const grade = gradeMap(
  PAGE,
  lang,
  region,
  L.map,
  entries,
  mapStrokes,
  skipped,
  target,
);

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const GRAY = (c: number) => (c === 0 ? '#000' : '#7a7a7a');
const svgOf = (d: Draft): string => {
  switch (d.kind) {
    case 'picture': {
      const data = fs.readFileSync(d.path).toString('base64');
      const {left, top, right, bottom} = d.rect;
      return `<image x="${left}" y="${top}" width="${right - left}" height="${
        bottom - top
      }" preserveAspectRatio="none" href="data:image/png;base64,${data}"/>`;
    }
    case 'text': {
      const lines = d.text.split('\n');
      const anchor = d.align === 2 ? 'end' : 'start';
      const x = d.align === 2 ? d.rect.right : d.rect.left;
      return lines
        .map(
          (l, i) =>
            `<text x="${x}" y="${
              d.rect.top + d.fontSize * (1 + i * 1.35)
            }" font-family="Helvetica, Arial, sans-serif" font-size="${
              d.fontSize
            }" font-weight="${
              d.bold ? 700 : 400
            }" text-anchor="${anchor}">${esc(l)}</text>`,
        )
        .join('');
    }
    case 'line':
      return `<line x1="${d.a.x}" y1="${d.a.y}" x2="${d.b.x}" y2="${
        d.b.y
      }" stroke="${GRAY(d.color)}" stroke-width="4" stroke-linecap="round"/>`;
    case 'path':
      return `<polyline points="${d.points
        .map(p => `${p.x},${p.y}`)
        .join(' ')}" fill="none" stroke="${GRAY(
        d.color,
      )}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
};
const pen = (pts: P[]) =>
  `<polyline points="${pts
    .map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(
      ' ',
    )}" fill="none" stroke="#000" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${
  PAGE.width
}" height="${PAGE.height}" viewBox="0 0 ${PAGE.width} ${PAGE.height}">
<rect width="100%" height="100%" fill="#fff"/>
${sheet.map(svgOf).join('\n')}
${[...mapStrokes, ...skipStrokes].map(pen).join('\n')}
${grade.drafts.map(svgOf).join('\n')}
</svg>`;

const out = path.join(ROOT, 'build/preview');
fs.mkdirSync(out, {recursive: true});
const suffix = arg === 'both' && count === 10 ? '' : `-${arg}-${count}`;
const base = path.join(out, `kartark-${MAPS[region].file}${suffix}${small ? "-nomad" : ""}`);
fs.writeFileSync(`${base}.svg`, svg);
try {
  execFileSync('rsvg-convert', ['-o', `${base}.png`, `${base}.svg`]);
  console.log(`${base}.png`);
} catch {
  console.log(`${base}.svg (rsvg-convert missing, so no PNG)`);
}
console.log(`Points: ${grade.points} of ${grade.max}, ${grade.marks} marks`);
for (const r of grade.results) {
  console.log(
    `${r.n}. ${r.country.capital}: ${r.assignment.kind} ${
      r.distanceKm !== undefined ? Math.round(r.distanceKm) + ' km' : ''
    } ${r.points} p`,
  );
}
