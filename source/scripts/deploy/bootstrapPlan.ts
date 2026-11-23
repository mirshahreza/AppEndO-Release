export type DeployPostInstallHook = {
  id: string;
  packageIds: string[];
  npmScript: string;
  args: string[];
  requiresEnv: string;
  summary: string;
};

export type DeployManifestArtifact = {
  packageId: string;
  fileName: string;
  sha256: string;
};

export type DeployManifest = {
  platformVersion?: string;
  bundledPackageIds?: string[];
  packageArtifacts?: DeployManifestArtifact[];
};

export type BundledPackagePlan = DeployManifestArtifact & {
  version: string;
  dependencyIds: string[];
};

const PLATFORM_PACKAGE_RANK: Record<string, number> = {
  cms: 0,
  'remote-hubs': 1,
};

export function orderBundledPackages<T extends { packageId: string; dependencyIds: string[] }>(
  items: readonly T[],
): T[] {
  const originalIndex = new Map(items.map((item, index) => [item.packageId, index]));
  const rank = (packageId: string): number => PLATFORM_PACKAGE_RANK[packageId] ?? 100;
  const seeded = [...items].sort((left, right) => {
    const byRank = rank(left.packageId) - rank(right.packageId);
    if (byRank !== 0) return byRank;
    return (originalIndex.get(left.packageId) ?? 0) - (originalIndex.get(right.packageId) ?? 0);
  });

  const byId = new Map(seeded.map((item) => [item.packageId, item]));
  const indegree = new Map<string, number>();
  const dependents = new Map<string, string[]>();
  for (const item of seeded) {
    indegree.set(item.packageId, 0);
    dependents.set(item.packageId, []);
  }
  for (const item of seeded) {
    for (const dependencyId of item.dependencyIds) {
      if (!byId.has(dependencyId) || dependencyId === item.packageId) continue;
      indegree.set(item.packageId, (indegree.get(item.packageId) ?? 0) + 1);
      dependents.get(dependencyId)?.push(item.packageId);
    }
  }

  const queue = seeded
    .filter((item) => (indegree.get(item.packageId) ?? 0) === 0)
    .map((item) => item.packageId);
  const ordered: T[] = [];
  while (queue.length > 0) {
    const packageId = queue.shift();
    if (!packageId) break;
    const item = byId.get(packageId);
    if (item) ordered.push(item);
    for (const nextId of dependents.get(packageId) ?? []) {
      const left = (indegree.get(nextId) ?? 1) - 1;
      indegree.set(nextId, left);
      if (left === 0) queue.push(nextId);
    }
  }

  if (ordered.length !== items.length) {
    throw new Error('Bundled package dependency cycle.');
  }
  return ordered;
}

export function verifyManifestPackageHashes(
  manifest: DeployManifest,
  actualSha256ByFileName: ReadonlyMap<string, string>,
): { ok: true; artifacts: DeployManifestArtifact[] } | { ok: false; error: string } {
  const artifacts = manifest.packageArtifacts ?? [];
  if (artifacts.length === 0) {
    return { ok: false, error: 'MANIFEST.json has no packageArtifacts to install.' };
  }
  const seen = new Set<string>();
  for (const artifact of artifacts) {
    const packageId = artifact.packageId?.trim();
    const fileName = artifact.fileName?.trim();
    const expected = artifact.sha256?.trim().toLowerCase();
    if (!packageId || !fileName || !expected) {
      return { ok: false, error: 'MANIFEST.json packageArtifacts entries need packageId, fileName, and sha256.' };
    }
    if (seen.has(packageId)) {
      return { ok: false, error: `MANIFEST.json lists package "${packageId}" more than once.` };
    }
    seen.add(packageId);
    const actual = actualSha256ByFileName.get(fileName)?.trim().toLowerCase();
    if (!actual) {
      return { ok: false, error: `Bundled package file is missing: packages/${fileName}` };
    }
    if (actual !== expected) {
      return {
        ok: false,
        error: `SHA-256 mismatch for packages/${fileName}. Expected ${expected}, got ${actual}.`,
      };
    }
  }
  return { ok: true, artifacts };
}

export type DeployBootstrapStamp = {
  schema: 'deploy-bootstrap';
  schemaVersion: 1;
  controlPlaneKey: string;
  packages: Array<{ packageId: string; version: string; sha256: string }>;
  postInstallHookIds: string[];
};

export function controlPlaneKeyFromParts(parts: {
  provider: string;
  host: string;
  port: number;
  database: string;
}): string {
  return [
    parts.provider.trim().toLowerCase(),
    parts.host.trim().toLowerCase(),
    String(parts.port || 0),
    parts.database.trim().toLowerCase(),
  ].join('|');
}

export function shouldQuarantineInstallState(input: {
  hasInstallStateFiles: boolean;
  stamp: DeployBootstrapStamp | null;
  controlPlaneKey: string;
}): boolean {
  if (!input.hasInstallStateFiles) return false;
  if (!input.stamp || input.stamp.schema !== 'deploy-bootstrap') return true;
  return input.stamp.controlPlaneKey !== input.controlPlaneKey;
}

export type PackageBootstrapAction = 'skip' | 'install' | 'reinstall';

export function packageBootstrapAction(input: {
  packageId: string;
  version: string;
  sha256: string;
  installedVersion: string | null;
  stamp: DeployBootstrapStamp | null;
  controlPlaneKey: string;
}): PackageBootstrapAction {
  const stampMatches = input.stamp?.schema === 'deploy-bootstrap'
    && input.stamp.controlPlaneKey === input.controlPlaneKey;
  const recorded = stampMatches
    ? input.stamp?.packages.find((item) => item.packageId === input.packageId)
    : undefined;
  const sameArtifact = recorded?.version === input.version
    && recorded.sha256.trim().toLowerCase() === input.sha256.trim().toLowerCase()
    && input.installedVersion === input.version;
  if (sameArtifact) return 'skip';
  if (input.installedVersion) return 'reinstall';
  return 'install';
}

export type PostInstallDecision =
  | { action: 'skip'; reason: string }
  | { action: 'run'; hook: ReleaseCutPostInstallHook }
  | { action: 'error'; error: string };

export function hookForBundledPackages(
  hooks: readonly DeployPostInstallHook[],
  packageIds: readonly string[],
): DeployPostInstallHook | undefined {
  const ids = new Set(packageIds);
  return hooks.find((hook) => Array.isArray(hook.packageIds)
    && hook.packageIds.some((packageId) => ids.has(packageId)));
}

export function decidePostInstallHook(input: {
  hook: DeployPostInstallHook | undefined;
  requested: boolean;
  force: boolean;
  requiredEnvValue: string | undefined;
  alreadyRan: boolean;
}): PostInstallDecision {
  if (!input.hook) {
    return { action: 'skip', reason: 'This deploy line has no post-install data hook.' };
  }
  if (!input.requested) {
    return {
      action: 'skip',
      reason: `Post-install hook "${input.hook.id}" is opt-in. Pass --post-install when ${input.hook.requiresEnv} is set.`,
    };
  }
  if (input.alreadyRan && !input.force) {
    return {
      action: 'skip',
      reason: `Post-install hook "${input.hook.id}" already ran for this database. Pass --force-post-install to run it again.`,
    };
  }
  if (!input.requiredEnvValue?.trim()) {
    return {
      action: 'error',
      error: `Post-install hook "${input.hook.id}" needs ${input.hook.requiresEnv} to be set. Refusing to run it without that source.`,
    };
  }
  return { action: 'run', hook: input.hook };
}

export type DeployBootstrapSecrets = {
  provider?: string;
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;
  encrypt?: boolean;
  trustServerCertificate?: boolean;
  adminUsername?: string;
  adminEmail?: string;
  adminPassword?: string;
  nodeName?: string;
  nodeEnv?: 'development' | 'production' | 'test';
};

const parseBooleanFlag = (value: string | undefined): boolean | undefined => {
  if (value == null || value.trim() === '') return undefined;
  const normalized = value.trim().toLowerCase();
  if (['1', 'true', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['0', 'false', 'no', 'n', 'off'].includes(normalized)) return false;
  return undefined;
};

export function secretsFromEnv(env: NodeJS.ProcessEnv): DeployBootstrapSecrets {
  const portRaw = env.APPENDO_DB_PORT?.trim();
  const port = portRaw ? Number(portRaw) : undefined;
  const nodeEnvRaw = (env.APPENDO_DEPLOY_NODE_ENV ?? env.NODE_ENV)?.trim().toLowerCase();
  const nodeEnv = nodeEnvRaw === 'production' || nodeEnvRaw === 'development' || nodeEnvRaw === 'test'
    ? nodeEnvRaw
    : undefined;
  return {
    provider: env.APPENDO_DB_PROVIDER?.trim() || undefined,
    host: env.APPENDO_DB_HOST?.trim() || undefined,
    port: Number.isFinite(port) ? port : undefined,
    database: env.APPENDO_DB_NAME?.trim() || undefined,
    username: env.APPENDO_DB_USER?.trim() || undefined,
    password: env.APPENDO_DB_PASSWORD,
    encrypt: parseBooleanFlag(env.APPENDO_DB_ENCRYPT),
    trustServerCertificate: parseBooleanFlag(env.APPENDO_DB_TRUST_SERVER_CERTIFICATE),
    adminUsername: env.APPENDO_ADMIN_USERNAME?.trim() || undefined,
    adminEmail: env.APPENDO_ADMIN_EMAIL?.trim() || undefined,
    adminPassword: env.APPENDO_ADMIN_PASSWORD,
    nodeName: env.APPENDO_NODE_NAME?.trim() || undefined,
    nodeEnv,
  };
}

export function mergeDeploySecrets(
  fileSecrets: DeployBootstrapSecrets,
  envSecrets: DeployBootstrapSecrets,
): DeployBootstrapSecrets {
  const merged: DeployBootstrapSecrets = { ...fileSecrets };
  (Object.keys(envSecrets) as Array<keyof DeployBootstrapSecrets>).forEach((key) => {
    const value = envSecrets[key];
    if (value !== undefined && value !== '') {
      (merged as Record<string, unknown>)[key] = value;
    }
  });
  return merged;
}

const DEPLOY_BOOTSTRAP_FIELD_ENV = [
  'APPENDO_DB_HOST',
  'APPENDO_DB_PORT',
  'APPENDO_DB_NAME',
  'APPENDO_DB_USER',
  'APPENDO_DB_PASSWORD',
  'APPENDO_DB_PROVIDER',
  'APPENDO_ADMIN_USERNAME',
  'APPENDO_ADMIN_EMAIL',
  'APPENDO_ADMIN_PASSWORD',
  'APPENDO_DEPLOY_SECRETS_FILE',
] as const;

/** `absent` = normal boot. `ready` = enough to install. `partial` = some deploy vars, not enough. */
export function deployBootstrapEnvIntent(env: NodeJS.ProcessEnv): 'absent' | 'partial' | 'ready' {
  if (env.APPENDO_DEPLOY_SECRETS_FILE?.trim()) return 'ready';
  const anyField = DEPLOY_BOOTSTRAP_FIELD_ENV.some((key) => Boolean(env[key]?.toString().trim()));
  if (!anyField) return 'absent';
  return missingFreshInstallFields(secretsFromEnv(env)).length === 0 ? 'ready' : 'partial';
}

/** Explicit opt-in. First boot never sets this by itself. */
export function postInstallHookRequested(env: NodeJS.ProcessEnv): boolean {
  return env.APPENDO_DEPLOY_RUN_POST_INSTALL === '1';
}

export function postInstallHookForced(env: NodeJS.ProcessEnv): boolean {
  return env.APPENDO_DEPLOY_FORCE_POST_INSTALL === '1';
}

export function missingFreshInstallFields(secrets: DeployBootstrapSecrets): string[] {
  const missing: string[] = [];
  if (!secrets.host?.trim()) missing.push('APPENDO_DB_HOST');
  if (!secrets.database?.trim()) missing.push('APPENDO_DB_NAME');
  if (!secrets.username?.trim()) missing.push('APPENDO_DB_USER');
  if (!secrets.password) missing.push('APPENDO_DB_PASSWORD');
  if (!secrets.adminUsername?.trim()) missing.push('APPENDO_ADMIN_USERNAME');
  if (!secrets.adminEmail?.trim()) missing.push('APPENDO_ADMIN_EMAIL');
  if (!secrets.adminPassword) missing.push('APPENDO_ADMIN_PASSWORD');
  return missing;
}

export function isPlaceholderJwtSecret(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length === 0 || trimmed.endsWith('_change_me');
}

export function parseDeploySecretsFile(text: string): DeployBootstrapSecrets {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    const parsed = JSON.parse(trimmed) as {
      database?: Record<string, unknown>;
      admin?: Record<string, unknown>;
      nodeEnv?: unknown;
      nodeName?: unknown;
    };
    const database = parsed.database ?? {};
    const admin = parsed.admin ?? {};
    const nodeEnvRaw = String(parsed.nodeEnv ?? '').trim().toLowerCase();
    return {
      provider: stringOrUndefined(database.provider),
      host: stringOrUndefined(database.host),
      port: numberOrUndefined(database.port),
      database: stringOrUndefined(database.database),
      username: stringOrUndefined(database.username),
      password: typeof database.password === 'string' ? database.password : undefined,
      encrypt: typeof database.encrypt === 'boolean' ? database.encrypt : undefined,
      trustServerCertificate: typeof database.trustServerCertificate === 'boolean'
        ? database.trustServerCertificate
        : undefined,
      adminUsername: stringOrUndefined(admin.username),
      adminEmail: stringOrUndefined(admin.email),
      adminPassword: typeof admin.password === 'string' ? admin.password : undefined,
      nodeName: stringOrUndefined(parsed.nodeName),
      nodeEnv: nodeEnvRaw === 'production' || nodeEnvRaw === 'development' || nodeEnvRaw === 'test'
        ? nodeEnvRaw
        : undefined,
    };
  }

  const fromEnv: NodeJS.ProcessEnv = {};
  for (const line of text.split(/\r?\n/)) {
    const raw = line.trim();
    if (!raw || raw.startsWith('#')) continue;
    const body = raw.startsWith('export ') ? raw.slice('export '.length).trim() : raw;
    const eq = body.indexOf('=');
    if (eq <= 0) continue;
    const key = body.slice(0, eq).trim();
    let value = body.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"'))
      || (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    fromEnv[key] = value;
  }
  return secretsFromEnv(fromEnv);
}

function stringOrUndefined(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function numberOrUndefined(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
