import { DataTypes, type Model, type ModelStatic, type Sequelize } from 'sequelize';
import { getControlPlaneSequelize, controlPlaneSequelizeSyncOptions } from '../../db/controlPlaneSequelize';

export type ComponentUsageSummaryRow = {
  componentName: string;
  kind: string;
  hitCount: number;
  lastHitAt: Date;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  updatedBy: string | null;
};

export type ComponentUsageSummaryModel = Model<ComponentUsageSummaryRow, Partial<ComponentUsageSummaryRow>>
  & ComponentUsageSummaryRow;

let cachedModel: ModelStatic<ComponentUsageSummaryModel> | null = null;
let testSequelize: Sequelize | null = null;

export const configureComponentUsageSequelizeForTests = (sequelize: Sequelize | null): void => {
  testSequelize = sequelize;
  cachedModel = null;
};

const resolveSequelize = (sequelize?: Sequelize): Sequelize =>
  sequelize ?? testSequelize ?? getControlPlaneSequelize();

export const getComponentUsageSummaryModel = (
  sequelize?: Sequelize,
): ModelStatic<ComponentUsageSummaryModel> => {
  const db = resolveSequelize(sequelize);
  if (cachedModel && cachedModel.sequelize === db) {
    return cachedModel;
  }

  cachedModel = db.define<ComponentUsageSummaryModel>(
    'BaseComponentUsageSummary',
    {
      componentName: { type: DataTypes.STRING(256), primaryKey: true, field: 'component_name' },
      kind: { type: DataTypes.STRING(32), primaryKey: true },
      hitCount: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: 'hit_count' },
      lastHitAt: { type: DataTypes.DATE, allowNull: false, field: 'last_hit_at' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at' },
      createdBy: { type: DataTypes.STRING(128), allowNull: true, field: 'created_by' },
      updatedBy: { type: DataTypes.STRING(128), allowNull: true, field: 'updated_by' },
    },
    {
      tableName: 'base_component_usage_summary',
      timestamps: false,
      indexes: [
        { name: 'ix_component_usage_summary_last_hit', fields: ['last_hit_at'] },
      ],
    },
  );
  return cachedModel;
};

export const ensureComponentUsageTables = async (sequelize?: Sequelize): Promise<void> => {
  const db = resolveSequelize(sequelize);
  const syncOptions = controlPlaneSequelizeSyncOptions(db);
  await getComponentUsageSummaryModel(db).sync(syncOptions);
};
