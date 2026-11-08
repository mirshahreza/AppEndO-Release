import { parseSqlServerAddress } from '../../shared/lib/sqlServerAddress';

export const parseSqlServerConnectionUrl = (url: string) => {
  const body = url.replace(/^sqlserver:\/\//, '');
  const segments = body.split(';').filter(Boolean);
  const hostPart = segments[0] ?? 'localhost';
  const params = new Map<string, string>();
  for (const segment of segments.slice(1)) {
    const eq = segment.indexOf('=');
    if (eq < 0) continue;
    params.set(segment.slice(0, eq).trim().toLowerCase(), segment.slice(eq + 1).trim());
  }
  const parsed = parseSqlServerAddress(hostPart, 1433);
  return {
    host: hostPart,
    port: parsed.port,
    database: params.get('database') ?? params.get('initial catalog') ?? 'AppEnd',
    username: params.get('user') ?? params.get('username') ?? '',
    password: params.get('password') ?? '',
    encrypt: (params.get('encrypt') ?? 'true').toLowerCase() !== 'false',
    trustServerCertificate: (params.get('trustservercertificate') ?? 'true').toLowerCase() !== 'false',
  };
};
