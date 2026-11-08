import type { Sequelize } from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import { controlPlaneSequelizeSyncOptions, getControlPlaneSequelize } from '../../db/controlPlaneSequelize';
import { getPersonalInboxProjectionItemModel } from './personalInboxProjectionSequelizeModels';

/** Per-user inbox open/dismiss cursor (`work_item:*`, `alert:*`, `feedback:*`). */
export class PersonalInboxItemSeenModel extends Model {
  declare userId: number;
  declare itemKey: string;
  declare seenAt: Date;
}

let modelsInitialized = false;

const initModels = (sequelize: Sequelize): void => {
  if (modelsInitialized) {
    return;
  }
  PersonalInboxItemSeenModel.init(
    {
      userId: { type: DataTypes.BIGINT, allowNull: false, field: 'user_id', primaryKey: true },
      itemKey: { type: DataTypes.STRING(128), allowNull: false, field: 'item_key', primaryKey: true },
      seenAt: { type: DataTypes.DATE, allowNull: false, field: 'seen_at', defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'base_personal_inbox_item_seen',
      timestamps: false,
      indexes: [{ name: 'ix_inbox_item_seen_user', fields: ['user_id'] }],
    },
  );
  modelsInitialized = true;
};

export const getPersonalInboxItemSeenModel = (): typeof PersonalInboxItemSeenModel => {
  const sequelize = getControlPlaneSequelize();
  initModels(sequelize);
  return PersonalInboxItemSeenModel;
};

const migrateProjectionSeenRows = async (sequelize: Sequelize): Promise<void> => {
  try {
    initModels(sequelize);
    const Seen = getPersonalInboxItemSeenModel();
    const ProjectionItem = getPersonalInboxProjectionItemModel();
    const rows = await ProjectionItem.findAll({
      where: { attention: 'none' },
      attributes: ['userId', 'itemKey', 'updatedAt'],
    });
    if (rows.length === 0) {
      return;
    }
    const now = new Date();
    for (const row of rows) {
      await Seen.upsert({
        userId: Number(row.userId),
        itemKey: row.itemKey,
        seenAt: row.updatedAt ?? now,
      });
    }
  } catch {
    // Projection tables may not exist on partial installs.
  }
};

export const ensurePersonalInboxSeenTable = async (sequelize?: Sequelize): Promise<void> => {
  const db = sequelize ?? getControlPlaneSequelize();
  initModels(db);
  await PersonalInboxItemSeenModel.sync(controlPlaneSequelizeSyncOptions(db));
  await migrateProjectionSeenRows(db);
};
