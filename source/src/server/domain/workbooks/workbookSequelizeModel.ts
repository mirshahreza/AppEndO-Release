import { DataTypes, type Model, type ModelStatic, type Sequelize } from 'sequelize';
import { getControlPlaneSequelize, controlPlaneSequelizeSyncOptions } from '../../db/controlPlaneSequelize';

export type WorkbookRow = {
  id: string;
  name: string;
  note: string | null;
  sheetsJson: string;
  ownerUserId: number;
  accessControl: string | null;
  accessPermission: string | null;
  createdAt: Date | null;
  createdBy: number | null;
  updatedAt: Date | null;
  updatedBy: number | null;
};

export type WorkbookModel = Model<WorkbookRow, Partial<WorkbookRow>> & WorkbookRow;

let cachedModel: ModelStatic<WorkbookModel> | null = null;

export const getWorkbookModel = (sequelize: Sequelize = getControlPlaneSequelize()): ModelStatic<WorkbookModel> => {
  if (cachedModel && cachedModel.sequelize === sequelize) {
    return cachedModel;
  }
  cachedModel = sequelize.define<WorkbookModel>(
    'BaseWorkbook',
    {
      id: { type: DataTypes.STRING(36), primaryKey: true },
      name: { type: DataTypes.STRING(255), allowNull: false },
      note: { type: DataTypes.TEXT, allowNull: true },
      sheetsJson: { type: DataTypes.TEXT('long'), allowNull: false, field: 'sheets_json' },
      ownerUserId: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: 'owner_user_id' },
      accessControl: { type: DataTypes.TEXT, allowNull: true, field: 'access_control' },
      accessPermission: { type: DataTypes.STRING(16), allowNull: true, field: 'access_permission' },
      createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
      createdBy: { type: DataTypes.BIGINT, allowNull: true, field: 'created_by' },
      updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
      updatedBy: { type: DataTypes.BIGINT, allowNull: true, field: 'updated_by' },
    },
    {
      tableName: 'base_workbooks',
      timestamps: false,
    },
  );
  return cachedModel;
};

const dropLegacyColumn = async (sequelize: Sequelize, column: string): Promise<void> => {
  const queryInterface = sequelize.getQueryInterface();
  const description = await queryInterface.describeTable('base_workbooks');
  if (description[column]) {
    await queryInterface.removeColumn('base_workbooks', column);
  }
};

export const ensureWorkbookTable = async (): Promise<void> => {
  const sequelize = getControlPlaneSequelize();
  const model = getWorkbookModel(sequelize);
  await model.sync(controlPlaneSequelizeSyncOptions(sequelize));
  await dropLegacyColumn(sequelize, 'kind').catch(() => undefined);
  await dropLegacyColumn(sequelize, 'binding_json').catch(() => undefined);
};
