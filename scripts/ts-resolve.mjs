/**
 * Lar Node kjøre kildefilene i src/ direkte (Node 23.6+ fjerner typene selv):
 * importer uten filendelse, som `./layout`, prøves som `./layout.ts`.
 *
 *   node --no-warnings --import ./scripts/ts-resolve.mjs scripts/preview-map-sheet.ts
 */
import {registerHooks} from 'node:module';

registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (e) {
      if (specifier.startsWith('.')) {
        for (const ext of ['.ts', '.tsx', '/index.ts']) {
          try {
            return nextResolve(specifier + ext, context);
          } catch {
            // prøv neste
          }
        }
      }
      throw e;
    }
  },
});
