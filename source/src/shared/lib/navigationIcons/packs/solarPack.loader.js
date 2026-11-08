// @ts-nocheck
/** @typedef {import('../types').NavigationIconPackModule} NavigationIconPackModule */

import { createLazyNavigationIconMap } from '../lazyNavigationIconMap.js';
import { wrapSolarIcon } from './packIconWrappers.js';

/** @type {NavigationIconPackModule | null} */
let cachedPack = null;

export default async function loadSolarPack() {
  if (cachedPack) {
    return cachedPack;
  }

  const SolarIcons = await import('@solar-icons/react');
  const iconNames = Object.keys(SolarIcons)
    .filter((name) => /^[A-Z]/.test(name))
    .sort((left, right) => left.localeCompare(right));

  cachedPack = {
    iconNames,
    entries: [],
    map: createLazyNavigationIconMap(iconNames, (name) => wrapSolarIcon(SolarIcons[name])),
  };

  return cachedPack;
}
