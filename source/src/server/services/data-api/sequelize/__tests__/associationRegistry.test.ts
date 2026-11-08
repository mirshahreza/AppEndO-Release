import { describe, expect, it } from 'vitest';
import { sortModelsTopologically } from '../associationRegistry';
import type { EdgeModelDefinition } from '../../../../../shared/api/contracts/data-api';

const baseModel = (
  id: string,
  associations: EdgeModelDefinition['associations'] = [],
): EdgeModelDefinition => ({
  id,
  dataSourceId: 'ds1',
  schema: null,
  objectName: id,
  objectType: 'TABLE',
  sequelize: { modelName: id, tableName: id },
  columns: [],
  primaryKey: 'id',
  associations,
  schemaFingerprint: 'fp',
  readOnly: false,
  labels: { title: id },
  status: 'ready',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
});

describe('associationRegistry', () => {
  it('sorts models topologically before registering associations', () => {
    const child = baseModel('child', [{
      id: 'a1',
      kind: 'belongsTo',
      targetModelId: 'parent',
      foreignKey: 'parentId',
      as: 'parent',
      source: 'manual',
    }]);
    const parent = baseModel('parent');
    const ordered = sortModelsTopologically([child, parent]);
    expect(ordered.map((item) => item.id)).toEqual(['parent', 'child']);
  });

  it('visits through models for belongsToMany before the source', () => {
    const users = baseModel('users', [{
      id: 'a_m2m',
      kind: 'belongsToMany',
      targetModelId: 'roles',
      throughModelId: 'user_roles',
      foreignKey: 'user_id',
      otherKey: 'role_id',
      as: 'roles',
      source: 'manual',
    }]);
    const roles = baseModel('roles');
    const userRoles = baseModel('user_roles');
    const ordered = sortModelsTopologically([users, roles, userRoles]);
    const usersIndex = ordered.findIndex((item) => item.id === 'users');
    const rolesIndex = ordered.findIndex((item) => item.id === 'roles');
    const throughIndex = ordered.findIndex((item) => item.id === 'user_roles');
    expect(rolesIndex).toBeLessThan(usersIndex);
    expect(throughIndex).toBeLessThan(usersIndex);
  });
});
