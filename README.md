# World Capitals Quiz

Supernote-plugin for å øve på land og hovedsteder. Pluginen lager et arbeidsark på en notatside, du skriver hovedstedene for hånd, og pluginen retter arket med håndskriftgjenkjenning.

## Bruk

1. Åpne en tom side i et notat.
2. Trykk **World Capitals Quiz** i verktøylinja, velg verdensdel og antall, og trykk **Lag arket**.
3. Skriv hovedstedene i midtkolonnen.
4. Trykk **World Capitals Quiz → Rett arket på denne siden**. Resultatet skrives i høyre kolonne. Du kan rette på nytt etter at du har endret svar.

## Flere spillere (hot seat)

Velg **Spillere: 2–4** i menyen og hvordan dere spiller:

- **Send rundt** – enheten skjules for de andre. Hver spiller får egne sider med *de samme* landene, med en «Gi enheten til Spiller 2»-side imellom. Trykk **Rett hele settet** på en av spillernes sider for å rette alle og se hvem som vant.
- **Bytt på** – alle ser enheten. Dere deler ett ark og svarer annenhver gang; hver spiller har *egne* land, så det hjelper ikke å se på de andres svar. Tallet i svarruta (tabell) eller nummeret i lista (kart) viser hvem sin tur det er. Poeng per spiller skrives nederst.

Hvilket spill en side hører til, står først i undertittelen («Spiller 2 av 3 · …», «Duell for 2 · …») og leses ved retting (`src/core/hotseat.ts`).

## Statistikk

Hver retting lagres: hvilket land, hvilken ferdighet (skrive hovedstad, hovedstad på kartet, land på kartet) og hvor godt det gikk. Retter du samme ark på nytt, erstattes den forrige rettingen. Menyen viser statistikk for spillet og verdensdelen som er valgt, og landene du bør øve mer på.

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

## Lisens og datakilder

Koden er lisensiert under [MIT](LICENSE). Pluginen bruker disse dataene (detaljer og lisenstekst i [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)):

- **Landnavn**: Unicode CLDR (Unicode License v3)
- **Hovedsteder og koordinater**: Wikidata (CC0)
- **Kart**: Natural Earth (allemannseie). Kartene viser de faktiske grensene og tar ikke stilling i grensekonflikter.
