import React, { useMemo } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { CultureProvider } from '../../core/culture/CultureContext';
import { resolveCultureFromPathname } from '../../core/culture/CultureUrlResolver';
import {
  isHwyPublicPortalPathname,
  resolveHwyPublicCultureFromPathname,
} from '../../domain/hwy/selfRegistration/hwySelfRegistrationRoutes';
import { useAppBootQuery } from '../../shared/api/queries/boot';

function resolvePublicCultureId(defaultCultureId: string, returnPath: string | null): string {
  const fallback = defaultCultureId.trim() || 'us';
  if (!returnPath?.trim()) {
    return fallback;
  }

  const normalizedReturn = returnPath.startsWith('/') ? returnPath : `/${returnPath}`;
  const { cultureId } = resolveCultureFromPathname(normalizedReturn);
  return cultureId || fallback;
}

export const PublicCultureScope: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { data } = useAppBootQuery();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const returnPath = searchParams.get('return');
  const cultureId = useMemo(() => {
    if (isHwyPublicPortalPathname(pathname)) {
      return resolveHwyPublicCultureFromPathname(pathname);
    }
    const fromPath = resolveCultureFromPathname(pathname).cultureId?.trim();
    if (fromPath) {
      return fromPath;
    }
    return resolvePublicCultureId(data?.cultures.defaultCultureId ?? 'us', returnPath);
  }, [data?.cultures.defaultCultureId, pathname, returnPath]);

  return (
    <CultureProvider cultureId={cultureId} translationBundleSource="embedded">
      {children}
    </CultureProvider>
  );
};
