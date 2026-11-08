import type { ControlPlaneDbProvider } from './controlPlaneDatabase';
import { parseSqlServerConnectionUrl } from './sqlServerControlPlaneUrl';

const escapeSqlServerValue = (value: string): string => {
  if (/[\\=;[\]{}]/.test(value)) {
    return `{${value.replace(/}/g, '}}')}`;
  }
  return value;
};

const stripStandardUrlPassword = (url: string): string => {
  const parsed = new URL(url);
  parsed.password = '';
  return parsed.toString();
};

const withStandardUrlPassword = (url: string, password: string): string => {
  const parsed = new URL(url);
  parsed.password = password;
  return parsed.toString();
};

const stripSqlServerUrlPassword = (url: string): string => {
  const body = url.replace(/^sqlserver:\/\//i, '');
  const segments = body.split(';').filter(Boolean);
  if (segments.length === 0) {
    return url;
  }
  const host = segments[0];
  const rest = segments.slice(1).filter((segment) => {
    const key = segment.split('=')[0]?.trim().toLowerCase();
    return key !== 'password';
  });
  return rest.length > 0 ? `sqlserver://${host};${rest.join(';')}` : `sqlserver://${host}`;
};

const withSqlServerUrlPassword = (url: string, password: string): string => {
  const stripped = stripSqlServerUrlPassword(url);
  const parsed = parseSqlServerConnectionUrl(stripped);
  const encrypt = parsed.encrypt ? 'true' : 'false';
  const trust = parsed.trustServerCertificate ? 'true' : 'false';
  return [
    `sqlserver://${parsed.host}`,
    `database=${escapeSqlServerValue(parsed.database)}`,
    `user=${escapeSqlServerValue(parsed.username)}`,
    `password=${escapeSqlServerValue(password)}`,
    `encrypt=${encrypt}`,
    `trustServerCertificate=${trust}`,
  ].join(';');
};

export const stripControlPlaneUrlPassword = (
  provider: ControlPlaneDbProvider,
  url: string,
): string => {
  const trimmed = url.trim();
  if (!trimmed) {
    return trimmed;
  }

  if (provider === 'sqlite') {
    return trimmed;
  }

  if (provider === 'sqlserver') {
    return stripSqlServerUrlPassword(trimmed);
  }

  try {
    return stripStandardUrlPassword(trimmed);
  } catch {
    return trimmed;
  }
};

export const withControlPlaneUrlPassword = (
  provider: ControlPlaneDbProvider,
  url: string,
  password: string,
): string => {
  const trimmed = url.trim();
  const secret = password.trim();
  if (!trimmed || !secret || provider === 'sqlite') {
    return stripControlPlaneUrlPassword(provider, trimmed);
  }

  if (provider === 'sqlserver') {
    return withSqlServerUrlPassword(trimmed, secret);
  }

  try {
    return withStandardUrlPassword(stripStandardUrlPassword(trimmed), secret);
  } catch {
    return trimmed;
  }
};
