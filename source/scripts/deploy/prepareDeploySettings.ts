import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { buildSqlServerHostToken, parseSqlServerHost } from '../../src/shared/lib/sqlServerAddress';
import {
  isPlaceholderJwtSecret,
  type DeployBootstrapSecrets,
} from './bootstrapPlan';

type SettingsDocument = Record<string, unknown>;

const asRecord = (value: unknown): SettingsDocument => (
  value && typeof value === 'object' && !Array.isArray(value) ? { ...(value as SettingsDocument) } : {}
);

export function prepareSettingsDocument(input: {
  settings: SettingsDocument;
  secrets: DeployBootstrapSecrets;
  installComplete: boolean;
  generateSecret?: () => string;
}): { settings: SettingsDocument; rotatedJwtSecrets: boolean } {
  const generateSecret = input.generateSecret ?? (() => crypto.randomBytes(32).toString('hex'));
  const settings: SettingsDocument = { ...input.settings };
  const runtime = asRecord(settings.runtime);
  const requestedNodeEnv = input.secrets.nodeEnv;
  if (requestedNodeEnv) {
    runtime.nodeEnv = requestedNodeEnv;
  }
  if (!input.installComplete && input.secrets.nodeName?.trim()) {
    runtime.nodeName = input.secrets.nodeName.trim();
  }

  let rotatedJwtSecrets = false;
  if (runtime.nodeEnv === 'production') {
    const access = String(runtime.accessTokenSecret ?? '');
    const refresh = String(runtime.refreshTokenSecret ?? '');
    if (isPlaceholderJwtSecret(access)) {
      runtime.accessTokenSecret = generateSecret();
      rotatedJwtSecrets = true;
    }
    if (isPlaceholderJwtSecret(refresh)) {
      runtime.refreshTokenSecret = generateSecret();
      rotatedJwtSecrets = true;
    }
  }
  settings.runtime = runtime;

  if (!input.installComplete && hasConnectionOverride(input.secrets)) {
    applyConnection(settings, input.secrets);
  }

  const install = asRecord(settings.install);
  if (!input.installComplete && install.pending !== true && !install.completedAt) {
    settings.install = { ...install, pending: true };
  }

  return { settings, rotatedJwtSecrets };
}

function hasConnectionOverride(secrets: DeployBootstrapSecrets): boolean {
  return Boolean(secrets.host?.trim() || secrets.database?.trim() || secrets.username?.trim());
}

function applyConnection(settings: SettingsDocument, secrets: DeployBootstrapSecrets): void {
  const database = asRecord(settings.database);
  const provider = (secrets.provider ?? String(database.provider ?? 'sqlserver')).trim().toLowerCase() || 'sqlserver';
  const sources = Array.isArray(settings.dataSources) ? [...settings.dataSources] : [];
  const current = asRecord(sources[0]);
  let host = secrets.host?.trim() || String(current.host ?? 'localhost');
  let port = secrets.port ?? Number(current.port ?? 0);
  if (provider === 'sqlserver') {
    const parsed = parseSqlServerHost(host);
    if (parsed.server && !host.includes('\\')) {
      host = parsed.server;
      if ((!Number.isFinite(port) || port <= 0) && parsed.port) {
        port = parsed.port;
      }
    }
  }
  const databaseName = secrets.database?.trim() || String(current.database ?? '');
  const username = secrets.username?.trim() || String(current.username ?? '');
  const encrypt = secrets.encrypt ?? current.encrypt !== false;
  const trustServerCertificate = secrets.trustServerCertificate ?? current.trustServerCertificate !== false;

  const nextSource = {
    ...current,
    type: provider === 'sqlserver' ? 'SQL Server' : String(current.type ?? provider),
    host,
    port: Number.isFinite(port) ? port : 0,
    database: databaseName,
    username,
    encrypt,
    trustServerCertificate,
    isDefault: true,
  };
  if (sources.length === 0) {
    sources.push(nextSource);
  } else {
    sources[0] = nextSource;
  }
  settings.dataSources = sources;

  if (provider === 'sqlserver') {
    const hostToken = buildSqlServerHostToken(host, Number(port) || 0);
    settings.database = {
      ...database,
      provider: 'sqlserver',
      engine: 'prisma',
      url: `sqlserver://${hostToken};database=${databaseName};user=${username};encrypt=${encrypt ? 'true' : 'false'};trustServerCertificate=${trustServerCertificate ? 'true' : 'false'}`,
    };
    runtimeProvider(settings, 'sqlserver');
  }
}

function runtimeProvider(settings: SettingsDocument, provider: string): void {
  const runtime = asRecord(settings.runtime);
  runtime.databaseProvider = provider;
  settings.runtime = runtime;
}

export function readSettingsDocument(settingsPath: string): SettingsDocument {
  return JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as SettingsDocument;
}

export function writeSettingsDocument(settingsPath: string, settings: SettingsDocument): void {
  fs.writeFileSync(settingsPath, `${JSON.stringify(settings, null, 2)}\n`, 'utf8');
}

export function resolveStarterSettingsPath(deployRoot: string): string {
  const candidates = [
    path.join(deployRoot, 'settings.recommended.json'),
    path.join(deployRoot, 'source', 'settings.recommended.json'),
    path.join(deployRoot, 'settings.example.json'),
    path.join(deployRoot, 'source', 'settings.example.json'),
  ];
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) {
    throw new Error('No settings.recommended.json or settings.example.json found. Run this from a deploy snapshot.');
  }
  return found;
}

export function ensureDeploySettingsFile(deployRoot: string): string {
  const settingsPath = path.join(deployRoot, 'settings.json');
  if (!fs.existsSync(settingsPath)) {
    fs.copyFileSync(resolveStarterSettingsPath(deployRoot), settingsPath);
  }
  return settingsPath;
}
