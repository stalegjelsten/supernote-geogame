/**
 * Kartbildene må være `require`-t et sted for at Metro skal legge dem i pakken
 * (`drawable-mdpi/assets_maps_<fil>.png`). Selve stien på enheten finnes med
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
