import type { NavigationIconPackId } from './types';

export type NavigationIconPackInfo = {
  packId: NavigationIconPackId;
  summary: string;
  style: string;
  approximateCount: string;
  license: string;
  licenseSummary: string;
  attributionRequired: boolean;
  suggestedAttribution?: string;
  author: string;
  homepage?: string;
  repository?: string;
  npmPackage?: string;
  usageNotes: readonly string[];
};

export const NAVIGATION_ICON_PACK_INFO: Record<NavigationIconPackId, NavigationIconPackInfo> = {
  lucide: {
    packId: 'lucide',
    summary: 'Clean stroke icons tuned for product UI and navigation.',
    style: '24×24 stroke icons with consistent line weight.',
    approximateCount: '1,600+',
    license: 'ISC',
    licenseSummary: 'Free for personal and commercial use. Modify and redistribute under ISC terms.',
    attributionRequired: false,
    author: 'Lucide Contributors',
    homepage: 'https://lucide.dev',
    repository: 'https://github.com/lucide-icons/lucide',
    npmPackage: 'lucide-react',
    usageNotes: [
      'Icons inherit `currentColor` — toolbar color tokens apply normally.',
      'Legacy refs without a pack prefix resolve to Lucide.',
    ],
  },
  tabler: {
    packId: 'tabler',
    summary: 'Large MIT icon library with broad category coverage.',
    style: '24×24 outline icons on a 2px stroke grid.',
    approximateCount: '5,900+',
    license: 'MIT',
    licenseSummary: 'Free for personal and commercial use with minimal restrictions.',
    attributionRequired: false,
    author: 'Tabler Contributors',
    homepage: 'https://tabler.io/icons',
    repository: 'https://github.com/tabler/tabler-icons',
    npmPackage: '@tabler/icons-react',
    usageNotes: [
      'Icon component names are prefixed with `Icon` (for example `IconHome`).',
      'Icons inherit `currentColor`.',
    ],
  },
  phosphor: {
    packId: 'phosphor',
    summary: 'Distinctive open-source family with multiple weights.',
    style: 'Flexible stroke icons; this pack loads the default regular weight set.',
    approximateCount: '1,500+',
    license: 'MIT',
    licenseSummary: 'Free for personal and commercial use.',
    attributionRequired: false,
    author: 'Phosphor Icons',
    homepage: 'https://phosphoricons.com',
    repository: 'https://github.com/phosphor-icons/core',
    npmPackage: '@phosphor-icons/react',
    usageNotes: [
      'PascalCase names without an `Icon` suffix (for example `House`).',
      'Icons inherit `currentColor`.',
    ],
  },
  heroicons: {
    packId: 'heroicons',
    summary: 'Hand-crafted outline icons from the Tailwind CSS team.',
    style: '24×24 outline icons for app shells and navigation.',
    approximateCount: '450+',
    license: 'MIT',
    licenseSummary: 'Free for personal and commercial use.',
    attributionRequired: false,
    author: 'Tailwind Labs',
    homepage: 'https://heroicons.com',
    repository: 'https://github.com/tailwindlabs/heroicons',
    npmPackage: '@heroicons/react',
    usageNotes: [
      'This pack uses the 24px outline set; names end with `Icon` (for example `HomeIcon`).',
      'Icons inherit `currentColor`.',
    ],
  },
  solar: {
    packId: 'solar',
    summary: 'Rounded decorative icons with soft corners and duotone fills.',
    style: 'Bold Duotone variant — two-tone accent fills on a rounded grid.',
    approximateCount: '1,400+',
    license: 'CC BY 4.0 (icon assets)',
    licenseSummary:
      'Free for commercial use. You must credit the original icon author (480 Design). The React wrapper code is MIT.',
    attributionRequired: true,
    suggestedAttribution:
      'Icons from Solar Icon Set by 480 Design — https://www.figma.com/community/file/1166831539721848736 — CC BY 4.0.',
    author: '480 Design',
    homepage: 'https://www.figma.com/community/file/1166831539721848736',
    repository: 'https://github.com/480-Design/Solar-Icon-Set',
    npmPackage: '@solar-icons/react',
    usageNotes: [
      'Loaded with the Bold Duotone weight by default.',
      'Built-in colors are preserved; toolbar color tokens may have limited effect.',
    ],
  },
  doodle: {
    packId: 'doodle',
    summary: 'Playful hand-drawn sketch icons for informal surfaces.',
    style: 'Hand-drawn doodle / sketch stroke aesthetic.',
    approximateCount: '439',
    license: 'MIT',
    licenseSummary: 'Free for personal and commercial use.',
    attributionRequired: false,
    author: 'Khushmeen Sidhu (design) · Mike Acler (React)',
    homepage: 'https://khushmeen.com/icons.html',
    repository: 'https://github.com/agilek/react-doodle-icons',
    npmPackage: 'react-doodle-icons',
    usageNotes: [
      'Names end with `Icon` (for example `HeartIcon`).',
      'Best for accents, onboarding, or decorative areas — not dense admin chrome.',
    ],
  },
  marketeq: {
    packId: 'marketeq',
    summary: 'Vibrant multicolor stroke icons for UI accents.',
    style: 'Pre-colored stroke icons with consistent padding.',
    approximateCount: '590',
    license: 'MIT',
    licenseSummary: 'Free for personal and commercial use without mandatory attribution.',
    attributionRequired: false,
    author: 'Marketeq',
    homepage: 'https://icon-sets.iconify.design/marketeq/',
    npmPackage: '@iconify-json/marketeq',
    usageNotes: [
      'Rendered via Iconify (`marketeq:<name>`); refs use kebab-case names (for example `acorn`).',
      'Built-in colors are preserved.',
    ],
  },
};

export function getNavigationIconPackInfo(packId: NavigationIconPackId): NavigationIconPackInfo {
  return NAVIGATION_ICON_PACK_INFO[packId];
}
