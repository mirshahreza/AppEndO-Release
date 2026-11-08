import net from 'net';
import * as mssql from 'mssql';
import { parseSqlServerHost } from '../../shared/lib/sqlServerAddress';
import {
  applyDirectTcpPortToSqlServerConfig,
  isLikelyLocalSqlHost,
  resolveLocalSqlInstancePortFromRegistry,
} from '../../core/database/sqlServerLocalInstancePort';
import {
  DATA_SOURCE_TYPE_ELASTICSEARCH_ANALYTICS,
  DATA_SOURCE_TYPE_MONGODB_ANALYTICS,
  DATA_SOURCE_TYPE_OLAP_BRIDGE,
} from '../../shared/api/contracts/data-sources/analyticsOptions';

const sqlServerClient = ((mssql as any)?.default ?? mssql) as typeof mssql;

const parseBooleanLike = (value: unknown, fallback: boolean): boolean => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  }
  return fallback;
};

const tryTcpConnection = (host: string, port: number, timeoutMs = 1500): Promise<boolean> => new Promise((resolve) => {
  const socket = new net.Socket();
  let settled = false;

  const finish = (ok: boolean) => {
    if (settled) return;
    settled = true;
    socket.destroy();
    resolve(ok);
  };

  socket.setTimeout(timeoutMs);
  socket.once('connect', () => finish(true));
  socket.once('error', () => finish(false));
  socket.once('timeout', () => finish(false));
  socket.connect(port, host);
});

const resolveLocalNamedInstanceConfig = async (
  server: string,
  instanceName: string,
  config: mssql.config,
): Promise<{ config: mssql.config; viaRegistryPort: boolean }> => {
  if (!instanceName || !isLikelyLocalSqlHost(server) || process.platform !== 'win32') {
    return { config, viaRegistryPort: false };
  }

  const discoveredPort = await resolveLocalSqlInstancePortFromRegistry(instanceName);
  if (!discoveredPort) {
    return { config, viaRegistryPort: false };
  }

  return {
    config: applyDirectTcpPortToSqlServerConfig(config, discoveredPort),
    viaRegistryPort: true,
  };
};

const testSqlServerConnectivity = async (source: any) => {
  const host = String(source.host || '').trim();
  const { server, instanceName, port: hostPort } = parseSqlServerHost(host);
  const database = String(source.database_name || source.database || '').trim();
  const username = String(source.username || '').trim();
  const password = String(source.password || '');
  const portValue = Number(source.port || 0);
  const explicitPort = Number.isFinite(portValue) && portValue > 0 ? portValue : null;
  const effectivePort = explicitPort ?? hostPort;
  const hasPort = Number.isFinite(effectivePort) && Number(effectivePort) > 0;
  const hasInstanceInHost = Boolean(instanceName);
  const shouldUseExplicitPort = hasPort && !hasInstanceInHost;
  const useInstanceLookup = hasInstanceInHost && !shouldUseExplicitPort;
  const encrypt = parseBooleanLike(source.encrypt, true);
  const trustServerCertificate = parseBooleanLike(source.trust_server_certificate ?? source.trustServerCertificate, true);
  const pooling = parseBooleanLike(source.pooling, false);

  if (!server) {
    return { status: 'error', message: 'Missing SQL Server host.' };
  }

  if (!hasPort && !instanceName) {
    return { status: 'error', message: 'Provide SQL Server port or host\\instance name.' };
  }

  if (!username || !password) {
    return { status: 'error', message: 'SQL Server username and password are required for real connectivity test.' };
  }

  const baseConfig: mssql.config = {
    server,
    user: username,
    password,
    options: {
      encrypt,
      trustServerCertificate,
      ...(useInstanceLookup ? { instanceName } : {}),
    },
    connectionTimeout: 5000,
    requestTimeout: 5000,
    pool: pooling
      ? {
          max: 10,
          min: 0,
          idleTimeoutMillis: 30000,
        }
      : {
          max: 1,
          min: 0,
          idleTimeoutMillis: 1000,
        },
    ...(shouldUseExplicitPort ? { port: Number(effectivePort) } : {}),
    ...(database ? { database } : {}),
  };

  const { config, viaRegistryPort } = await resolveLocalNamedInstanceConfig(server, instanceName, baseConfig);

  const tryConnect = async (cfg: mssql.config) => {
    let pool: mssql.ConnectionPool | null = null;
    try {
      pool = new sqlServerClient.ConnectionPool(cfg);
      await pool.connect();
    } finally {
      if (pool) {
        try {
          await pool.close();
        } catch {
          // No-op.
        }
      }
    }
  };

  try {
    await tryConnect(config);
    return {
      status: 'connected',
      message: viaRegistryPort
        ? `SQL Server login succeeded via local instance TCP port ${config.port}.`
        : 'SQL Server login succeeded.',
    };
  } catch (error: any) {
    const code = String(error?.code || '').toUpperCase();
    if (code === 'ETIMEOUT' || code === 'ESOCKET') {
      if (useInstanceLookup && !viaRegistryPort && isLikelyLocalSqlHost(server)) {
        const discoveredPort = await resolveLocalSqlInstancePortFromRegistry(instanceName);
        if (discoveredPort) {
          const fallbackConfig = applyDirectTcpPortToSqlServerConfig(config, discoveredPort);

          try {
            await tryConnect(fallbackConfig);
            return {
              status: 'connected',
              message: `SQL Server login succeeded via local instance TCP port ${discoveredPort}.`,
            };
          } catch (fallbackError: any) {
            const fallbackCode = String(fallbackError?.code || '').toUpperCase();
            if (fallbackCode === 'ELOGIN') {
              return { status: 'error', message: 'SQL Server authentication failed (username/password).' };
            }

            return {
              status: 'error',
              message: fallbackError?.message || 'SQL Server connectivity test failed after local instance port fallback.',
            };
          }
        }
      }

      if (useInstanceLookup) {
        return {
          status: 'error',
          message: 'Instance resolution timeout. Enable SQL Browser service (UDP 1434) or set a fixed TCP port (Port field or host,port).',
        };
      }
      return { status: 'error', message: 'SQL Server host is unreachable or connection timed out.' };
    }
    if (code === 'ELOGIN') {
      return { status: 'error', message: 'SQL Server authentication failed (username/password).' };
    }
    return { status: 'error', message: error?.message || 'SQL Server connectivity test failed.' };
  }
};

export const testDataSourceConnectivity = async (source: any) => {
  if (source.type === 'SQL Server') {
    return testSqlServerConnectivity(source);
  }

  if (source.type === DATA_SOURCE_TYPE_OLAP_BRIDGE) {
    const host = String(source.host || '').trim().replace(/\/$/, '');
    if (!host) {
      return { status: 'error', message: 'Missing OLAP bridge host URL.' };
    }
    try {
      const response = await fetch(`${host}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Bridge-Api-Key': String(source.password || ''),
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) {
        return { status: 'error', message: `OLAP bridge health failed (${response.status}).` };
      }
      const payload = await response.json() as { status?: string };
      if (payload?.status === 'ok') {
        return { status: 'connected', message: 'OLAP bridge is reachable.' };
      }
      return { status: 'error', message: 'OLAP bridge health did not return ok.' };
    } catch (error) {
      return {
        status: 'error',
        message: error instanceof Error ? error.message : 'OLAP bridge is unreachable.',
      };
    }
  }

  let host = String(source.host || '').trim();
  let port = Number(source.port || 0);
  if (host.includes('://')) {
    try {
      const url = new URL(host);
      host = url.hostname;
      if (!Number.isFinite(port) || port <= 0) {
        port = Number(url.port || 0);
      }
    } catch {
      // keep host as typed
    }
  }
  if (
    (source.type === DATA_SOURCE_TYPE_MONGODB_ANALYTICS || source.type === DATA_SOURCE_TYPE_ELASTICSEARCH_ANALYTICS)
    && (!Number.isFinite(port) || port <= 0)
  ) {
    port = source.type === DATA_SOURCE_TYPE_MONGODB_ANALYTICS ? 27017 : 9200;
  }
  if (!host || !Number.isFinite(port) || port <= 0) {
    return { status: 'error', message: 'Missing host or port.' };
  }

  const reachable = await tryTcpConnection(host, port);
  if (!reachable) {
    return { status: 'error', message: 'Connection timeout or refused.' };
  }

  return { status: 'connected', message: 'TCP port is reachable.' };
};
