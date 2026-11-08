// @ts-nocheck
/** @typedef {import('../types').NavigationIconPackModule} NavigationIconPackModule */

import { addCollection } from '@iconify/react';
import { createLazyNavigationIconMap } from '../lazyNavigationIconMap.js';
import { createMarketeqIcon } from './packIconWrappers.js';

/** @type {NavigationIconPackModule | null} */
let cachedPack = null;

/** @type {Promise<void> | null} */
let collectionRegistered = null;

async function ensureMarketeqCollection() {
  if (!collectionRegistered) {
    collectionRegistered = import('@iconify-json/marketeq').then((marketeqModule) => {
      addCollection(marketeqModule.default ?? marketeqModule);
    });
  }
  await collectionRegistered;
}

export default async function loadMarketeqPack() {
  if (cachedPack) {
    return cachedPack;
  }

  await ensureMarketeqCollection();

  const marketeqModule = await import('@iconify-json/marketeq');
  const iconNames = Object.keys(marketeqModule.icons.icons)
    .sort((left, right) => left.localeCompare(right));

  cachedPack = {
    iconNames,
    entries: [],
    map: createLazyNavigationIconMap(iconNames, (name) => createMarketeqIcon(name)),
  };

  return cachedPack;
}
