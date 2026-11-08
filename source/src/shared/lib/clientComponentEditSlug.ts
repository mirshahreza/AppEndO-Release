/** Slugs must match Client Components edit URLs (`client-components/edit/{name}`). */
export function isClientComponentEditSlug(slug: string): boolean {
  const trimmed = slug.trim();
  if (!trimmed || trimmed.includes(':') || trimmed.includes('/')) {
    return false;
  }
  return /^[\w-]+$/.test(trimmed);
}

const PACKAGE_PAGE_KEY_PREFIX = 'hwy-';

/**
 * Package page keys often split view/edit routes (`hwy-member-dossier-view`).
 * Client Components use the product slug without the package prefix (`member-dossier`).
 */
export function resolvePackagePageKeyToEditSlug(pageKey: string): string {
  const trimmed = pageKey.trim();
  if (!trimmed) {
    return '';
  }
  const viewEditSuffix = /-(?:view|edit)$/;
  let slug = viewEditSuffix.test(trimmed)
    ? (trimmed.replace(viewEditSuffix, '') || trimmed)
    : trimmed;
  if (slug.startsWith(PACKAGE_PAGE_KEY_PREFIX)) {
    slug = slug.slice(PACKAGE_PAGE_KEY_PREFIX.length);
  }
  return slug.length > 0 ? slug : trimmed;
}
