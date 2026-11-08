import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { createNodeCapabilityMiddleware } from '../nodeCapability.middleware';

const createResponse = () => {
  const res = {
    statusCode: 200,
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

describe('createNodeCapabilityMiddleware', () => {
  it('allows universal routes on any node', () => {
    const next = vi.fn();
    const middleware = createNodeCapabilityMiddleware(['worker']);
    const req = { originalUrl: '/api/health', method: 'GET' } as Request;
    const res = createResponse();

    middleware(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(res.statusCode).toBe(200);
  });

  it('blocks platform routes on worker-only nodes', () => {
    const next = vi.fn();
    const middleware = createNodeCapabilityMiddleware(['worker']);
    const req = { originalUrl: '/api/settings/general', method: 'GET' } as Request;
    const res = createResponse();

    middleware(req, res, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(503);
    expect(res.body).toMatchObject({
      success: false,
      requiredCapabilities: ['platform'],
      activeCapabilities: ['worker'],
    });
  });

  it('allows jobs on worker nodes', () => {
    const next = vi.fn();
    const middleware = createNodeCapabilityMiddleware(['worker']);
    const req = { originalUrl: '/api/jobs', method: 'GET' } as Request;
    const res = createResponse();

    middleware(req, res, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });
});
