import { DataTypes, type Model, type ModelStatic, type Sequelize } from 'sequelize';
import { getControlPlaneSequelize, controlPlaneSequelizeSyncOptions } from '../../db/controlPlaneSequelize';

export type EdgeDataSourceRow = {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database: string | null;
  username: string | null;
  encrypt: boolean;
  trustServerCertificate: boolean;
  pooling: boolean;
  optionsJson: string | null;
  status: string;
  createdAt: Date | null;
  createdBy: string | null;
  updatedAt: Date | null;
  updatedBy: string | null;
};

export type EdgeDataSourceModel = Model<EdgeDataSourceRow, Partial<EdgeDataSourceRow>> & EdgeDataSourceRow;

let cachedModel: ModelStatic<EdgeDataSourceModel> | null = null;

export const getEdgeDataSourceModel = (
  sequelize: Sequelize = getControlPlaneSequelize(),
): ModelStatic<EdgeDataSourceModel> => {
  if (cachedModel && cachedModel.sequelize === sequelize) {
    return cachedModel;
  }
  cachedModel = sequelize.define<EdgeDataSourceModel>(
    'BaseDataSource',
    {
      id: { type: DataTypes.STRING(64), primaryKey: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      type: { type: DataTypes.STRING(64), allowNull: false },
      host: { type: DataTypes.STRING(255), allowNull: false },
      port: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
      database: { type: DataTypes.STRING(255), allowNull: true },
      username: { type: DataTypes.STRING(255), allowNull: true },
      encrypt: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      trustServerCertificate: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        field: 'trust_server_certificate',
      },
      pooling: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      optionsJson: { type: DataTypes.TEXT, allowNull: true, field: 'options_json' },
      status: { type: DataTypes.STRING(32), allowNull: false, defaultValue: 'disconnected' },
      createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
      createdBy: { type: DataTypes.STRING(128), allowNull: true, field: 'created_by' },
      updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
      updatedBy: { type: DataTypes.STRING(128), allowNull: true, field: 'updated_by' },
    },
    {
      tableName: 'base_data_sources',
      timestamps: false,
    },
  );
  return cachedModel;
};

export const resetEdgeDataSourceModelCacheForTests = (): void => {
  cachedModel = null;
};

export const ensureEdgeDataSourcesTable = async (
  sequelize: Sequelize = getControlPlaneSequelize(),
): Promise<void> => {
  const model = getEdgeDataSourceModel(sequelize);
  await model.sync(controlPlaneSequelizeSyncOptions(sequelize));
};
