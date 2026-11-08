import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createImpersonationGrant,
  endImpersonationGrant,
  getActiveImpersonationGrant,
  resetImpersonationGrantsForTests,
} from '../impersonationGrantStore';

describe('impersonationGrantStore', () => {
  beforeEach(() => {
    resetImpersonationGrantsForTests();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a grant retrievable only by its issuing admin', () => {
    const grant = createImpersonationGrant({
      impersonatorId: 1,
      impersonatorEmail: 'admin@example.com',
      targetUserId: 42,
      targetEmail: 'user@example.com',
      targetRoles: ['user'],
    });

    expect(getActiveImpersonationGrant(grant.id, 1)).not.toBeNull();
    expect(getActiveImpersonationGrant(grant.id, 999)).toBeNull();
  });

  it('uppercases and de-blanks target roles', () => {
    const grant = createImpersonationGrant({
      impersonatorId: 1,
      impersonatorEmail: null,
      targetRoles: [' user ', '', 'Editor'],
    });
    expect(grant.targetRoles).toEqual(['USER', 'EDITOR']);
  });

  it('defaults to a 15-minute expiry', () => {
    const grant = createImpersonationGrant({
      impersonatorId: 1,
      impersonatorEmail: null,
      targetRoles: ['USER'],
    });
    expect(grant.expiresAt - grant.createdAt).toBe(15 * 60 * 1000);
  });

  it('caps a requested duration at 60 minutes', () => {
    const grant = createImpersonationGrant({
      impersonatorId: 1,
      impersonatorEmail: null,
      targetRoles: ['USER'],
      durationMinutes: 24 * 60,
    });
    expect(grant.expiresAt - grant.createdAt).toBe(60 * 60 * 1000);
  });

  it('expires the grant after its time-box elapses', () => {
    const grant = createImpersonationGrant({
      impersonatorId: 1,
      impersonatorEmail: null,
      targetRoles: ['USER'],
      durationMinutes: 15,
    });

    vi.setSystemTime(new Date('2026-01-01T00:14:59.000Z'));
    expect(getActiveImpersonationGrant(grant.id, 1)).not.toBeNull();

    vi.setSystemTime(new Date('2026-01-01T00:15:01.000Z'));
    expect(getActiveImpersonationGrant(grant.id, 1)).toBeNull();
  });

  it('ends a grant early only for its issuing admin, and it cannot be reused', () => {
    const grant = createImpersonationGrant({
      impersonatorId: 1,
      impersonatorEmail: null,
      targetRoles: ['USER'],
    });

    expect(endImpersonationGrant(grant.id, 999)).toBeNull();
    expect(getActiveImpersonationGrant(grant.id, 1)).not.toBeNull();

    expect(endImpersonationGrant(grant.id, 1)).not.toBeNull();
    expect(getActiveImpersonationGrant(grant.id, 1)).toBeNull();
  });
});
