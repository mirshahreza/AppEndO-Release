import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const runDataApiMock = vi.hoisted(() => vi.fn(async (
  _req: Request,
  res: Response,
) => {
  res.status(200).json({ success: true, data: [] });
}));

const registryMock = vi.hoisted(() => ({
  isReservedApiPath: vi.fn((pathname: string) => pathname.startsWith('/api/functions')),
  ensureLoaded: vi.fn(async () => undefined),
  resolve: vi.fn(),
}));

vi.mock('../../services/server-function.service', () => ({
  ServerFunctionService: class MockServerFunctionService {
    executeManagedFunction = vi.fn();
  },
}));

vi.mock('../../services/managedFunctionRouteRegistry', () => ({
  managedFunctionRouteRegistry: registryMock,
}));

vi.mock('../dataApiExecutor.middleware', () => ({
  isDataApiManagedFunction: (record: { engine_type?: string; engineType?: string }) => (
    record.engine_type === 'DATA_API' || record.engineType === 'DATA_API'
  ),
  createDataApiExecutorRunner: () => runDataApiMock,
}));

vi.mock('../../services/data-api/edgeDomainManagedFunction', () => ({
  isEdgeDomainActionManagedFunction: () => false,
  runEdgeDomainActionManagedFunction: vi.fn(),
}));

import { createManagedFunctionProxyMiddleware } from '../managedFunctionProxy.middleware';

const createResponse = () => {
  const res = {
    headersSent: false,
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      this.headersSent = true;
      return this;
    },
  };
  return res as Response & { statusCode: number; body: unknown; headersSent: boolean };
};

const dataApiMatch = (accessControl: Record<string, unknown>) => ({
  function: {
    id: 'orders.orders-list',
    engine_type: 'DATA_API' as const,
    code: '',
    path: '/api/orders',
    method: 'GET',
    access_control: accessControl,
    metadata_json: JSON.stringify({
      origin: 'data-api',
      edgeApiDefinitionId: 'ea_orders',
      edgeApiOperationId: 'op_list',
    }),
  },
  params: {},
});

describe('managedFunctionProxy Data API access parity (SEA-4.8)', () => {
  const next = vi.fn() as NextFunction;
  const middleware = createManagedFunctionProxyMiddleware(vi.fn(), {
    settingsPath: 'settings.json',
  });

  beforeEach(() => {
    vi.clearAllMocks();
    registryMock.isReservedApiPath.mockImplementation((pathname: string) => (
      pathname.startsWith('/api/functions')
    ));
  });

  it('returns 401 without token when accessMode is not public', async () => {
    registryMock.resolve.mockReturnValue(dataApiMatch({
      accessMode: 'authenticated',
      allowRoles: [],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    }));

    const req = {
      method: 'GET',
      originalUrl: '/api/orders',
      url: '/api/orders',
      body: {},
      params: {},
      query: {},
      headers: {},
    } as Request;
    const res = createResponse();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({
      success: false,
      error: 'Missing access token.',
    });
    expect(runDataApiMock).not.toHaveBeenCalled();
  });

  it('returns 403 when authenticated but role is insufficient for specific mode', async () => {
    registryMock.resolve.mockReturnValue(dataApiMatch({
      accessMode: 'specific',
      allowRoles: ['DEVELOPER'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    }));

    const req = {
      method: 'GET',
      originalUrl: '/api/orders',
      url: '/api/orders',
      body: {},
      params: {},
      query: {},
      headers: {},
      auth: { userId: 9, role: 'USER', roles: ['USER'] },
    } as Request;
    const res = createResponse();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({
      success: false,
      error: 'Forbidden: insufficient permissions for this server function.',
    });
    expect(runDataApiMock).not.toHaveBeenCalled();
  });

  it('allows admin bypass even when allowRoles exclude ADMIN', async () => {
    registryMock.resolve.mockReturnValue(dataApiMatch({
      accessMode: 'specific',
      allowRoles: ['DEVELOPER'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    }));

    const req = {
      method: 'GET',
      originalUrl: '/api/orders',
      url: '/api/orders',
      body: {},
      params: {},
      query: {},
      headers: {},
      auth: { userId: 1, role: 'ADMIN', roles: ['ADMIN'] },
    } as Request;
    const res = createResponse();

    await middleware(req, res, next);

    expect(runDataApiMock).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('deny role wins over allow role', async () => {
    registryMock.resolve.mockReturnValue(dataApiMatch({
      accessMode: 'specific',
      allowRoles: ['DEVELOPER'],
      allowUsers: [],
      denyRoles: ['DEVELOPER'],
      denyUsers: [],
    }));

    const req = {
      method: 'GET',
      originalUrl: '/api/orders',
      url: '/api/orders',
      body: {},
      params: {},
      query: {},
      headers: {},
      auth: { userId: 4, role: 'DEVELOPER', roles: ['DEVELOPER'] },
    } as Request;
    const res = createResponse();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(403);
    expect(runDataApiMock).not.toHaveBeenCalled();
  });
});
