import type { ControlPlaneDatabaseSettings } from '../db/controlPlaneDatabase';
import { connectedMessageForProvider, parseSqlServerConnectionUrl } from '../db/controlPlaneInstall';
import {
  closePrismaControlPlane,
  initPrismaControlPlaneFromSettings,
} from '../db/prismaControlPlane';
import { isSqlServerNamedInstanceHost } from '../../shared/lib/sqlServerAddress';
import { testDataSourceConnectivity } from './dataSourceConnectivity';
import {
  readPgPoolConfigFromPayload,
  testPostgresServerLogin,
  testTargetDatabaseConnection,
} from '../setup/installDatabase';

export type ControlPlaneConnectivityResult = {
  status: 'connected' | 'error';
  message: string;
};

export const testControlPlaneConnectivity = async (
  settings: ControlPlaneDatabaseSettings,
): Promise<ControlPlaneConnectivityResult> => {
  try {
    if (settings.provider === 'postgresql') {
      const parsed = new URL(settings.url);
      const config = readPgPoolConfigFromPayload({
        host: parsed.hostname,
        port: Number(parsed.port || 5432),
        database: decodeURIComponent(parsed.pathname.replace(/^\//, '')),
        username: decodeURIComponent(parsed.username),
        password: decodeURIComponent(parsed.password),
      });
      await testPostgresServerLogin(config);
      await testTargetDatabaseConnection(config);
      return { status: 'connected', message: connectedMessageForProvider('postgresql') };
    }

    if (settings.provider === 'sqlserver') {
      const parsed = parseSqlServerConnectionUrl(settings.url);
      const namedInstance = isSqlServerNamedInstanceHost(parsed.host);
      const result = await testDataSourceConnectivity({
        type: 'SQL Server',
        host: parsed.host,
        port: namedInstance ? 0 : parsed.port,
        database: parsed.database,
        username: parsed.username,
        password: parsed.password,
        encrypt: parsed.encrypt,
        trustServerCertificate: parsed.trustServerCertificate,
        pooling: false,
      });
      if (result.status !== 'connected') {
        return { status: 'error', message: result.message };
      }
      return { status: 'connected', message: connectedMessageForProvider('sqlserver') };
    }

    await initPrismaControlPlaneFromSettings(settings);
    await closePrismaControlPlane();
    return { status: 'connected', message: connectedMessageForProvider(settings.provider) };
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : 'Database connection failed.';
    const message = /Could not locate the bindings file/i.test(raw)
      ? 'SQLite native module is not built. Run npm rebuild better-sqlite3 and restart the server.'
      : raw;
    return { status: 'error', message };
  }
};
