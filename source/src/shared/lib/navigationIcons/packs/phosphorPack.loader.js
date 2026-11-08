/** @typedef {import('../types').NavigationIconPackModule} NavigationIconPackModule */

/** @type {NavigationIconPackModule | null} */
let cachedPack = null;

export default async function loadPhosphorPack() {
  if (cachedPack) {
    return cachedPack;
  }

  const PhosphorIcons = await import('@phosphor-icons/react');
  const iconNames = Object.keys(PhosphorIcons)
    .filter((name) => !name.endsWith('Icon'))
    .sort((left, right) => left.localeCompare(right));
  const entries = iconNames.map((name) => [name, PhosphorIcons[name]]);

  cachedPack = {
    entries,
    map: Object.fromEntries(entries),
  };

  return cachedPack;
}
