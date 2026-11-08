// @ts-nocheck
/** @typedef {import('../types').NavigationIconPackModule} NavigationIconPackModule */

import { createLazyNavigationIconMap } from '../lazyNavigationIconMap.js';

/** @type {NavigationIconPackModule | null} */
let cachedPack = null;

export default async function loadDoodlePack() {
  if (cachedPack) {
    return cachedPack;
  }

  const DoodleIcons = await import('react-doodle-icons');
  const iconNames = Object.keys(DoodleIcons)
    .filter((name) => name.endsWith('Icon'))
    .sort((left, right) => left.localeCompare(right));

  cachedPack = {
    iconNames,
    entries: [],
    map: createLazyNavigationIconMap(iconNames, (name) => DoodleIcons[name]),
  };

  return cachedPack;
}
