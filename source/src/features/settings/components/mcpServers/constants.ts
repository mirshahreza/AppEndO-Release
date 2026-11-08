import type { AiMcpServerConfig } from '../../../../shared/api/contracts/ai/types';

export const EMPTY_MCP_SERVER_FORM: AiMcpServerConfig = {
  id: '',
  label: '',
  enabled: false,
  transport: 'stdio',
  command: '',
  args: [],
  url: '',
  env: undefined,
  allowedTools: [],
  note: '',
};

export const MCP_TRANSPORT_OPTIONS = [
  { id: 'stdio', label: 'stdio (local process)' },
  { id: 'sse', label: 'SSE (remote)' },
  { id: 'http', label: 'HTTP (streamable)' },
] as const;

export const slugifyMcpServerId = (label: string): string => (
  label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63)
);

export const parseCommaSeparatedList = (value: string): string[] => (
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
);

export const formatCommaSeparatedList = (items?: string[]): string => (
  items?.join(', ') ?? ''
);

export const serializeEnvRecord = (env?: Record<string, string>): string => {
  if (!env) return '';
  return Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
};

export const parseEnvRecord = (value: string): Record<string, string> | undefined => {
  const lines = value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) return undefined;

  const env: Record<string, string> = {};
  lines.forEach((line) => {
    const separatorIndex = line.indexOf('=');
    if (separatorIndex <= 0) return;
    const key = line.slice(0, separatorIndex).trim();
    const envValue = line.slice(separatorIndex + 1);
    if (key) env[key] = envValue;
  });

  return Object.keys(env).length > 0 ? env : undefined;
};
