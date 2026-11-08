import { Sequelize } from 'sequelize';
import { hydrateDataSourcePassword } from '../../config/dataSourceSecrets';
import { SETTINGS_PATH } from '../../config/settingsFile';
import { readControlPlaneDatabaseSettings } from '../../db/controlPlaneDatabase';
import { getDataSourcesFromSettings, type StoredDataSource } from '../../db/dataSourcesStore';
import { buildSequelizeOptions } from '../../services/data-api/sequelize/dialectConfig';
import { HttpError } from '../../errors/HttpError';
import { controlPlaneProviderToDataSourceType } from '../../../shared/api/contracts/install/controlPlaneProviders';
import { ensureArchiveTables } from './archiveSequelizeModels';

const cache = new Map<string, Sequelize>();

const LOG_ARCHIVE_PURPOSE = 'log-archive';

export const archiveDataSourceTypeForProvider = (provider: string): string | undefined => {
  if (provider === 'sqlite') return 'SQLite';
  return controlPlaneProviderToDataSourceType(provider as 'postgresql' | 'sqlserver' | 'mysql' | 'sqlite');
};

const isLogArchivePurpose = (source: StoredDataSource): boolean => (
  String(source.options?.purpose ?? '').trim() === LOG_ARCHIVE_PURPOSE
);

export const listLogArchiveDestinations = (): Array<{
  id: string;
  name: string;
  type: string;
}> => {
  const sources = getDataSourcesFromSettings(SETTINGS_PATH);
  const expectedType = archiveDataSourceTypeForProvider(
    readControlPlaneDatabaseSettings(SETTINGS_PATH).provider,
  );
  const eligible = sources.filter((source) => {
    if (source.isDefault) return false;
    if (expectedType && source.type !== expectedType) return false;
    return true;
  });
  const purposeful = eligible.filter(isLogArchivePurpose);
  return purposeful.map((source) => ({
    id: source.id,
    name: source.name,
    type: source.type,
  }));
};

export const resolveLogArchiveDataSource = (connectionId: string | undefined): StoredDataSource => {
  const id = String(connectionId ?? '').trim();
  if (!id) {
    throw new HttpError(400, 'Archive destination is not configured.');
  }
  const source = getDataSourcesFromSettings(SETTINGS_PATH).find((item) => item.id === id);
  if (!source) {
    throw new HttpError(400, 'Archive destination was not found.');
  }
  if (source.isDefault) {
    throw new HttpError(400, 'Archive destination cannot be the operational control-plane database.');
  }
  const expectedType = archiveDataSourceTypeForProvider(
    readControlPlaneDatabaseSettings(SETTINGS_PATH).provider,
  );
  if (expectedType && source.type !== expectedType) {
    throw new HttpError(400, 'Archive destination must match the install dialect.');
  }
  if (!isLogArchivePurpose(source)) {
    throw new HttpError(400, 'Archive destination must have purpose log-archive.');
  }
  return source;
};

export async function authenticateArchiveDestination(connectionId: string): Promise<void> {
  const source = resolveLogArchiveDataSource(connectionId);
  const hydrated = hydrateDataSourcePassword(source);
  const sequelize = new Sequelize({
    ...buildSequelizeOptions(hydrated),
    logging: false,
  });
  try {
    await sequelize.authenticate();
  } finally {
    await sequelize.close();
  }
}

export async function openArchiveSequelize(connectionId: string | undefined): Promise<Sequelize> {
  const source = resolveLogArchiveDataSource(connectionId);
  const existing = cache.get(source.id);
  if (existing) {
    await existing.authenticate();
    await ensureArchiveTables(existing);
    return existing;
  }
  const hydrated = hydrateDataSourcePassword(source);
  const sequelize = new Sequelize({
    ...buildSequelizeOptions(hydrated),
    logging: false,
  });
  await sequelize.authenticate();
  await ensureArchiveTables(sequelize);
  cache.set(source.id, sequelize);
  return sequelize;
}

export async function closeArchiveSequelizeCache(): Promise<void> {
  for (const sequelize of cache.values()) {
    await sequelize.close().catch(() => undefined);
  }
  cache.clear();
}
