import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { resolveMock, ensureLoadedMock } = vi.hoisted(() => ({
  resolveMock: vi.fn(),
  ensureLoadedMock: vi.fn(async () => undefined),
}));

vi.mock('../../services/builtinFunctionRegistry.service', () => ({
  builtinFunctionRegistry: {
    ensureLoaded: ensureLoadedMock,
    resolve: (...args: unknown[]) => resolveMock(...args),
  },
}));

import { createBuiltInRouteGuard } from '../builtInFunctionAccess.middleware';

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
    send(payload: unknown) {
      this.body = payload;
      return this;
    },
    on: vi.fn(),
  } as unknown as Response;
  return res;
};

describe('createBuiltInRouteGuard', () => {
  beforeEach(() => {
    resolveMock.mockReset();
    ensureLoadedMock.mockClear();
  });

  it('allows catalogued routes when accessControl permits the caller', async () => {
    resolveMock.mockReturnValue({
      record: {
        method: 'GET',
        path: '/api/users',
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
      originalUrl: '/api/users',
      auth: { userId: 1, email: 'dev@append.os', role: 'DEVELOPER', roles: ['DEVELOPER'] },
    } as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await createBuiltInRouteGuard('ADMIN')(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('falls back to admin-only guard for routes outside the catalog', async () => {
    resolveMock.mockReturnValue(null);

    const req = {
      method: 'POST',
      originalUrl: '/api/users/1/change-password',
      auth: { userId: 1, email: 'user@append.os', role: 'USER', roles: ['USER'] },
    } as Request;
    const res = createResponse();
    const next = vi.fn() as NextFunction;

    await createBuiltInRouteGuard('ADMIN')(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(403);
  });
});
