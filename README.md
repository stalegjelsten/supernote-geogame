# Geogame

Supernote-plugin for å øve på land og hovedsteder. Pluginen lager et arbeidsark på en notatside, du skriver hovedstedene for hånd, og pluginen retter arket med håndskriftgjenkjenning.

## Bruk

1. Åpne en tom side i et notat.
2. Trykk **Geogame** i verktøylinja, velg verdensdel og antall, og trykk **Lag arket**.
3. Skriv hovedstedene i midtkolonnen.
4. Trykk **Geogame → Rett arket på denne siden**. Resultatet skrives i høyre kolonne. Du kan rette på nytt etter at du har endret svar.

## Nivå

Velg **Blandet**, **Lett**, **Middels** eller **Vanskelig**. Landene i verdensdelen sorteres etter hvor kjent hovedstaden er (landet, når kartet ber deg merke land), og nivået trekker fra den mest kjente, midterste eller minst kjente tredjedelen. Kjentheten er sidevisninger på Wikipedia på 13 språk (`src/data/familiarity.ts`, laget med `node scripts/gen-familiarity.js`; kilder: Wikimedia og Wikidata, CC0).

## Flere spillere (hot seat)

Velg **Spillere: 2–4** i menyen og hvordan dere spiller:

- **Send rundt** – enheten skjules for de andre. Hver spiller får egne sider med *de samme* landene, med en «Gi enheten til Spiller 2»-side imellom. Trykk **Rett hele settet** på en av spillernes sider for å rette alle og se hvem som vant.
- **Bytt på** – alle ser enheten. Dere deler ett ark og svarer annenhver gang; hver spiller har *egne* land, trukket så alle får omtrent like kjente, så det hjelper ikke å se på de andres svar. Tallet i svarruta (tabell) eller nummeret i lista (kart) viser hvem sin tur det er. Poeng per spiller skrives nederst.

Hvilket spill en side hører til, står først i undertittelen («Spiller 2 av 3 · …», «Duell for 2 · …») og leses ved retting (`src/core/hotseat.ts`).

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
- `src/sdk/notes.ts` – innpakning av `sn-plugin-lib`
- `src/actions.ts` – «Nytt ark» og «Rett arket»
- `App.tsx` – menyen som åpnes fra verktøylinja
