import type { DesignerVersionSummary } from '../../../shared/api/queries/component-designer';
import {
  STUDIO_PORTAL_SEGMENT,
  SITE_PORTAL_SEGMENT,
  HOME_SHELL_KEY,
  BUILT_IN_STUDIO_SHELL_ENTRY,
  BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY,
  BUILT_IN_SITE_SHELL_ENTRY,
  LEGACY_CORE_SITE_SHELL_ENTRY,
  SITE_SHELL_LAYOUT_KEY,
} from '../../../shared/api/contracts/platform/mountConstants';
import type { ExperienceManifestPortal } from '../../../shared/api/contracts/platform/experienceManifest';
import {
  portalUsesRedirectEntry,
  isBuiltInStudioPortal,
  isBuiltInComponentAlonePortal,
  isBuiltInSitePortal,
  resolvePortalLayoutKey,
} from '../../../shared/api/contracts/platform/experienceManifest';
import { buildPortalRootPath } from '../../../app/platform/platformConfigHelpers';
import { buildDesignerComponentPath, parseDesignerComponentPath } from '../../../shared/lib/designerComponentPath';
import { CLIENT_COMPONENT_LIST_SEGMENT } from '../../component-designer/componentDesignerRoute';
import { normalizeDesignerComponentName, normalizeComponentFolder } from '../../../shared/lib/designerIdentity';
import { parseDesignerShellEntry, SHELL_DRAFT_FOLDER, isSystemManagedShellLayoutKey, isCoreShellEntry } from '../../../shared/lib/designerShellEntry';
import { isLayoutTemplateSummary } from '../../../domain/component-designer/layout-presets/builtInComponents';
import { CATALOG_TAG_SHELL, catalogSearchTags } from '../../../domain/component-designer/layout-presets/catalogSystemTags';
import { isBuiltInShellPresetId } from '../../../domain/component-designer/layout-presets/types';

export { SHELL_DRAFT_FOLDER };

export type LayoutPickerItem = {
  id: string;
  layoutKey: string;
  componentPath: string;
};

const CORE_LAYOUT_PICKER_ITEMS: readonly LayoutPickerItem[] = [
  {
    id: STUDIO_PORTAL_SEGMENT,
    layoutKey: STUDIO_PORTAL_SEGMENT,
    componentPath: BUILT_IN_STUDIO_SHELL_ENTRY,
  },
  {
    id: SITE_SHELL_LAYOUT_KEY,
    layoutKey: SITE_SHELL_LAYOUT_KEY,
    componentPath: SITE_SHELL_LAYOUT_KEY,
  },
];

const CORE_LAYOUT_PICKER_ORDER = new Map(
  CORE_LAYOUT_PICKER_ITEMS.map((item, index) => [item.layoutKey, index]),
);

export function formatPortalLayoutComponentPath(layoutKey: string): string {
  const normalizedLayoutKey = layoutKey.trim();
  if (!normalizedLayoutKey) {
    return '';
  }

  if (
    normalizedLayoutKey === SITE_PORTAL_SEGMENT
    || normalizedLayoutKey === HOME_SHELL_KEY
    || normalizedLayoutKey === SITE_SHELL_LAYOUT_KEY
    || normalizedLayoutKey === BUILT_IN_SITE_SHELL_ENTRY
    || normalizedLayoutKey === LEGACY_CORE_SITE_SHELL_ENTRY
  ) {
    return SITE_SHELL_LAYOUT_KEY;
  }

  if (
    normalizedLayoutKey === STUDIO_PORTAL_SEGMENT
    || normalizedLayoutKey === BUILT_IN_STUDIO_SHELL_ENTRY
  ) {
    return BUILT_IN_STUDIO_SHELL_ENTRY;
  }

  return normalizedLayoutKey;
}

/** Designer drafts that belong in the portal Layout picker (shell badge / shell name). */
export function isLayoutPickerShellDraft(
  draft: Pick<DesignerVersionSummary, 'isBuiltIn' | 'isPackageComponent' | 'folder' | 'name' | 'tags'>,
): boolean {
  if (isLayoutTemplateSummary(draft)) {
    return false;
  }

  const layoutKey = toLayoutPickerKey(draft.name);
  if (!layoutKey || isSystemManagedShellLayoutKey(layoutKey)) {
    return false;
  }

  const name = draft.name.trim().toLowerCase();
  if (name.includes('shell') || isBuiltInShellPresetId(draft.name)) {
    return true;
  }

  return catalogSearchTags(draft).some((tag) => tag.toLowerCase() === CATALOG_TAG_SHELL);
}

/** HeroUI select keys cannot contain `:`, so core layouts use their portal aliases. */
export function toLayoutPickerKey(layoutKey: string): string {
  const key = layoutKey.trim();
  if (!key) {
    return '';
  }
  if (
    key === HOME_SHELL_KEY
    || key === BUILT_IN_SITE_SHELL_ENTRY
    || key === LEGACY_CORE_SITE_SHELL_ENTRY
    || key === SITE_PORTAL_SEGMENT
    || key === SITE_SHELL_LAYOUT_KEY
  ) {
    return SITE_SHELL_LAYOUT_KEY;
  }
  if (key === BUILT_IN_STUDIO_SHELL_ENTRY) {
    return STUDIO_PORTAL_SEGMENT;
  }
  return key;
}

/** Designer layout key for portal-layouts/{key}, regardless of stored shellKey shape. */
export function resolvePortalLayoutDesignerKey(
  portal: Pick<ExperienceManifestPortal, 'segment' | 'shellKey'>,
): string {
  const raw = portal.shellKey?.trim() ?? '';

  const designerEntry = parseDesignerShellEntry(raw);
  if (designerEntry) {
    return designerEntry.shellKey;
  }

  const parsedPath = parseDesignerComponentPath(raw);
  if (parsedPath?.folder === SHELL_DRAFT_FOLDER && parsedPath.componentName) {
    return parsedPath.componentName;
  }

  return resolvePortalLayoutKey(portal.segment, portal.shellKey);
}

export function formatPortalLayoutDisplay(
  application: Pick<ExperienceManifestPortal, 'segment' | 'shellKey' | 'entryMode' | 'redirectToSegment' | 'redirectToCulture'>,
): string {
  if (portalUsesRedirectEntry(application)) {
    return '';
  }

  if (isBuiltInStudioPortal(application)) {
    return BUILT_IN_STUDIO_SHELL_ENTRY;
  }

  if (isBuiltInComponentAlonePortal(application)) {
    return BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY;
  }

  if (isBuiltInSitePortal(application)) {
    return SITE_SHELL_LAYOUT_KEY;
  }

  return formatPortalLayoutComponentPath(resolvePortalLayoutDesignerKey(application));
}

/** Core shells (`core:AdminLayout`, `core:ComponentAlone`, …) are not opened in Client Components. */
export function canOpenPortalLayoutInDesigner(
  application: Pick<ExperienceManifestPortal, 'segment' | 'shellKey' | 'entryMode' | 'redirectToSegment' | 'redirectToCulture'>,
): boolean {
  if (portalUsesRedirectEntry(application)) {
    return false;
  }

  const display = formatPortalLayoutDisplay(application);
  if (!display || isCoreShellEntry(display) || isCoreShellEntry(application.shellKey ?? '')) {
    return false;
  }

  return true;
}

export function buildLayoutPickerItems(
  drafts: readonly DesignerVersionSummary[],
  currentLayoutKey?: string,
): LayoutPickerItem[] {
  const items: LayoutPickerItem[] = CORE_LAYOUT_PICKER_ITEMS.map((item) => ({ ...item }));

  for (const draft of drafts) {
    if (!isLayoutPickerShellDraft(draft)) {
      continue;
    }
    const layoutKey = toLayoutPickerKey(draft.name);
    if (items.some((item) => item.layoutKey === layoutKey)) {
      continue;
    }
    items.push({
      id: draft.id,
      layoutKey,
      componentPath: draft.name.trim(),
    });
  }

  const current = toLayoutPickerKey(currentLayoutKey ?? '');
  if (current && !items.some((item) => item.layoutKey === current)) {
    items.push({
      id: `current-${current}`,
      layoutKey: current,
      componentPath: formatPortalLayoutComponentPath(current),
    });
  }

  return items.sort((left, right) => {
    const leftCore = CORE_LAYOUT_PICKER_ORDER.get(left.layoutKey);
    const rightCore = CORE_LAYOUT_PICKER_ORDER.get(right.layoutKey);
    if (leftCore != null && rightCore != null) {
      return leftCore - rightCore;
    }
    if (leftCore != null) {
      return -1;
    }
    if (rightCore != null) {
      return 1;
    }
    return left.layoutKey.localeCompare(right.layoutKey);
  });
}

export type NotFoundPagePickerItem = {
  id: string;
  componentPath: string;
  label: string;
};

/** Designer drafts eligible as a portal custom 404 page (any folder/name path). */
export function buildNotFoundPagePickerItems(
  drafts: readonly DesignerVersionSummary[],
): NotFoundPagePickerItem[] {
  return drafts
    .filter((draft) => draft.folder.trim() && draft.name.trim())
    .filter((draft) => !(
      draft.folder === SHELL_DRAFT_FOLDER && isSystemManagedShellLayoutKey(draft.name)
    ))
    .map((draft) => {
      const componentPath = buildDesignerComponentPath(draft.folder || 'general', draft.name);
      return {
        id: draft.id,
        componentPath,
        label: draft.name.trim(),
      };
    })
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function resolveLayoutDesignerDraftId(
  drafts: readonly DesignerVersionSummary[],
  layoutKey: string,
): string | null {
  const normalizedLayoutKey = normalizeDesignerComponentName(layoutKey.trim());
  if (!normalizedLayoutKey) {
    return null;
  }

  const normalizedFolder = normalizeComponentFolder(SHELL_DRAFT_FOLDER);

  const layoutFolderMatch = drafts.find(
    (draft) => normalizeComponentFolder(draft.folder || '') === normalizedFolder
      && normalizeDesignerComponentName(draft.name) === normalizedLayoutKey,
  );
  if (layoutFolderMatch) {
    return layoutFolderMatch.id;
  }

  const nameMatch = drafts.find(
    (draft) => normalizeDesignerComponentName(draft.name) === normalizedLayoutKey,
  );
  return nameMatch?.id ?? null;
}

export function buildPortalLayoutDesignerPath(
  portalBasePath: string,
  layoutKey: string,
  draftId?: string | null,
): string {
  const normalizedBase = portalBasePath.replace(/\/+$/, '');
  const basePath = `${normalizedBase}/${CLIENT_COMPONENT_LIST_SEGMENT}`;

  if (draftId?.trim()) {
    const params = new URLSearchParams();
    params.set('load', draftId.trim());
    return `${basePath}?${params.toString()}`;
  }

  if (layoutKey.trim()) {
    return `${basePath}/edit/${layoutKey.trim()}`;
  }

  return basePath;
}

export function buildCanonicalPortalLayoutDesignerPath(
  cultureId: string,
  layoutKey: string,
  draftId?: string | null,
): string {
  const normalizedCultureId = cultureId.trim() || 'us';
  const portalBase = buildPortalRootPath(
    `/${normalizedCultureId}`,
    STUDIO_PORTAL_SEGMENT,
  );
  return buildPortalLayoutDesignerPath(portalBase, layoutKey, draftId);
}

export function buildCanonicalPortalLayoutDesignerHref(
  cultureId: string,
  portal: Pick<ExperienceManifestPortal, 'segment' | 'shellKey'>,
  drafts?: readonly DesignerVersionSummary[],
): string {
  const layoutKey = resolvePortalLayoutDesignerKey(portal);
  const draftId = drafts ? resolveLayoutDesignerDraftId(drafts, layoutKey) : null;
  return buildCanonicalPortalLayoutDesignerPath(cultureId, layoutKey, draftId);
}
