import { buildDesignerComponentPath, resolveExperienceManifestPageKey } from '../../../shared/lib/designerComponentPath';

export function buildPackageUiEntryPath(componentKey: string): string {
  const normalized = componentKey.trim().replace(/^\/+/, '');
  return `ui/${normalized}.tsx`;
}

export function buildPackageUiEntryPathFromParts(folder: string, componentName: string): string {
  return buildPackageUiEntryPath(buildDesignerComponentPath(folder, componentName));
}

export function buildPackageDesignerPageDraftEntry(componentKey: string): string {
  const normalized = componentKey.trim().replace(/^\/+/, '');
  return `designer/pages/${normalized}.json`;
}

const UI_ROUTE_PAGE_KEY_RE = /^[a-z][a-z0-9._-]{2,63}$/;

export function buildPackageUiRoutePageKey(componentKey: string): string | null {
  const slug = resolveExperienceManifestPageKey(componentKey)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63);
  if (!UI_ROUTE_PAGE_KEY_RE.test(slug)) {
    return null;
  }
  return slug;
}
