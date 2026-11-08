import type { NavigationManifest, NavigationManifestItem } from '../../api/contracts/platform/navigation';

const EXCLUDED_GROUP_HEADINGS = new Set(['Development', 'Extensions']);

const collectPageKeys = (items: NavigationManifestItem[], out: Set<string>): void => {
  for (const item of items) {
    if (item.type === 'separator') {
      continue;
    }
    const pageKey = item.pageKey?.trim();
    if (pageKey) {
      out.add(pageKey);
    }
    if (item.children?.length) {
      collectPageKeys(item.children, out);
    }
  }
};

/** Page keys under Development / Extensions navigation groups (Studio manifest). */
export function collectExcludedAccessAssistantPageKeys(
  manifest: NavigationManifest,
): Set<string> {
  const excluded = new Set<string>();

  for (const group of manifest.groups) {
    const heading = group.heading?.trim() ?? null;
    if (!heading || !EXCLUDED_GROUP_HEADINGS.has(heading)) {
      continue;
    }
    collectPageKeys(group.items, excluded);
  }

  return excluded;
}
