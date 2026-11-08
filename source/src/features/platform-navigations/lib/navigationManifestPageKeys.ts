import { resolveDesignerDraftIdFromComponentPath } from '../../../shared/lib/designerComponentPath';
import type {
  NavigationManifest,
  NavigationManifestItem,
} from '../../../shared/api/contracts/platform/navigation';
import type { DesignerVersionSummary } from '../../../shared/api/queries/component-designer';
import { resolveDesignerDraftPageKey } from '../hooks/useNavigationEditorOptions';

export function resolvePublicNavigationPageKey(
  pageKey: string | undefined,
  drafts: readonly DesignerVersionSummary[],
): string | undefined {
  const key = pageKey?.trim();
  if (!key) {
    return pageKey;
  }

  if (resolveDesignerDraftIdFromComponentPath(drafts, key)) {
    return key;
  }

  const draft = drafts.find((entry) => entry.id === key);
  if (draft) {
    return resolveDesignerDraftPageKey(draft);
  }

  return key;
}

function normalizeNavigationManifestItem(
  item: NavigationManifestItem,
  drafts: readonly DesignerVersionSummary[],
): NavigationManifestItem {
  return {
    ...item,
    pageKey: item.pageKey ? resolvePublicNavigationPageKey(item.pageKey, drafts) : item.pageKey,
    children: item.children?.map((child) => normalizeNavigationManifestItem(child, drafts)),
  };
}

export function normalizeNavigationManifestPageKeys(
  manifest: NavigationManifest,
  drafts: readonly DesignerVersionSummary[],
): NavigationManifest {
  if (drafts.length === 0) {
    return manifest;
  }

  return {
    ...manifest,
    groups: manifest.groups.map((group) => ({
      ...group,
      items: group.items.map((item) => normalizeNavigationManifestItem(item, drafts)),
    })),
  };
}
