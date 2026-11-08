import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const executeManagedFunctionMock = vi.hoisted(() => vi.fn(async (
  _req: Request,
  res: Response,
) => {
  res.status(200).json({ success: true, proxied: true });
}));

const registryMock = vi.hoisted(() => ({
  isReservedApiPath: vi.fn((pathname: string) => pathname.startsWith('/api/functions')),
  ensureLoaded: vi.fn(async () => undefined),
  resolve: vi.fn(),
}));

vi.mock('../../services/server-function.service', () => ({
  ServerFunctionService: class MockServerFunctionService {
    executeManagedFunction = executeManagedFunctionMock;
  },
}));

vi.mock('../../services/managedFunctionRouteRegistry', () => ({
  managedFunctionRouteRegistry: registryMock,
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

describe('managedFunctionProxy middleware', () => {
  const next = vi.fn() as NextFunction;
  const edgeDbQuery = vi.fn();
  const middleware = createManagedFunctionProxyMiddleware(edgeDbQuery);

  beforeEach(() => {
    vi.clearAllMocks();
    registryMock.isReservedApiPath.mockImplementation((pathname: string) => (
      pathname.startsWith('/api/functions')
    ));
  });

  it('skips reserved platform paths', async () => {
    const req = {
      method: 'GET',
      originalUrl: '/api/functions',
      url: '/api/functions',
      body: {},
      params: {},
      query: {},
      headers: {},
    } as Request;
    const res = createResponse();

    await middleware(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(registryMock.resolve).not.toHaveBeenCalled();
  });

  it('delegates unmatched paths to next handler', async () => {
    registryMock.resolve.mockReturnValue(null);

    const req = {
      method: 'GET',
      originalUrl: '/api/unknown/route',
      url: '/api/unknown/route',
      body: {},
      params: {},
      query: { q: '1' },
      headers: {},
      auth: { userId: 1, role: 'ADMIN', roles: ['ADMIN'] },
    } as Request;
    const res = createResponse();

    await middleware(req, res, next);

    expect(registryMock.ensureLoaded).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    expect(executeManagedFunctionMock).not.toHaveBeenCalled();
  });

  it('executes matched managed functions and merges route params into body', async () => {
    registryMock.resolve.mockReturnValue({
      function: {
        id: 'demo.item',
        engine_type: 'SANDBOX_JS',
        metadata_json: null,
        code: 'res.json({ ok: true });',
        path: '/api/demo/products/:id',
        method: 'GET',
      },
      params: { id: '42' },
    });

    const req = {
      method: 'GET',
      originalUrl: '/api/demo/products/42?limit=5',
      url: '/api/demo/products/42?limit=5',
      body: { body: { ignored: true } },
      params: {},
      query: { limit: '5' },
      headers: {},
      auth: { userId: 7, role: 'ADMIN', roles: ['ADMIN'] },
    } as Request;
    const res = createResponse();

    await middleware(req, res, next);

    expect(executeManagedFunctionMock).toHaveBeenCalledOnce();
    expect(next).not.toHaveBeenCalled();
    expect(res.body).toEqual({ success: true, proxied: true });

    const [requestArg, , , , overrides] = executeManagedFunctionMock.mock.calls[0] as [
      Request,
      Response,
      unknown,
      unknown,
      Record<string, unknown>,
    ];

    expect((requestArg.body as Record<string, unknown>).params).toEqual({ id: '42' });
    expect(overrides.functionId).toBe('demo.item');
    expect(overrides.actorUserId).toBe(7);
    expect(overrides.edgeCache).toMatchObject({
      requestMethod: 'GET',
      requestParams: { id: '42' },
      requestQuery: { limit: '5' },
    });
  });

  it('returns HttpError status payloads without calling next', async () => {
    const { HttpError } = await import('../../errors/HttpError');
    executeManagedFunctionMock.mockRejectedValueOnce(new HttpError(400, 'Function argument validation failed.'));

    registryMock.resolve.mockReturnValue({
      function: { id: 'demo.fn', code: '//', path: '/api/demo/fn', method: 'GET' },
      params: {},
    });

    const req = {
      method: 'GET',
      originalUrl: '/api/demo/fn',
      url: '/api/demo/fn',
      body: {},
      params: {},
      query: {},
      headers: {},
      auth: { userId: 7, role: 'ADMIN', roles: ['ADMIN'] },
    } as Request;
    const res = createResponse();

    await middleware(req, res, next);

    expect(res.statusCode).toBe(400);
    expect(res.body).toMatchObject({
      success: false,
      error: 'Function argument validation failed.',
    });
    expect(next).not.toHaveBeenCalled();
  });
});
