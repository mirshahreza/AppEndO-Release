import { isHwyPublicPortalPathname } from '../../domain/hwy/selfRegistration/hwySelfRegistrationRoutes';

const PUBLIC_APP_PATHS = new Set([
  '/install',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]);

/** Routes that should render immediately without waiting for /api/boot. */
export const isPublicAppPath = (pathname: string): boolean => (
  PUBLIC_APP_PATHS.has(pathname) || isHwyPublicPortalPathname(pathname)
);
