/** @typedef {import('../types').NavigationIconPackModule} NavigationIconPackModule */

/** @type {NavigationIconPackModule | null} */
let cachedPack = null;

export default async function loadTablerPack() {
  if (cachedPack) {
    return cachedPack;
  }

  const TablerIcons = await import('@tabler/icons-react');
  const iconNames = Object.keys(TablerIcons)
    .filter((name) => name.startsWith('Icon'))
    .sort((left, right) => left.localeCompare(right));
  const entries = iconNames.map((name) => [name, TablerIcons[name]]);

  cachedPack = {
    entries,
    map: Object.fromEntries(entries),
  };

  return cachedPack;
}
