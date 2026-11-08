import type { config as MssqlConfig } from 'mssql';

import { parseSqlServerHost } from '../../shared/lib/sqlServerAddress';
import { parseSqlServerConnectionUrl } from './sqlServerControlPlaneUrl';

/** node-mssql config for PrismaMssql from a control-plane sqlserver:// URL. */
export const buildMssqlConfigFromControlPlaneUrl = (url: string): MssqlConfig => {
  const parsed = parseSqlServerConnectionUrl(url);
  const { server, instanceName, port: hostPort } = parseSqlServerHost(parsed.host);
  const explicitPort = parsed.port > 0 ? parsed.port : null;
  const effectivePort = explicitPort ?? hostPort;
  const hasExplicitPort = explicitPort !== null && !instanceName;

  return {
    server,
    ...(hasExplicitPort ? { port: effectivePort ?? undefined } : {}),
    database: parsed.database,
    user: parsed.username,
    password: parsed.password,
    // SQL Server instances with DelayedAutoStart can exceed the node-mssql default 15s on cold connect.
    connectionTimeout: 60_000,
    requestTimeout: 60_000,
    options: {
      encrypt: parsed.encrypt,
      trustServerCertificate: parsed.trustServerCertificate,
      connectTimeout: 60_000,
      requestTimeout: 60_000,
      ...(instanceName && !hasExplicitPort ? { instanceName } : {}),
    },
    pool: {
      max: Math.max(1, Number(process.env.APPENDO_MSSQL_POOL_MAX ?? 10) || 10),
      min: 0,
      idleTimeoutMillis: 30_000,
      acquireTimeoutMillis: Math.max(
        60_000,
        Number(process.env.APPENDO_MSSQL_POOL_ACQUIRE_MS ?? 60_000) || 60_000,
      ),
    },
  };
};
