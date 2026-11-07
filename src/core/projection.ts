/**
 * Kartprojeksjoner og omregning mellom lengde/bredde, kartbilde og side.
 *
 * Kartbildene i `assets/maps/` er laget med nøyaktig disse funksjonene
 * (`scripts/gen-maps.ts`), så piksel ↔ lengde/bredde går begge veier uten tap.
 *
 * - Verdensdelene bruker Lamberts flatetro asimutale projeksjon (LAEA, sfærisk),
 *   sentrert midt i verdensdelen. Den har liten forvrengning over et kontinent
 *   og kan regnes tilbake med lukkede formler.
 * - Verdenskartet bruker Equal Earth (Šavrič, Patterson og Jenny 2018), som er
 *   flatetro og ser «vanlig» ut. Den inverse regnes med Newtons metode.
 *
 * Projeksjonskoordinatene er for en enhetskule (radius 1), med y oppover.
 * Bildekoordinatene er piksler med origo øverst til venstre.
 *
 * Filen har ingen import, så den kan kjøres direkte av Node i byggeskriptet.
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

/** Alt som trengs for å regne mellom et kartbilde og lengde/bredde. */
export interface MapMeta {
  /** Filnavn uten endelse i `assets/maps/`. */
  file: string;
  projection: Projection;
  /** Utsnittet i projeksjonskoordinater (enhetskule). */
  bounds: Bounds;
  /** Bildets størrelse i piksler. */
  width: number;
  height: number;
  /** Avstand (km) som gir poengkurven sin skala; større for større kart. */
  scaleKm: number;
}

const RAD = Math.PI / 180;

/** Lengdeforskjell i radianer, lagt i [-π, π). */
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

// Equal Earth-konstanter.
const A1 = 1.340264;
const A2 = -0.081106;
const A3 = 0.000893;
const A4 = 0.003796;
const M = Math.sqrt(3) / 2;

/** Lengde/bredde (grader) → projeksjonskoordinater. */
export function project(p: Projection, lon: number, lat: number): XY {
  return projectRelative(p, deltaLon(lon, p.lon0), lat);
}

/**
 * Som `project`, men med lengdeforskjellen fra midtmeridianen (radianer) gitt
 * direkte og uten å pakkes inn i [-π, π). Byggeskriptet bruker dette for å tegne
 * polygoner som krysser kanten av verdenskartet i ett stykke.
 */
export function projectRelative(p: Projection, lam: number, lat: number): XY {
  const phi = lat * RAD;
  if (p.kind === 'laea') {
    const phi0 = p.lat0 * RAD;
    const cosc =
      Math.sin(phi0) * Math.sin(phi) +
      Math.cos(phi0) * Math.cos(phi) * Math.cos(lam);
    // Antipoden (cosc = -1) har ingen entydig plassering; den er uansett langt utenfor kartet.
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

/** Projeksjonskoordinater → lengde/bredde (grader). */
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
  // Newtons metode for θ ut fra y.
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

/** Lengde/bredde → piksel i kartbildet. */
export function lonLatToImage(meta: MapMeta, lon: number, lat: number): XY {
  const {x, y} = project(meta.projection, lon, lat);
  const b = meta.bounds;
  return {
    x: ((x - b.xmin) / (b.xmax - b.xmin)) * meta.width,
    y: ((b.ymax - y) / (b.ymax - b.ymin)) * meta.height,
  };
}

/** Piksel i kartbildet → lengde/bredde. */
export function imageToLonLat(meta: MapMeta, px: number, py: number): LonLat {
  const b = meta.bounds;
  const x = b.xmin + (px / meta.width) * (b.xmax - b.xmin);
  const y = b.ymax - (py / meta.height) * (b.ymax - b.ymin);
  return unproject(meta.projection, x, y);
}

/** Rektangel på siden (Android-piksler). Samme form som `Rect` i layout.ts. */
export interface PageRect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Lengde/bredde → punkt på siden, når kartet er tegnet i `rect`. */
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

/** Punkt på siden → lengde/bredde, når kartet er tegnet i `rect`. */
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

/** Jordens middelradius i km. */
export const EARTH_RADIUS_KM = 6371.0088;

/** Storsirkelavstand i km (haversine). */
export function haversineKm(a: LonLat, b: LonLat): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLon = (b.lon - a.lon) * RAD;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}
