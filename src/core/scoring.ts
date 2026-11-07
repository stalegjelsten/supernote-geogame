/**
 * Poeng for én gjetning på kartet.
 *
 * Full pott (1000) innenfor en tidel av skalaen, så små unøyaktigheter i
 * pennemerket ikke koster noe. Deretter avtar poengene eksponentielt:
 * hver gang avstanden øker med én skala, faller poengene til ca. 37 %.
 *
 * Skalaen følger kartets størrelse (1/20 av diagonalen, se scripts/gen-maps.ts):
 * Europa ≈ 300 km, verden 1000 km. Bommer du med 300 km i Europa, får du 407 poeng;
 * på verdenskartet gir samme bom 819 poeng.
 */
export const MAX_POINTS = 1000;

export function mapPoints(distanceKm: number, scaleKm: number): number {
  if (!(distanceKm >= 0) || !(scaleKm > 0)) {
    return 0;
  }
  const free = scaleKm / 10;
  if (distanceKm <= free) {
    return MAX_POINTS;
  }
  return Math.round(MAX_POINTS * Math.exp(-(distanceKm - free) / scaleKm));
}
