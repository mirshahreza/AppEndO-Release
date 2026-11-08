import { DataTypes, type Model, type ModelStatic, type Sequelize } from 'sequelize';
import { getControlPlaneSequelize, controlPlaneSequelizeSyncOptions } from '../../db/controlPlaneSequelize';

export type DashboardWidgetCommentRow = {
  id: number;
  pageId: string;
  widgetNodeId: string;
  authorId: number;
  body: string;
  createdAt: Date | null;
};

export type DashboardPageAccessRow = {
  pageId: string;
  accessControl: string | null;
  accessPermission: string;
  ownerUserId: number;
  embedAllowedOrigins: string | null;
  createdAt: Date | null;
  createdBy: number | null;
  updatedAt: Date | null;
  updatedBy: number | null;
};

export type DashboardSnapshotRow = {
  id: string;
  pageId: string;
  renderedPayload: string;
  createdBy: number;
  createdAt: Date | null;
  expiresAt: Date | null;
};

type CommentModel = Model<DashboardWidgetCommentRow, Partial<DashboardWidgetCommentRow>> & DashboardWidgetCommentRow;
type AccessModel = Model<DashboardPageAccessRow, Partial<DashboardPageAccessRow>> & DashboardPageAccessRow;
type SnapshotModel = Model<DashboardSnapshotRow, Partial<DashboardSnapshotRow>> & DashboardSnapshotRow;

let commentModel: ModelStatic<CommentModel> | null = null;
let accessModel: ModelStatic<AccessModel> | null = null;
let snapshotModel: ModelStatic<SnapshotModel> | null = null;

export const getDashboardWidgetCommentModel = (
  sequelize: Sequelize = getControlPlaneSequelize(),
): ModelStatic<CommentModel> => {
  if (commentModel && commentModel.sequelize === sequelize) {
    return commentModel;
  }
  commentModel = sequelize.define<CommentModel>(
    'BaseDashboardWidgetComment',
    {
      id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
      pageId: { type: DataTypes.STRING(128), allowNull: false, field: 'page_id' },
      widgetNodeId: { type: DataTypes.STRING(128), allowNull: false, field: 'widget_node_id' },
      authorId: { type: DataTypes.BIGINT, allowNull: false, field: 'author_id' },
      body: { type: DataTypes.TEXT, allowNull: false },
      createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
    },
    {
      tableName: 'base_dashboard_widget_comments',
      timestamps: false,
      indexes: [
        {
          name: 'ix_dash_widget_comments_thread',
          fields: ['page_id', 'widget_node_id', 'created_at'],
        },
      ],
    },
  );
  return commentModel;
};

export const getDashboardPageAccessModel = (
  sequelize: Sequelize = getControlPlaneSequelize(),
): ModelStatic<AccessModel> => {
  if (accessModel && accessModel.sequelize === sequelize) {
    return accessModel;
  }
  accessModel = sequelize.define<AccessModel>(
    'BaseDashboardPageAccess',
    {
      pageId: { type: DataTypes.STRING(128), primaryKey: true, field: 'page_id' },
      accessControl: { type: DataTypes.TEXT, allowNull: true, field: 'access_control' },
      accessPermission: { type: DataTypes.STRING(16), allowNull: false, defaultValue: 'view', field: 'access_permission' },
      ownerUserId: { type: DataTypes.BIGINT, allowNull: false, defaultValue: 0, field: 'owner_user_id' },
      embedAllowedOrigins: { type: DataTypes.TEXT, allowNull: true, field: 'embed_allowed_origins' },
      createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
      createdBy: { type: DataTypes.BIGINT, allowNull: true, field: 'created_by' },
      updatedAt: { type: DataTypes.DATE, allowNull: true, field: 'updated_at' },
      updatedBy: { type: DataTypes.BIGINT, allowNull: true, field: 'updated_by' },
    },
    { tableName: 'base_dashboard_page_access', timestamps: false },
  );
  return accessModel;
};

export const getDashboardSnapshotModel = (
  sequelize: Sequelize = getControlPlaneSequelize(),
): ModelStatic<SnapshotModel> => {
  if (snapshotModel && snapshotModel.sequelize === sequelize) {
    return snapshotModel;
  }
  snapshotModel = sequelize.define<SnapshotModel>(
    'BaseDashboardSnapshot',
    {
      id: { type: DataTypes.STRING(36), primaryKey: true },
      pageId: { type: DataTypes.STRING(128), allowNull: false, field: 'page_id' },
      renderedPayload: { type: DataTypes.TEXT('long'), allowNull: false, field: 'rendered_payload' },
      createdBy: { type: DataTypes.BIGINT, allowNull: false, field: 'created_by' },
      createdAt: { type: DataTypes.DATE, allowNull: true, field: 'created_at' },
      expiresAt: { type: DataTypes.DATE, allowNull: true, field: 'expires_at' },
    },
    { tableName: 'base_dashboard_snapshots', timestamps: false },
  );
  return snapshotModel;
};

const LEGACY_WIDGET_COMMENT_INDEX =
  'base_dashboard_widget_comments_page_id_widget_node_id_created_a';
const WIDGET_COMMENT_TABLE = 'base_dashboard_widget_comments';

/** SQL Server requires `DROP INDEX name ON table`; Postgres/SQLite accept `DROP INDEX IF EXISTS name`. */
export const dropLegacyDashboardWidgetCommentIndexSql = (dialect: string): string | null => {
  switch (dialect) {
    case 'mssql':
      return `
IF OBJECT_ID(N'[${WIDGET_COMMENT_TABLE}]', N'U') IS NOT NULL
AND EXISTS (
  SELECT 1
  FROM sys.indexes i
  INNER JOIN sys.tables t ON i.object_id = t.object_id
  WHERE i.name = N'${LEGACY_WIDGET_COMMENT_INDEX}'
    AND t.name = N'${WIDGET_COMMENT_TABLE}'
)
DROP INDEX [${LEGACY_WIDGET_COMMENT_INDEX}] ON [${WIDGET_COMMENT_TABLE}];
`;
    case 'mysql':
      return `ALTER TABLE \`${WIDGET_COMMENT_TABLE}\` DROP INDEX \`${LEGACY_WIDGET_COMMENT_INDEX}\``;
    default:
      return `DROP INDEX IF EXISTS "${LEGACY_WIDGET_COMMENT_INDEX}"`;
  }
};

export const ensureDashboardCanvasTables = async (
  sequelize: Sequelize = getControlPlaneSequelize(),
): Promise<void> => {
  const dropSql = dropLegacyDashboardWidgetCommentIndexSql(sequelize.getDialect());
  if (dropSql) {
    try {
      await sequelize.query(dropSql);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/unknown key|check that column\/key exists|doesn't exist/i.test(message)) {
        throw error;
      }
    }
  }
  await getDashboardWidgetCommentModel(sequelize).sync(controlPlaneSequelizeSyncOptions(sequelize));
  await getDashboardPageAccessModel(sequelize).sync(controlPlaneSequelizeSyncOptions(sequelize));
  await getDashboardSnapshotModel(sequelize).sync(controlPlaneSequelizeSyncOptions(sequelize));
};
