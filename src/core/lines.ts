/**
 * Fordeler resultatet fra én samlet gjenkjenning av hele svarkolonnen på radene.
 *
 * Gjenkjenningen gir én tekstlinje per skrevet linje, ovenfra og ned. Når antall
 * ikke-tomme linjer er det samme som antall rader med håndskrift, kan vi koble dem
 * i rekkefølge. Ellers returneres null, og kalleren må gjenkjenne rad for rad.
 *
 * @param text Samlet gjenkjent tekst.
 * @param rowsWithInk Radnumrene som har håndskrift, i stigende rekkefølge.
 */
export function splitByRows(text: string, rowsWithInk: number[]): Map<number, string> | null {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);
  if (lines.length !== rowsWithInk.length) {
    return null;
  }
  return new Map(rowsWithInk.map((row, i) => [row, lines[i]]));
}
