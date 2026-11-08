import { isNavigationIconPackId, parseNavigationIconRef } from './navigationIconRef';
import type { NavigationIconPackId, NavigationIconPackMeta, NavigationIconPackModule } from './types';

export const NAVIGATION_ICON_PACKS: NavigationIconPackMeta[] = [
  { id: 'lucide', label: 'Lucide' },
  { id: 'tabler', label: 'Tabler' },
  { id: 'phosphor', label: 'Phosphor' },
  { id: 'heroicons', label: 'Heroicons' },
  { id: 'solar', label: 'Solar' },
  { id: 'doodle', label: 'Doodle' },
  { id: 'marketeq', label: 'Marketeq' },
];

type PackLoader = () => Promise<NavigationIconPackModule>;

const packLoaders: Record<NavigationIconPackId, PackLoader> = {
  lucide: async () => {
    const module = await import('./packs/lucidePack.loader.js');
    return module.default();
  },
  tabler: async () => {
    const module = await import('./packs/tablerPack.loader.js');
    return module.default();
  },
  phosphor: async () => {
    const module = await import('./packs/phosphorPack.loader.js');
    return module.default();
  },
  heroicons: async () => {
    const module = await import('./packs/heroiconsPack.loader.js');
    return module.default();
  },
  solar: async () => {
    const module = await import('./packs/solarPack.loader.js');
    return module.default();
  },
  doodle: async () => {
    const module = await import('./packs/doodlePack.loader.js');
    return module.default();
  },
  marketeq: async () => {
    const module = await import('./packs/marketeqPack.loader.js');
    return module.default();
  },
};

const packCache = new Map<NavigationIconPackId, NavigationIconPackModule>();
const packLoadPromises = new Map<NavigationIconPackId, Promise<NavigationIconPackModule>>();

export function getCachedNavigationIconPack(
  packId: NavigationIconPackId,
): NavigationIconPackModule | null {
  return packCache.get(packId) ?? null;
}

export async function loadNavigationIconPack(
  packId: NavigationIconPackId,
): Promise<NavigationIconPackModule> {
  const cached = packCache.get(packId);
  if (cached) {
    return cached;
  }

  const pending = packLoadPromises.get(packId);
  if (pending) {
    return pending;
  }

  const loadPromise = packLoaders[packId]()
    .then((pack) => {
      packCache.set(packId, pack);
      packLoadPromises.delete(packId);
      return pack;
    })
    .catch((error) => {
      packLoadPromises.delete(packId);
      throw error;
    });

  packLoadPromises.set(packId, loadPromise);
  return loadPromise;
}

export function resolveNavigationIconFromCache(
  iconRef?: string | null,
): NavigationIconPackModule['map'][string] | null {
  const parsed = parseNavigationIconRef(iconRef);
  if (!parsed || !isNavigationIconPackId(parsed.packId)) {
    return null;
  }

  return packCache.get(parsed.packId)?.map[parsed.iconName] ?? null;
}
