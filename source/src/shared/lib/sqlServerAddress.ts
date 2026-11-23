/** SQL Server host uses `host\instance` — port is resolved by SQL Browser, not TCP field. */
export const isSqlServerNamedInstanceHost = (address: string): boolean => {
  const rawAddress = address.trim();
  return rawAddress.includes('\\') && !rawAddress.includes(',');
};

const parsePositivePort = (value: string): number | null => {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 65535) return null;
  return parsed;
};

/** `[ipv6]` or `[ipv6]:port`. Returns null when the value is not bracketed. */
const splitBracketedHost = (value: string): { base: string; port: number | null } | null => {
  const match = value.trim().match(/^\[([^\]]+)\](?::(\d+))?$/);
  if (!match) return null;
  if (!match[2]) {
    return { base: match[1].trim(), port: null };
  }
  const port = parsePositivePort(match[2]);
  if (port === null) return null;
  return { base: match[1].trim(), port };
};

/**
 * `host:port` for a hostname or IPv4 (exactly one colon).
 * Bare IPv6 (`::1`) has more than one colon and is left intact.
 */
const splitColonPort = (value: string): { base: string; port: number } | null => {
  const trimmed = value.trim();
  const bracketed = splitBracketedHost(trimmed);
  if (bracketed?.port) {
    return { base: bracketed.base, port: bracketed.port };
  }
  const colon = trimmed.lastIndexOf(':');
  if (colon <= 0 || trimmed.indexOf(':') !== colon) return null;
  const port = parsePositivePort(trimmed.slice(colon + 1));
  if (port === null) return null;
  const base = trimmed.slice(0, colon).trim();
  if (!base) return null;
  return { base, port };
};

const extractTcpEndpoint = (value: string): { base: string; port: number | null } => {
  const bracketed = splitBracketedHost(value);
  if (bracketed) return bracketed;

  const commaIndex = value.lastIndexOf(',');
  if (commaIndex >= 0) {
    const base = value.slice(0, commaIndex).trim();
    const parsedPort = parsePositivePort(value.slice(commaIndex + 1));
    if (parsedPort !== null) {
      return { base, port: parsedPort };
    }
  }

  const colon = splitColonPort(value);
  if (colon) return colon;
  return { base: value.trim(), port: null };
};

/** Parse SQL Server host field (`host`, `host,port`, `host:port`, IPv4, or `host\instance`). */
export const parseSqlServerAddress = (address: string, fallbackPort: number) => {
  const rawAddress = address.trim();
  if (isSqlServerNamedInstanceHost(rawAddress)) {
    return {
      host: rawAddress,
      port: 0,
    };
  }

  if (!rawAddress) {
    return {
      host: 'localhost',
      port: fallbackPort,
    };
  }

  const { base, port } = extractTcpEndpoint(rawAddress);
  if (port !== null) {
    return {
      host: base || 'localhost',
      port,
    };
  }

  return {
    host: base || 'localhost',
    port: fallbackPort,
  };
};

export const buildSqlServerHostToken = (host: string, port: number): string => {
  const trimmed = host.trim();
  if (!trimmed) {
    return 'localhost';
  }
  if (trimmed.includes(',') || isSqlServerNamedInstanceHost(trimmed) || splitColonPort(trimmed)) {
    return trimmed;
  }
  if (Number.isFinite(port) && port > 0) {
    return `${trimmed}:${port}`;
  }
  return trimmed;
};

export type ParsedSqlServerHost = {
  server: string;
  instanceName: string;
  port: number | null;
};

/** Parse SQL Server host for connectivity (`host`, `host,port`, `host\instance`, `.\instance`). */
export const parseSqlServerHost = (rawHost: string): ParsedSqlServerHost => {
  const host = rawHost.trim();
  if (!host) {
    return { server: '', instanceName: '', port: null };
  }

  const extractPort = (value: string): { base: string; port: number | null } => extractTcpEndpoint(value);

  const slashIndex = host.indexOf('\\');
  if (slashIndex >= 0) {
    const left = host.slice(0, slashIndex).trim();
    const right = host.slice(slashIndex + 1).trim();
    const { base: instanceNameRaw, port } = extractPort(right);
    const normalizedServer = !left || left === '.' ? 'localhost' : left;
    return {
      server: normalizedServer,
      instanceName: instanceNameRaw,
      port,
    };
  }

  const { base: serverRaw, port } = extractPort(host);
  return {
    server: serverRaw === '.' ? 'localhost' : serverRaw,
    instanceName: '',
    port,
  };
};
