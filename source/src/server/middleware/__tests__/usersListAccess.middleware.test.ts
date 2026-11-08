import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveMock, ensureLoadedMock, coursesRolesMock } = vi.hoisted(() => ({
  resolveMock: vi.fn(),
  ensureLoadedMock: vi.fn(async () => undefined),
  coursesRolesMock: vi.fn(async () => ['HWY_COURSES']),
}));

vi.mock('../../services/builtinFunctionRegistry.service', () => ({
  builtinFunctionRegistry: {
    ensureLoaded: ensureLoadedMock,
    resolve: (...args: unknown[]) => resolveMock(...args),
  },
}));

vi.mock('../hwyCoursesActivitiesAccess.middleware', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../hwyCoursesActivitiesAccess.middleware')>();
  return {
    ...actual,
    resolveHwyCoursesActivitiesApiAllowRoles: coursesRolesMock,
  };
});

import { legacyHwyRoleIdToPlatformRoleName } from '../../../domain/hwy/hwyMemberListLegacyAccess';
import {
  requireHwyMemberListFaceAssetAccess,
  requireUsersListAccess,
} from '../usersListAccess.middleware';

const createResponse = () => {
  const res = {
    statusCode: 200,
    headersSent: false,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  } as unknown as Response;
  return res;
};

describe('requireUsersListAccess', () => {
  beforeEach(() => {
    resolveMock.mockReset();
    ensureLoadedMock.mockClear();
  });

  it('allows avatar access when GET /api/users accessControl permits the caller', async () => {
    resolveMock.mockImplementation((method: string, path: string) => {
      if (path === '/api/hwy/member-directory') {
        return null;
      }
      if (path === '/api/users') {
        return {
          record: {
            accessControl: {
              accessMode: 'specific',
              allowRoles: ['DEVELOPER'],
              allowUsers: [],
              denyRoles: [],
              denyUsers: [],
            },
          },
        };
      }
      return null;
    });

    const req = {
      method: 'GET',
      originalUrl: '/api/users/7/avatar-xs',
      params: { id: '7' },
      auth: { userId: 1, email: 'dev@append.os', role: 'DEVELOPER', roles: ['DEVELOPER'] },
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await requireUsersListAccess(req, res, next);

    expect(resolveMock).toHaveBeenCalledWith('GET', '/api/hwy/member-directory');
    expect(resolveMock).toHaveBeenCalledWith('GET', '/api/users');
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('denies avatar access when list-users ACL blocks the caller', async () => {
    resolveMock.mockImplementation((method: string, path: string) => {
      if (path === '/api/hwy/member-directory' || path === '/api/users') {
        return {
          record: {
            accessControl: {
              accessMode: 'specific',
              allowRoles: ['DEVELOPER'],
              allowUsers: [],
              denyRoles: [],
              denyUsers: [],
            },
          },
        };
      }
      return null;
    });

    const req = {
      method: 'GET',
      originalUrl: '/api/users/7/avatar-xs',
      params: { id: '7' },
      auth: { userId: 2, email: 'user@append.os', role: 'USER', roles: ['USER'] },
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await requireUsersListAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });

  it('allows avatar access for geo-responsibility gate roles without Users-list capability', async () => {
    const geoRole = legacyHwyRoleIdToPlatformRoleName(1000003);
    const req = {
      method: 'GET',
      originalUrl: '/api/users/7/avatar-xs',
      params: { id: '7' },
      auth: { userId: 99, email: 'geo@append.os', role: geoRole, roles: [geoRole] },
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await requireUsersListAccess(req, res, next);

    expect(resolveMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('allows a caller to load their own avatar without Users-list capability', async () => {
    resolveMock.mockReturnValue({
      record: {
        accessControl: {
          accessMode: 'specific',
          allowRoles: ['DEVELOPER'],
          allowUsers: [],
          denyRoles: [],
          denyUsers: [],
        },
      },
    });

    const req = {
      method: 'GET',
      originalUrl: '/api/users/2/avatar-xs',
      params: { id: '2' },
      auth: { userId: 2, email: 'user@append.os', role: 'USER', roles: ['USER'] },
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await requireUsersListAccess(req, res, next);

    expect(resolveMock).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });
});

describe('requireHwyMemberListFaceAssetAccess', () => {
  beforeEach(() => {
    resolveMock.mockReset();
    ensureLoadedMock.mockClear();
    coursesRolesMock.mockClear();
  });

  it('allows courses/activities roles to load registration thumbnails', async () => {
    resolveMock.mockReturnValue(null);
    coursesRolesMock.mockResolvedValue(['HWY_COURSES']);

    const req = {
      method: 'GET',
      originalUrl: '/api/hwy/member-files/42/content',
      params: { fileId: '42' },
      auth: { userId: 3, email: 'courses@append.os', role: 'HWY_COURSES', roles: ['HWY_COURSES'] },
    } as unknown as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await requireHwyMemberListFaceAssetAccess(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });
});
