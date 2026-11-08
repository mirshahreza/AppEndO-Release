/** True for HTTP API routes (`/api/...`), not Vite sources like `/src/shared/api/client.ts`. */
export const isHttpApiPathname = (pathname: string): boolean => (
  pathname === '/api' || pathname.startsWith('/api/')
);

export const isHttpApiRequestPath = (pathOrUrl: string): boolean => {
  const withoutQuery = pathOrUrl.split('?')[0] ?? pathOrUrl;
  if (withoutQuery.startsWith('/')) {
    return isHttpApiPathname(withoutQuery);
  }
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://local';
    const parsed = new URL(pathOrUrl, origin);
    return isHttpApiPathname(parsed.pathname);
  } catch {
    return false;
  }
};

export const apiPathFromResourceUrl = (url: string): string | null => {
  try {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://local';
    const parsed = new URL(url, origin);
    if (!isHttpApiPathname(parsed.pathname)) {
      return null;
    }
    return `${parsed.pathname}${parsed.search}`;
  } catch {
    return null;
  }
};
