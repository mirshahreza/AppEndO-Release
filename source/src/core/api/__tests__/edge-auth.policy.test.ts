import { describe, expect, it } from 'vitest';

const userHasAnyRole = (authRoles: string[], required: string[]): boolean => {
  const normalized = authRoles.map((role) => role.toUpperCase());
  return required
    .map((role) => role.toUpperCase())
    .some((role) => normalized.includes(role));
};

/** Documented policy: edge execute and AI chat require ADMIN (see server.ts route gates). */
const PRIVILEGED_EDGE_ROLES = ['ADMIN'];

describe('privileged edge/AI RBAC policy', () => {
  it('allows ADMIN principals', () => {
    expect(userHasAnyRole(['ADMIN'], PRIVILEGED_EDGE_ROLES)).toBe(true);
    expect(userHasAnyRole(['USER', 'ADMIN'], PRIVILEGED_EDGE_ROLES)).toBe(true);
  });

  it('denies non-admin principals', () => {
    expect(userHasAnyRole(['USER'], PRIVILEGED_EDGE_ROLES)).toBe(false);
    expect(userHasAnyRole([], PRIVILEGED_EDGE_ROLES)).toBe(false);
  });
});
