import type { Sequelize } from 'sequelize';
import { DataTypes, Model } from 'sequelize';
import { controlPlaneSequelizeSyncOptions, getControlPlaneSequelize } from '../../db/controlPlaneSequelize';

/** Per-user reply/forward markers on inbox rows (original row stays — Gmail-style keep copy). */
export class PersonalInboxCorrespondenceModel extends Model {
  declare userId: number;
  declare itemKey: string;
  declare repliedAt: Date | null;
  declare forwardedAt: Date | null;
  declare updatedAt: Date;
}

let modelsInitialized = false;

const initModels = (sequelize: Sequelize): void => {
  if (modelsInitialized) {
    return;
  }
  PersonalInboxCorrespondenceModel.init(
    {
      userId: { type: DataTypes.BIGINT, allowNull: false, field: 'user_id', primaryKey: true },
      itemKey: { type: DataTypes.STRING(128), allowNull: false, field: 'item_key', primaryKey: true },
      repliedAt: { type: DataTypes.DATE, allowNull: true, field: 'replied_at' },
      forwardedAt: { type: DataTypes.DATE, allowNull: true, field: 'forwarded_at' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at', defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'base_personal_inbox_correspondence',
      timestamps: false,
      indexes: [{ name: 'ix_inbox_correspondence_user', fields: ['user_id'] }],
    },
  );
  modelsInitialized = true;
};

export const getPersonalInboxCorrespondenceModel = (): typeof PersonalInboxCorrespondenceModel => {
  const sequelize = getControlPlaneSequelize();
  initModels(sequelize);
  return PersonalInboxCorrespondenceModel;
};

export const ensurePersonalInboxCorrespondenceTable = async (sequelize?: Sequelize): Promise<void> => {
  const db = sequelize ?? getControlPlaneSequelize();
  initModels(db);
  await PersonalInboxCorrespondenceModel.sync(controlPlaneSequelizeSyncOptions(db));
};
