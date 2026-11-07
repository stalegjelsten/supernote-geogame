/**
 * Distributes the result from one combined recognition of the whole answer column onto the rows.
 *
 * The recognition gives one text line per written line, top to bottom. When the number of
 * non-empty lines equals the number of rows with handwriting, we can match them
 * in order. Otherwise null is returned, and the caller must recognize row by row.
 *
 * @param text Combined recognized text.
 * @param rowsWithInk The row numbers that have handwriting, in ascending order.
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
