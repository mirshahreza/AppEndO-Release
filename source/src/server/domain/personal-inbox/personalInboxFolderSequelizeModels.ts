import type { Sequelize } from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import { controlPlaneSequelizeSyncOptions, getControlPlaneSequelize } from '../../db/controlPlaneSequelize';
import {
  ensurePersonalInboxArchivedTables,
  getPersonalInboxArchivedItemModel,
} from './personalInboxArchivedSequelizeModels';
import { PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED } from '../../../shared/personal-inbox/personalInboxFolderRefs';

export class PersonalInboxUserFolderModel extends Model {
  declare id: number;
  declare userId: number;
  declare name: string;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export class PersonalInboxItemFolderTagModel extends Model {
  declare userId: number;
  declare itemKey: string;
  declare folderRef: string;
  declare taggedAt: Date;
}

let modelsInitialized = false;

const initModels = (sequelize: Sequelize): void => {
  if (modelsInitialized) {
    return;
  }
  PersonalInboxUserFolderModel.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      userId: { type: DataTypes.BIGINT, allowNull: false, field: 'user_id' },
      name: { type: DataTypes.STRING(128), allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at', defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'base_personal_inbox_user_folders',
      timestamps: false,
      indexes: [{ name: 'ix_inbox_user_folders_user', fields: ['user_id'] }],
    },
  );

  PersonalInboxItemFolderTagModel.init(
    {
      userId: { type: DataTypes.BIGINT, allowNull: false, field: 'user_id', primaryKey: true },
      itemKey: { type: DataTypes.STRING(128), allowNull: false, field: 'item_key', primaryKey: true },
      folderRef: { type: DataTypes.STRING(64), allowNull: false, field: 'folder_ref', primaryKey: true },
      taggedAt: { type: DataTypes.DATE, allowNull: false, field: 'tagged_at', defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'base_personal_inbox_item_folder_tags',
      timestamps: false,
      indexes: [{ name: 'ix_inbox_item_folder_tags_user', fields: ['user_id'] }],
    },
  );
  modelsInitialized = true;
};

export const getPersonalInboxUserFolderModel = (): typeof PersonalInboxUserFolderModel => {
  const sequelize = getControlPlaneSequelize();
  initModels(sequelize);
  return PersonalInboxUserFolderModel;
};

export const getPersonalInboxItemFolderTagModel = (): typeof PersonalInboxItemFolderTagModel => {
  const sequelize = getControlPlaneSequelize();
  initModels(sequelize);
  return PersonalInboxItemFolderTagModel;
};

const migrateLegacyArchivedRows = async (sequelize: Sequelize): Promise<void> => {
  try {
    initModels(sequelize);
    await ensurePersonalInboxArchivedTables(sequelize);
    const Tag = getPersonalInboxItemFolderTagModel();
    const Archived = getPersonalInboxArchivedItemModel();
    const archivedRows = await Archived.findAll({ attributes: ['userId', 'itemKey'] });
    if (archivedRows.length === 0) {
      return;
    }
    for (const row of archivedRows) {
      const userId = Number(row.userId);
      const itemKey = row.itemKey;
      const existing = await Tag.findOne({
        where: { userId, itemKey, folderRef: PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED },
      });
      if (!existing) {
        await Tag.create({
          userId,
          itemKey,
          folderRef: PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED,
          taggedAt: new Date(),
        });
      }
    }
  } catch {
    // Legacy archived table may not exist on fresh installs.
  }
};

export const ensurePersonalInboxFolderTables = async (sequelize?: Sequelize): Promise<void> => {
  const db = sequelize ?? getControlPlaneSequelize();
  initModels(db);
  await PersonalInboxUserFolderModel.sync(controlPlaneSequelizeSyncOptions(db));
  await PersonalInboxItemFolderTagModel.sync(controlPlaneSequelizeSyncOptions(db));
  await migrateLegacyArchivedRows(db);
};
