# World Capitals Quiz

Supernote plugin for practicing countries and capitals. The plugin creates a worksheet on a note page, you write the capitals by hand, and the plugin grades the sheet using handwriting recognition.

> **Made with AI.** All the code in this project was written by AI (Claude from Anthropic, via Claude Code). The same goes for the texts and translations in the plugin. Ståle Gjelsten decided what the plugin should do, directed the work and tested it on a Supernote Manta. Country names, capitals and maps come from open data sources (see [License and data sources](#license-and-data-sources)), not from AI.

## Usage

1. Open a note. The sheet is created on the current page if it is empty and has a white template or none; otherwise it is created on a new page after it.
2. Tap **World Capitals Quiz** in the toolbar, choose a continent and a number of countries, and tap **Make sheet**.
3. Write the capitals in the middle column.
4. Tap **World Capitals Quiz → Grade this page**. The result is written in the right column. You can grade again after changing answers.

For capitals that are often confused, or where the country has several capitals (for example Tanzania, South Africa, Bolivia and Nigeria), the result cell gets a small number and a short note is printed at the bottom of the sheet. Example: "¹ Dar es Salaam was capital until 1996 and is the largest city." The notes live in `src/i18n/notes.ts` (Norwegian and English; other languages get English).

## Level

Choose **Mixed**, **Easy**, **Medium** or **Hard**. The countries of the continent are sorted by how well known the capital is (the country, when the map asks you to mark countries), and the level draws from the best known, middle or least known third. Familiarity is based on Wikipedia page views in 13 languages (`src/data/familiarity.ts`, generated with `node scripts/gen-familiarity.js`; sources: Wikimedia and Wikidata, CC0).

## Multiple players (hot seat)

Choose **Players: 2–4** in the menu and how you play:

- **Pass around** – the device is hidden from the others. Each player gets their own pages with *the same* countries, with a "Pass the device to player 2" page in between. Tap **Grade the whole set** on any player's page to grade everyone and see who won.
- **Take turns** – everyone sees the device. You share one sheet and answer in turn; each player has *their own* countries, drawn so everyone gets roughly equally well-known ones, so looking at the others' answers doesn't help. The number in the answer box (table) or the number in the list (map) shows whose turn it is. Points per player are written at the bottom.

Which game a page belongs to is stated first in the subtitle ("Player 2 of 3 · …", "Duel for 2 · …") and read when grading (`src/core/hotseat.ts`).

## Statistics

Every grading of a single-player sheet is saved: which countries, which skill (writing the capital, capital on the map, country on the map), how well it went and when. Multiplayer sheets are not saved, since their answers belong to several players.

- **Score per country:** correct = 1, almost = 0.8, wrong or blank = 0. On the map, capitals score points/1000 and countries right/wrong; cities you skip count as 0, and cities without a mark are left out.
- **Grading the same sheet again** replaces the previous result. The sheet is recognized by the note and the countries on the page, so it survives pages being moved.
- **Level:** a country is *new* until it has been practiced, and *known* after three correct in a row (Leitner box 3). The box also decides when the country is due for review (0, 1, 3, 7, 14, 30 and 60 days).
- **In the menu** under **Statistics** you see the number of graded sheets, known/learning/new per continent, how many countries are due for review and the five countries you should practice more, for the selected game and continent. **Reset statistics** deletes everything (with confirmation).
- **Storage:** the SDK cannot write file contents, so each graded sheet is stored as an empty folder with the result encoded in its name, in `<plugin folder>/stats/` (e.g. `g1.t.<time>.<key>.noz…`). At most 3000 entries; the oldest are deleted first. Nothing is sent from the device.
- **Training modes:** `src/core/training.ts` has strategies for choosing countries for new sheets based on the statistics. `createSheet` and `createMapSheet` accept a strategy, but the menu has no option for it yet, so sheets are still drawn at random.

## Development

```bash
npm install
npm test          # unit tests for answer matching, layout and row distribution
npm run typecheck
npm run build     # creates build/outputs/geogame.snplg
```

Install by copying `geogame.snplg` to `MyStyle/` on the device and going to Settings → Apps → Plugins → Add plugin. Publish via the upload button in InkHub.

## Structure

- `src/data/countries.ts` – countries, capitals and accepted alternative answers
- `src/core/` – pure logic without the SDK (matching, layout, row distribution), tested in `__tests__/`
- `src/core/stats.ts` – answer history and per-country statistics (mastery, Leitner box, review schedule)
- `src/core/training.ts` – strategies for choosing countries for new sheets (`random`, `smart`, `weak`, `due`, `new`)
- `src/sdk/notes.ts` – wrapper around `sn-plugin-lib`
- `src/sdk/statsStore.ts` – stores the history as empty folders in `<plugin folder>/stats/` (the SDK cannot write files)
- `src/actions.ts` – "New sheet" and "Grade the sheet"
- `App.tsx` – the menu opened from the toolbar

## Which countries and capitals are included

**197 countries:** the 193 UN member states ([UN list of member states](https://www.un.org/en/about-us/member-states)), the two observer states Vatican City and Palestine, and Kosovo and Taiwan, which are recognized by many countries but are not UN members. Other territories (for example Western Sahara, Greenland and the Cook Islands) are not included. The continent of each country is listed in `src/data/countries.ts`.

**Capitals:** the answer key is the country's capital (P36) in [Wikidata](https://www.wikidata.org). If the country has several capitals, the key is the one usually given as the official capital. Cities that are de facto also capitals (seat of government, shared capitals) are accepted as answers, but former capitals are not. See `scripts/data/co-capitals-wikidata.json` and the notes in `src/i18n/notes.ts`.

## License and data sources

The code is licensed under [MIT](LICENSE). The plugin uses this data (details and license texts in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)):

- **Country names**: Unicode CLDR (Unicode License v3)
- **Capitals and coordinates**: Wikidata (CC0)
- **Maps**: Natural Earth (public domain). The maps show the de facto boundaries and take no position in border disputes.
