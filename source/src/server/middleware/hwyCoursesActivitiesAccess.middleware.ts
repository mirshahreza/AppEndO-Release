import type { NextFunction, Request, Response } from 'express';

import { hwyGeoResponsibilityAllGateRoleNames } from '../../domain/hwy/hwyGeoResponsibilityCatalog';
import { findPlatformRouteBindingById } from '../domain/platform/routeBindingRepository';
import { normalizeAuthRoles } from './auth.middleware';

/** Hawiety courses & activities SPA route binding (install-hwy-courses-activities-portal). */
export const HWY_COURSES_ACTIVITIES_ROUTE_BINDING_ID = 126;

const ALLOW_ROLES_CACHE_MS = 30_000;
let allowRolesCache: { roles: string[]; loadedAt: number } | null = null;

const normalizeRoleList = (roles: string[]): string[] => {
  const merged = new Set<string>(['ADMIN']);
  for (const role of roles) {
    const trimmed = role.trim();
    if (trimmed) {
      merged.add(trimmed.toUpperCase());
    }
  }
  return [...merged];
};

export async function resolveHwyCoursesActivitiesApiAllowRoles(): Promise<string[]> {
  const now = Date.now();
  if (allowRolesCache && now - allowRolesCache.loadedAt < ALLOW_ROLES_CACHE_MS) {
    return allowRolesCache.roles;
  }
  try {
    const binding = await findPlatformRouteBindingById(HWY_COURSES_ACTIVITIES_ROUTE_BINDING_ID);
    const fromBinding = binding?.auth?.allowRoles ?? [];
    const roles = normalizeRoleList(fromBinding);
    allowRolesCache = { roles, loadedAt: now };
    return roles;
  } catch {
    return ['ADMIN'];
  }
}

export const requireHwyCoursesActivitiesAccess = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  void (async () => {
    try {
      const authRoles = normalizeAuthRoles(req);
      if (authRoles.length === 0) {
        res.status(401).json({ success: false, error: 'Unauthorized.' });
        return;
      }
      const allowed = await resolveHwyCoursesActivitiesApiAllowRoles();
      if (!allowed.some((role) => authRoles.includes(role))) {
        res.status(403).json({ success: false, error: 'Forbidden.' });
        return;
      }
      next();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Access check failed.';
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: message });
      }
    }
  })();
};

const geoResponsibilityGateRoles = (): string[] => [
  'ADMIN',
  ...hwyGeoResponsibilityAllGateRoleNames(),
];

/** Member rashh picker: geo-responsibility operators or courses/activities admins. */
export const requireHwyMemberRashhPickerAccess = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  void (async () => {
    try {
      const authRoles = normalizeAuthRoles(req);
      if (authRoles.length === 0) {
        res.status(401).json({ success: false, error: 'Unauthorized.' });
        return;
      }
      if (geoResponsibilityGateRoles().some((role) => authRoles.includes(role))) {
        next();
        return;
      }
      const allowed = await resolveHwyCoursesActivitiesApiAllowRoles();
      if (allowed.some((role) => authRoles.includes(role))) {
        next();
        return;
      }
      res.status(403).json({ success: false, error: 'Forbidden.' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Access check failed.';
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: message });
      }
    }
  })();
};
