/** SQL Server host uses `host\instance` — port is resolved by SQL Browser, not TCP field. */
export const isSqlServerNamedInstanceHost = (address: string): boolean => {
  const rawAddress = address.trim();
  return rawAddress.includes('\\') && !rawAddress.includes(',');
};

/** Parse SQL Server host field (`host`, `host,port`, or `host\instance`). */
export const parseSqlServerAddress = (address: string, fallbackPort: number) => {
  const rawAddress = address.trim();
  if (isSqlServerNamedInstanceHost(rawAddress)) {
    return {
      host: rawAddress,
      port: 0,
    };
  }

  if (!rawAddress.includes(',')) {
    return {
      host: rawAddress || 'localhost',
      port: fallbackPort,
    };
  }

  const [hostPart, portPart] = rawAddress.split(',', 2);
  const parsedPort = Number((portPart || '').trim());

  return {
    host: (hostPart || '').trim() || 'localhost',
    port: Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : fallbackPort,
  };
};

export const buildSqlServerHostToken = (host: string, port: number): string => {
  const trimmed = host.trim();
  if (!trimmed) {
    return 'localhost';
  }
  if (trimmed.includes(',') || isSqlServerNamedInstanceHost(trimmed)) {
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

  const parsePositivePort = (value: string): number | null => {
    const n = Number(value.trim());
    if (!Number.isFinite(n) || n <= 0) return null;
    return n;
  };

  const extractPort = (value: string): { base: string; port: number | null } => {
    const commaIndex = value.lastIndexOf(',');
    if (commaIndex < 0) {
      return { base: value.trim(), port: null };
    }

    const base = value.slice(0, commaIndex).trim();
    const portRaw = value.slice(commaIndex + 1).trim();
    const parsedPort = parsePositivePort(portRaw);
    if (parsedPort === null) {
      return { base: value.trim(), port: null };
    }

    return { base, port: parsedPort };
  };

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
