import { DataTypes, Model, type Sequelize } from 'sequelize';
import { controlPlaneSequelizeSyncOptions, getControlPlaneSequelize } from '../../db/controlPlaneSequelize';

export class DirectMessageThreadModel extends Model {
  declare id: number;
  declare participantLowUserId: number;
  declare participantHighUserId: number;
  declare lastMessageAt: Date | null;
  declare lastMessagePreview: string | null;
  declare createdAt: Date;
  declare updatedAt: Date;
}

export class DirectMessageMessageModel extends Model {
  declare id: number;
  declare threadId: number;
  declare senderUserId: number;
  declare body: string;
  declare replyToMessageId: number | null;
  declare forwardedFromMessageId: number | null;
  declare createdAt: Date;
}

export class DirectMessageParticipantStateModel extends Model {
  declare threadId: number;
  declare userId: number;
  declare lastReadMessageId: number | null;
  declare updatedAt: Date;
}

export class DirectMessageAttachmentModel extends Model {
  declare id: number;
  declare messageId: number | null;
  declare fileName: string;
  declare mimeType: string;
  declare sizeBytes: number;
  declare storageKey: string;
  declare uploadedByUserId: number;
  declare stagedSessionKey: string | null;
  declare createdAt: Date;
}

let modelsInitialized = false;

const initModels = (sequelize: Sequelize): void => {
  if (modelsInitialized) {
    return;
  }
  DirectMessageThreadModel.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      participantLowUserId: { type: DataTypes.BIGINT, allowNull: false, field: 'participant_low_user_id' },
      participantHighUserId: { type: DataTypes.BIGINT, allowNull: false, field: 'participant_high_user_id' },
      lastMessageAt: { type: DataTypes.DATE, allowNull: true, field: 'last_message_at' },
      lastMessagePreview: { type: DataTypes.STRING(500), allowNull: true, field: 'last_message_preview' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at', defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'base_direct_message_threads',
      timestamps: false,
      indexes: [
        {
          unique: true,
          name: 'uq_direct_message_thread_participants',
          fields: ['participant_low_user_id', 'participant_high_user_id'],
        },
        { name: 'ix_direct_message_thread_last_message', fields: ['last_message_at'] },
      ],
    },
  );

  DirectMessageMessageModel.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      threadId: { type: DataTypes.BIGINT, allowNull: false, field: 'thread_id' },
      senderUserId: { type: DataTypes.BIGINT, allowNull: false, field: 'sender_user_id' },
      body: { type: DataTypes.TEXT, allowNull: false },
      replyToMessageId: { type: DataTypes.BIGINT, allowNull: true, field: 'reply_to_message_id' },
      forwardedFromMessageId: { type: DataTypes.BIGINT, allowNull: true, field: 'forwarded_from_message_id' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'base_direct_message_messages',
      timestamps: false,
      indexes: [
        { name: 'ix_direct_message_messages_thread_created', fields: ['thread_id', 'created_at'] },
      ],
    },
  );

  DirectMessageParticipantStateModel.init(
    {
      threadId: { type: DataTypes.BIGINT, allowNull: false, field: 'thread_id', primaryKey: true },
      userId: { type: DataTypes.BIGINT, allowNull: false, field: 'user_id', primaryKey: true },
      lastReadMessageId: { type: DataTypes.BIGINT, allowNull: true, field: 'last_read_message_id' },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at', defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'base_direct_message_participant_state',
      timestamps: false,
    },
  );

  DirectMessageAttachmentModel.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      messageId: { type: DataTypes.BIGINT, allowNull: true, field: 'message_id' },
      fileName: { type: DataTypes.STRING(260), allowNull: false, field: 'file_name' },
      mimeType: { type: DataTypes.STRING(120), allowNull: false, field: 'mime_type' },
      sizeBytes: { type: DataTypes.INTEGER, allowNull: false, field: 'size_bytes' },
      storageKey: { type: DataTypes.STRING(500), allowNull: false, field: 'storage_key' },
      uploadedByUserId: { type: DataTypes.BIGINT, allowNull: false, field: 'uploaded_by_user_id' },
      stagedSessionKey: { type: DataTypes.STRING(64), allowNull: true, field: 'staged_session_key' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
    },
    {
      sequelize,
      tableName: 'base_direct_message_attachments',
      timestamps: false,
      indexes: [
        { name: 'ix_direct_message_attachments_message', fields: ['message_id'] },
        { name: 'ix_direct_message_attachments_staged', fields: ['staged_session_key'] },
      ],
    },
  );

  modelsInitialized = true;
};

export const getDirectMessageThreadModel = (): typeof DirectMessageThreadModel => {
  const sequelize = getControlPlaneSequelize();
  initModels(sequelize);
  return DirectMessageThreadModel;
};

export const getDirectMessageMessageModel = (): typeof DirectMessageMessageModel => {
  const sequelize = getControlPlaneSequelize();
  initModels(sequelize);
  return DirectMessageMessageModel;
};

export const getDirectMessageParticipantStateModel = (): typeof DirectMessageParticipantStateModel => {
  const sequelize = getControlPlaneSequelize();
  initModels(sequelize);
  return DirectMessageParticipantStateModel;
};

export const getDirectMessageAttachmentModel = (): typeof DirectMessageAttachmentModel => {
  const sequelize = getControlPlaneSequelize();
  initModels(sequelize);
  return DirectMessageAttachmentModel;
};

export const ensureDirectMessageTables = async (): Promise<void> => {
  const sequelize = getControlPlaneSequelize();
  initModels(sequelize);
  const sync = controlPlaneSequelizeSyncOptions(sequelize);
  await DirectMessageThreadModel.sync(sync);
  await DirectMessageMessageModel.sync(sync);
  await DirectMessageParticipantStateModel.sync(sync);
  await DirectMessageAttachmentModel.sync(sync);
};

export const resetDirectMessageModelsForTests = (): void => {
  modelsInitialized = false;
};
