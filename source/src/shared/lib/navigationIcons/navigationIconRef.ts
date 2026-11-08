import type { NavigationIconPackId } from './types';

export const NAVIGATION_ICON_PACK_IDS = [
  'lucide',
  'tabler',
  'phosphor',
  'heroicons',
  'solar',
  'doodle',
  'marketeq',
] as const;

export type ParsedNavigationIconRef = {
  packId: NavigationIconPackId;
  iconName: string;
};

export function isNavigationIconPackId(value: string): value is NavigationIconPackId {
  return (NAVIGATION_ICON_PACK_IDS as readonly string[]).includes(value);
}

export function parseNavigationIconRef(value?: string | null): ParsedNavigationIconRef | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  const colonIndex = trimmed.indexOf(':');
  if (colonIndex > 0) {
    const packId = trimmed.slice(0, colonIndex);
    const iconName = trimmed.slice(colonIndex + 1).trim();
    if (isNavigationIconPackId(packId) && iconName) {
      return { packId, iconName };
    }
  }

  return { packId: 'lucide', iconName: trimmed };
}

export function formatNavigationIconRef(
  packId: NavigationIconPackId,
  iconName: string,
): string {
  return `${packId}:${iconName}`;
}

/** True when value is `pack:iconName` from the icon picker, not arbitrary adornment text. */
export function isExplicitNavigationIconRef(value?: string | null): boolean {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }

  const colonIndex = trimmed.indexOf(':');
  if (colonIndex <= 0) {
    return false;
  }

  const packId = trimmed.slice(0, colonIndex);
  const iconName = trimmed.slice(colonIndex + 1).trim();
  return isNavigationIconPackId(packId) && iconName.length > 0;
}

export function formatNavigationIconRefLabel(value?: string | null): string {
  const parsed = parseNavigationIconRef(value);
  if (!parsed) {
    return 'lucide:Settings';
  }

  return formatNavigationIconRef(parsed.packId, parsed.iconName);
}
