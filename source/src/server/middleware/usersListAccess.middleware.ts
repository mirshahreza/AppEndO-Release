import type { NextFunction, Request, Response } from 'express';
import { hwyGeoResponsibilityCanAccessSection } from '../../domain/hwy/hwyGeoResponsibilityCatalog';
import { canAccessManagedFunction } from '../../shared/api/contracts/server-functions/accessControl';
import {
  hasAdminRole,
  normalizeAuthRoles,
  requireRole,
  tryAttachAuth,
} from './auth.middleware';
import { resolveHwyCoursesActivitiesApiAllowRoles } from './hwyCoursesActivitiesAccess.middleware';
import { builtinFunctionRegistry } from '../services/builtinFunctionRegistry.service';

const USERS_LIST_METHOD = 'GET';
const USERS_LIST_PATH = '/api/users';
const HWY_MEMBER_DIRECTORY_LIST_METHOD = 'GET';
const HWY_MEMBER_DIRECTORY_LIST_PATH = '/api/hwy/member-directory';

/**
 * Sub-routes (e.g. avatar-xs) inherit the same accessControl as GET /api/users
 * without registering a separate built-in function in the catalog.
 */
export const requireUsersListAccess = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.auth?.userId) {
      tryAttachAuth(req);
    }

    const principal = {
      isAdmin: hasAdminRole(req),
      isAuthenticated: Boolean(req.auth?.userId),
      userId: req.auth?.userId,
      email: req.auth?.email,
      roles: normalizeAuthRoles(req),
    };

    // Shell chrome loads the signed-in user's own avatar without Users-list capability.
    const requestedUserId = Number(req.params.id);
    if (
      principal.isAuthenticated
      && Number.isInteger(requestedUserId)
      && requestedUserId > 0
      && requestedUserId === Number(principal.userId)
    ) {
      next();
      return;
    }

    const roles = normalizeAuthRoles(req);
    if (hwyGeoResponsibilityCanAccessSection(roles)) {
      next();
      return;
    }

    await builtinFunctionRegistry.ensureLoaded();

    const memberDirectoryMatch = builtinFunctionRegistry.resolve(
      HWY_MEMBER_DIRECTORY_LIST_METHOD,
      HWY_MEMBER_DIRECTORY_LIST_PATH,
    );
    if (
      memberDirectoryMatch
      && canAccessManagedFunction(principal, memberDirectoryMatch.record.accessControl)
    ) {
      next();
      return;
    }

    const match = builtinFunctionRegistry.resolve(USERS_LIST_METHOD, USERS_LIST_PATH);

    if (match && canAccessManagedFunction(principal, match.record.accessControl)) {
      next();
      return;
    }

    if (!match) {
      requireRole('ADMIN')(req, res, next);
      return;
    }

    res.status(principal.isAuthenticated ? 403 : 401).json({
      success: false,
      error: principal.isAuthenticated
        ? 'Forbidden: insufficient permissions for this server function.'
        : 'Missing access token.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Users list access check failed.';
    res.status(500).json({ success: false, error: message });
  }
};

/**
 * Registration list thumbnails and member-directory face avatars (`/api/hwy/member-files/:id/content`).
 * Same read audience as list faces — not ADMIN-only dossier edits.
 */
export const requireHwyMemberListFaceAssetAccess = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    if (!req.auth?.userId) {
      tryAttachAuth(req);
    }

    const principal = {
      isAdmin: hasAdminRole(req),
      isAuthenticated: Boolean(req.auth?.userId),
      userId: req.auth?.userId,
      email: req.auth?.email,
      roles: normalizeAuthRoles(req),
    };

    if (!principal.isAuthenticated) {
      res.status(401).json({ success: false, error: 'Missing access token.' });
      return;
    }

    if (principal.isAdmin) {
      next();
      return;
    }

    const roles = normalizeAuthRoles(req);
    if (hwyGeoResponsibilityCanAccessSection(roles)) {
      next();
      return;
    }

    await builtinFunctionRegistry.ensureLoaded();

    const memberDirectoryMatch = builtinFunctionRegistry.resolve(
      HWY_MEMBER_DIRECTORY_LIST_METHOD,
      HWY_MEMBER_DIRECTORY_LIST_PATH,
    );
    if (
      memberDirectoryMatch
      && canAccessManagedFunction(principal, memberDirectoryMatch.record.accessControl)
    ) {
      next();
      return;
    }

    const usersListMatch = builtinFunctionRegistry.resolve(USERS_LIST_METHOD, USERS_LIST_PATH);
    if (usersListMatch && canAccessManagedFunction(principal, usersListMatch.record.accessControl)) {
      next();
      return;
    }

    const coursesRoles = await resolveHwyCoursesActivitiesApiAllowRoles();
    if (coursesRoles.some((role) => roles.includes(role))) {
      next();
      return;
    }

    res.status(403).json({
      success: false,
      error: 'Forbidden: insufficient permissions for this server function.',
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Member list face asset access check failed.';
    res.status(500).json({ success: false, error: message });
  }
};
