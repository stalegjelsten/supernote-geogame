# Geogame

Supernote-plugin for å øve på land og hovedsteder. Pluginen lager et arbeidsark på en notatside, du skriver hovedstedene for hånd, og pluginen retter arket med håndskriftgjenkjenning.

## Bruk

1. Åpne en tom side i et notat.
2. Trykk **Geogame** i verktøylinja, velg verdensdel og antall, og trykk **Lag arket**.
3. Skriv hovedstedene i midtkolonnen.
4. Trykk **Geogame → Rett arket på denne siden**. Resultatet skrives i høyre kolonne. Du kan rette på nytt etter at du har endret svar.

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
