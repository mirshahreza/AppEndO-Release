import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

import {
  CONTROL_PLANE_EXTERNALLY_MANAGED_TABLE_NAMES,
  CONTROL_PLANE_SCHEMA_PROTECTED_TABLE_NAMES,
  isExternallyManagedControlPlaneTableName,
  isNonPrismaProtectedTableName,
  listPrismaExternalTableNames,
} from '../../../config/controlPlaneSchemaOwnership';
import { listPrismaMappedTableNames } from '../controlPlaneSchemaDiff';
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
    expect(names.has('base_record_events')).toBe(true);
    expect(names.has('base_credential_vault_secrets')).toBe(true);
  });

  it('declares Sequelize feature tables as Prisma external names and not as Prisma models', () => {
    const schema = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
    const prismaTables = listPrismaMappedTableNames(schema);
    const productionDrops = [
      'base_control_plane_boot_markers',
      'base_credential_vault_secrets',
      'base_record_event_holds',
      'base_record_events',
      'base_user_message_dispatches',
    ];
    for (const name of productionDrops) {
      expect(isExternallyManagedControlPlaneTableName(name)).toBe(true);
      expect(prismaTables.has(name)).toBe(false);
    }
    for (const name of CONTROL_PLANE_EXTERNALLY_MANAGED_TABLE_NAMES) {
      expect(prismaTables.has(name)).toBe(false);
    }
    expect(prismaTables.has('base_logs_app')).toBe(true);
    expect(isExternallyManagedControlPlaneTableName('base_logs_app')).toBe(false);
    expect(listPrismaExternalTableNames('sqlserver')).toContain('dbo.base_record_events');
    expect(listPrismaExternalTableNames('postgresql')).toContain('public.base_record_events');
    expect(listPrismaExternalTableNames('sqlite')).toContain('base_record_events');
    expect(listPrismaExternalTableNames('sqlserver').some((name) => name.endsWith('.base_users'))).toBe(false);
  });

  it('lists every non-Prisma Sequelize tableName under src/server/domain', () => {
    const domainRoot = path.join(process.cwd(), 'src/server/domain');
    const tableNames = new Set<string>();
    const visit = (dir: string): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (entry.name === '__tests__') continue;
          visit(full);
          continue;
        }
        if (!entry.name.endsWith('.ts')) continue;
        const source = fs.readFileSync(full, 'utf8');
        for (const match of source.matchAll(/tableName:\s*'((?:base_)[a-z0-9_]+)'/g)) {
          tableNames.add(match[1] ?? '');
        }
      }
    };
    visit(domainRoot);
    const schema = fs.readFileSync(path.join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
    const prismaTables = listPrismaMappedTableNames(schema);
    const missing = [...tableNames].filter((name) => (
      name.startsWith('base_') && !prismaTables.has(name) && !isExternallyManagedControlPlaneTableName(name)
    ));
    expect(missing).toEqual([]);
    expect(tableNames.has('base_record_events')).toBe(true);
  });
});
