import type { DesignerVersionSummary } from '../api/queries/component-designer';
import { normalizeComponentFolder, normalizeDesignerComponentName } from './designerIdentity';

const DEFAULT_DRAFT_FOLDER = 'general';

export function buildDesignerComponentPath(folder: string, componentName: string): string {
  const normalizedFolder = normalizeComponentFolder(folder || DEFAULT_DRAFT_FOLDER);
  const normalizedName = normalizeDesignerComponentName(componentName);
  return `${normalizedFolder}/${normalizedName}`;
}

/**
 * Experience-manifest / platform `pageKey` for a designer identity.
 * Folder-qualified paths (`general/my-page`) collapse to the component name slug.
 */
export function resolveExperienceManifestPageKey(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return parseDesignerComponentPath(trimmed)?.componentName ?? trimmed;
}

/**
 * Designer page-module `loaderRef` for a folder-qualified component path.
 * Returns null when `value` is not a folder/name path (e.g. built-in `dashboard`).
 */
export function resolveDesignerComponentLoaderRef(value: string): string | null {
  const parsed = parseDesignerComponentPath(value.trim());
  if (!parsed) {
    return null;
  }

  return buildDesignerComponentPath(parsed.folder, parsed.componentName);
}

/** Operator edit slug: `name` only. Folder-qualified paths collapse to the component name. */
export function canonicalizeDesignerItemSlug(value: string): string {
  const trimmed = value.trim().replace(/^\/+|\/+$/g, '');
  if (!trimmed) {
    return '';
  }

  const parsed = parseDesignerComponentPath(trimmed);
  const name = parsed?.componentName ?? trimmed;
  return normalizeDesignerComponentName(name);
}

export function parseDesignerComponentPath(value: string): { folder: string; componentName: string } | null {
  const trimmed = value.trim().replace(/^\/+/, '');
  const slashIndex = trimmed.indexOf('/');
  if (slashIndex <= 0) {
    return null;
  }

  const folder = trimmed.slice(0, slashIndex).trim();
  const componentName = trimmed.slice(slashIndex + 1).trim();
  if (!folder || !componentName) {
    return null;
  }

  return { folder, componentName };
}

export function resolveDesignerDraftIdFromComponentPath(
  drafts: readonly DesignerVersionSummary[],
  componentPath: string,
): string | null {
  const parsed = parseDesignerComponentPath(componentPath);
  if (!parsed) {
    return resolveDesignerDraftIdFromItemSlug(drafts, componentPath);
  }

  const normalizedFolder = normalizeComponentFolder(parsed.folder);
  const normalizedName = normalizeDesignerComponentName(parsed.componentName);

  const match = drafts.find(
    (draft) => normalizeComponentFolder(draft.folder || DEFAULT_DRAFT_FOLDER) === normalizedFolder
      && normalizeDesignerComponentName(draft.name) === normalizedName,
  );
  if (match) {
    return match.id;
  }

  return resolveDesignerDraftIdFromItemSlug(drafts, parsed.componentName);
}

export function resolveDesignerDraftIdFromItemSlug(
  drafts: readonly DesignerVersionSummary[],
  slug: string,
): string | null {
  const normalizedName = canonicalizeDesignerItemSlug(slug);
  if (!normalizedName) {
    return null;
  }

  const match = drafts.find(
    (draft) => normalizeDesignerComponentName(draft.name) === normalizedName,
  );
  return match?.id ?? null;
}

/** Studio mount prefix from a portal pathname (`/us/studio/...` → `/us/studio`). */
export function resolveStudioMountPathPrefix(pathname: string): string {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const match = normalized.match(/^(\/[^/]+\/studio|\/studio)(?=\/|$)/);
  return match?.[1] ?? '/studio';
}
