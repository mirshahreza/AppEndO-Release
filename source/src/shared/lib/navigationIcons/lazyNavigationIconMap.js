// @ts-nocheck
/** @typedef {import('./types').NavigationIconComponent} NavigationIconComponent */

/**
 * Build a name → component map that creates icons on first access only.
 * @param {readonly string[]} iconNames
 * @param {(iconName: string) => NavigationIconComponent} createIcon
 * @returns {Record<string, NavigationIconComponent>}
 */
export function createLazyNavigationIconMap(iconNames, createIcon) {
  const iconSet = new Set(iconNames);
  const cache = Object.create(null);

  return new Proxy(Object.create(null), {
    get(_target, prop) {
      if (typeof prop !== 'string' || !iconSet.has(prop)) {
        return undefined;
      }

      if (!cache[prop]) {
        cache[prop] = createIcon(prop);
      }

      return cache[prop];
    },
  });
}

/**
 * @param {import('./types').NavigationIconPackModule} pack
 * @returns {readonly string[]}
 */
export function getNavigationIconPackNames(pack) {
  if (pack.iconNames) {
    return pack.iconNames;
  }

  return pack.entries.map(([name]) => name);
}
