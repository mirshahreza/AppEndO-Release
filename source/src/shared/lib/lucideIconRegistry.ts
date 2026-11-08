import { Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { loadNavigationIconPack } from './navigationIcons/navigationIconPacks';
import { parseNavigationIconRef } from './navigationIcons/navigationIconRef';

export const DEFAULT_LUCIDE_ICON = Settings;

export function toLucidePascalCase(name: string): string {
  return name
    .split('-')
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
}

export async function getLucideIconMap(): Promise<Record<string, LucideIcon>> {
  const pack = await loadNavigationIconPack('lucide');
  return pack.map as Record<string, LucideIcon>;
}

export async function resolveLucideIcon(
  iconName?: string | null,
  fallback: LucideIcon = DEFAULT_LUCIDE_ICON,
): Promise<LucideIcon> {
  const parsed = parseNavigationIconRef(iconName);
  if (!parsed || parsed.packId !== 'lucide') {
    return fallback;
  }

  const map = await getLucideIconMap();
  return map[parsed.iconName]
    ?? map[toLucidePascalCase(parsed.iconName)]
    ?? fallback;
}
