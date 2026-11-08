import type { MouseEvent } from 'react';
import {
  DataSourceType,
  type DataSourceFormState,
  type DataSourceRecord,
  type SaveDataSourcePayload,
} from '../../shared/api/contracts/data-sources/types';
import { formatDisplayDateYmd } from '../../shared/lib/gridDateFormat';
import { parseSqlServerAddress } from '../../shared/lib/sqlServerAddress';
import { DEFAULT_FORM } from './constants';

export const getReadableErrorMessage = (error: unknown, fallback: string) => {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Connectivity test timed out. Please check server availability and try again.';
  }

  if (error instanceof Error) {
    if (error.message.toLowerCase().includes('failed to fetch')) {
      return 'Could not reach API server for connectivity test.';
    }
    return error.message || fallback;
  }

  return fallback;
};

export const getDefaultFormByType = (type: DataSourceType): DataSourceFormState => {
  if (type === DataSourceType.SQLITE) {
    return { ...DEFAULT_FORM, type };
  }

  if (type === DataSourceType.MYSQL) {
    return { ...DEFAULT_FORM, type, host: 'localhost', port: 3306, database: '' };
  }

  if (type === DataSourceType.POSTGRES) {
    return { ...DEFAULT_FORM, type, host: 'localhost', port: 5433, database: 'AppEnd' };
  }

  if (type === DataSourceType.ORACLE) {
    return { ...DEFAULT_FORM, type, host: 'localhost', port: 1521, database: '' };
  }

  if (type === DataSourceType.SQL_SERVER) {
    return { ...DEFAULT_FORM, type, host: 'localhost', port: 1433, database: 'AppEnd' };
  }

  if (type === DataSourceType.OLAP_BRIDGE) {
    return { ...DEFAULT_FORM, type, host: 'http://localhost', port: 8080, database: '', username: '', password: '', optionsJson: '{\n  "catalog": "",\n  "cube": "",\n  "language": "MDX"\n}' };
  }

  if (type === DataSourceType.MONGODB_ANALYTICS) {
    return { ...DEFAULT_FORM, type, host: 'localhost', port: 27017, database: '', optionsJson: '{\n  "collection": ""\n}' };
  }

  if (type === DataSourceType.ELASTICSEARCH_ANALYTICS) {
    return { ...DEFAULT_FORM, type, host: 'http://localhost', port: 9200, database: '', optionsJson: '{\n  "index": ""\n}' };
  }

  return { ...DEFAULT_FORM, type };
};

const toSqlBool = (value: boolean) => (value ? 'Yes' : 'No');
const toPoolBool = (value: boolean) => (value ? 'True' : 'False');

export { parseSqlServerAddress };

export const formatGridDate = (value?: string) => formatDisplayDateYmd(value);

/** Card enrichment date: `YYYY-MM-DD` from an ISO timestamp. */
export const formatEnrichedAtDate = (value?: string | null): string => {
  if (!value?.trim()) return '';
  return formatDisplayDateYmd(value, '');
};

export const formatCardDateTime = (value?: string, emptyValue = '-') => formatDisplayDateYmd(value, emptyValue);

export const formatDataSourceActorLabel = (
  actor?: string | null,
  emptyValue = '-',
) => actor?.trim() || emptyValue;

export const getConnectionLabel = (item: Pick<DataSourceRecord, 'type' | 'host' | 'port' | 'database'>) => {
  if (item.type === DataSourceType.SQLITE) {
    return item.database || 'database.sqlite';
  }
  return Number(item.port || 0) > 0
    ? `${item.host || '-'}:${item.port}`
    : (item.host || '-');
};

export const buildConnectionStringPreview = (form: DataSourceFormState) => {
  const host = form.host?.trim() || 'localhost';
  const port = Number(form.port || 0);
  const database = form.database?.trim() || '';
  const username = form.username?.trim() || '';
  const password = form.password || '';

  if (form.type === DataSourceType.SQLITE) {
    return `Data Source=${database || 'database.sqlite'};`;
  }

  if (form.type === DataSourceType.POSTGRES) {
    return `Host=${host};Port=${port || 5432};Database=${database};Username=${username};Password=${password};`;
  }

  if (form.type === DataSourceType.MYSQL) {
    return `Server=${host};Port=${port || 3306};Database=${database};Uid=${username};Pwd=${password};`;
  }

  if (form.type === DataSourceType.ORACLE) {
    return `Data Source=(DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=${host})(PORT=${port || 1521}))(CONNECT_DATA=(SERVICE_NAME=${database})));User Id=${username};Password=${password};`;
  }

  if (form.type === DataSourceType.SQL_SERVER) {
    const hasExplicitPort = host.includes(',');
    const hasInstance = host.includes('\\');
    const dataSource = hasExplicitPort || hasInstance ? host : `${host},1433`;
    return `Data Source=${dataSource};Initial Catalog=${database};Persist Security Info=True;User ID=${username};Password=${password};Encrypt=${toSqlBool(Boolean(form.encrypt))};TrustServerCertificate=${toSqlBool(Boolean(form.trustServerCertificate))};Pooling=${toPoolBool(Boolean(form.pooling))};`;
  }

  return '';
};

export const formToEditState = (item: DataSourceRecord): DataSourceFormState => {
  if (item.type === DataSourceType.SQL_SERVER) {
    const hostHasPort = (item.host || '').includes(',');
    const parsed = parseSqlServerAddress(item.host || 'localhost', Number(item.port || 0));

    return {
      name: item.name || '',
      type: item.type,
      host: hostHasPort ? parsed.host : (item.host || 'localhost'),
      port: hostHasPort ? parsed.port : Number(item.port || 0),
      database: item.database || '',
      username: item.username || '',
      password: '',
      encrypt: item.encrypt ?? true,
      trustServerCertificate: item.trustServerCertificate ?? true,
      pooling: item.pooling ?? false,
      optionsJson: item.options && Object.keys(item.options).length > 0
        ? JSON.stringify(item.options, null, 2)
        : '',
    };
  }

  return {
    name: item.name || '',
    type: item.type,
    host: item.host || 'localhost',
    port: Number(item.port || 0),
    database: item.database || '',
    username: item.username || '',
    password: '',
    encrypt: item.encrypt ?? true,
    trustServerCertificate: item.trustServerCertificate ?? true,
    pooling: item.pooling ?? false,
    optionsJson: item.options && Object.keys(item.options).length > 0
      ? JSON.stringify(item.options, null, 2)
      : '',
  };
};

export const parseFormOptionsJson = (raw: string): Record<string, unknown> | undefined => {
  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

export const buildSavePayload = (
  form: DataSourceFormState,
): SaveDataSourcePayload => {
  const isSqlite = form.type === DataSourceType.SQLITE;
  const isSqlServer = form.type === DataSourceType.SQL_SERVER;
  const parsedSqlServerAddress = isSqlServer
    ? parseSqlServerAddress(form.host, Number(form.port || 0))
    : null;
  const options = parseFormOptionsJson(form.optionsJson);

  return {
    name: form.name.trim(),
    type: form.type,
    host: isSqlite ? 'localhost' : (isSqlServer ? parsedSqlServerAddress?.host ?? form.host : form.host),
    port: isSqlite ? 0 : (isSqlServer ? parsedSqlServerAddress?.port ?? 0 : Number(form.port || 0)),
    database: form.database || null,
    username: isSqlite ? '' : form.username,
    password: isSqlite ? '' : form.password,
    encrypt: isSqlServer ? form.encrypt : undefined,
    trustServerCertificate: isSqlServer ? form.trustServerCertificate : undefined,
    pooling: isSqlServer ? form.pooling : undefined,
    options,
  };
};

export const buildTestDraftPayload = (form: DataSourceFormState) => {
  const isSqlite = form.type === DataSourceType.SQLITE;
  const isSqlServer = form.type === DataSourceType.SQL_SERVER;
  const parsedSqlServerAddress = isSqlServer
    ? parseSqlServerAddress(form.host, Number(form.port || 0))
    : null;

  return {
    type: form.type,
    host: isSqlite ? 'localhost' : (isSqlServer ? parsedSqlServerAddress?.host ?? form.host : form.host),
    port: isSqlite ? 0 : (isSqlServer ? parsedSqlServerAddress?.port ?? 0 : Number(form.port || 0)),
    database: form.database || null,
    username: isSqlite ? '' : form.username,
    password: isSqlite ? '' : form.password,
    encrypt: isSqlServer ? Boolean(form.encrypt) : undefined,
    trustServerCertificate: isSqlServer ? Boolean(form.trustServerCertificate) : undefined,
    pooling: isSqlServer ? Boolean(form.pooling) : undefined,
    options: parseFormOptionsJson(form.optionsJson),
  };
};

export const getMutationError = (
  data: { success?: boolean; error?: string },
  fallback: string,
): string | null => {
  if (data.success) {
    return null;
  }
  return typeof data.error === 'string' ? data.error : fallback;
};

export const stopButtonEvent = (event: MouseEvent<HTMLButtonElement>) => {
  event.preventDefault();
  event.stopPropagation();
};
