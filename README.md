# World Capitals Quiz

Supernote-plugin for å øve på land og hovedsteder. Pluginen lager et arbeidsark på en notatside, du skriver hovedstedene for hånd, og pluginen retter arket med håndskriftgjenkjenning.

> **Laget med KI.** All koden i dette prosjektet er skrevet av KI (Claude fra Anthropic, via Claude Code). Det samme gjelder tekstene og oversettelsene i pluginen. Ståle Gjelsten har bestemt hva pluginen skal gjøre, styrt arbeidet og testet den på en Supernote Manta. Landnavn, hovedsteder og kart kommer fra åpne datakilder (se [Lisens og datakilder](#lisens-og-datakilder)), ikke fra KI.

## Bruk

1. Åpne et notat. Arket lages på siden du står på hvis den er tom og har hvit eller ingen mal; ellers lages det på en ny side etter den.
2. Trykk **World Capitals Quiz** i verktøylinja, velg verdensdel og antall, og trykk **Lag arket**.
3. Skriv hovedstedene i midtkolonnen.
4. Trykk **World Capitals Quiz → Rett arket på denne siden**. Resultatet skrives i høyre kolonne. Du kan rette på nytt etter at du har endret svar.

For hovedsteder som ofte forveksles eller der landet har flere hovedsteder (for eksempel Tanzania, Sør-Afrika, Bolivia og Nigeria), får resultatcellen et lite tall, og en kort merknad står nederst på arket. Eksempel: «¹ Dar es Salaam var hovedstad til 1996 og er største by.» Merknadene ligger i `src/i18n/notes.ts` (norsk og engelsk; andre språk får engelsk).

## Flere spillere (hot seat)

Velg **Spillere: 2–4** i menyen og hvordan dere spiller:

- **Send rundt** – enheten skjules for de andre. Hver spiller får egne sider med *de samme* landene, med en «Gi enheten til Spiller 2»-side imellom. Trykk **Rett hele settet** på en av spillernes sider for å rette alle og se hvem som vant.
- **Bytt på** – alle ser enheten. Dere deler ett ark og svarer annenhver gang; hver spiller har *egne* land, så det hjelper ikke å se på de andres svar. Tallet i svarruta (tabell) eller nummeret i lista (kart) viser hvem sin tur det er. Poeng per spiller skrives nederst.

Hvilket spill en side hører til, står først i undertittelen («Spiller 2 av 3 · …», «Duell for 2 · …») og leses ved retting (`src/core/hotseat.ts`).

## Statistikk

Hver retting av et ark for én spiller lagres: hvilke land, hvilken ferdighet (skrive hovedstad, hovedstad på kartet, land på kartet), hvor godt det gikk og når. Flerspillerark lagres ikke, siden svarene der tilhører flere spillere.

- **Score per land:** riktig = 1, nesten = 0,8, feil eller blank = 0. På kartet gir hovedsteder poeng/1000 og land riktig/feil; byer du hopper over teller som 0, og byer uten merke tas ikke med.
- **Ny retting av samme ark** erstatter den forrige. Arket kjennes igjen på notatet og landene på siden, så det tåler at sider flyttes.
- **Nivå:** et land er *nytt* til det er øvd, og *kan* etter tre riktige på rad (Leitner-boks 3). Boksen bestemmer også når landet bør repeteres (0, 1, 3, 7, 14, 30 og 60 dager).
- **I menyen** under **Statistikk** vises antall rettede ark, kan/øver på/nye per verdensdel, hvor mange land som skal repeteres og de fem landene du bør øve mer på, for spillet og verdensdelen som er valgt. **Nullstill statistikk** sletter alt (med bekreftelse).
- **Lagring:** SDK-en kan ikke skrive filinnhold, så hvert rettet ark lagres som en tom mappe med resultatet kodet i navnet, i `<pluginmappe>/stats/` (f.eks. `g1.t.<tid>.<nøkkel>.noz…`). Høyst 3000 poster; de eldste slettes først. Ingenting sendes fra enheten.
- **Treningsmoduser:** `src/core/training.ts` har strategier for å velge land til nye ark ut fra statistikken. `createSheet` og `createMapSheet` tar imot en strategi, men menyen har ikke noe valg for det ennå, så arkene trekkes fortsatt tilfeldig.

## Utvikling

```bash
npm install
npm test          # enhetstester for svarsammenligning, layout og radfordeling
npm run typecheck
npm run build     # lager build/outputs/geogame.snplg
```

Installer ved å kopiere `geogame.snplg` til `MyStyle/` på enheten og gå til Innstillinger → Apper → Plugins → Legg til plugin. Publiser via opplastingsknappen i InkHub.

## Struktur

- `src/data/countries.ts` – land, hovedsteder og godkjente alternative svar
- `src/core/` – ren logikk uten SDK (sammenligning, layout, radfordeling), testet i `__tests__/`
- `src/core/stats.ts` – svarhistorikk og statistikk per land (mestring, Leitner-boks, repetisjonsplan)
- `src/core/training.ts` – strategier for å velge land til nye ark (`random`, `smart`, `weak`, `due`, `new`)
- `src/sdk/notes.ts` – innpakning av `sn-plugin-lib`
- `src/sdk/statsStore.ts` – lagrer historikken som tomme mapper i `<pluginmappe>/stats/` (SDK-en kan ikke skrive filer)
- `src/actions.ts` – «Nytt ark» og «Rett arket»
- `App.tsx` – menyen som åpnes fra verktøylinja

## Hvilke land og hovedsteder er med

**197 land:** de 193 medlemslandene i FN ([FNs liste over medlemsland](https://www.un.org/en/about-us/member-states)), de to observatørstatene Vatikanstaten og Palestina, og Kosovo og Taiwan, som er anerkjent av mange land, men ikke er medlemmer av FN. Andre områder (for eksempel Vest-Sahara, Grønland og Cookøyene) er ikke med. Verdensdelen til hvert land står i `src/data/countries.ts`.

**Hovedsteder:** fasiten er hovedstaden (P36) til landet i [Wikidata](https://www.wikidata.org). Har landet flere hovedsteder, er fasiten den som vanligvis oppgis som offisiell hovedstad. Byer som de facto også er hovedstad (regjeringssete, delte hovedsteder) godtas som svar, men ikke tidligere hovedsteder. Se `scripts/data/co-capitals-wikidata.json` og merknadene i `src/i18n/notes.ts`.

## Lisens og datakilder

Koden er lisensiert under [MIT](LICENSE). Pluginen bruker disse dataene (detaljer og lisenstekst i [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)):

- **Landnavn**: Unicode CLDR (Unicode License v3)
- **Hovedsteder og koordinater**: Wikidata (CC0)
- **Kart**: Natural Earth (allemannseie). Kartene viser de faktiske grensene og tar ikke stilling i grensekonflikter.
