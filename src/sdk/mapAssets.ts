/**
 * The map images must be `require`d somewhere for Metro to include them in the bundle
 * (`drawable-mdpi/assets_maps_<fil>.png`). The actual path on the device is found with
 * `bundledImagePath` i notes.ts.
 */
export const MAP_ASSETS = {
  eu: require('../../assets/maps/eu.png'),
  as: require('../../assets/maps/as.png'),
  af: require('../../assets/maps/af.png'),
  na: require('../../assets/maps/na.png'),
  sa: require('../../assets/maps/sa.png'),
  oc: require('../../assets/maps/oc.png'),
  world: require('../../assets/maps/world.png'),
} as const;
