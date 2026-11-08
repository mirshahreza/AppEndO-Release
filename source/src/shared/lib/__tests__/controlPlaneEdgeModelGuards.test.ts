import { describe, expect, it } from 'vitest';
import type { EdgeModelDefinition } from '../../api/contracts/data-api';
import {
  assertControlPlaneEdgeModelPatchAllowed,
  isControlPlaneStructuralColumnPatch,
} from '../controlPlaneEdgeModelGuards';

const baseColumn = {
  name: 'id',
  field: 'id',
  dataType: 'integer',
  sequelizeType: 'INTEGER',
  allowNull: false,
  isPrimaryKey: true,
  isForeignKey: false,
};

const baseAssociation = {
  id: 'assoc-1',
  kind: 'belongsTo' as const,
  targetModelId: 'roles',
  foreignKey: 'role_id',
  as: 'role',
  source: 'catalog' as const,
};

const platformModel: EdgeModelDefinition = {
  id: 'm1',
  dataSourceId: 'ds1',
  schema: null,
  objectName: 'base_users',
  objectType: 'TABLE',
  sequelize: { modelName: 'BaseUsers', tableName: 'base_users' },
  columns: [baseColumn],
  primaryKey: 'id',
  associations: [baseAssociation],
  schemaFingerprint: 'fp',
  readOnly: false,
  labels: { title: 'Users' },
  status: 'ready',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('assertControlPlaneEdgeModelPatchAllowed', () => {
  it('allows metadata and non-structural column changes on existing columns', () => {
    expect(() => assertControlPlaneEdgeModelPatchAllowed(platformModel, {
      labels: { title: 'Platform Users', description: 'Updated' },
      readOnly: true,
      columns: [{
        ...baseColumn,
        sequelizeType: 'BIGINT',
      }],
    })).not.toThrow();
  });

  it('allows adding columns and associations', () => {
    expect(() => assertControlPlaneEdgeModelPatchAllowed(platformModel, {
      columns: [
        baseColumn,
        {
          name: 'nickname',
          field: 'nickname',
          dataType: 'text',
          sequelizeType: 'STRING',
          allowNull: true,
          isPrimaryKey: false,
          isForeignKey: false,
        },
      ],
      associations: [
        baseAssociation,
        {
          id: 'assoc-2',
          kind: 'hasMany',
          targetModelId: 'posts',
          foreignKey: 'user_id',
          as: 'posts',
          source: 'manual',
        },
      ],
    })).not.toThrow();
  });

  it('rejects removing or reshaping existing platform columns', () => {
    expect(() => assertControlPlaneEdgeModelPatchAllowed(platformModel, {
      columns: [],
    })).toThrow(/cannot be removed/);

    expect(() => assertControlPlaneEdgeModelPatchAllowed(platformModel, {
      columns: [{ ...baseColumn, name: 'user_id' }],
    })).toThrow(/cannot be removed/);

    expect(() => assertControlPlaneEdgeModelPatchAllowed(platformModel, {
      columns: [{ ...baseColumn, dataType: 'text' }],
    })).toThrow(/cannot change database shape/);
  });

  it('rejects removing or changing existing platform associations', () => {
    expect(() => assertControlPlaneEdgeModelPatchAllowed(platformModel, {
      associations: [],
    })).toThrow(/cannot be removed/);

    expect(() => assertControlPlaneEdgeModelPatchAllowed(platformModel, {
      associations: [{ ...baseAssociation, as: 'renamed' }],
    })).toThrow(/cannot be changed/);
  });

  it('does not constrain non-platform models', () => {
    expect(() => assertControlPlaneEdgeModelPatchAllowed({
      ...platformModel,
      objectName: 'customers',
    }, {
      columns: [],
      associations: [],
    })).not.toThrow();
  });
});

describe('isControlPlaneStructuralColumnPatch', () => {
  it('detects structural keys', () => {
    expect(isControlPlaneStructuralColumnPatch({ sequelizeType: 'BIGINT' })).toBe(false);
    expect(isControlPlaneStructuralColumnPatch({ dataType: 'text' })).toBe(true);
    expect(isControlPlaneStructuralColumnPatch({ name: 'x' })).toBe(true);
  });
});
