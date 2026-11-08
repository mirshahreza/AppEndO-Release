export type SiteNavItem = {
  id: string;
  label: string;
  hash?: string;
  path?: string;
};

const KNOWN_NAV_LABELS: Record<string, string> = {
  about: 'About',
  contact: 'Contact',
  guide: 'Guide',
};

const PORTAL_PREFIXES = new Set(['site', 'home']);

/** Public CMS URLs live on the Home portal (`/us/...`), not `/us/site/...`. */
export function buildSiteHref(
  cultureId: string,
  item: Pick<SiteNavItem, 'hash' | 'path'>,
): string {
  const root = `/${cultureId || 'us'}`.replace(/\/{2,}/g, '/') || '/';
  if (item.hash) {
    return `${root}#${item.hash}`;
  }
  const path = item.path?.trim().replace(/^\/+|\/+$/g, '') ?? '';
  if (path) {
    return `${root}/${path}`.replace(/\/{2,}/g, '/');
  }
  return root;
}

export function siteNavLabel(slug: string, title: string): string {
  if (!slug.trim()) {
    return 'Home';
  }
  return KNOWN_NAV_LABELS[slug] || title;
}

/** Public page slug from a culture URL (`/us/about` → `about`). */
export function readSiteSlugFromPathname(pathname: string, cultureId: string): string {
  const parts = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  if (cultureId && parts[0] === cultureId) {
    parts.shift();
  }
  if (parts[0] && PORTAL_PREFIXES.has(parts[0])) {
    parts.shift();
  }
  if (parts[0] === 'stories') {
    parts.shift();
  }
  return parts.join('/');
}
