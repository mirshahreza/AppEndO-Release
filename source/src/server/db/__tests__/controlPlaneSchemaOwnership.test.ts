import { describe, expect, it } from 'vitest';

import {
  CONTROL_PLANE_SCHEMA_PROTECTED_TABLE_NAMES,
  isNonPrismaProtectedTableName,
} from '../../../config/controlPlaneSchemaOwnership';
import { resolveControlPlaneSchemaProtectedTables } from '../controlPlaneSchemaProtectedTables';

describe('controlPlaneSchemaOwnership', () => {
  it('treats extx/cms/zz prefixes as non-Prisma protected', () => {
    expect(isNonPrismaProtectedTableName('extx_members')).toBe(true);
    expect(isNonPrismaProtectedTableName('extx_members_ext')).toBe(true);
    expect(isNonPrismaProtectedTableName('cms_contents')).toBe(true);
    expect(isNonPrismaProtectedTableName('base_users')).toBe(false);
  });

  it('includes boot marker and env names in protected set', () => {
    const names = resolveControlPlaneSchemaProtectedTables({
      CONTROL_PLANE_SCHEMA_PROTECTED_TABLES: 'custom_pkg_table',
    });
    for (const fixed of CONTROL_PLANE_SCHEMA_PROTECTED_TABLE_NAMES) {
      expect(names.has(fixed)).toBe(true);
    }
    expect(names.has('custom_pkg_table')).toBe(true);
  });
});
