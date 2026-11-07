#!/usr/bin/env node
/**
 * Generates src/data/familiarity.ts: how well known each country and capital is,
 * measured as Wikipedia page views. Used for fair drawing when the players
 * take turns (see src/core/fairDraw.ts).
 *
 *   node scripts/gen-familiarity.js
 *
 * Sources (both CC0):
 * - Wikidata: the article titles (sitelinks) for the country and the capital. The capital
 *   has its Q-ID in scripts/data/capitals-wikidata.json; the country is looked up by ISO code (P297).
 * - Page views over the last 60 days from the MediaWiki API (prop=pageviews,
 *   the same numbers as Wikimedia Pageviews), summed over WIKIS. That gives 50
 *   articles per call, so the whole dataset is fetched with just over a hundred calls, one at a time.
 *
 * The raw data is stored in scripts/data/familiarity-pageviews.json, so the numbers can
 * be verified. Re-run the script for fresh numbers.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_TS = path.join(ROOT, 'src/data/familiarity.ts');
const OUT_JSON = path.join(__dirname, 'data/familiarity-pageviews.json');
/** Cache per wiki, so an interrupted run can resume. Deleted when everything is done. */
const CACHE = path.join(__dirname, 'data/.familiarity-cache.json');
const CAPITALS = require('./data/capitals-wikidata.json');

/** Large Wikipedias in different languages, so the numbers do not just mirror English. */
// Norwegian Bokmål is called "no" on Wikipedia (no.wikipedia.org).
const WIKIS = ['en', 'de', 'fr', 'es', 'ja', 'ru', 'it', 'pt', 'zh', 'pl', 'nl', 'sv', 'no'];

/** Land uten ISO-kode i Wikidata. */
const COUNTRY_QID_OVERRIDES = {XK: 'Q1246'};

/**
 * Capitals where the Q-ID in capitals-wikidata.json is an item without articles.
 * Managua: Q131546626 is a newer item for the city; the articles are on Q3274.
 */
const CAPITAL_QID_OVERRIDES = {NI: 'Q3274'};
const capitalQ = code => CAPITAL_QID_OVERRIDES[code] ?? CAPITALS[code].q;

const UA = 'geogame-build-script/1.0 (Supernote plugin; offline data build)';

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** Pause between calls, so we stay well under Wikimedia's limits. */
const DELAY_MS = 1500;

/** Shared pause for all calls when the API asks us to wait (429 + retry-after). */
let pausedUntil = 0;

async function getJson(url, tries = 8) {
  for (let i = 0; ; i++) {
    const wait = pausedUntil - Date.now();
    if (wait > 0) {
      await sleep(wait);
    }
    await sleep(DELAY_MS);
    let res;
    try {
      res = await fetch(url, {headers: {'User-Agent': UA, Accept: 'application/json'}});
    } catch (e) {
      // Network error (e.g. ECONNRESET): retry after a pause.
      if (i >= tries) {
        throw e;
      }
      process.stderr.write(`  network error (${e.cause?.code ?? e.message}), retrying\n`);
      await sleep(2 ** i * 1000);
      continue;
    }
    if (res.ok) {
      return res.json();
    }
    if (res.status === 404) {
      return null;
    }
    if (i >= tries) {
      throw new Error(`${res.status} ${url}`);
    }
    const retry = Number(res.headers.get('retry-after')) || 2 ** i;
    if (res.status === 429) {
      pausedUntil = Math.max(pausedUntil, Date.now() + Math.max(retry, 30) * 1000);
      process.stderr.write(`  429, venter ${Math.max(retry, 30)} s\n`);
    } else {
      await sleep(retry * 1000);
    }
  }
}

/**
 * The country's Wikidata item from the ISO code (P297). If several items share the same
 * code (e.g. historical states), the one with the most Wikipedia articles is chosen.
 */
async function countryQids(codes) {
  const values = codes.filter(c => !COUNTRY_QID_OVERRIDES[c]).map(c => `"${c}"`).join(' ');
  const query = `SELECT ?c ?iso ?n WHERE { VALUES ?iso { ${values} } ?c wdt:P297 ?iso ; wikibase:sitelinks ?n . }`;
  const data = await getJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`);
  const best = {};
  for (const b of data.results.bindings) {
    const n = Number(b.n.value);
    if (!best[b.iso.value] || n > best[b.iso.value].n) {
      best[b.iso.value] = {q: b.c.value.split('/').pop(), n};
    }
  }
  const out = {};
  for (const c of codes) {
    out[c] = COUNTRY_QID_OVERRIDES[c] ?? best[c]?.q;
    if (!out[c]) {
      throw new Error(`Wikidata item not found for ${c}`);
    }
  }
  console.error(`Found Wikidata items for ${codes.length} countries`);
  return out;
}

async function sitelinks(qids) {
  const out = {};
  const sitefilter = WIKIS.map(w => `${w}wiki`).join('|');
  for (let i = 0; i < qids.length; i += 50) {
    const ids = qids.slice(i, i + 50).join('|');
    const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=sitelinks&sitefilter=${sitefilter}&ids=${ids}`;
    const data = await getJson(url);
    for (const [q, e] of Object.entries(data.entities)) {
      out[q] = Object.fromEntries(Object.values(e.sitelinks ?? {}).map(s => [s.site.replace(/wiki$/, ''), s.title]));
    }
  }
  return out;
}

/**
 * Page views for many titles on one wiki, 50 at a time.
 * Returns {title: views} and the dates that were covered.
 */
async function viewsFor(wiki, titles, dates) {
  const out = {};
  for (let i = 0; i < titles.length; i += 50) {
    const batch = titles.slice(i, i + 50);
    let cont = {};
    for (;;) {
      const params = new URLSearchParams({
        action: 'query',
        format: 'json',
        formatversion: '2',
        prop: 'pageviews',
        pvipdays: '60',
        titles: batch.join('|'),
        ...cont,
      });
      const data = await getJson(`https://${wiki}.wikipedia.org/w/api.php?${params}`);
      const normalized = Object.fromEntries((data.query?.normalized ?? []).map(n => [n.to, n.from]));
      for (const page of data.query?.pages ?? []) {
        if (!page.pageviews) {
          continue;
        }
        const title = normalized[page.title] ?? page.title;
        out[title] = (out[title] ?? 0) + Object.values(page.pageviews).reduce((a, v) => a + (v ?? 0), 0);
        Object.keys(page.pageviews).forEach(d => dates.add(d));
      }
      if (!data.continue) {
        break;
      }
      cont = data.continue;
    }
    process.stderr.write(`  ${wiki}: ${Math.min(i + 50, titles.length)}/${titles.length}\n`);
  }
  return out;
}

async function main() {
  const codes = Object.keys(CAPITALS).sort();
  console.error(`Wikier: ${WIKIS.join(', ')}`);

  const cq = await countryQids(codes);
  const links = await sitelinks([...new Set([...Object.values(cq), ...codes.map(capitalQ)])]);

  let cache = {};
  try {
    cache = JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  } catch {}
  const dates = new Set(cache.dates ?? []);
  const byWiki = cache.byWiki ?? {};
  // Reuse the previous completed run for wikis included there (set REFRESH=1 for fresh numbers).
  if (!process.env.REFRESH) {
    try {
      const prev = JSON.parse(fs.readFileSync(OUT_JSON, 'utf8'));
      for (const wiki of prev.wikis) {
        if (WIKIS.includes(wiki) && !byWiki[wiki]) {
          byWiki[wiki] = {};
          for (const v of Object.values(prev.data)) {
            for (const kind of ['country', 'capital']) {
              const hit = v[kind][wiki];
              if (hit && hit.views > 0) {
                byWiki[wiki][hit.title] = hit.views;
              }
            }
          }
        }
      }
      prev.period.forEach(d => dates.add(d));
    } catch {}
  }
  for (const wiki of WIKIS) {
    // Missing titles (e.g. a corrected Q-ID) are fetched even if the wiki is stored.
    const titles = new Set();
    for (const code of codes) {
      for (const q of [cq[code], capitalQ(code)]) {
        if (links[q]?.[wiki]) {
          titles.add(links[q][wiki]);
        }
      }
    }
    const missing = byWiki[wiki] ? [...titles].filter(t => !(t in byWiki[wiki])) : [...titles];
    if (byWiki[wiki] && !missing.length) {
      console.error(`  ${wiki}: from stored numbers`);
      continue;
    }
    byWiki[wiki] = {...byWiki[wiki], ...(await viewsFor(wiki, missing, dates))};
    fs.writeFileSync(CACHE, JSON.stringify({dates: [...dates], byWiki}));
    console.error(`  ${wiki}: ferdig`);
  }

  const raw = {};
  for (const code of codes) {
    raw[code] = {countryQ: cq[code], capitalQ: capitalQ(code), country: {}, capital: {}};
    for (const kind of ['country', 'capital']) {
      const q = kind === 'country' ? cq[code] : capitalQ(code);
      for (const [wiki, title] of Object.entries(links[q] ?? {})) {
        raw[code][kind][wiki] = {title, views: byWiki[wiki]?.[title] ?? 0};
      }
    }
  }
  const sorted = [...dates].sort();
  const period = [sorted[0], sorted[sorted.length - 1]];
  fs.writeFileSync(OUT_JSON, JSON.stringify({period, wikis: WIKIS, data: raw}, null, 1) + '\n');

  const sum = o => Object.values(o).reduce((a, x) => a + x.views, 0);
  const lines = codes.map(c => `  ${c}: [${sum(raw[c].country)}, ${sum(raw[c].capital)}],`);
  fs.writeFileSync(
    OUT_TS,
    `/**
 * How well known each country and capital is: Wikipedia page views
 * (${WIKIS.join(', ')}) ${period[0]}–${period[1]}.
 * Source: Wikimedia (page views) and Wikidata (article titles), both CC0.
 *
 * Generated by scripts/gen-familiarity.js – do not edit by hand.
 */
import type {CountryCode} from './countries';

/** [views of the country, views of the capital] */
export const FAMILIARITY: Record<CountryCode, readonly [country: number, capital: number]> = {
${lines.join('\n')}
};
`,
  );
  fs.rmSync(CACHE, {force: true});
  console.error(`Wrote ${path.relative(ROOT, OUT_TS)} and ${path.relative(ROOT, OUT_JSON)}`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
