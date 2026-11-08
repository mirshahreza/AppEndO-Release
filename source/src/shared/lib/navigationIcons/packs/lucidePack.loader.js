/** @typedef {import('../types').NavigationIconPackModule} NavigationIconPackModule */

/** @type {NavigationIconPackModule | null} */
let cachedPack = null;

export default async function loadLucidePack() {
  if (cachedPack) {
    return cachedPack;
  }

  const lucideModule = await import('lucide-react');
  // `icons` is canonical only (House, not Home). Keep deprecated aliases that Lucide
  // still exports so nav refs like "Home" resolve instead of falling back to Settings.
  const map = { ...lucideModule.icons };
  if (lucideModule.Home && !map.Home) {
    map.Home = lucideModule.Home;
  }
  const iconNames = Object.keys(map).sort((left, right) => left.localeCompare(right));
  const entries = iconNames.map((name) => [name, map[name]]);

  cachedPack = {
    entries,
    map,
  };

  return cachedPack;
}
