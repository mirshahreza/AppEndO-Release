import {
  navDescriptionKey,
  navGroupKey,
  navLabelKey,
} from '../../core/culture/cultureShellKeys';
import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import type { AdminShellNavGroup, AdminShellNavItem } from './types';

const silentLookup = { missing: 'silent' as const };

function translateOrFallback(t: TranslationFn, key: string, fallback: string): string {
  const translated = t(key, silentLookup);
  return translated !== key ? translated : fallback;
}

function translateNavItem(item: AdminShellNavItem, t: TranslationFn): AdminShellNavItem {
  if (item.type === 'separator') {
    return item;
  }

  const pageKey = item.pageKey;
  const labelKey = pageKey ? navLabelKey(pageKey) : null;
  const label = labelKey
    ? translateOrFallback(t, labelKey, item.label)
    : item.label;
  const descriptionKey = pageKey && item.description ? navDescriptionKey(pageKey) : null;
  const description = descriptionKey
    ? translateOrFallback(t, descriptionKey, item.description ?? '')
    : item.description;

  return {
    ...item,
    label,
    description,
    children: item.children?.map((child) => translateNavItem(child, t)),
  };
}

export function translateAdminShellNav(
  groups: AdminShellNavGroup[],
  t: TranslationFn,
): AdminShellNavGroup[] {
  return groups.map((group) => ({
    heading: group.heading
      ? translateOrFallback(t, navGroupKey(group.heading), group.heading)
      : null,
    items: group.items.map((item) => translateNavItem(item, t)),
  }));
}
