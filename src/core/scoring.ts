/**
 * Points for one guess on the map.
 *
 * Full pot (1000) within a tenth of the scale, so small inaccuracies in the
 * pen mark cost nothing. After that the points decay exponentially:
 * each time the distance increases by one scale, the points fall to about 37 %.
 *
 * The scale follows the map's size (1/20 of the diagonal, see scripts/gen-maps.ts):
 * Europe ≈ 300 km, world 1000 km. Miss by 300 km in Europe and you get 407 points;
 * on the world map the same miss gives 819 points.
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
