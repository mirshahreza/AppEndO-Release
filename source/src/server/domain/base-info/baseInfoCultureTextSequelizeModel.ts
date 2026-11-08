import { DataTypes, type Model, type ModelStatic, type Sequelize } from 'sequelize';
import {
  getControlPlaneSequelize,
  controlPlaneSequelizeSyncOptions,
} from '../../db/controlPlaneSequelize';
import { withSqlServerDeadlockRetry } from '../../db/sqlServerDeadlockRetry';

/** SQL-facing materialized display title per culture (mirrors culture translation keys). */
export type BaseInfoCultureTextRow = {
  baseInfoId: string;
  cultureId: string;
  title: string;
};

type BaseInfoCultureTextModel = Model<BaseInfoCultureTextRow, BaseInfoCultureTextRow> & BaseInfoCultureTextRow;

let cachedModel: ModelStatic<BaseInfoCultureTextModel> | null = null;
let ensureTablePromise: Promise<void> | null = null;

export function getBaseInfoCultureTextModel(sequelize: Sequelize): ModelStatic<BaseInfoCultureTextModel> {
  if (cachedModel) {
    return cachedModel;
  }

  cachedModel = sequelize.define<BaseInfoCultureTextModel>(
    'BaseInfoCultureText',
    {
      baseInfoId: {
        type: DataTypes.STRING(64),
        primaryKey: true,
        field: 'base_info_id',
      },
      cultureId: {
        type: DataTypes.STRING(32),
        primaryKey: true,
        field: 'culture_id',
      },
      title: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'title',
      },
    },
    {
      tableName: 'base_info_culture_text',
      timestamps: false,
    },
  );

  return cachedModel;
}

export async function ensureBaseInfoCultureTextTable(): Promise<void> {
  if (!ensureTablePromise) {
    ensureTablePromise = withSqlServerDeadlockRetry(async () => {
      const sequelize = await getControlPlaneSequelize();
      const model = getBaseInfoCultureTextModel(sequelize);
      await model.sync(controlPlaneSequelizeSyncOptions(sequelize));
    }).catch((error: unknown) => {
      ensureTablePromise = null;
      throw error;
    });
  }
  await ensureTablePromise;
}

export async function upsertBaseInfoCultureTextTitles(
  entries: Array<{ baseInfoId: string; cultureId: string; title: string }>,
): Promise<void> {
  const filtered = entries
    .map((entry) => ({
      baseInfoId: entry.baseInfoId.trim(),
      cultureId: entry.cultureId.trim(),
      title: entry.title.trim(),
    }))
    .filter((entry) => entry.baseInfoId && entry.cultureId && entry.title);

  if (filtered.length === 0) {
    return;
  }

  await withSqlServerDeadlockRetry(async () => {
    await ensureBaseInfoCultureTextTable();
    const sequelize = await getControlPlaneSequelize();
    const model = getBaseInfoCultureTextModel(sequelize);

    await sequelize.transaction(async (transaction) => {
      for (const entry of filtered) {
        await model.upsert(entry, { transaction });
      }
    });
  });
}

export async function deleteBaseInfoCultureTextForIds(baseInfoIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(baseInfoIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return;
  }

  await ensureBaseInfoCultureTextTable();
  const sequelize = await getControlPlaneSequelize();
  const model = getBaseInfoCultureTextModel(sequelize);
  await model.destroy({ where: { baseInfoId: uniqueIds } });
}
