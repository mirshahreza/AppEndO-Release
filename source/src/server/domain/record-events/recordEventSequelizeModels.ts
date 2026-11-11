import { DataTypes, type Model, type ModelStatic, type Sequelize, type Transaction } from 'sequelize';
import { getControlPlaneSequelize, controlPlaneSequelizeSyncOptions } from '../../db/controlPlaneSequelize';

export type RecordEventRow = {
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
};

export type RecordEventModel = Model<RecordEventRow, Partial<RecordEventRow>> & RecordEventRow;

export type RecordEventHoldRow = {
  subjectKind: string;
  subjectId: string;
  heldAt: Date;
  heldBy: number | null;
  reasonText: string | null;
};

export type RecordEventHoldModel = Model<RecordEventHoldRow, Partial<RecordEventHoldRow>> & RecordEventHoldRow;

let cachedEventModel: ModelStatic<RecordEventModel> | null = null;
let cachedHoldModel: ModelStatic<RecordEventHoldModel> | null = null;
let testSequelize: Sequelize | null = null;

export const configureRecordEventSequelizeForTests = (sequelize: Sequelize | null): void => {
  testSequelize = sequelize;
  cachedEventModel = null;
  cachedHoldModel = null;
};

const resolveSequelize = (sequelize?: Sequelize): Sequelize =>
  sequelize ?? testSequelize ?? getControlPlaneSequelize();

export const getRecordEventModel = (
  sequelize?: Sequelize,
): ModelStatic<RecordEventModel> => {
  const db = resolveSequelize(sequelize);
  if (cachedEventModel && cachedEventModel.sequelize === db) {
    return cachedEventModel;
  }
  cachedEventModel = db.define<RecordEventModel>(
    'BaseRecordEvent',
    {
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
    },
    {
      tableName: 'base_record_events',
      timestamps: false,
      indexes: [
        { name: 'ix_record_events_subject_occurred', fields: ['subject_kind', 'subject_id', 'occurred_at'] },
        { unique: true, name: 'uq_record_events_subject_seq', fields: ['subject_kind', 'subject_id', 'subject_seq'] },
        { name: 'ix_record_events_actor_occurred', fields: ['actor_user_id', 'occurred_at'] },
        { name: 'ix_record_events_acting_as_occurred', fields: ['acting_as_user_id', 'occurred_at'] },
        { name: 'ix_record_events_correlation', fields: ['correlation_id'] },
        { name: 'ix_record_events_occurred', fields: ['occurred_at'] },
        { name: 'ix_record_events_request', fields: ['request_id'] },
        { name: 'ix_record_events_channel_occurred', fields: ['client_channel', 'occurred_at'] },
        { name: 'ix_record_events_install_occurred', fields: ['client_install_id', 'occurred_at'] },
        { unique: true, name: 'uq_record_events_idempotency', fields: ['idempotency_key'] },
      ],
    },
  );
  return cachedEventModel;
};

export const getRecordEventHoldModel = (
  sequelize?: Sequelize,
): ModelStatic<RecordEventHoldModel> => {
  const db = resolveSequelize(sequelize);
  if (cachedHoldModel && cachedHoldModel.sequelize === db) {
    return cachedHoldModel;
  }
  cachedHoldModel = db.define<RecordEventHoldModel>(
    'BaseRecordEventHold',
    {
      subjectKind: { type: DataTypes.STRING(128), primaryKey: true, field: 'subject_kind' },
      subjectId: { type: DataTypes.STRING(64), primaryKey: true, field: 'subject_id' },
      heldAt: { type: DataTypes.DATE, allowNull: false, field: 'held_at' },
      heldBy: { type: DataTypes.BIGINT, allowNull: true, field: 'held_by' },
      reasonText: { type: DataTypes.TEXT, allowNull: true, field: 'reason_text' },
    },
    {
      tableName: 'base_record_event_holds',
      timestamps: false,
    },
  );
  return cachedHoldModel;
};

export const resetRecordEventModelCacheForTests = (): void => {
  cachedEventModel = null;
  cachedHoldModel = null;
};

export const ensureRecordEventTables = async (
  sequelize?: Sequelize,
): Promise<void> => {
  if (process.env.HWY_ETL_RECORD_EVENTS_INDEXES_DROPPED === '1') {
    return;
  }
  const db = resolveSequelize(sequelize);
  const syncOptions = controlPlaneSequelizeSyncOptions(db);
  await getRecordEventModel(db).sync(syncOptions);
  await getRecordEventHoldModel(db).sync(syncOptions);
};

export type RecordEventTransaction = Transaction;
