import type { AdminShellNavGroup } from './types';

const KNOWN_GROUP_ICONS: Record<string, string> = {
  Development: 'tabler:IconBraces',
  Workshops: 'tabler:IconTools',
  Extensions: 'tabler:IconPuzzle',
  Operations: 'tabler:IconSettingsAutomation',
  Records: 'tabler:IconArchive',
  'Remote Hubs': 'tabler:IconNetwork',
};

const GROUP_DISPLAY_LABELS: Record<string, string> = {
  Development: 'Dev',
  Extensions: 'Ext',
  Operations: 'Ops',
};

/** Visible section label length on the collapsed sidebar rail. */
export const NAV_GROUP_COLLAPSED_LABEL_MAX_CHARS = 6;

export function resolveNavGroupDisplayLabel(heading: string): string {
  return GROUP_DISPLAY_LABELS[heading] ?? heading;
}

export function truncateCollapsedNavLabel(label: string): string {
  const graphemes = Array.from(label);
  if (graphemes.length <= NAV_GROUP_COLLAPSED_LABEL_MAX_CHARS) {
    return label;
  }
  return graphemes.slice(-NAV_GROUP_COLLAPSED_LABEL_MAX_CHARS).join('');
}

export function resolveCollapsedNavRailLabel(
  fullLabel: string,
  collapsedLabelOverride?: string | null,
): string {
  const source = collapsedLabelOverride?.trim() || fullLabel;
  return truncateCollapsedNavLabel(source);
}

export function resolveNavGroupCollapsedFullLabel(
  group: Pick<AdminShellNavGroup, 'heading' | 'items'>,
): string {
  if (group.heading) {
    return resolveNavGroupDisplayLabel(group.heading);
  }

  const firstItem = group.items.find((item) => item.type !== 'separator' && item.label);
  return firstItem?.label ?? 'Menu';
}

export function resolveNavGroupIcon(group: Pick<AdminShellNavGroup, 'heading' | 'icon' | 'items'>): string {
  if (group.icon) {
    return group.icon;
  }

  if (group.heading && KNOWN_GROUP_ICONS[group.heading]) {
    return KNOWN_GROUP_ICONS[group.heading];
  }

  const firstItemIcon = group.items.find(
    (item) => item.type !== 'separator' && Boolean(item.icon),
  )?.icon;

  return firstItemIcon ?? 'Layers';
}

export function resolveNavGroupCollapsedLabel(
  group: Pick<AdminShellNavGroup, 'heading' | 'items' | 'collapsedLabel'>,
): string {
  return resolveCollapsedNavRailLabel(
    resolveNavGroupCollapsedFullLabel(group),
    group.collapsedLabel,
  );
}
