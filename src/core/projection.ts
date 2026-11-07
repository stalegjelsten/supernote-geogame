/**
 * Map projections and conversion between longitude/latitude, map image and page.
 *
 * The map images in `assets/maps/` are made with exactly these functions
 * (`scripts/gen-maps.ts`), so pixel ↔ longitude/latitude works both ways without loss.
 *
 * - The continents use Lambert's azimuthal equal-area projection (LAEA, spherical),
 *   centered in the middle of the continent. It has little distortion across a continent
 *   and can be inverted with closed formulas.
 * - The world map uses Equal Earth (Šavrič, Patterson and Jenny 2018), which is
 *   equal-area and looks "ordinary". The inverse is computed with Newton's method.
 *
 * Projection coordinates are for a unit sphere (radius 1), with y upward.
 * Image coordinates are pixels with the origin at the top left.
 *
 * The file has no imports, so it can be run directly by Node in the build script.
 */

export interface LonLat {
  lon: number;
  lat: number;
}

export interface XY {
  x: number;
  y: number;
}

export type Projection =
  | {kind: 'laea'; lon0: number; lat0: number}
  | {kind: 'equalEarth'; lon0: number};

export interface Bounds {
  xmin: number;
  xmax: number;
  ymin: number;
  ymax: number;
}

/** Everything needed to convert between a map image and longitude/latitude. */
export interface MapMeta {
  /** File name without extension in `assets/maps/`. */
  file: string;
  projection: Projection;
  /** The extent in projection coordinates (unit sphere). */
  bounds: Bounds;
  /** The image's size in pixels. */
  width: number;
  height: number;
  /** Distance (km) that gives the score curve its scale; larger for larger maps. */
  scaleKm: number;
}

const RAD = Math.PI / 180;

/** Longitude difference in radians, wrapped into [-π, π). */
function deltaLon(lon: number, lon0: number): number {
  let d = (lon - lon0) % 360;
  if (d < -180) {
    d += 360;
  } else if (d >= 180) {
    d -= 360;
  }
  return d * RAD;
}

function wrapLon(lon: number): number {
  let l = ((((lon + 180) % 360) + 360) % 360) - 180;
  if (l === -180) {
    l = 180;
  }
  return l;
}

// Equal Earth constants.
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

/** Longitude/latitude (degrees) → projection coordinates. */
export function project(p: Projection, lon: number, lat: number): XY {
  return projectRelative(p, deltaLon(lon, p.lon0), lat);
}

/**
 * Like `project`, but with the longitude difference from the central meridian (radians) given
 * directly and not wrapped into [-π, π). The build script uses this to draw
 * polygons that cross the edge of the world map in one piece.
 */
export function projectRelative(p: Projection, lam: number, lat: number): XY {
  const phi = lat * RAD;
  if (p.kind === 'laea') {
    const phi0 = p.lat0 * RAD;
    const cosc =
      Math.sin(phi0) * Math.sin(phi) +
      Math.cos(phi0) * Math.cos(phi) * Math.cos(lam);
    // The antipode (cosc = -1) has no unique placement; it is far outside the map anyway.
    const k = Math.sqrt(2 / Math.max(1e-12, 1 + cosc));
    return {
      x: k * Math.cos(phi) * Math.sin(lam),
      y:
        k *
        (Math.cos(phi0) * Math.sin(phi) -
          Math.sin(phi0) * Math.cos(phi) * Math.cos(lam)),
    };
  }
  const theta = Math.asin(M * Math.sin(phi));
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  return {
    x:
      (2 * Math.sqrt(3) * lam * Math.cos(theta)) /
      (3 * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1)),
    y: theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)),
  };
}

/** Projection coordinates → longitude/latitude (degrees). */
export function unproject(p: Projection, x: number, y: number): LonLat {
  if (p.kind === 'laea') {
    const phi0 = p.lat0 * RAD;
    const rho = Math.hypot(x, y);
    if (rho < 1e-12) {
      return {lon: p.lon0, lat: p.lat0};
    }
    const c = 2 * Math.asin(Math.min(1, rho / 2));
    const sinc = Math.sin(c);
    const cosc = Math.cos(c);
    const lat = Math.asin(
      cosc * Math.sin(phi0) + (y * sinc * Math.cos(phi0)) / rho,
    );
    const lam = Math.atan2(
      x * sinc,
      rho * Math.cos(phi0) * cosc - y * Math.sin(phi0) * sinc,
    );
    return {lon: wrapLon(p.lon0 + lam / RAD), lat: lat / RAD};
  }
  // Newton's method for θ from y.
  let theta = y / A1;
  for (let i = 0; i < 20; i++) {
    const t2 = theta * theta;
    const t6 = t2 * t2 * t2;
    const f = theta * (A1 + A2 * t2 + t6 * (A3 + A4 * t2)) - y;
    const df = A1 + 3 * A2 * t2 + t6 * (7 * A3 + 9 * A4 * t2);
    const step = f / df;
    theta -= step;
    if (Math.abs(step) < 1e-12) {
      break;
    }
  }
  const t2 = theta * theta;
  const t6 = t2 * t2 * t2;
  const lam =
    (3 * x * (9 * A4 * t6 * t2 + 7 * A3 * t6 + 3 * A2 * t2 + A1)) /
    (2 * Math.sqrt(3) * Math.cos(theta));
  const lat = Math.asin(Math.max(-1, Math.min(1, Math.sin(theta) / M)));
  return {lon: wrapLon(p.lon0 + lam / RAD), lat: lat / RAD};
}

/** Longitude/latitude → pixel in the map image. */
export function lonLatToImage(meta: MapMeta, lon: number, lat: number): XY {
  const {x, y} = project(meta.projection, lon, lat);
  const b = meta.bounds;
  return {
    x: ((x - b.xmin) / (b.xmax - b.xmin)) * meta.width,
    y: ((b.ymax - y) / (b.ymax - b.ymin)) * meta.height,
  };
}

/** Pixel in the map image → longitude/latitude. */
export function imageToLonLat(meta: MapMeta, px: number, py: number): LonLat {
  const b = meta.bounds;
  const x = b.xmin + (px / meta.width) * (b.xmax - b.xmin);
  const y = b.ymax - (py / meta.height) * (b.ymax - b.ymin);
  return unproject(meta.projection, x, y);
}

/** Rectangle on the page (Android pixels). Same shape as `Rect` in layout.ts. */
export interface PageRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Longitude/latitude → point on the page, when the map is drawn in `rect`. */
export function lonLatToPage(
  meta: MapMeta,
  rect: PageRect,
  lon: number,
  lat: number,
): XY {
  const p = lonLatToImage(meta, lon, lat);
  return {
    x: rect.left + (p.x / meta.width) * (rect.right - rect.left),
    y: rect.top + (p.y / meta.height) * (rect.bottom - rect.top),
  };
}

/** Point on the page → longitude/latitude, when the map is drawn in `rect`. */
export function pageToLonLat(
  meta: MapMeta,
  rect: PageRect,
  x: number,
  y: number,
): LonLat {
  return imageToLonLat(
    meta,
    ((x - rect.left) / (rect.right - rect.left)) * meta.width,
    ((y - rect.top) / (rect.bottom - rect.top)) * meta.height,
  );
}

/** Earth's mean radius in km. */
export const EARTH_RADIUS_KM = 6371.0088;

/** Great-circle distance in km (haversine). */
export function haversineKm(a: LonLat, b: LonLat): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
