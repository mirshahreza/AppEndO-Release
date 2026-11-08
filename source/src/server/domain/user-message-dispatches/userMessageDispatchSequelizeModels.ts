import { DataTypes, type Model, type ModelStatic, type Sequelize } from 'sequelize';
import { getControlPlaneSequelize, controlPlaneSequelizeSyncOptions } from '../../db/controlPlaneSequelize';

export type UserMessageDispatchRow = {
  id: number;
  userId: number;
  correlationId: string;
  eventType: string;
  channel: string;
  deliveryStatus: string;
  title: string;
  bodySummary: string;
  href: string | null;
  severity: string;
  metadataJson: string | null;
  inAppNotificationId: number | null;
  digestBatchId: string | null;
  deliveredAt: Date | null;
  errorSummary: string | null;
  createdAt: Date;
};

export type UserMessageDispatchModel = Model<UserMessageDispatchRow, Partial<UserMessageDispatchRow>> & UserMessageDispatchRow;

let cachedModel: ModelStatic<UserMessageDispatchModel> | null = null;
let testSequelize: Sequelize | null = null;

export const configureUserMessageDispatchSequelizeForTests = (sequelize: Sequelize | null): void => {
  testSequelize = sequelize;
  cachedModel = null;
};

const resolveSequelize = (sequelize?: Sequelize): Sequelize =>
  sequelize ?? testSequelize ?? getControlPlaneSequelize();

export const getUserMessageDispatchModel = (
  sequelize?: Sequelize,
): ModelStatic<UserMessageDispatchModel> => {
  const db = resolveSequelize(sequelize);
  if (cachedModel && cachedModel.sequelize === db) {
    return cachedModel;
  }
  cachedModel = db.define<UserMessageDispatchModel>(
    'BaseUserMessageDispatch',
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.BIGINT, allowNull: false, field: 'user_id' },
      correlationId: { type: DataTypes.STRING(36), allowNull: false, field: 'correlation_id' },
      eventType: { type: DataTypes.STRING(128), allowNull: false, field: 'event_type' },
      channel: { type: DataTypes.STRING(16), allowNull: false },
      deliveryStatus: { type: DataTypes.STRING(32), allowNull: false, field: 'delivery_status' },
      title: { type: DataTypes.STRING(500), allowNull: false },
      bodySummary: { type: DataTypes.TEXT, allowNull: false, field: 'body_summary' },
      href: { type: DataTypes.STRING(2048), allowNull: true },
      severity: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'info' },
      metadataJson: { type: DataTypes.TEXT, allowNull: true, field: 'metadata_json' },
      inAppNotificationId: { type: DataTypes.BIGINT, allowNull: true, field: 'in_app_notification_id' },
      digestBatchId: { type: DataTypes.STRING(36), allowNull: true, field: 'digest_batch_id' },
      deliveredAt: { type: DataTypes.DATE, allowNull: true, field: 'delivered_at' },
      errorSummary: { type: DataTypes.TEXT, allowNull: true, field: 'error_summary' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'base_user_message_dispatches',
      timestamps: false,
      indexes: [
        {
          unique: true,
          name: 'uq_user_message_dispatches_user_corr_channel',
          fields: ['user_id', 'correlation_id', 'channel'],
        },
        { name: 'ix_user_message_dispatches_user_created', fields: ['user_id', 'created_at'] },
        { name: 'ix_user_message_dispatches_digest_batch', fields: ['digest_batch_id'] },
      ],
    },
  );
  return cachedModel;
};

export const resetUserMessageDispatchModelCacheForTests = (): void => {
  cachedModel = null;
};

export const ensureUserMessageDispatchTables = async (sequelize?: Sequelize): Promise<void> => {
  const db = resolveSequelize(sequelize);
  await getUserMessageDispatchModel(db).sync(controlPlaneSequelizeSyncOptions(db));
};
