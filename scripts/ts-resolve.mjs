/**
 * Lets Node run the source files in src/ directly (Node 23.6+ strips the types itself):
 * imports without a file extension, such as `./layout`, are tried as `./layout.ts`.
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
            // try the next one
          }
        }
      }
      throw e;
    }
  },
});
