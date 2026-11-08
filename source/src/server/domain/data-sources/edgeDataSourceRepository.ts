import type { Sequelize } from 'sequelize';
import { getControlPlaneSequelize } from '../../db/controlPlaneSequelize';
import { deleteSecretsForOwner, getSecret, setSecret } from '../security/credentialVault/credentialVault';
import {
  getEdgeDataSourceModel,
  type EdgeDataSourceRow,
} from './edgeDataSourceSequelizeModel';

export const DATA_SOURCE_VAULT_OWNER_TYPE = 'data_source';
export const DATA_SOURCE_VAULT_PASSWORD_PURPOSE = 'password';

let sequelizeForTests: Sequelize | null = null;

export const configureEdgeDataSourceSequelizeForTests = (sequelize: Sequelize | null): void => {
  sequelizeForTests = sequelize;
};

const resolveSequelize = (): Sequelize => sequelizeForTests ?? getControlPlaneSequelize();

const toIso = (value: Date | string | null | undefined, fallback: string): string => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }
  if (typeof value === 'string' && value.trim()) {
    return value;
  }
  return fallback;
};

export type HydratedEdgeDataSource = EdgeDataSourceRow & {
  password: string;
  created_at: string;
  created_by: string | null;
  updated_at: string;
  updated_by: string | null;
};

const toHydrated = async (row: EdgeDataSourceRow): Promise<HydratedEdgeDataSource> => {
  const password = await getSecret(
    DATA_SOURCE_VAULT_OWNER_TYPE,
    row.id,
    DATA_SOURCE_VAULT_PASSWORD_PURPOSE,
  ) ?? '';
  const createdAt = toIso(row.createdAt, new Date().toISOString());
  return {
    ...row,
    password,
    created_at: createdAt,
    created_by: row.createdBy,
    updated_at: toIso(row.updatedAt, ''),
    updated_by: row.updatedBy,
  };
};

export type EdgeDataSourceWriteInput = {
  id: string;
  name: string;
  type: string;
  host: string;
  port: number;
  database?: string;
  username?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  pooling?: boolean;
  options?: Record<string, unknown>;
  status: string;
  created_at: string;
  created_by?: string | null;
  updated_at: string;
  updated_by?: string | null;
};

export async function listHydratedEdgeDataSources(): Promise<HydratedEdgeDataSource[]> {
  const model = getEdgeDataSourceModel(resolveSequelize());
  const rows = await model.findAll({ order: [['created_at', 'ASC']] });
  const hydrated: HydratedEdgeDataSource[] = [];
  for (const row of rows) {
    hydrated.push(await toHydrated(row.get({ plain: true })));
  }
  return hydrated;
}

export async function upsertEdgeDataSource(
  input: EdgeDataSourceWriteInput,
  passwordUpdate?: string,
): Promise<void> {
  const model = getEdgeDataSourceModel(resolveSequelize());
  const createdAt = new Date(input.created_at);
  const updatedAt = input.updated_at ? new Date(input.updated_at) : null;
  await model.upsert({
    id: input.id,
    name: input.name,
    type: input.type,
    host: input.host,
    port: input.port,
    database: input.database?.trim() ? input.database : null,
    username: input.username?.trim() ? input.username : null,
    encrypt: input.encrypt !== false,
    trustServerCertificate: input.trustServerCertificate !== false,
    pooling: input.pooling !== false,
    optionsJson: input.options && Object.keys(input.options).length > 0
      ? JSON.stringify(input.options)
      : null,
    status: input.status,
    createdAt: Number.isNaN(createdAt.getTime()) ? new Date() : createdAt,
    createdBy: input.created_by ?? null,
    updatedAt: updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt : null,
    updatedBy: input.updated_by ?? null,
  });

  const secret = passwordUpdate?.trim() ?? '';
  if (secret) {
    await setSecret(
      DATA_SOURCE_VAULT_OWNER_TYPE,
      input.id,
      DATA_SOURCE_VAULT_PASSWORD_PURPOSE,
      secret,
    );
  }
}

export async function deleteEdgeDataSource(id: string): Promise<void> {
  const model = getEdgeDataSourceModel(resolveSequelize());
  await model.destroy({ where: { id } });
  await deleteSecretsForOwner(DATA_SOURCE_VAULT_OWNER_TYPE, id);
}
