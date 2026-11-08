import { DataTypes, type Model, type ModelStatic, type Sequelize } from 'sequelize';
import { getControlPlaneSequelize, controlPlaneSequelizeSyncOptions } from '../../db/controlPlaneSequelize';

export type PersonalInboxArchivedItemRow = {
  userId: number;
  itemKey: string;
  archivedAt: Date;
};

export type PersonalInboxArchivedItemModel = Model<
  PersonalInboxArchivedItemRow,
  Partial<PersonalInboxArchivedItemRow>
> & PersonalInboxArchivedItemRow;

let cachedModel: ModelStatic<PersonalInboxArchivedItemModel> | null = null;
let testSequelize: Sequelize | null = null;

export const configurePersonalInboxArchivedSequelizeForTests = (sequelize: Sequelize | null): void => {
  testSequelize = sequelize;
  cachedModel = null;
};

const resolveSequelize = (sequelize?: Sequelize): Sequelize =>
  sequelize ?? testSequelize ?? getControlPlaneSequelize();

export const getPersonalInboxArchivedItemModel = (
  sequelize?: Sequelize,
): ModelStatic<PersonalInboxArchivedItemModel> => {
  const db = resolveSequelize(sequelize);
  if (cachedModel && cachedModel.sequelize === db) {
    return cachedModel;
  }
  cachedModel = db.define<PersonalInboxArchivedItemModel>(
    'BasePersonalInboxArchivedItem',
    {
      userId: { type: DataTypes.BIGINT, allowNull: false, primaryKey: true, field: 'user_id' },
      itemKey: { type: DataTypes.STRING(128), allowNull: false, primaryKey: true, field: 'item_key' },
      archivedAt: { type: DataTypes.DATE, allowNull: false, field: 'archived_at', defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'base_personal_inbox_archived_items',
      timestamps: false,
      indexes: [{ name: 'ix_personal_inbox_archived_user', fields: ['user_id'] }],
    },
  );
  return cachedModel;
};

export const resetPersonalInboxArchivedModelCacheForTests = (): void => {
  cachedModel = null;
};

export const ensurePersonalInboxArchivedTables = async (sequelize?: Sequelize): Promise<void> => {
  const db = resolveSequelize(sequelize);
  await getPersonalInboxArchivedItemModel(db).sync(controlPlaneSequelizeSyncOptions(db));
};
