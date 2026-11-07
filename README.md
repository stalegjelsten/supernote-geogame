# World Capitals Quiz

Supernote plugin for practicing countries and capitals. The plugin creates a worksheet on a note page, you write the capitals by hand, and the plugin grades the sheet using handwriting recognition.

> **Made with AI.** All the code in this project was written by AI (Claude from Anthropic, via Claude Code). The same goes for the texts and translations in the plugin. Ståle Gjelsten decided what the plugin should do, directed the work and tested it on a Supernote Manta. Country names, capitals and maps come from open data sources (see [License and data sources](#license-and-data-sources)), not from AI.

## Installation

The plugin has been submitted to InkHub and is pending review. Until it is approved there, you can install it manually:

1. Download `geogame.snplg` from the [latest release](https://github.com/stalegjelsten/supernote-geogame/releases/latest).
2. Copy the file to your Supernote, for example to the `MyStyle/` folder (via USB, Browse & Access or Supernote Cloud).
3. On the device, go to **Settings → Apps → Plugins → Select Plugin Package** and choose `geogame.snplg`.
4. Open a note: **World Capitals Quiz** now appears in the toolbar under **Plugins** (🧩).

To update, install the new `geogame.snplg` from a later release the same way.

## Usage

1. Open a note. The sheet is created on the current page if it is empty and has a white template or none; otherwise it is created on a new page after it.
2. Tap **Plugins** (🧩) in the toolbar, then **World Capitals Quiz**, choose a continent and a number of countries, and tap **Make sheet**.
3. Write the capitals in the middle column.
4. Tap **Plugins → World Capitals Quiz → Grade this page**. The result is written in the right column. You can grade again after changing answers.

## Map quiz

Choose **Game: Map** in the menu to mark places with a cross on a high-contrast map instead of writing. Choose whether to mark **Capitals** or **Countries**, what the list shows (city and country, city only or country only) and how many (5, 10 or 15). Grade with **Grade this page**. Capitals score up to 1000 points each depending on how many kilometres off the cross is; countries are right or wrong. To skip one, draw a line in the box in front of it in the list.

## Outline quiz

Choose **Game: Outline** to get the outlines of 6, 9, 12, 16 or 20 countries in a grid, and write the name of the country on the line in each box. Grade with **Grade this page**; the name is accepted in the sheet's language and in English, with a few typos allowed ("almost").

- **Size:** large, medium or small outlines.
- **Scale:** *Fill the box* (every country as large as the box allows), *Fill the box, with scale bar* (the same, with a scale bar in km in each box), or *Relative size*: the countries are drawn in proportion to each other on a logarithmic scale, since on a linear scale most countries become specks next to Russia. A country ten times as long as another is drawn about 1.4 times as large (each factor of ten takes 30 % off the size, down to at least 15 %). These boxes also get a scale bar.
- **Rotation:** none, a little (up to ±35°) or any angle.

The outlines come from Natural Earth 1:10m (public domain). Each country is projected on its own (Lambert azimuthal equal-area centred on the country), overseas parts far from the main part (such as French Guiana) and very small islands are left out, and the shapes are simplified to at most 420 points (`node --no-warnings --import ./scripts/ts-resolve.mjs scripts/gen-outlines.ts`). Which country is in which box is stored in a short code at the bottom of the sheet ("ID o1.nb.…"), so the names don't show. Outline sheets are for one player, and the results are saved in the statistics as **Countries by outline**. Preview a sheet without a device with `scripts/preview-outline-sheet.ts`.

## Languages

The sheets and the menu are available in 55 languages. By default the plugin follows the device language; another language can be chosen in the **Language** tab. Answers are read with Supernote's handwriting recognition, which uses the recognition language set on the device, so set it to the language you write in.

Everything runs on the device; the maps and data are bundled with the plugin and nothing is sent anywhere.

## Footnotes

For capitals that are often confused, or where the country has several capitals (for example Tanzania, South Africa, Bolivia and Nigeria), the result cell gets a small number and a short note is printed at the bottom of the sheet. Example: "¹ Dar es Salaam was capital until 1996 and is the largest city." The notes are available in all 55 languages: Norwegian and English are written in `src/i18n/notes.ts`, and the other languages are translated from English in `src/i18n/capital-notes/<code>.ts`.

## Level

Choose **Mixed**, **Easy**, **Medium** or **Hard** (hidden when a table sheet uses every country of the continent). The countries of the continent are sorted by how well known the capital is (the country, when the map asks you to mark countries), and the level draws from the best known, middle or least known third (widened if the sheet needs more countries than a third holds). Familiarity is based on Wikipedia page views in 13 languages (`src/data/familiarity.ts`, generated with `node scripts/gen-familiarity.js`; sources: Wikimedia and Wikidata, CC0).

## Multiple players (hot seat)

Choose **Players: 2–4** in the menu and how you play:

- **Pass around** – the device is hidden from the others. Each player gets their own pages with *the same* countries, with a "Pass the device to player 2" page in between. Tap **Grade the whole set** on any player's page to grade everyone and see who won. The same button also grades all pages of a long single-player table sheet.
- **Take turns** – everyone sees the device. You share one sheet and answer in turn; each player has *their own* countries, drawn so everyone gets roughly equally well-known ones, so looking at the others' answers doesn't help. The number in the answer box (table) or the number in the list (map) shows whose turn it is. Points per player are written at the bottom.

Which game a page belongs to is stated first in the subtitle ("Player 2 of 3 · …", "Duel for 2 · …") and read when grading (`src/core/hotseat.ts`).

## Statistics

Every grading of a single-player sheet is saved: which countries, which skill (writing the capital, capital on the map, country on the map), how well it went and when. Multiplayer sheets are not saved, since their answers belong to several players.

- **Score per country:** correct = 1, almost = 0.8, wrong or blank = 0. On the map, capitals score points/1000 and countries right/wrong; cities you skip count as 0, and cities without a mark are left out.
- **Grading the same sheet again** replaces the previous result. The sheet is recognized by the note and the countries on the page, so it survives pages being moved.
- **Level:** a country is *new* until it has been practiced, and *known* after three passes in a row (score at least 0.7, so "almost" counts; Leitner box 3). The box also decides when the country is due for review (0, 1, 3, 7, 14, 30 and 60 days).
- **In the menu** the **Statistics** tab shows, for the chosen skill (it follows the selected game, but you can pick another), the average score, the number of graded sheets and how many countries in the selected continent are due for review. Once two or more sheets are graded, a column chart shows the score on the last ten. Each continent, and the whole world, gets a bar with known (black), learning (gray) and new (white) countries; tap one to see up to five countries you should practice more. **Reset statistics** deletes everything (with confirmation).
- **Storage:** the SDK cannot write file contents, so each graded sheet is stored as an empty folder with the result encoded in its name, in `<plugin folder>/stats/` (e.g. `g1.t.<time>.<key>.noz…`). At most 3000 entries; the oldest are deleted first. Nothing is sent from the device.
- **Practice:** the **Practice** choice in the menu decides which countries a new single-player sheet gets, using the statistics for the skill being practiced (`src/core/training.ts`):
  - **Smart** (default) – mostly countries due for review and countries you struggle with, plus a few new ones. With no statistics yet, it draws like Random.
  - **Weak** – the countries with the lowest score, filled up with new ones if there are few.
  - **Review** – the countries that are due on the review schedule.
  - **New** – countries you have never practiced.
  - **Random** – all countries equally likely; the statistics are not used.

  The countries are drawn at random in proportion to a weight, so sheets vary even when the same countries are prioritized, and the level and continent still decide which countries can be drawn. Multiplayer sheets are always drawn at random, since the statistics belong to one player.

## Development

```bash
npm install
npm test          # unit tests (matching, layout, map scoring, hot seat, statistics, notes, translations)
npm run typecheck
npm run build     # creates build/outputs/geogame.snplg
```

Install the build the same way as under [Installation](#installation). Publish via the upload button in InkHub.

## Structure

- `src/data/countries.ts` – country codes and continents; `src/data/capitals.ts` – capital coordinates
- `src/i18n/countries/<code>.ts` – country names, capitals and accepted alternative answers per language (nb and en by hand, the rest generated by `scripts/gen-languages.js`)
- `src/core/` – pure logic without the SDK (matching, layout, row distribution, map scoring, hot seat, statistics, footnotes), tested in `__tests__/`
- `src/core/stats.ts` – answer history and per-country statistics (mastery, Leitner box, review schedule)
- `src/core/training.ts` – strategies for choosing countries for new sheets (`random`, `smart`, `weak`, `due`, `new`)
- `src/sdk/notes.ts` – wrapper around `sn-plugin-lib`
- `src/sdk/statsStore.ts` – stores the history as empty folders in `<plugin folder>/stats/` (the SDK cannot write files)
- `src/actions.ts` – creating and grading table sheets, and saving statistics
- `src/mapActions.ts` – creating and grading map sheets; `src/sdk/mapAssets.ts` – the bundled maps
- `src/outlineActions.ts` – creating and grading outline sheets; `src/core/outlineSheet.ts` – layout, scaling, rotation, the hidden key and grading; `src/data/outlines.ts` – the outlines (generated)
- `App.tsx` – the menu opened from the toolbar, with the tabs New worksheet, Statistics and Language

## Which countries and capitals are included

**197 countries:** the 193 UN member states ([UN list of member states](https://www.un.org/en/about-us/member-states)), the two observer states Vatican City and Palestine, and Kosovo and Taiwan, which are recognized by many countries but are not UN members. Other territories (for example Western Sahara, Greenland and the Cook Islands) are not included. The continent of each country is listed in `src/data/countries.ts`.

**Capitals:** the answer key is the country's capital (P36) in [Wikidata](https://www.wikidata.org). If the country has several capitals, the key is the one usually given as the official capital. Cities that today also serve as capitals (seat of government, shared, economic or commercial capital, such as The Hague, La Paz and Bujumbura) are accepted as answers. Cities that are only former capitals (such as Dar es Salaam, Lagos and Almaty) are not. See `scripts/data/co-capitals-wikidata.json` and the notes in `src/i18n/notes.ts`.

## License and data sources

The code is licensed under [MIT](LICENSE). The plugin uses this data (details and license texts in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)):

- **Country names**: Unicode CLDR (Unicode License v3)
- **Capitals and coordinates**: Wikidata (CC0)
- **Maps and country outlines**: Natural Earth (public domain). The maps show the de facto boundaries and take no position in border disputes.
