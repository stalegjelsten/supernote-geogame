// Generert av scripts/gen-maps.ts – ikke rediger for hånd.
/**
 * Kartene i assets/maps/: projeksjon, utsnitt (projeksjonskoordinater på en
 * enhetskule) og bildestørrelse. Se src/core/projection.ts for formlene.
 */
import type {MapMeta} from '../core/projection';
import type {Region} from '../core/sheet';

/** Antall hovedsteder på ett kartark; bildene er laget i full størrelse for denne layouten. */
export const MAP_SHEET_COUNT = 10;

export const MAPS: Record<Region, MapMeta> = {
  EU: {
    file: 'eu',
    projection: {kind: 'laea', lon0: 15, lat0: 52},
    bounds: {xmin: -0.3715296079, xmax: 0.3035407613, ymin: -0.3021721529, ymax: 0.3606687947},
    width: 1514,
    height: 1487,
    scaleKm: 300,
  },
  AS: {
    file: 'as',
    projection: {kind: 'laea', lon0: 88, lat0: 28},
    bounds: {xmin: -0.856103547, xmax: 0.9866066769, ymin: -0.6291774031, ymax: 0.547560167},
    width: 1574,
    height: 1005,
    scaleKm: 740,
  },
  AF: {
    file: 'af',
    projection: {kind: 'laea', lon0: 17, lat0: 2},
    bounds: {xmin: -0.7498937652, xmax: 0.7155962785, ymin: -0.6860127546, ymax: 0.6588778417},
    width: 1574,
    height: 1444,
    scaleKm: 660,
  },
  NA: {
    file: 'na',
    projection: {kind: 'laea', lon0: -85, lat0: 28},
    bounds: {xmin: -0.4916960969, xmax: 0.4616532045, ymin: -0.3927341736, ymax: 0.4748446983},
    width: 1574,
    height: 1432,
    scaleKm: 420,
  },
  SA: {
    file: 'sa',
    projection: {kind: 'laea', lon0: -60, lat0: -22},
    bounds: {xmin: -0.416072161, xmax: 0.473375499, ymin: -0.6154399322, ymax: 0.6286041151},
    width: 1064,
    height: 1488,
    scaleKm: 500,
  },
  OC: {
    file: 'oc',
    projection: {kind: 'laea', lon0: 160, lat0: -14},
    bounds: {xmin: -0.7773573589, xmax: 0.529815223, ymin: -0.6128364773, ymax: 0.4898011826},
    width: 1574,
    height: 1328,
    scaleKm: 560,
  },
  ALL: {
    file: 'world',
    projection: {kind: 'equalEarth', lon0: 10},
    bounds: {xmin: -2.739109544, xmax: 2.739109544, ymin: -1.032428198, ymax: 1.305631749},
    width: 1574,
    height: 672,
    scaleKm: 1000,
  },
};
