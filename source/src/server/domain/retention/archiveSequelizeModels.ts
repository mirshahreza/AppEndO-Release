import { DataTypes, type Model, type ModelStatic, type Sequelize } from 'sequelize';

export type HotAppLogRow = {
  id: number;
  actor: string;
  callSuccess: number | null;
  failureReason: string | null;
  durationMs: number | null;
  level: string;
  context: string;
  message: string;
  messageSize: number;
  hasMeta: number;
  metaJson: string | null;
  metaSize: number;
  createdAt: Date | null;
  createdBy: number | null;
  updatedAt: Date | null;
  updatedBy: number | null;
};

export type ArchiveAppLogRow = HotAppLogRow & {
  archivedAt: Date;
  archiveJobId: number;
};

export type HotAuthAuditRow = {
  id: number;
  userId: number | null;
  email: string | null;
  eventType: string;
  success: number;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadataJson: string | null;
  createdAt: Date | null;
  createdBy: number | null;
  updatedAt: Date | null;
  updatedBy: number | null;
};

export type ArchiveAuthAuditRow = HotAuthAuditRow & {
  archivedAt: Date;
  archiveJobId: number;
};

export type ArchiveRecordEventRow = {
  id: number;
  subjectKind: string;
  subjectId: string;
  occurredAt: Date;
  actorUserId: number | null;
  actingAsUserId: number | null;
  actorKind: string;
  outcome: string;
  source: string;
  sourceRef: string | null;
  requestId: string | null;
  eventKind: string;
  field: string | null;
  fromValue: string | null;
  toValue: string | null;
  reasonCode: string | null;
  reasonText: string | null;
  correlationId: string;
  subjectSeq: number;
  prevHash: string;
  rowHash: string;
  idempotencyKey: string;
  clientChannel: string | null;
  clientIp: string | null;
  clientTimeZone: string | null;
  clientInstallId: string | null;
  clientJson: string | null;
  payload: string | null;
  archivedAt: Date;
  archiveJobId: number;
};

type HotAppLogModel = Model<HotAppLogRow, Partial<HotAppLogRow>> & HotAppLogRow;
type ArchiveAppLogModel = Model<ArchiveAppLogRow, Partial<ArchiveAppLogRow>> & ArchiveAppLogRow;
type HotAuthAuditModel = Model<HotAuthAuditRow, Partial<HotAuthAuditRow>> & HotAuthAuditRow;
type ArchiveAuthAuditModel = Model<ArchiveAuthAuditRow, Partial<ArchiveAuthAuditRow>> & ArchiveAuthAuditRow;
type ArchiveRecordEventModel = Model<ArchiveRecordEventRow, Partial<ArchiveRecordEventRow>> & ArchiveRecordEventRow;

export type ArchiveUserMessageDispatchRow = {
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
  archivedAt: Date;
  archiveJobId: number;
};

type ArchiveUserMessageDispatchModel = Model<ArchiveUserMessageDispatchRow, Partial<ArchiveUserMessageDispatchRow>> & ArchiveUserMessageDispatchRow;

const hotAppLogModels = new WeakMap<Sequelize, ModelStatic<HotAppLogModel>>();
const archiveAppLogModels = new WeakMap<Sequelize, ModelStatic<ArchiveAppLogModel>>();
const hotAuthAuditModels = new WeakMap<Sequelize, ModelStatic<HotAuthAuditModel>>();
const archiveAuthAuditModels = new WeakMap<Sequelize, ModelStatic<ArchiveAuthAuditModel>>();
const archiveRecordEventModels = new WeakMap<Sequelize, ModelStatic<ArchiveRecordEventModel>>();
const archiveUserMessageDispatchModels = new WeakMap<Sequelize, ModelStatic<ArchiveUserMessageDispatchModel>>();

const appLogAttributes = {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  actor: { type: DataTypes.STRING, allowNull: false, defaultValue: 'SYSTEM' },
  callSuccess: { type: DataTypes.INTEGER, allowNull: true, field: 'call_success' },
  failureReason: { type: DataTypes.TEXT, allowNull: true, field: 'failure_reason' },
  durationMs: { type: DataTypes.INTEGER, allowNull: true, field: 'duration_ms' },
  level: { type: DataTypes.STRING, allowNull: false },
  context: { type: DataTypes.STRING, allowNull: false },
  message: { type: DataTypes.TEXT, allowNull: false },
  messageSize: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'message_size' },
  hasMeta: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'has_meta' },
  metaJson: { type: DataTypes.TEXT, allowNull: true, field: 'meta_json' },
  metaSize: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0, field: 'meta_size' },
  createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
  createdBy: { type: DataTypes.BIGINT, allowNull: true, field: 'created_by' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
  updatedBy: { type: DataTypes.BIGINT, allowNull: true, field: 'updated_by' },
} as const;

const archiveExtra = {
  archivedAt: { type: DataTypes.DATE, allowNull: false, field: 'archived_at' },
  archiveJobId: { type: DataTypes.BIGINT, allowNull: false, field: 'archive_job_id' },
};

const authAuditAttributes = {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  userId: { type: DataTypes.BIGINT, allowNull: true, field: 'user_id' },
  email: { type: DataTypes.STRING, allowNull: true },
  eventType: { type: DataTypes.STRING, allowNull: false, field: 'event_type' },
  success: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
  reason: { type: DataTypes.TEXT, allowNull: true },
  ipAddress: { type: DataTypes.STRING, allowNull: true, field: 'ip_address' },
  userAgent: { type: DataTypes.STRING, allowNull: true, field: 'user_agent' },
  metadataJson: { type: DataTypes.TEXT, allowNull: true, field: 'metadata_json' },
  createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
  createdBy: { type: DataTypes.BIGINT, allowNull: true, field: 'created_by' },
  updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
  updatedBy: { type: DataTypes.BIGINT, allowNull: true, field: 'updated_by' },
} as const;

const userMessageDispatchAttributes = {
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
  createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at' },
} as const;

const recordEventAttributes = {
  id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
  subjectKind: { type: DataTypes.STRING(128), allowNull: false, field: 'subject_kind' },
  subjectId: { type: DataTypes.STRING(64), allowNull: false, field: 'subject_id' },
  occurredAt: { type: DataTypes.DATE, allowNull: false, field: 'occurred_at' },
  actorUserId: { type: DataTypes.BIGINT, allowNull: true, field: 'actor_user_id' },
  actingAsUserId: { type: DataTypes.BIGINT, allowNull: true, field: 'acting_as_user_id' },
  actorKind: { type: DataTypes.STRING(16), allowNull: false, field: 'actor_kind' },
  outcome: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'success' },
  source: { type: DataTypes.STRING(16), allowNull: false },
  sourceRef: { type: DataTypes.STRING(128), allowNull: true, field: 'source_ref' },
  requestId: { type: DataTypes.STRING(64), allowNull: true, field: 'request_id' },
  eventKind: { type: DataTypes.STRING(32), allowNull: false, field: 'event_kind' },
  field: { type: DataTypes.STRING(128), allowNull: true },
  fromValue: { type: DataTypes.TEXT, allowNull: true, field: 'from_value' },
  toValue: { type: DataTypes.TEXT, allowNull: true, field: 'to_value' },
  reasonCode: { type: DataTypes.STRING(64), allowNull: true, field: 'reason_code' },
  reasonText: { type: DataTypes.TEXT, allowNull: true, field: 'reason_text' },
  correlationId: { type: DataTypes.STRING(36), allowNull: false, field: 'correlation_id' },
  subjectSeq: { type: DataTypes.BIGINT, allowNull: false, field: 'subject_seq' },
  prevHash: { type: DataTypes.CHAR(64), allowNull: false, field: 'prev_hash' },
  rowHash: { type: DataTypes.CHAR(64), allowNull: false, field: 'row_hash' },
  idempotencyKey: { type: DataTypes.STRING(128), allowNull: false, field: 'idempotency_key' },
  clientChannel: { type: DataTypes.STRING(16), allowNull: true, field: 'client_channel' },
  clientIp: { type: DataTypes.STRING(64), allowNull: true, field: 'client_ip' },
  clientTimeZone: { type: DataTypes.STRING(64), allowNull: true, field: 'client_time_zone' },
  clientInstallId: { type: DataTypes.STRING(64), allowNull: true, field: 'client_install_id' },
  clientJson: { type: DataTypes.TEXT, allowNull: true, field: 'client_json' },
  payload: { type: DataTypes.TEXT, allowNull: true },
} as const;

export const getHotAppLogModel = (sequelize: Sequelize): ModelStatic<HotAppLogModel> => {
  const cached = hotAppLogModels.get(sequelize);
  if (cached) return cached;
  const model = sequelize.define<HotAppLogModel>('HotAppLog', appLogAttributes, {
    tableName: 'base_logs_app',
    timestamps: false,
  });
  hotAppLogModels.set(sequelize, model);
  return model;
};

export const getArchiveAppLogModel = (sequelize: Sequelize): ModelStatic<ArchiveAppLogModel> => {
  const cached = archiveAppLogModels.get(sequelize);
  if (cached) return cached;
  const model = sequelize.define<ArchiveAppLogModel>('ArchiveAppLog', {
    ...appLogAttributes,
    ...archiveExtra,
  }, {
    tableName: 'base_logs_app',
    timestamps: false,
  });
  archiveAppLogModels.set(sequelize, model);
  return model;
};

export const getHotAuthAuditModel = (sequelize: Sequelize): ModelStatic<HotAuthAuditModel> => {
  const cached = hotAuthAuditModels.get(sequelize);
  if (cached) return cached;
  const model = sequelize.define<HotAuthAuditModel>('HotAuthAuditLog', authAuditAttributes, {
    tableName: 'base_logs_auth_audit',
    timestamps: false,
  });
  hotAuthAuditModels.set(sequelize, model);
  return model;
};

export const getArchiveAuthAuditModel = (sequelize: Sequelize): ModelStatic<ArchiveAuthAuditModel> => {
  const cached = archiveAuthAuditModels.get(sequelize);
  if (cached) return cached;
  const model = sequelize.define<ArchiveAuthAuditModel>('ArchiveAuthAuditLog', {
    ...authAuditAttributes,
    ...archiveExtra,
  }, {
    tableName: 'base_logs_auth_audit',
    timestamps: false,
  });
  archiveAuthAuditModels.set(sequelize, model);
  return model;
};

export const getArchiveUserMessageDispatchModel = (
  sequelize: Sequelize,
): ModelStatic<ArchiveUserMessageDispatchModel> => {
  const cached = archiveUserMessageDispatchModels.get(sequelize);
  if (cached) return cached;
  const model = sequelize.define<ArchiveUserMessageDispatchModel>('ArchiveUserMessageDispatch', {
    ...userMessageDispatchAttributes,
    ...archiveExtra,
  }, {
    tableName: 'base_user_message_dispatches',
    timestamps: false,
  });
  archiveUserMessageDispatchModels.set(sequelize, model);
  return model;
};

export const getArchiveRecordEventModel = (sequelize: Sequelize): ModelStatic<ArchiveRecordEventModel> => {
  const cached = archiveRecordEventModels.get(sequelize);
  if (cached) return cached;
  const model = sequelize.define<ArchiveRecordEventModel>('ArchiveRecordEvent', {
    ...recordEventAttributes,
    ...archiveExtra,
  }, {
    tableName: 'base_record_events',
    timestamps: false,
  });
  archiveRecordEventModels.set(sequelize, model);
  return model;
};

export const ensureHotLogTablesForTests = async (sequelize: Sequelize): Promise<void> => {
  await getHotAppLogModel(sequelize).sync({ force: false });
  await getHotAuthAuditModel(sequelize).sync({ force: false });
};

/** Destination DB only — never call this on the operational control plane. */
export const ensureArchiveTables = async (sequelize: Sequelize): Promise<void> => {
  await getArchiveAppLogModel(sequelize).sync();
  await getArchiveAuthAuditModel(sequelize).sync();
  await getArchiveRecordEventModel(sequelize).sync();
  await getArchiveUserMessageDispatchModel(sequelize).sync();
};
