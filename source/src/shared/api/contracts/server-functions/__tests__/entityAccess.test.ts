import { describe, expect, it } from 'vitest';
import {
  applyEntityAccessDecision,
  applyEntityAccessSelection,
  buildRoleAccessEntityKey,
  buildUserAccessEntityKeys,
  entityInAccessList,
  resolveEntityFunctionAccessDecision,
  resolvePrimaryUserAccessEntityKey,
} from '../entityAccess';

describe('entityAccess', () => {
  it('builds user entity keys from id and email', () => {
    expect(buildUserAccessEntityKeys(7, 'user@example.com')).toEqual(['7', 'user@example.com']);
    expect(resolvePrimaryUserAccessEntityKey(7, 'user@example.com')).toBe('user@example.com');
    expect(resolvePrimaryUserAccessEntityKey(7, null)).toBe('7');
  });

  it('normalizes role entity keys', () => {
    expect(buildRoleAccessEntityKey('developer')).toBe('DEVELOPER');
  });

  it('detects user membership in allow/deny lists case-insensitively', () => {
    const acl = {
      accessMode: 'specific' as const,
      allowRoles: [],
      allowUsers: ['User@Example.com'],
      denyRoles: [],
      denyUsers: [],
    };

    expect(entityInAccessList(acl, 'user', ['7', 'user@example.com'], 'allow')).toBe(true);
    expect(entityInAccessList(acl, 'user', ['9'], 'allow')).toBe(false);
  });

  it('adds allow user and removes same user from deny list', () => {
    const next = applyEntityAccessSelection(
      {
        accessMode: 'authenticated',
        allowRoles: [],
        allowUsers: [],
        denyRoles: [],
        denyUsers: ['user@example.com'],
      },
      'user',
      ['7', 'user@example.com'],
      'user@example.com',
      'allow',
      true,
    );

    expect(next.accessMode).toBe('specific');
    expect(next.allowUsers).toEqual(['user@example.com']);
    expect(next.denyUsers).toEqual([]);
  });

  it('removes role from deny list when unselected', () => {
    const next = applyEntityAccessSelection(
      {
        accessMode: 'specific',
        allowRoles: [],
        allowUsers: [],
        denyRoles: ['DEVELOPER', 'USER'],
        denyUsers: [],
      },
      'role',
      ['DEVELOPER'],
      'DEVELOPER',
      'deny',
      false,
    );

    expect(next.denyRoles).toEqual(['USER']);
  });

  it('resolves unified access decisions from allow and deny lists', () => {
    const acl = {
      accessMode: 'specific' as const,
      allowRoles: [],
      allowUsers: ['user@example.com'],
      denyRoles: [],
      denyUsers: [],
    };

    expect(resolveEntityFunctionAccessDecision(acl, 'user', ['7', 'user@example.com'])).toBe('allow');
    expect(resolveEntityFunctionAccessDecision({
      ...acl,
      allowUsers: [],
      denyUsers: ['user@example.com'],
    }, 'user', ['7', 'user@example.com'])).toBe('deny');
    expect(resolveEntityFunctionAccessDecision({
      accessMode: 'authenticated',
      allowRoles: [],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    }, 'user', ['7', 'user@example.com'])).toBe('none');
  });

  it('sorts entries by folder then name then id', async () => {
    const { compareEntityFunctionAccessEntries, sortEntityFunctionAccessEntries } = await import('../entityAccess');
    const entries = sortEntityFunctionAccessEntries([
      {
        id: 'b-fn',
        name: 'beta',
        method: 'GET',
        path: '/api/b',
        folder: 'auth',
        accessMode: 'authenticated',
        decision: 'none',
        editable: true,
      },
      {
        id: 'a-fn',
        name: 'alpha',
        method: 'GET',
        path: '/api/a',
        folder: 'auth',
        accessMode: 'authenticated',
        decision: 'allow',
        editable: true,
      },
      {
        id: 'z-fn',
        name: 'zebra',
        method: 'GET',
        path: '/api/z',
        folder: 'users',
        accessMode: 'authenticated',
        decision: 'deny',
        editable: true,
      },
    ]);

    expect(entries.map((entry) => entry.name)).toEqual(['alpha', 'beta', 'zebra']);
    expect(compareEntityFunctionAccessEntries(entries[0], entries[1])).toBeLessThan(0);
  });

  it('applies unified none decision by clearing both lists', () => {
    const next = applyEntityAccessDecision(
      {
        accessMode: 'specific',
        allowRoles: [],
        allowUsers: ['user@example.com'],
        denyRoles: [],
        denyUsers: ['user@example.com'],
      },
      'user',
      ['7', 'user@example.com'],
      'user@example.com',
      'none',
    );

    expect(next.allowUsers).toEqual([]);
    expect(next.denyUsers).toEqual([]);
  });
});
