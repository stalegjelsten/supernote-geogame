# World Capitals Quiz

Supernote plugin for practicing countries and capitals. The plugin creates a worksheet on a note page, you answer by hand, and the plugin grades the sheet using handwriting recognition. There are four games: write the capitals in a table, mark capitals or countries on a map, name countries from their outlines, and write the names of numbered countries on a map. Statistics per country decide which countries you get next.

> **Made with AI.** All the code in this project was written by AI (Claude from Anthropic, via Claude Code). The same goes for the texts and translations in the plugin. Ståle Gjelsten decided what the plugin should do, directed the work and tested it on a Supernote Manta. Country names, capitals and maps come from open data sources (see [License and data sources](#license-and-data-sources)), not from AI.

## Installation

### From InkHub

The plugin is published in InkHub, the Supernote plugin store. Search for **World Capitals Quiz** in InkHub and install it from there.

### Manually (latest version)

New versions come out on GitHub first, and the version in InkHub may be older. To get the latest version, install it manually:

1. Download `geogame.snplg` from the [latest release](https://github.com/stalegjelsten/supernote-geogame/releases/latest).
2. Copy the file to your Supernote, for example to the `MyStyle/` folder (via USB, Browse & Access or Supernote Cloud).
3. On the device, go to **Settings → Apps → Plugins → Select Plugin Package** and choose `geogame.snplg`.
4. Open a note: **World Capitals Quiz** now appears in the toolbar under **Plugins** (🧩).

To update, install the new `geogame.snplg` from a later release the same way.

### Devices

The layout adapts to the page size (Manta, Nomad, A5X and A6X): smaller pages get fewer countries per page. The plugin is tested on a Manta.

## Usage

1. Open a note. The sheet is created on the current page if it is empty and has a white template or none; otherwise it is created on a new page after it.
2. Tap **Plugins** (🧩) in the toolbar, then **World Capitals Quiz**, choose a continent and a number of countries, and tap **Make sheet**.
3. Write the capitals in the middle column. You don't have to answer all of them: boxes you leave empty are not counted in the [statistics](#statistics). If you don't know an answer and want that to count, draw a dash in the box.
4. Tap **Plugins → World Capitals Quiz → Grade this page**. The result is written in the right column. You can grade again after changing answers.

## Map quiz

Choose **Game: Map** in the menu to mark places with a cross on a high-contrast map instead of writing. Choose whether to mark **Capitals** or **Countries**, what the list shows (city and country, city only or country only) and how many (5, 10 or 15). Grade with **Grade this page**. Capitals score up to 1000 points each depending on how many kilometres off the cross is; countries are right or wrong. To skip one, draw a line in the box in front of it in the list.

## Outline quiz

Choose **Game: Outline** to get the outlines of 6, 9, 12, 16 or 20 countries in a grid, and write the name of the country on the line in each box. Grade with **Grade this page**; the name is accepted in the sheet's language and in English, with a few typos allowed ("almost"), and so are common other names such as USA, UK, UAE, Holland and Burma (`src/data/countryAliases.ts`).

- **Size:** large, medium or small outlines.
- **Scale:** *Fill the box* (every country as large as the box allows), *Fill the box, with scale bar* (the same, with a scale bar in km in each box), or *Relative size*: the countries are drawn in proportion to each other on a logarithmic scale, since on a linear scale most countries become specks next to Russia. A country ten times as long as another is drawn about 1.4 times as large (each factor of ten takes 30 % off the size, down to at least 15 %). These boxes also get a scale bar.
- **Rotation:** none, a little (up to ±35°) or any angle.

The outlines come from Natural Earth 1:10m (public domain), and for 30 small countries, where Natural Earth is too coarse to show the shape, from geoBoundaries (open licenses per country, mostly OpenStreetMap under ODbL; see THIRD_PARTY_NOTICES.md). Each country is projected on its own (Lambert azimuthal equal-area centred on the country), overseas parts far from the main part (such as French Guiana) and very small islands are left out, and the shapes are simplified to at most 420 points (`node --no-warnings --import ./scripts/ts-resolve.mjs scripts/gen-outlines.ts`). Which country is in which box is stored in a short code at the bottom of the sheet ("ID o1.nb.…"), so the names don't show. Outline sheets are for one player, and the results are saved in the statistics as **Countries by outline**. Preview a sheet without a device with `scripts/preview-outline-sheet.ts`.

## Names on the map

Choose **Game: Names on map** to get a map of the continent with 10, 15 or 20 countries marked with a dot and a number, and a numbered list of lines below it. Write the name of each country on the line with its number. Grade with **Grade this page**; the names are accepted the same way as on the outline sheet (the sheet's language, English and common other names, with a few typos allowed). The results are saved in the statistics as **Names on the map**.

- **One player:** names-on-the-map sheets are for one player, like outline sheets.
- **Continents:** Europe, Asia, Africa, North America, South America and Oceania. The world map is too wide for the list below it, so it is not offered. Oceania has 14 countries with a point on the map, so a sheet there has at most 14.
- **Small screens** (Nomad, A5X): 10 countries. With 15 the list needs three columns and the writing lines get too short (about 24 mm), and fewer columns would leave too little room for the map.
- **The map** gets the whole width of the page (Europe is about 113 mm wide on Manta with 15 countries). Most countries are far too small to write in, which is why the names go on the list.
- **The numbers** are put next to the dots, where no border or coast runs behind them if there is such a place nearby; otherwise a bit farther out with a short line back to the dot. Lines never cross. Where the lines are on the map is read from the map images themselves (`src/data/mapLines.ts`, made with `node --no-warnings --import ./scripts/ts-resolve.mjs scripts/gen-map-lines.ts`; run it again if the maps are remade). Countries whose dots would lie on top of each other (the small islands in the Caribbean) are avoided.
- **The key** at the bottom ("ID l2.nb.EU.…") gives the language, the continent and the countries in order, so the names don't show. "l1" sheets from the first test build, with writing boxes and leader lines beside the map, are still graded with that layout.

Preview a sheet without a device with `node --no-warnings --import ./scripts/ts-resolve.mjs scripts/preview-label-sheet.ts EU nb 15 manta answers` (region, language, count, manta or nomad, and "answers" for a graded sheet with made-up answers).

## Languages

The sheets and the menu are available in 55 languages. By default the plugin follows the device language; another language can be chosen in the **Language** tab. Answers are read with Supernote's handwriting recognition, which uses the recognition language set on the device, so set it to the language you write in.

Everything runs on the device; the maps and data are bundled with the plugin and nothing is sent anywhere.

## Footnotes

For capitals that are often confused, or where the country has several capitals (for example Tanzania, South Africa, Bolivia and Nigeria), the result cell gets a small number and a short note is printed at the bottom of the sheet. Example: "¹ Dar es Salaam was capital until 1996 and is the largest city." The notes are available in all 55 languages: Norwegian and English are written in `src/i18n/notes.ts`, and the other languages are translated from English in `src/i18n/capital-notes/<code>.ts`.

## Level

Choose **Mixed**, **Easy**, **Medium** or **Hard** (hidden when a table sheet uses every country of the continent). The countries of the continent are sorted by how well known the capital is (the country, when the map asks you to mark countries), and the level draws from the best known, middle or least known third (widened if the sheet needs more countries than a third holds). Familiarity is based on Wikipedia page views in 13 languages (`src/data/familiarity.ts`, generated with `node scripts/gen-familiarity.js`; sources: Wikimedia and Wikidata, CC0).

## Multiple players (hot seat)

Choose **Players: 2–4** in the menu and how you play. This is available for table and map sheets; outline and names-on-the-map sheets are for one player.

- **Pass around** – the device is hidden from the others. Each player gets their own pages with *the same* countries, with a "Pass the device to player 2" page in between. Tap **Grade the whole set** on any player's page to grade everyone and see who won. The same button also grades all pages of a long single-player table sheet.
- **Take turns** – everyone sees the device. You share one sheet and answer in turn; each player has *their own* countries, drawn so everyone gets roughly equally well-known ones, so looking at the others' answers doesn't help. The number in the answer box (table) or the number in the list (map) shows whose turn it is. Points per player are written at the bottom.

Which game a page belongs to is stated first in the subtitle ("Player 2 of 3 · …", "Duel for 2 · …") and read when grading (`src/core/hotseat.ts`).

## Statistics

Every grading of a single-player sheet is saved: which countries, which skill (writing the capital, capital on the map, country on the map, country by outline, names on the map), how well it went and when. Each skill has its own statistics. Multiplayer sheets are not saved, since their answers belong to several players, and nothing is saved in [guest mode](#guest-mode).

### Score per country

| Answer | Score |
| --- | --- |
| Correct | 1 |
| Almost (right, but misspelled) | 0.8 |
| Wrong, or a mark that isn't a name (a dash, a question mark) | 0 |
| Empty box | not counted |

On the map, capitals score points/1000 and countries right or wrong. Cities you skip (a line in the box in front of them) count as 0, and cities without a cross are not counted.

### Answering only some of the countries

On table, outline and names-on-the-map sheets, a box with nothing written in it is left out of the statistics. It counts neither as wrong nor as practiced. So you can answer only the countries you want to practice and leave the rest empty.

To say "I don't know" so that it counts, draw a dash (or anything else that isn't a name) in the box. The handwriting recognition can't read it as a name, so it scores 0 and the country comes back on later sheets. The menu says this under the grade buttons.

The score written on the sheet still counts every row, so empty boxes are wrong there. A page with nothing written on it saves nothing.

### Misspellings

On sheets where you write the answer, "almost" (the half-check mark) means the answer was right but misspelled, or that the recognition misread a letter or two.

- A misspelling neither moves the country up nor sends it back to the start. It has to be spelled right before the country counts as *known*.
- Countries whose latest answer was misspelled get their own list in the menu, **Right, but check the spelling**, with the right spelling. They are not in the **Practise more** list.
- The training modes treat them as at least half weak, so they come back on new sheets until you spell them right.
- They are recognized from the stored score (0.8), so results from before this was added count too.

### Level and review

A country is *new* until it has been practiced, and *known* after three right answers in a row (score at least 0.7, not counting misspellings; Leitner box 3). A wrong answer sends it back to box 0. The box also decides when the country is due for review: after 0, 1, 3, 7, 14, 30 or 60 days.

### Grading again

Grading the same sheet again replaces the earlier result, so fixing an answer and grading again doesn't count twice. The sheet is recognized by a hidden ID on the page (or, on older sheets, by the note and the countries on the page), so it doesn't matter if the page is moved or the note renamed.

### In the menu

The **Statistics** tab shows the statistics for one skill. It follows the selected game, but you can pick another.

- **Summary:** the average score, the number of graded sheets and answers, and how many countries in the selected continent are due for review.
- **Latest sheets:** once two or more sheets are graded, a column chart shows the score on the last ten.
- **Continents:** each continent, and the whole world, gets a bar with known (black), learning (gray) and new (white) countries. Tap one to choose it for the lists below.
- **Practise more:** up to five countries in that continent with the lowest score.
- **Right, but check the spelling:** up to five countries in that continent that were misspelled last time.
- **Graded sheets:** the last ten sheets, newest first, with date, score and number of answers. **Remove** takes one sheet out of the statistics (with confirmation), for example one someone else played. Grading that sheet again adds it back.
- **Reset statistics** deletes everything (with confirmation).

### Guest mode

**Lend out (guest mode)**, under the grade buttons in the **New worksheet** tab, is for when someone else borrows the device. Sheets are made and graded as usual, but:

- nothing is saved in the statistics,
- new sheets are drawn at random, since the statistics belong to the owner (the **Practice** choice is hidden),
- a bar at the top of the menu says that guest mode is on.

Guest mode stays on, also after a restart, until you tap **Turn off guest mode**. Sheets graded in guest mode don't come back when guest mode is turned off; grade them again afterwards if they should count.

### Practice

The **Practice** choice in the menu decides which countries a new single-player sheet gets, using the statistics for the skill being practiced (`src/core/training.ts`):

- **Smart** (default) – mostly countries due for review and countries you struggle with, plus a few new ones. With no statistics yet, it draws like Random.
- **Weak** – the countries with the lowest score, filled up with new ones if there are few.
- **Review** – the countries that are due on the review schedule.
- **New** – countries you have never practiced.
- **Random** – all countries equally likely; the statistics are not used.

The countries are drawn at random in proportion to a weight, so sheets vary even when the same countries are prioritized, and the level and continent still decide which countries can be drawn. Multiplayer sheets and sheets in guest mode are always drawn at random, since the statistics belong to one player.

### Storage

The SDK cannot write file contents, so each graded sheet is stored as an empty folder with the result encoded in its name, in `<plugin folder>/stats/` (e.g. `g1.t.<time>.<key>.noz…`). At most 3000 entries are kept; the oldest are deleted first. Guest mode is stored as the empty folder `<plugin folder>/guest`. Nothing is sent from the device.

## Development

```bash
npm install
npm test          # unit tests (matching, layout, map scoring, outlines, names on the map, hot seat, statistics, notes, translations)
npm run typecheck
npm run build     # creates build/outputs/geogame.snplg
```

Install the build the same way as under [Installation](#installation). Publish via the upload button in InkHub.

## Structure

- `src/data/countries.ts` – country codes and continents; `src/data/capitals.ts` – capital coordinates
- `src/i18n/menu/<code>.ts` – the menu texts per language (`en.ts` is the template the others are translated from)
- `src/i18n/countries/<code>.ts` – country names, capitals and accepted alternative answers per language (nb and en by hand, the rest generated by `scripts/gen-languages.js`)
- `src/core/` – pure logic without the SDK (matching, layout, row distribution, map scoring, hot seat, statistics, footnotes), tested in `__tests__/`
- `src/core/stats.ts` – answer history and per-country statistics (mastery, Leitner box, review schedule, misspellings, the list of graded sheets); `src/core/statsReport.ts` – what the Statistics tab shows
- `src/core/sheetId.ts` – the hidden ID on each sheet, which tells a new grading of the same sheet from a new sheet
- `src/core/training.ts` – strategies for choosing countries for new sheets (`random`, `smart`, `weak`, `due`, `new`)
- `src/sdk/notes.ts` – wrapper around `sn-plugin-lib`; `src/sdk/pluginDir.ts` – the plugin folder, asked for once
- `src/sdk/statsStore.ts` – stores the history as empty folders in `<plugin folder>/stats/` (the SDK cannot write files), removes single sheets, and keeps guest mode
- `src/actions.ts` – creating and grading table sheets, and saving statistics (`answeredOnly` leaves out empty boxes, for all written sheet types)
- `src/mapActions.ts` – creating and grading map sheets; `src/sdk/mapAssets.ts` – the bundled maps
- `src/labelActions.ts` – creating and grading name-on-the-map sheets; `src/core/labelSheet.ts` – layout, placing the numbers, the hidden key and grading; `src/core/mapLines.ts` and `src/data/mapLines.ts` – where the map images have lines (generated)
- `src/outlineActions.ts` – creating and grading outline sheets; `src/core/outlineSheet.ts` – layout, scaling, rotation, the hidden key and grading; `src/data/outlines.ts` – the outlines (generated)
- `App.tsx` – the menu opened from the toolbar, with the tabs New worksheet, Statistics and Language

## Which countries and capitals are included

**197 countries:** the 193 UN member states ([UN list of member states](https://www.un.org/en/about-us/member-states)), the two observer states Vatican City and Palestine, and Kosovo and Taiwan, which are recognized by many countries but are not UN members. Other territories (for example Western Sahara, Greenland and the Cook Islands) are not included. The continent of each country is listed in `src/data/countries.ts`.

**Capitals:** the answer key is the country's capital (P36) in [Wikidata](https://www.wikidata.org). If the country has several official capitals (South Africa, Eswatini, Sri Lanka), all of them are accepted. Cities that are only the seat of government or an economic capital (such as The Hague, La Paz and Bujumbura) or former capitals (such as Dar es Salaam, Lagos and Malabo) are not accepted; they get a note on the graded sheet instead. See `scripts/data/co-capitals-wikidata.json` and the notes in `src/i18n/notes.ts`.

## License and data sources

The code is licensed under [MIT](LICENSE). The outlines of small countries derived from OpenStreetMap are under ODbL 1.0 (see THIRD_PARTY_NOTICES.md). The menu lists the sources under **Language → Sources**, and an outline sheet with such a country gets a credit line at the bottom. The plugin uses this data (details and license texts in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)):

- **Country names**: Unicode CLDR (Unicode License v3)
- **Capitals and coordinates**: Wikidata (CC0)
- **Maps and country outlines**: Natural Earth (public domain); outlines of small countries from geoBoundaries (OpenStreetMap/ODbL, CC BY and public domain). The maps show the de facto boundaries and take no position in border disputes.
