import { execFile, execFileSync } from 'child_process';
import os from 'os';
import { promisify } from 'util';
import type { config as MssqlConfig } from 'mssql';

const execFileAsync = promisify(execFile);

const parseWindowsRegistryValue = (stdout: string, valueName: string): string | null => {
  const lines = stdout.split(/\r?\n/);
  for (const line of lines) {
    if (!line.toLowerCase().includes(valueName.toLowerCase())) {
      continue;
    }

    const parts = line.trim().split(/\s{2,}/).filter(Boolean);
    if (parts.length >= 3 && parts[0].toLowerCase() === valueName.toLowerCase()) {
      return parts[2].trim();
    }
  }

  return null;
};

const parsePositivePortOrNull = (value: unknown): number | null => {
  const n = Number(String(value ?? '').trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
};

export const isLikelyLocalSqlHost = (server: string): boolean => {
  const normalized = server.trim().toLowerCase();
  if (!normalized) return false;
  if (normalized === '.' || normalized === '(local)' || normalized === 'localhost') return true;
  if (normalized === '127.0.0.1' || normalized === '::1') return true;
  return normalized === os.hostname().toLowerCase();
};

const lookupInstanceTcpPort = (instanceId: string): number | null => {
  const tcpKey = `HKLM\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\${instanceId}\\MSSQLServer\\SuperSocketNetLib\\Tcp\\IPAll`;

  try {
    const tcpPortStdout = execFileSync('reg', ['query', tcpKey, '/v', 'TcpPort'], {
      windowsHide: true,
      encoding: 'utf8',
    });
    const fixedPort = parsePositivePortOrNull(parseWindowsRegistryValue(tcpPortStdout, 'TcpPort'));
    if (fixedPort) return fixedPort;
  } catch {
    // Continue to dynamic ports lookup.
  }

  try {
    const dynamicStdout = execFileSync('reg', ['query', tcpKey, '/v', 'TcpDynamicPorts'], {
      windowsHide: true,
      encoding: 'utf8',
    });
    const dynamicPort = parsePositivePortOrNull(parseWindowsRegistryValue(dynamicStdout, 'TcpDynamicPorts'));
    if (dynamicPort) return dynamicPort;
  } catch {
    return null;
  }

  return null;
};

const resolveInstanceIdFromRegistry = (instance: string): string | null => {
  const instanceNamesKey = 'HKLM\\SOFTWARE\\Microsoft\\Microsoft SQL Server\\Instance Names\\SQL';
  const candidates = Array.from(new Set([instance, instance.toUpperCase(), instance.toLowerCase()]));
  for (const candidate of candidates) {
    try {
      const stdout = execFileSync('reg', ['query', instanceNamesKey, '/v', candidate], {
        windowsHide: true,
        encoding: 'utf8',
      });
      const value = parseWindowsRegistryValue(stdout, candidate);
      if (value) return value;
    } catch {
      // Try next candidate casing.
    }
  }
  return null;
};

/** Sync registry lookup for Prisma CLI / other blocking callers (Windows only). */
export const resolveLocalSqlInstancePortFromRegistrySync = (instanceName: string): number | null => {
  if (process.platform !== 'win32') return null;
  const instance = instanceName.trim();
  if (!instance) return null;
  try {
    const instanceId = resolveInstanceIdFromRegistry(instance);
    if (!instanceId) return null;
    return lookupInstanceTcpPort(instanceId);
  } catch {
    return null;
  }
};

/** Read the local named-instance TCP port from the Windows SQL Server registry (avoids SQL Browser). */
export const resolveLocalSqlInstancePortFromRegistry = async (instanceName: string): Promise<number | null> => {
  if (process.platform !== 'win32') return null;

  const instance = instanceName.trim();
  if (!instance) return null;

  try {
    const instanceId = resolveInstanceIdFromRegistry(instance);
    if (!instanceId) return null;
    return lookupInstanceTcpPort(instanceId);
  } catch {
    return null;
  }
};

export const applyDirectTcpPortToSqlServerConfig = (config: MssqlConfig, port: number): MssqlConfig => {
  const options = { ...(config.options || {}) } as Record<string, unknown>;
  delete options.instanceName;
  return {
    ...config,
    port,
    options: options as MssqlConfig['options'],
  };
};
