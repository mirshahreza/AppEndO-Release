/** @typedef {import('../types').NavigationIconPackModule} NavigationIconPackModule */

/** @type {NavigationIconPackModule | null} */
let cachedPack = null;

export default async function loadHeroiconsPack() {
  if (cachedPack) {
    return cachedPack;
  }

  const HeroIcons = await import('@heroicons/react/24/outline');
  const iconNames = Object.keys(HeroIcons)
    .filter((name) => name.endsWith('Icon'))
    .sort((left, right) => left.localeCompare(right));
  const entries = iconNames.map((name) => [name, HeroIcons[name]]);

  cachedPack = {
    entries,
    map: Object.fromEntries(entries),
  };

  return cachedPack;
}
