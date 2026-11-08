import { describe, expect, it } from 'vitest';
import {
  compileNodeVisibilityAccessToCondition,
  parseVisibilityConditionToAccess,
  resolveNodeVisibilityAccess,
} from '../designerNodeVisibilityAccess';
import type { DesignerNode } from '../types';

const node = (layout: Record<string, unknown>): DesignerNode => ({
  id: 'n1',
  type: 'div',
  parentId: null,
  order: 0,
  props: {},
  layout,
  binding: {},
  children: [],
});

describe('designerNodeVisibilityAccess', () => {
  it('compiles specific allow roles to a store.user.role expression', () => {
    const condition = compileNodeVisibilityAccessToCondition({
      accessMode: 'specific',
      allowRoles: ['ADMIN', 'EDITOR'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    });

    expect(condition).toBe('["ADMIN","EDITOR"].includes(String(store.user?.role ?? \'\').toUpperCase())');
  });

  it('returns undefined for authenticated access (always visible when logged in)', () => {
    expect(compileNodeVisibilityAccessToCondition({
      accessMode: 'authenticated',
      allowRoles: [],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    })).toBeUndefined();
  });

  it('round-trips compiled allow-role expressions', () => {
    const compiled = '["ADMIN"].includes(String(store.user?.role ?? \'\').toUpperCase())';
    const parsed = parseVisibilityConditionToAccess(compiled);
    expect(parsed?.allowRoles).toEqual(['ADMIN']);
  });

  it('parses legacy store.user.role === admin expressions', () => {
    const parsed = parseVisibilityConditionToAccess("store.user.role === 'admin'");
    expect(parsed?.allowRoles).toEqual(['ADMIN']);
  });

  it('reads visibilityAccess from node layout', () => {
    const access = resolveNodeVisibilityAccess(node({
      visibilityAccess: {
        accessMode: 'specific',
        allowRoles: ['USER'],
        allowUsers: [],
        denyRoles: [],
        denyUsers: [],
      },
    }));
    expect(access.allowRoles).toEqual(['USER']);
  });
});
