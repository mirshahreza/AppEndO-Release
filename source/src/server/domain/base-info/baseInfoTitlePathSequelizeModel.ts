import { DataTypes, type Model, type ModelStatic, type Sequelize } from 'sequelize';
import {
  getControlPlaneSequelize,
  controlPlaneSequelizeSyncOptions,
} from '../../db/controlPlaneSequelize';

export type BaseInfoTitlePathRow = {
  baseInfoId: string;
  cultureId: string;
  titlePath: string;
};

type BaseInfoTitlePathModel = Model<BaseInfoTitlePathRow, BaseInfoTitlePathRow> & BaseInfoTitlePathRow;

let cachedModel: ModelStatic<BaseInfoTitlePathModel> | null = null;

export function getBaseInfoTitlePathModel(sequelize: Sequelize): ModelStatic<BaseInfoTitlePathModel> {
  if (cachedModel) {
    return cachedModel;
  }

  cachedModel = sequelize.define<BaseInfoTitlePathModel>(
    'BaseInfoTitlePath',
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
      titlePath: {
        type: DataTypes.TEXT,
        allowNull: false,
        field: 'title_path',
      },
    },
    {
      tableName: 'base_info_title_path',
      timestamps: false,
    },
  );

  return cachedModel;
}

export async function ensureBaseInfoTitlePathTable(): Promise<void> {
  const sequelize = await getControlPlaneSequelize();
  const model = getBaseInfoTitlePathModel(sequelize);
  await model.sync(controlPlaneSequelizeSyncOptions(sequelize));
}

export async function listBaseInfoTitlePathsForCulture(
  cultureId: string,
  baseInfoIds: string[],
): Promise<Map<string, string>> {
  const uniqueIds = [...new Set(baseInfoIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return new Map();
  }

  const sequelize = await getControlPlaneSequelize();
  const model = getBaseInfoTitlePathModel(sequelize);
  const rows = await model.findAll({
    where: {
      cultureId: cultureId.trim(),
      baseInfoId: uniqueIds,
    },
  });

  return new Map(rows.map((row) => [row.baseInfoId, row.titlePath]));
}

export async function upsertBaseInfoTitlePaths(
  cultureId: string,
  entries: Array<{ baseInfoId: string; titlePath: string }>,
): Promise<void> {
  const normalizedCultureId = cultureId.trim();
  if (!normalizedCultureId || entries.length === 0) {
    return;
  }

  const sequelize = await getControlPlaneSequelize();
  const model = getBaseInfoTitlePathModel(sequelize);

  const normalizedEntries = entries
    .map((entry) => ({
      baseInfoId: entry.baseInfoId.trim(),
      cultureId: normalizedCultureId,
      titlePath: entry.titlePath.trim(),
    }))
    .filter((entry) => entry.baseInfoId && entry.titlePath);

  if (normalizedEntries.length === 0) {
    return;
  }

  const chunkSize = 500;

  for (let offset = 0; offset < normalizedEntries.length; offset += chunkSize) {
    const chunk = normalizedEntries.slice(offset, offset + chunkSize);

    if (sequelize.getDialect() === 'mssql') {
      // Sequelize MERGE (upsert) can block for minutes on this table; UPDATE + conditional INSERT is faster.
      for (const entry of chunk) {
        const [, metadata] = await sequelize.query(
          `UPDATE dbo.base_info_title_path
           SET title_path = :titlePath
           WHERE base_info_id = :baseInfoId AND culture_id = :cultureId;
           IF @@ROWCOUNT = 0
             INSERT INTO dbo.base_info_title_path (base_info_id, culture_id, title_path)
             VALUES (:baseInfoId, :cultureId, :titlePath);`,
          {
            replacements: {
              baseInfoId: entry.baseInfoId,
              cultureId: entry.cultureId,
              titlePath: entry.titlePath,
            },
          },
        );
        void metadata;
      }
      continue;
    }

    await model.bulkCreate(chunk, {
      updateOnDuplicate: ['titlePath'],
    });
  }
}

export async function deleteBaseInfoTitlePathsForIds(baseInfoIds: string[]): Promise<void> {
  const uniqueIds = [...new Set(baseInfoIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return;
  }

  await ensureBaseInfoTitlePathTable();
  const sequelize = await getControlPlaneSequelize();
  const model = getBaseInfoTitlePathModel(sequelize);
  await model.destroy({
    where: { baseInfoId: uniqueIds },
  });
}
