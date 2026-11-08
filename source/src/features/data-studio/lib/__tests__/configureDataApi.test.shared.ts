import type { EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';

export const sampleModel: EdgeModelDefinition = {
  id: 'model_users',
  dataSourceId: 'ds_local',
  schema: null,
  objectName: 'dbo.Users',
  objectType: 'TABLE',
  sequelize: {
    modelName: 'Users',
    tableName: 'users',
  },
  columns: [
    {
      name: 'id',
      field: 'id',
      dataType: 'INTEGER',
      sequelizeType: 'INTEGER',
      allowNull: false,
      isPrimaryKey: true,
      isForeignKey: false,
    },
    {
      name: 'email',
      field: 'email',
      dataType: 'TEXT',
      sequelizeType: 'STRING',
      allowNull: false,
      isPrimaryKey: false,
      isForeignKey: false,
    },
    {
      name: 'gender_code',
      field: 'genderCode',
      dataType: 'TEXT',
      sequelizeType: 'STRING',
      allowNull: true,
      isPrimaryKey: false,
      isForeignKey: false,
    },
  ],
  primaryKey: 'id',
  associations: [
    {
      id: 'assoc_orders',
      kind: 'hasMany',
      targetModelId: 'model_orders',
      foreignKey: 'user_id',
      as: 'orders',
      source: 'catalog',
    },
  ],
  schemaFingerprint: 'fp',
  readOnly: false,
  labels: { title: 'Users' },
  status: 'ready',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};
