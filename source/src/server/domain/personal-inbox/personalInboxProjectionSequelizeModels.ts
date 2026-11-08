import { DataTypes, type Model, type ModelStatic, type Sequelize } from 'sequelize';
import { getControlPlaneSequelize, controlPlaneSequelizeSyncOptions } from '../../db/controlPlaneSequelize';

export type PersonalInboxProjectionItemRow = {
  id: number;
  userId: number;
  itemKey: string;
  kind: string;
  origin: string;
  originDetail: string | null;
  title: string;
  summary: string | null;
  surfacedAt: Date;
  attention: string;
  href: string;
  refType: string;
  refId: number;
  createdAt: Date;
  updatedAt: Date;
};

export type PersonalInboxProjectionItemModel = Model<
  PersonalInboxProjectionItemRow,
  Partial<PersonalInboxProjectionItemRow>
> & PersonalInboxProjectionItemRow;

export type PersonalInboxProjectionMetaRow = {
  userId: number;
  refreshedAt: Date | null;
  itemCount: number;
  updatedAt: Date;
};

export type PersonalInboxProjectionMetaModel = Model<
  PersonalInboxProjectionMetaRow,
  Partial<PersonalInboxProjectionMetaRow>
> & PersonalInboxProjectionMetaRow;

let cachedItemModel: ModelStatic<PersonalInboxProjectionItemModel> | null = null;
let cachedMetaModel: ModelStatic<PersonalInboxProjectionMetaModel> | null = null;
let testSequelize: Sequelize | null = null;

export const configurePersonalInboxProjectionSequelizeForTests = (sequelize: Sequelize | null): void => {
  testSequelize = sequelize;
  cachedItemModel = null;
  cachedMetaModel = null;
};

const resolveSequelize = (sequelize?: Sequelize): Sequelize =>
  sequelize ?? testSequelize ?? getControlPlaneSequelize();

export const getPersonalInboxProjectionItemModel = (
  sequelize?: Sequelize,
): ModelStatic<PersonalInboxProjectionItemModel> => {
  const db = resolveSequelize(sequelize);
  if (cachedItemModel && cachedItemModel.sequelize === db) {
    return cachedItemModel;
  }
  cachedItemModel = db.define<PersonalInboxProjectionItemModel>(
    'BasePersonalInboxProjectionItem',
    {
      id: { type: DataTypes.BIGINT, primaryKey: true, autoIncrement: true },
      userId: { type: DataTypes.BIGINT, allowNull: false, field: 'user_id' },
      itemKey: { type: DataTypes.STRING(128), allowNull: false, field: 'item_key' },
      kind: { type: DataTypes.STRING(16), allowNull: false },
      origin: { type: DataTypes.STRING(64), allowNull: false },
      originDetail: { type: DataTypes.STRING(256), allowNull: true, field: 'origin_detail' },
      title: { type: DataTypes.STRING(500), allowNull: false },
      summary: { type: DataTypes.TEXT, allowNull: true },
      surfacedAt: { type: DataTypes.DATE, allowNull: false, field: 'surfaced_at' },
      attention: { type: DataTypes.STRING(24), allowNull: false },
      href: { type: DataTypes.STRING(2048), allowNull: false },
      refType: { type: DataTypes.STRING(24), allowNull: false, field: 'ref_type' },
      refId: { type: DataTypes.BIGINT, allowNull: false, field: 'ref_id' },
      createdAt: { type: DataTypes.DATE, allowNull: false, field: 'created_at', defaultValue: DataTypes.NOW },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at', defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'base_personal_inbox_projection_items',
      timestamps: false,
      indexes: [
        {
          unique: true,
          name: 'uq_personal_inbox_projection_user_item',
          fields: ['user_id', 'item_key'],
        },
        { name: 'ix_personal_inbox_projection_user_surfaced', fields: ['user_id', 'surfaced_at'] },
        { name: 'ix_personal_inbox_projection_user_kind', fields: ['user_id', 'kind'] },
      ],
    },
  );
  return cachedItemModel;
};

export const getPersonalInboxProjectionMetaModel = (
  sequelize?: Sequelize,
): ModelStatic<PersonalInboxProjectionMetaModel> => {
  const db = resolveSequelize(sequelize);
  if (cachedMetaModel && cachedMetaModel.sequelize === db) {
    return cachedMetaModel;
  }
  cachedMetaModel = db.define<PersonalInboxProjectionMetaModel>(
    'BasePersonalInboxProjectionMeta',
    {
      userId: { type: DataTypes.BIGINT, primaryKey: true, field: 'user_id' },
      refreshedAt: { type: DataTypes.DATE, allowNull: true, field: 'refreshed_at' },
      itemCount: { type: DataTypes.INTEGER, allowNull: false, field: 'item_count', defaultValue: 0 },
      updatedAt: { type: DataTypes.DATE, allowNull: false, field: 'updated_at', defaultValue: DataTypes.NOW },
    },
    {
      tableName: 'base_personal_inbox_projection_meta',
      timestamps: false,
    },
  );
  return cachedMetaModel;
};

export const resetPersonalInboxProjectionModelCacheForTests = (): void => {
  cachedItemModel = null;
  cachedMetaModel = null;
};

export const ensurePersonalInboxProjectionTables = async (sequelize?: Sequelize): Promise<void> => {
  const db = resolveSequelize(sequelize);
  await getPersonalInboxProjectionItemModel(db).sync(controlPlaneSequelizeSyncOptions(db));
  await getPersonalInboxProjectionMetaModel(db).sync(controlPlaneSequelizeSyncOptions(db));
};
