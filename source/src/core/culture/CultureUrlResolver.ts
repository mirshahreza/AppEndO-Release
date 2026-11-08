import { getDefaultCulturePackId, getEnabledCulturePackIds } from './CultureRegistry';

export type ResolvedCulturePath = {
  cultureId: string;
  remainderPath: string;
};

function normalizePathname(pathname: string): string {
  const trimmed = pathname.trim();
  if (!trimmed || trimmed === '/') {
    return '/';
  }

  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

function buildRemainderPath(segments: string[]): string {
  if (segments.length === 0) {
    return '/';
  }

  return `/${segments.join('/')}`;
}

export function resolveCultureFromPathname(pathname: string): ResolvedCulturePath {
  const normalized = normalizePathname(pathname);

  if (normalized === '/') {
    return {
      cultureId: getDefaultCulturePackId(),
      remainderPath: '/',
    };
  }

  const segments = normalized.split('/').filter(Boolean);
  const firstSegment = segments[0];
  const enabledCultureIds = new Set(getEnabledCulturePackIds());

  if (enabledCultureIds.has(firstSegment)) {
    return {
      cultureId: firstSegment,
      remainderPath: buildRemainderPath(segments.slice(1)),
    };
  }

  return {
    cultureId: getDefaultCulturePackId(),
    remainderPath: normalized,
  };
}
