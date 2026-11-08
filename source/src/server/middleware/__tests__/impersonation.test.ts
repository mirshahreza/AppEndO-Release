import type { Request } from 'express';
import { beforeEach, describe, expect, it } from 'vitest';
import { applyImpersonationForRequest, IMPERSONATE_GRANT_HEADER } from '../impersonation';
import {
  createImpersonationGrant,
  resetImpersonationGrantsForTests,
} from '../../services/dev-toolbar/impersonationGrantStore';

const makeReq = (overrides: Partial<Request> = {}): Request => ({
  headers: {},
  auth: {
    userId: 1,
    email: 'admin@example.com',
    role: 'ADMIN',
    roles: ['ADMIN'],
  },
  ...overrides,
} as unknown as Request);

describe('applyImpersonationForRequest', () => {
  beforeEach(() => {
    resetImpersonationGrantsForTests();
  });

  it('does nothing when no grant header is present', () => {
    const req = makeReq();
    applyImpersonationForRequest(req);
    expect(req.auth?.userId).toBe(1);
    expect(req.impersonatorId).toBeUndefined();
  });

  it('swaps req.auth to the target and records impersonatorId for a valid own grant', () => {
    const grant = createImpersonationGrant({
      impersonatorId: 1,
      impersonatorEmail: 'admin@example.com',
      targetUserId: 42,
      targetEmail: 'target@example.com',
      targetRoles: ['USER'],
    });

    const req = makeReq({ headers: { [IMPERSONATE_GRANT_HEADER]: grant.id } });
    applyImpersonationForRequest(req);

    expect(req.impersonatorId).toBe(1);
    expect(req.auth).toEqual({
      userId: 42,
      email: 'target@example.com',
      role: 'USER',
      roles: ['USER'],
    });
  });

  it('never applies a grant when the real caller is not ADMIN', () => {
    const grant = createImpersonationGrant({
      impersonatorId: 1,
      impersonatorEmail: 'admin@example.com',
      targetUserId: 42,
      targetEmail: 'target@example.com',
      targetRoles: ['ADMIN'],
    });

    const req = makeReq({
      headers: { [IMPERSONATE_GRANT_HEADER]: grant.id },
      auth: { userId: 1, email: 'not-admin@example.com', role: 'USER', roles: ['USER'] },
    });
    applyImpersonationForRequest(req);

    expect(req.impersonatorId).toBeUndefined();
    expect(req.auth?.userId).toBe(1);
    expect(req.auth?.role).toBe('USER');
  });

  it('never applies a grant belonging to a different admin', () => {
    const grant = createImpersonationGrant({
      impersonatorId: 999,
      impersonatorEmail: 'other-admin@example.com',
      targetUserId: 42,
      targetEmail: 'target@example.com',
      targetRoles: ['USER'],
    });

    const req = makeReq({ headers: { [IMPERSONATE_GRANT_HEADER]: grant.id } });
    applyImpersonationForRequest(req);

    expect(req.impersonatorId).toBeUndefined();
    expect(req.auth?.userId).toBe(1);
  });

  it('ignores an unknown/expired grant id and leaves the real actor in place', () => {
    const req = makeReq({ headers: { [IMPERSONATE_GRANT_HEADER]: 'not-a-real-grant' } });
    applyImpersonationForRequest(req);

    expect(req.impersonatorId).toBeUndefined();
    expect(req.auth?.userId).toBe(1);
  });

  it('falls back to the real role-only actor when the grant targets a role with no specific user', () => {
    const grant = createImpersonationGrant({
      impersonatorId: 1,
      impersonatorEmail: 'admin@example.com',
      targetRoles: ['EDITOR'],
    });

    const req = makeReq({ headers: { [IMPERSONATE_GRANT_HEADER]: grant.id } });
    applyImpersonationForRequest(req);

    expect(req.impersonatorId).toBe(1);
    expect(req.auth).toEqual({
      userId: 1,
      email: 'admin@example.com',
      role: 'EDITOR',
      roles: ['EDITOR'],
    });
  });
});
