import {
  BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY,
  BUILT_IN_SITE_SHELL_ENTRY,
  BUILT_IN_STUDIO_SHELL_ENTRY,
  COMPONENT_ALONE_PORTAL_SEGMENT,
  HOME_SHELL_KEY,
  LEGACY_CORE_SITE_SHELL_ENTRY,
  SITE_PORTAL_SEGMENT,
  SITE_SHELL_LAYOUT_KEY,
  STUDIO_PORTAL_SEGMENT,
} from '../api/contracts/platform/mountConstants';
import { buildDesignerComponentPath, parseDesignerComponentPath } from './designerComponentPath';

export const DESIGNER_SHELL_ENTRY_PREFIX = 'designer:';

/** Operator page drafts — the only catalog folder besides reserved app shells. */
export const DEFAULT_DRAFT_FOLDER = 'general';

/** Component Designer folder for portal layout drafts (Portals page layout picker). */
export const SHELL_DRAFT_FOLDER = 'portal-layouts';

/** Persist every draft under `general`. `portal-layouts` remains a virtual portal shell prefix only. */
export function resolveCanonicalDesignerDraftFolder(_folder?: unknown): string {
  return DEFAULT_DRAFT_FOLDER;
}

/** Default designer layout seeded in portal-layouts/ — mirrors core AdminLayout surfaces. */
export const DEFAULT_SHELL_LAYOUT_KEY = 'admin-layout';

/** Fallback shell drafts when a portal shell key has no matching portal-layouts draft. */
export const SHELL_DRAFT_FALLBACK_KEYS = [DEFAULT_SHELL_LAYOUT_KEY, 'app-shell'] as const;

export const COMPONENT_ALONE_SHELL_LAYOUT_KEY = COMPONENT_ALONE_PORTAL_SEGMENT;

export function isSystemManagedShellLayoutKey(shellKey: string): boolean {
  return shellKey.trim() === COMPONENT_ALONE_SHELL_LAYOUT_KEY;
}

export function isSystemManagedShellLayoutDraft(
  item: { name: string; folder?: string | null },
): boolean {
  return isSystemManagedShellLayoutKey(item.name);
}

function pickLatestShellDraft<T extends { name: string; updatedAt: string }>(
  shellDrafts: T[],
  shellKey: string,
): T | undefined {
  return shellDrafts
    .filter((draft) => draft.name.trim() === shellKey)
    .sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime())[0];
}

export function resolveShellDesignerDraftSummary<T extends { name: string; folder?: string | null; updatedAt: string }>(
  items: T[],
  shellKey: string,
): T | undefined {
  const normalizedShellKey = shellKey.trim();
  if (!normalizedShellKey) {
    return undefined;
  }

  const shellDrafts = items;
  const primary = pickLatestShellDraft(shellDrafts, normalizedShellKey);
  if (primary) {
    return primary;
  }

  for (const fallbackKey of SHELL_DRAFT_FALLBACK_KEYS) {
    if (fallbackKey === normalizedShellKey) {
      continue;
    }

    const fallback = pickLatestShellDraft(shellDrafts, fallbackKey);
    if (fallback) {
      return fallback;
    }
  }

  return shellDrafts.sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  )[0];
}

export function parseShellDesignerComponentPath(
  componentPath: string,
): { shellKey: string; componentPath: string } | null {
  const parsed = parseDesignerComponentPath(componentPath);
  if (!parsed || parsed.folder !== SHELL_DRAFT_FOLDER) {
    return null;
  }

  const shellKey = parsed.componentName.trim();
  if (!shellKey) {
    return null;
  }

  return {
    shellKey,
    componentPath: buildDesignerComponentPath(SHELL_DRAFT_FOLDER, shellKey),
  };
}

export function buildDesignerShellEntry(shellKey: string, publishedVersion?: number): string {
  const normalized = shellKey.trim();
  if (!normalized) {
    return `${DESIGNER_SHELL_ENTRY_PREFIX}${SHELL_DRAFT_FOLDER}/`;
  }

  const suffix = Number.isInteger(publishedVersion) && Number(publishedVersion) > 0
    ? `@v${publishedVersion}`
    : '';
  return `${DESIGNER_SHELL_ENTRY_PREFIX}${SHELL_DRAFT_FOLDER}/${normalized}${suffix}`;
}

export function parseDesignerShellEntry(entry: string): {
  shellKey: string;
  publishedVersion: number | null;
} | null {
  const trimmed = entry.trim();
  if (!trimmed.startsWith(DESIGNER_SHELL_ENTRY_PREFIX)) {
    return null;
  }

  const remainder = trimmed.slice(DESIGNER_SHELL_ENTRY_PREFIX.length).replace(/^\/+/, '');
  const match = remainder.match(new RegExp(`^${SHELL_DRAFT_FOLDER.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/(.+)$`));
  if (!match) {
    return null;
  }

  const value = match[1].trim();
  const pinned = value.match(/^(.*)@v([1-9]\d*)$/);
  const shellKey = (pinned?.[1] ?? value).trim();
  return shellKey
    ? { shellKey, publishedVersion: pinned ? Number(pinned[2]) : null }
    : null;
}

export function isDesignerShellEntry(entry: string): boolean {
  return parseDesignerShellEntry(entry) !== null;
}

const CORE_SHELL_ENTRY_PREFIX = 'core:';

export function isCoreShellEntry(entry: string): boolean {
  return entry.trim().startsWith(CORE_SHELL_ENTRY_PREFIX);
}

/** Persistable `shell.entry` from a portal layout picker value. */
export function resolveShellEntryForLayoutKey(layoutKey: string): string {
  const key = layoutKey.trim();
  if (!key) {
    return '';
  }
  if (key === LEGACY_CORE_SITE_SHELL_ENTRY
    || key === SITE_PORTAL_SEGMENT
    || key === HOME_SHELL_KEY
    || key === SITE_SHELL_LAYOUT_KEY
  ) {
    return BUILT_IN_SITE_SHELL_ENTRY;
  }
  if (isCoreShellEntry(key)) {
    return key;
  }
  if (key === STUDIO_PORTAL_SEGMENT) {
    return BUILT_IN_STUDIO_SHELL_ENTRY;
  }
  if (key === COMPONENT_ALONE_PORTAL_SEGMENT) {
    return BUILT_IN_COMPONENT_ALONE_SHELL_ENTRY;
  }
  return buildDesignerShellEntry(key);
}

/** Layout picker value from a stored `shell.entry`. */
export function resolveLayoutKeyFromShellEntry(entry: string, fallback: string): string {
  const trimmed = entry.trim();
  if (!trimmed) {
    return fallback;
  }
  if (
    trimmed === BUILT_IN_SITE_SHELL_ENTRY
    || trimmed === LEGACY_CORE_SITE_SHELL_ENTRY
  ) {
    return SITE_SHELL_LAYOUT_KEY;
  }
  if (isCoreShellEntry(trimmed)) {
    return trimmed;
  }
  const designer = parseDesignerShellEntry(trimmed);
  if (designer) {
    if (
      designer.shellKey === HOME_SHELL_KEY
      || designer.shellKey === SITE_PORTAL_SEGMENT
    ) {
      return SITE_SHELL_LAYOUT_KEY;
    }
    return designer.shellKey;
  }
  return fallback;
}
