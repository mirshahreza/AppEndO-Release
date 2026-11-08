import type { NavigationIconPackId } from './types';
import { NAVIGATION_ICON_PACK_INFO } from './navigationIconPackInfo';

export type IconPackManifestEntry = {
  id: NavigationIconPackId;
  label: string;
  npmPackage?: string;
  license: string;
  attributionRequired: boolean;
  suggestedAttribution?: string;
  author: string;
  homepage?: string;
  usage: 'navigation' | 'decorative';
  bundled: boolean;
};

export const ICON_PACK_MANIFEST: IconPackManifestEntry[] = [
  {
    id: 'lucide',
    label: 'Lucide',
    npmPackage: 'lucide-react',
    license: 'ISC',
    attributionRequired: false,
    author: 'Lucide Contributors',
    homepage: 'https://lucide.dev',
    usage: 'navigation',
    bundled: true,
  },
  {
    id: 'tabler',
    label: 'Tabler',
    npmPackage: '@tabler/icons-react',
    license: 'MIT',
    attributionRequired: false,
    author: 'Tabler Contributors',
    homepage: 'https://tabler.io/icons',
    usage: 'navigation',
    bundled: true,
  },
  {
    id: 'phosphor',
    label: 'Phosphor',
    npmPackage: '@phosphor-icons/react',
    license: 'MIT',
    attributionRequired: false,
    author: 'Phosphor Icons',
    homepage: 'https://phosphoricons.com',
    usage: 'navigation',
    bundled: true,
  },
  {
    id: 'heroicons',
    label: 'Heroicons',
    npmPackage: '@heroicons/react',
    license: 'MIT',
    attributionRequired: false,
    author: 'Tailwind Labs',
    homepage: 'https://heroicons.com',
    usage: 'navigation',
    bundled: true,
  },
  {
    id: 'solar',
    label: 'Solar',
    npmPackage: '@solar-icons/react',
    license: 'CC BY 4.0 (icon assets)',
    attributionRequired: true,
    suggestedAttribution: NAVIGATION_ICON_PACK_INFO.solar.suggestedAttribution,
    author: '480 Design',
    homepage: 'https://www.figma.com/community/file/1166831539721848736',
    usage: 'decorative',
    bundled: true,
  },
  {
    id: 'doodle',
    label: 'Doodle',
    npmPackage: 'react-doodle-icons',
    license: 'MIT',
    attributionRequired: false,
    author: 'Khushmeen Sidhu',
    homepage: 'https://khushmeen.com/icons.html',
    usage: 'decorative',
    bundled: true,
  },
  {
    id: 'marketeq',
    label: 'Marketeq',
    npmPackage: '@iconify-json/marketeq',
    license: 'MIT',
    attributionRequired: false,
    author: 'Marketeq',
    homepage: 'https://icon-sets.iconify.design/marketeq/',
    usage: 'decorative',
    bundled: true,
  },
];

export function getIconPackManifestEntry(packId: NavigationIconPackId): IconPackManifestEntry | undefined {
  return ICON_PACK_MANIFEST.find((entry) => entry.id === packId);
}

export function listNavigationIconPacks(): IconPackManifestEntry[] {
  return ICON_PACK_MANIFEST.filter((entry) => entry.usage === 'navigation');
}

export function listDecorativeIconPacks(): IconPackManifestEntry[] {
  return ICON_PACK_MANIFEST.filter((entry) => entry.usage === 'decorative');
}
