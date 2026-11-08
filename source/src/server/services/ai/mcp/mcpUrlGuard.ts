import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '127.0.0.1',
  '0.0.0.0',
  '::1',
  '[::1]',
]);

const isPrivateIpv4 = (ip: string): boolean => {
  const parts = ip.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) {
    return true;
  }

  const [a, b] = parts;
  if (a === 10) return true;
  if (a === 127) return true;
  if (a === 0) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  return false;
};

const isPrivateIpv6 = (ip: string): boolean => {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  if (normalized.startsWith('fe80')) return true;
  return false;
};

export const isBlockedIpAddress = (ip: string): boolean => {
  if (net.isIPv4(ip)) {
    return isPrivateIpv4(ip);
  }
  if (net.isIPv6(ip)) {
    return isPrivateIpv6(ip);
  }
  return true;
};

export const validateMcpRemoteUrlHostname = (urlString: string): URL => {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    throw new Error('Invalid MCP server URL.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('MCP URL must use http or https.');
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (BLOCKED_HOSTNAMES.has(hostname) || BLOCKED_HOSTNAMES.has(url.hostname.toLowerCase())) {
    throw new Error('MCP URL must not target loopback or localhost.');
  }

  if (net.isIP(hostname) && isBlockedIpAddress(hostname)) {
    throw new Error(`MCP URL hostname is blocked: ${hostname}`);
  }

  return url;
};

export const validateMcpRemoteUrl = async (urlString: string): Promise<URL> => {
  const url = validateMcpRemoteUrlHostname(urlString);
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (net.isIP(hostname)) {
    return url;
  }

  const addresses = await dns.lookup(hostname, { all: true });
  if (addresses.length === 0) {
    throw new Error('MCP URL hostname could not be resolved.');
  }

  for (const address of addresses) {
    if (isBlockedIpAddress(address.address)) {
      throw new Error(`MCP URL resolves to blocked address: ${address.address}`);
    }
  }

  return url;
};

export const createSsrfGuardedFetch = (): typeof fetch => (
  async (input, init) => {
    const response = await fetch(input, { ...init, redirect: 'manual' });
    if (response.status >= 300 && response.status < 400) {
      throw new Error('MCP HTTP redirect is not allowed.');
    }
    return response;
  }
);
