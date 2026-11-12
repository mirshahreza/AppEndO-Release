import { resolveLocalSqlInstancePortFromRegistrySync } from '../../core/database/sqlServerLocalInstancePort';
import {
  isSqlServerNamedInstanceHost,
  parseSqlServerHost,
} from '../../shared/lib/sqlServerAddress';
import { withControlPlaneUrlPassword } from './controlPlaneUrlPassword';
import { parseSqlServerConnectionUrl } from './sqlServerControlPlaneUrl';

const normalizePrismaCliHost = (rawHost: string, port: number): string => {
  const { server } = parseSqlServerHost(rawHost);
  const base = server === '.' ? 'localhost' : server;
  return `${base}:${port}`;
};

/**
 * Prisma CLI rejects many AppEndO control-plane host tokens (`host\\instance`) with P1013.
 * Resolve local named instances to `host:port` for migrate diff / db push / db execute only.
 */
export const toPrismaCliSqlServerUrl = (controlPlaneUrl: string): string => {
  const trimmed = controlPlaneUrl.trim();
  if (!/^sqlserver:\/\//i.test(trimmed)) {
    return trimmed;
  }

  const parsed = parseSqlServerConnectionUrl(trimmed);
  let hostToken = parsed.host;

  if (isSqlServerNamedInstanceHost(parsed.host)) {
    const { instanceName } = parseSqlServerHost(parsed.host);
    const discovered = instanceName
      ? resolveLocalSqlInstancePortFromRegistrySync(instanceName)
      : null;
    const effectivePort = discovered ?? (parsed.port > 0 ? parsed.port : null);
    if (effectivePort) {
      hostToken = normalizePrismaCliHost(parsed.host, effectivePort);
    }
  } else if (parsed.port > 0 && !parsed.host.includes(',')) {
    hostToken = normalizePrismaCliHost(parsed.host, parsed.port);
  }

  const strippedHost = `sqlserver://${hostToken};database=${parsed.database};user=${parsed.username};encrypt=${parsed.encrypt ? 'true' : 'false'};trustServerCertificate=${parsed.trustServerCertificate ? 'true' : 'false'}`;
  return withControlPlaneUrlPassword('sqlserver', strippedHost, parsed.password);
};

export const toPrismaCliDatabaseUrl = (url: string): string => {
  if (/^sqlserver:\/\//i.test(url.trim())) {
    return toPrismaCliSqlServerUrl(url);
  }
  return url;
};
