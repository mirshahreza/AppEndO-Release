import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { mountInstallPendingBootStubs } from '../installPendingBootStubs';

const createResponse = () => {
  const headers: Record<string, string> = {};
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    headers,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      headers[name] = value;
      return this;
    },
    json(payload: unknown) {
      this.body = payload;
      return this;
    },
  };
  return res as typeof res & Response;
};

const invokeStub = (originalUrl: string, isPromoted = false) => {
  let middleware: ((req: Request, res: Response, next: NextFunction) => void) | undefined;
  const app = {
    use(handler: typeof middleware) {
      middleware = handler;
    },
  };
  mountInstallPendingBootStubs(app as never, () => isPromoted);
  const req = { method: 'GET', originalUrl } as Request;
  const res = createResponse();
  const next = vi.fn();
  middleware?.(req, res, next);
  return { res, next };
};

describe('mountInstallPendingBootStubs', () => {
  it('returns disabled EUA status instead of falling through to the install 503', () => {
    const { res, next } = invokeStub('/api/eua/status');

    expect(next).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({
      success: true,
      aiEnabled: false,
    });
  });

  it('serves the default PWA manifest so the install wizard does not 404', () => {
    const { res, next } = invokeStub('/manifest.webmanifest');

    expect(next).not.toHaveBeenCalled();
    expect(res.headers['Content-Type']).toBe('application/manifest+json; charset=utf-8');
    expect(res.body).toMatchObject({
      name: 'AppEndO',
      short_name: 'AppEndO',
      start_url: '/',
    });
  });

  it('does not intercept after the install server is promoted', () => {
    const { next } = invokeStub('/api/eua/status', true);

    expect(next).toHaveBeenCalledOnce();
  });
});
