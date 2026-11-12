import bcrypt from 'bcryptjs';
import { Pool } from 'pg';
import { resetControlPlaneInitState, ensureControlPlaneInitialized } from '../../db/controlPlaneInit';
import { cacheManager } from '../../../core/cache/CacheManager';
import { DEFAULT_CACHE_SETTINGS } from '../../../shared/api/contracts/cache/constants';
import { mergeCacheSettingsPatch } from '../../../shared/api/contracts/cache/validators';
import type {
  InstallAdminPayload,
  InstallCachePayload,
  InstallCapabilitiesPayload,
  InstallDatabasePayload,
  InstallEmailPayload,
  InstallRedisPayload,
} from '../../../shared/api/contracts/install/types';
import {
  INSTALL_COMPLETE_REDIRECT_PATH,
  INSTALL_WIZARD_API_VERSION,
} from '../../../shared/api/contracts/install/types';
import { DEFAULT_SETTINGS } from '../../../shared/api/contracts/settings/constants';
import { defaultSectionValue } from '../../../shared/api/contracts/settings/sections';
import {
  buildCapabilityEnvGuide,
  DEFAULT_NODE_CAPABILITIES,
  normalizeNodeCapabilities,
  parseNodeCapabilities,
  validateNodeCapabilities,
} from '../../../shared/nodeCapabilities';
import { getCacheSettings, saveCacheSettingsToFile } from '../../db/cacheSettingsStore';
import { ensureCredentialVaultTable } from '../../domain/security/credentialVault/credentialVaultSequelizeModel';
import { ensureRecordEventTables } from '../../domain/record-events/recordEventSequelizeModels';
import { ensureUserMessageDispatchTables } from '../../domain/user-message-dispatches/userMessageDispatchSequelizeModels';
import { seedSampleMockRecordEvents } from '../../domain/record-events/sampleMockHistory';
import {
  hydrateSmtpPassword,
  syncCacheRedisPassword,
  syncSmtpPassword,
} from '../../domain/security/credentialVault/platformSettingsSecrets';
import type { PlatformBlobSectionKey } from '../../../shared/api/contracts/settings/scopes';
import {
  upsertDefaultDataSourceFromInstall,
} from '../../db/dataSourcesStore';
import {
  isInstallComplete,
  readInstallSettings,
  toPublicInstallSettings,
  writeInstallSettings,
} from '../../db/installSettingsStore';
import {
  readRuntimeSettings,
  readSettingsObject,
  writeSettingsObject,
} from '../../config/settingsFile';
import { closeControlPlanePool, initControlPlanePool, isControlPlanePoolReady } from '../../db/controlPlane';
import { closeControlPlaneSequelize } from '../../db/controlPlaneSequelize';
import { bindPrismaToPgPool } from '../../db/prismaControlPlane';
import { HttpError } from '../../errors/HttpError';
import { ensureDevSimpleAuthSettings } from '../../setup/greenfieldInstall';
import { readPgPoolConfigFromSettings } from '../../setup/installDatabase';
import { getSettingsSection, upsertSettingsSection } from '../../domain/settings/settingsSectionRepository';
import { verifySmtpSettings, type SmtpSettings, normalizeSmtpAuth } from '../email/email.service';
import { initializeAppSettingsCache, isAppSettingsCacheInitialized, replaceCachedSections } from '../settings/appSettingsCache';
import {
  initializePlatformSettingsCache,
  isPlatformSettingsCacheInitialized,
  replaceCachedPlatformBlob,
} from '../settings/platformSettingsCache';
import { readPlatformBlobSeedsFromExample } from '../settings/platformSettingsSeed';
import { applySecuritySettingsFromPlatformCache } from '../../db/securitySettingsStore';
import {
  DEFAULT_CONTROL_PLANE_PROVIDER,
  isControlPlaneProviderId,
} from '../../../shared/api/contracts/install/controlPlaneProviders';
import { isSqlServerNamedInstanceHost } from '../../../shared/lib/sqlServerAddress';
import {
  buildControlPlaneDatabaseSettingsFromInstallPayload,
  controlPlaneHasSchema,
  persistControlPlaneDatabaseSettings,
  prepareControlPlaneDatabase,
  readInstallDatabaseDraftFromSettings,
  resetControlPlaneSchema,
  type ParsedInstallDatabasePayload,
} from '../../db/controlPlaneInstall';
import { readControlPlaneDatabaseSettings } from '../../db/controlPlaneDatabase';
import { initPrismaControlPlane, closePrismaControlPlane, isPrismaControlPlaneReady } from '../../db/prismaControlPlane';
import { testControlPlaneConnectivity } from '../../utils/controlPlaneConnectivity';
import { testDataSourceConnectivity } from '../../utils/dataSourceConnectivity';
import { refreshServerRuntimeAfterInstall } from '../../bootstrapFullRuntime';
import {
  isInstallPromotionAvailable,
  isInstallServerPromoted,
  promoteInstallPendingServer,
} from '../../installServerPromotion';

const isInstallPendingSession = (): boolean =>
  isInstallPromotionAvailable() && !isInstallServerPromoted();
import { runInstallHealthChecks } from './installHealth.service';
import { hasProfilePayloadValue, normalizeProfilePayload } from '../../utils/profilePayload';
import { upsertUserProfile } from '../users/userProfile.service';
import { findFirstAdminUser } from '../../domain/users/userRoleRepository';
import { ensureBootstrapAdminUser, upsertInstallAdminUser } from '../../domain/users/userRepository';
import { configureControlPlaneAutoIncrement, backfillBootstrapAdminAuditFields } from '../../db/controlPlaneSeed';
import { readControlPlaneProvider } from '../../domain/users/prismaHelpers';
import { USER_ID_SEQUENCE_START } from '../../../core/db/database';

export type InstallServiceDeps = {
  settingsPath: string;
};

const parseDatabasePayload = (payload: InstallDatabasePayload): ParsedInstallDatabasePayload => {
  const providerRaw = String(payload.provider ?? DEFAULT_CONTROL_PLANE_PROVIDER).trim().toLowerCase();
  if (!isControlPlaneProviderId(providerRaw)) {
    throw new HttpError(400, 'provider must be postgresql, mysql, sqlite, or sqlserver.');
  }

  const host = String(payload.host ?? '').trim();
  const database = String(payload.database ?? '').trim();
  const username = String(payload.username ?? '').trim();
  const password = String(payload.password ?? '');
  const port = Number(payload.port);
  const encrypt = payload.encrypt !== false;
  const trustServerCertificate = payload.trustServerCertificate !== false;
  const overrideExistingObjects = payload.overrideExistingObjects === true;
  const seedSampleData = payload.seedSampleData === true;

  if (providerRaw === 'sqlite') {
    if (!database) {
      throw new HttpError(400, 'database file path is required for sqlite.');
    }
    return {
      provider: providerRaw,
      host: 'localhost',
      port: 0,
      database,
      username: '',
      password: '',
      encrypt: true,
      trustServerCertificate: true,
      overrideExistingObjects,
      seedSampleData,
    };
  }

  if (!host || !database || !username) {
    throw new HttpError(400, 'host, database, and username are required.');
  }
  const sqlServerNamedInstance = providerRaw === 'sqlserver' && isSqlServerNamedInstanceHost(host);
  if (!sqlServerNamedInstance && (!Number.isFinite(port) || port <= 0)) {
    throw new HttpError(400, 'port must be a positive number.');
  }

  return {
    provider: providerRaw,
    host,
    port: sqlServerNamedInstance ? 0 : (Number.isFinite(port) ? port : 0),
    database,
    username,
    password,
    encrypt,
    trustServerCertificate,
    overrideExistingObjects,
    seedSampleData,
  };
};

const readSavedSmtpPassword = async (settingsPath: string): Promise<string> => {
  const install = readInstallSettings(settingsPath);
  if (!install.databaseInitialized) {
    return '';
  }

  return withInstallDatabase(settingsPath, async () => {
    const row = await getSettingsSection('email');
    const value = row?.value ?? defaultSectionValue('email');
    if (value.smtpHasPassword === true) {
      return hydrateSmtpPassword();
    }
    return '';
  });
};

const resolveInstallEmailPayload = async (
  settingsPath: string,
  payload: InstallEmailPayload,
): Promise<InstallEmailPayload> => {
  if (String(payload.smtpPass ?? '').trim()) {
    return payload;
  }
  const savedPass = await readSavedSmtpPassword(settingsPath);
  if (!savedPass) {
    return payload;
  }
  return { ...payload, smtpPass: savedPass };
};

const parseEmailPayload = (payload: InstallEmailPayload) => {
  const smtpHost = String(payload.smtpHost ?? '').trim();
  const smtpUser = String(payload.smtpUser ?? '').trim();
  const smtpPass = String(payload.smtpPass ?? '');
  const smtpFromEmail = String(payload.smtpFromEmail ?? '').trim().toLowerCase();
  const smtpFromName = String(payload.smtpFromName ?? '').trim() || DEFAULT_SETTINGS.smtpFromName;
  const smtpPort = Number(payload.smtpPort ?? DEFAULT_SETTINGS.smtpPort);
  const smtpSecure = payload.smtpSecure === true;

  if (!smtpHost) {
    throw new HttpError(400, 'SMTP host is required.');
  }
  if (!smtpFromEmail) {
    throw new HttpError(400, 'From email is required.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(smtpFromEmail)) {
    throw new HttpError(400, 'Enter a valid from email address.');
  }
  if (!Number.isFinite(smtpPort) || smtpPort <= 0) {
    throw new HttpError(400, 'SMTP port must be a positive number.');
  }
  if (!smtpUser) {
    throw new HttpError(400, 'SMTP username is required.');
  }
  if (!smtpPass) {
    throw new HttpError(400, 'SMTP password is required.');
  }

  const auth = normalizeSmtpAuth(smtpHost, smtpUser, smtpPass);

  return {
    smtpHost,
    smtpPort,
    smtpUser: auth.user,
    smtpPass: auth.pass,
    smtpFromEmail,
    smtpFromName,
    smtpSecure,
  };
};

const toSmtpSettings = (parsed: ReturnType<typeof parseEmailPayload>): SmtpSettings => ({
  enabled: true,
  host: parsed.smtpHost,
  port: parsed.smtpPort,
  secure: parsed.smtpSecure,
  user: parsed.smtpUser,
  pass: parsed.smtpPass,
  fromEmail: parsed.smtpFromEmail,
  fromName: parsed.smtpFromName,
});

const buildInstallEmailSection = (parsed: ReturnType<typeof parseEmailPayload>) => ({
  ...defaultSectionValue('email'),
  smtpEnabled: true,
  smtpHost: parsed.smtpHost,
  smtpPort: parsed.smtpPort,
  smtpSecure: parsed.smtpSecure,
  smtpUser: parsed.smtpUser,
  smtpPass: parsed.smtpPass,
  smtpHasPassword: true,
  smtpFromEmail: parsed.smtpFromEmail,
  smtpFromName: parsed.smtpFromName,
});

const readDefaultEmailDraft = async (settingsPath: string) => {
  const install = readInstallSettings(settingsPath);
  if (!install.databaseInitialized) {
    return undefined;
  }

  return withInstallDatabase(settingsPath, async () => {
    const row = await getSettingsSection('email');
    const value = row?.value ?? defaultSectionValue('email');
    return {
      smtpHost: typeof value.smtpHost === 'string' ? value.smtpHost : DEFAULT_SETTINGS.smtpHost,
      smtpPort: typeof value.smtpPort === 'number' && value.smtpPort > 0
        ? value.smtpPort
        : DEFAULT_SETTINGS.smtpPort,
      smtpUser: typeof value.smtpUser === 'string' ? value.smtpUser : DEFAULT_SETTINGS.smtpUser,
      hasPassword: value.smtpHasPassword === true,
      smtpFromEmail: typeof value.smtpFromEmail === 'string'
        ? value.smtpFromEmail
        : DEFAULT_SETTINGS.smtpFromEmail,
      smtpFromName: typeof value.smtpFromName === 'string'
        ? value.smtpFromName
        : DEFAULT_SETTINGS.smtpFromName,
      smtpSecure: value.smtpSecure === true,
    };
  });
};

/** Serializes install-time DB access so concurrent requests cannot tear down Prisma mid-flight. */
let installDatabaseSessionGate: Promise<void> = Promise.resolve();

const withInstallDatabase = async <T>(
  settingsPath: string,
  task: () => Promise<T>,
): Promise<T> => {
  const prior = installDatabaseSessionGate;
  let releaseGate!: () => void;
  installDatabaseSessionGate = new Promise<void>((resolve) => {
    releaseGate = resolve;
  });
  await prior;

  try {
    const install = readInstallSettings(settingsPath);
    const installWizardActive = install.pending === true || install.databaseInitialized !== true;
    const reuseExistingPrismaSession = !installWizardActive
      && !isInstallPendingSession()
      && (isInstallServerPromoted() || isPrismaControlPlaneReady());
    if (reuseExistingPrismaSession) {
      return await task();
    }

    // Pool without Prisma (partial teardown) must not skip re-init — domain access uses Prisma only.
    if (isControlPlanePoolReady()) {
      await closeControlPlanePool();
    }

    const dbSettings = readControlPlaneDatabaseSettings(settingsPath);
    if (dbSettings.engine === 'prisma' && dbSettings.url) {
      const { pgPool } = await initPrismaControlPlane(settingsPath);
      if (pgPool) {
        initControlPlanePool(pgPool);
      }
      try {
        return await task();
      } finally {
        if (!isInstallServerPromoted()) {
          // Close the active client — SQLite schema push may replace the session client.
          await closePrismaControlPlane();
          await closeControlPlaneSequelize();
          resetControlPlaneInitState();
          if (pgPool) {
            await closeControlPlanePool(pgPool);
          }
        }
      }
    }

    const config = readPgPoolConfigFromSettings(settingsPath);
    const pool = new Pool(config);
    initControlPlanePool(pool);
    await bindPrismaToPgPool(pool);
    try {
      return await task();
    } finally {
      if (!isInstallServerPromoted()) {
        await closePrismaControlPlane();
        await closeControlPlaneSequelize();
        resetControlPlaneInitState();
        await closeControlPlanePool(pool);
      }
    }
  } finally {
    releaseGate();
  }
};

const persistInstallPlatformBlob = async <T extends Record<string, unknown>>(
  settingsPath: string,
  sectionKey: PlatformBlobSectionKey,
  value: T,
  writeToFile: (settingsPath: string, blob: T) => T,
): Promise<T> => withInstallDatabase(settingsPath, async () => {
  if (isPlatformSettingsCacheInitialized()) {
    await replaceCachedPlatformBlob(sectionKey, value, null);
    return value;
  }
  return writeToFile(settingsPath, value);
});

const assertInstallNotComplete = (settingsPath: string) => {
  if (isInstallComplete(settingsPath)) {
    throw new HttpError(409, 'Install wizard is already complete.');
  }
};

const readDefaultDatabaseDraft = (settingsPath: string) => (
  readInstallDatabaseDraftFromSettings(settingsPath)
);

const persistRuntimeCapabilities = (
  settingsPath: string,
  capabilities: InstallCapabilitiesPayload['capabilities'],
  nodeName: string,
) => {
  const settings = readSettingsObject(settingsPath);
  const runtime = readRuntimeSettings(settingsPath);
  settings.runtime = {
    ...runtime,
    capabilities,
    nodeName,
  };
  writeSettingsObject(settingsPath, settings);
};

const readDefaultCacheDraft = (settingsPath: string) => {
  const settings = readSettingsObject(settingsPath);
  const raw = settings.cache;
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const cache = getCacheSettings(settingsPath);
  if (cache.driver === 'redis') {
    return {
      driver: 'redis' as const,
      redis: {
        host: cache.storeSettings.redis.host,
        port: cache.storeSettings.redis.port,
        hasPassword: Boolean(cache.storeSettings.redis.hasPassword)
          || Boolean(cache.storeSettings.redis.password),
        dbIndex: cache.storeSettings.redis.dbIndex,
      },
    };
  }
  return { driver: 'memory' as const };
};

export class InstallService {
  constructor(private readonly deps: InstallServiceDeps) {}

  async getStatus() {
    return {
      body: {
        success: true as const,
        apiVersion: INSTALL_WIZARD_API_VERSION,
        install: toPublicInstallSettings(this.deps.settingsPath),
        defaultDatabase: readDefaultDatabaseDraft(this.deps.settingsPath),
        defaultCache: readDefaultCacheDraft(this.deps.settingsPath),
        defaultEmail: await readDefaultEmailDraft(this.deps.settingsPath),
      },
    };
  }

  async testDatabase(payload: InstallDatabasePayload) {
    assertInstallNotComplete(this.deps.settingsPath);
    const draft = parseDatabasePayload(payload);

    try {
      if (draft.provider === 'sqlserver') {
        const result = await testDataSourceConnectivity({
          type: 'SQL Server',
          host: draft.host,
          port: isSqlServerNamedInstanceHost(draft.host) ? 0 : draft.port,
          database: draft.database,
          username: draft.username,
          password: draft.password,
          encrypt: draft.encrypt,
          trustServerCertificate: draft.trustServerCertificate,
          pooling: true,
        });
        return {
          body: {
            success: true as const,
            status: result.status,
            message: result.message,
          },
        };
      }

      const settings = buildControlPlaneDatabaseSettingsFromInstallPayload(draft);
      const result = await testControlPlaneConnectivity(settings);
      return {
        body: {
          success: true as const,
          status: result.status,
          message: result.message,
        },
      };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Database connection failed.';
      return {
        body: {
          success: true as const,
          status: 'error' as const,
          message,
        },
      };
    }
  }

  async saveDatabase(payload: InstallDatabasePayload) {
    assertInstallNotComplete(this.deps.settingsPath);
    const draft = parseDatabasePayload(payload);
    const test = await this.testDatabase(payload);
    if (test.body.status !== 'connected') {
      throw new HttpError(400, test.body.message || 'Database connection failed.');
    }

    const { overrideExistingObjects, seedSampleData, ...connection } = draft;
    persistControlPlaneDatabaseSettings(this.deps.settingsPath, draft);
    upsertDefaultDataSourceFromInstall(this.deps.settingsPath, connection);
    writeInstallSettings(this.deps.settingsPath, {
      pending: true,
      overrideExistingObjects,
      seedSampleData,
      databaseInitialized: false,
    });

    return {
      body: {
        success: true as const,
        message: 'Database settings saved.',
        overrideExistingObjects,
        seedSampleData,
      },
    };
  }

  async initDatabase() {
    assertInstallNotComplete(this.deps.settingsPath);
    const install = readInstallSettings(this.deps.settingsPath);
    const dbSettings = readControlPlaneDatabaseSettings(this.deps.settingsPath);

    const connectivity = await testControlPlaneConnectivity(dbSettings);
    if (connectivity.status !== 'connected') {
      throw new HttpError(400, connectivity.message || 'Database connection failed.');
    }

    await prepareControlPlaneDatabase(dbSettings);

    const overrideExistingObjects = install.overrideExistingObjects === true;
    const seedSampleData = install.seedSampleData === true;
    let hasSchema = await controlPlaneHasSchema(dbSettings);
    let schemaDropped = false;

    if (overrideExistingObjects && hasSchema) {
      await closePrismaControlPlane().catch(() => undefined);
      await resetControlPlaneSchema(dbSettings);
      schemaDropped = true;
      hasSchema = false;
    }

    resetControlPlaneInitState();

    await withInstallDatabase(this.deps.settingsPath, async () => {
      if (!hasSchema) {
        // SQLite reset only deletes the file — it does not push schema (unlike PG / Prisma --force-reset).
        await ensureControlPlaneInitialized(this.deps.settingsPath, {
          seedSampleData,
          pushSchema: dbSettings.provider === 'sqlite' || !schemaDropped,
          sqlServerGreenfieldPush: dbSettings.provider === 'sqlserver' && !hasSchema,
        });
      }
      await ensureCredentialVaultTable();
      await ensureRecordEventTables();
      await ensureUserMessageDispatchTables();
      await seedSampleMockRecordEvents();
      const adminActorId = await ensureBootstrapAdminUser();
      await initializeAppSettingsCache(adminActorId);
      await initializePlatformSettingsCache(readPlatformBlobSeedsFromExample(), adminActorId);
      applySecuritySettingsFromPlatformCache(this.deps.settingsPath);
      await ensureDevSimpleAuthSettings(adminActorId);
      await backfillBootstrapAdminAuditFields(adminActorId);
    });

    writeInstallSettings(this.deps.settingsPath, { databaseInitialized: true });

    return {
      body: {
        success: true as const,
        message: schemaDropped
          ? `Existing schema removed and database reinitialized${seedSampleData ? ' with sample data' : ''}.`
          : hasSchema
            ? 'Database schema already exists — connected successfully.'
            : `Database created and initialized${seedSampleData ? ' with sample data' : ''}.`,
      },
    };
  }

  async ensureDatabase() {
    return this.initDatabase();
  }

  async configureAdmin(payload: InstallAdminPayload) {
    assertInstallNotComplete(this.deps.settingsPath);
    const install = readInstallSettings(this.deps.settingsPath);
    if (!install.databaseInitialized) {
      throw new HttpError(400, 'Initialize the database before configuring the admin account.');
    }

    const username = String(payload.username ?? '').trim().toLowerCase();
    const email = String(payload.email ?? '').trim().toLowerCase();
    const password = String(payload.password ?? '');
    const confirmPassword = String(payload.confirmPassword ?? '');

    if (!username) {
      throw new HttpError(400, 'Username is required.');
    }
    if (!email) {
      throw new HttpError(400, 'Email is required.');
    }
    if (!password) {
      throw new HttpError(400, 'Password is required.');
    }
    if (password !== confirmPassword) {
      throw new HttpError(400, 'Passwords do not match.');
    }

    const admin = await withInstallDatabase(this.deps.settingsPath, () => findFirstAdminUser());
    const hash = bcrypt.hashSync(password, 10);
    const profileInput: Record<string, unknown> = {
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone,
    };
    if (
      payload.profileImageBody != null
      || payload.profileImageBodyXs != null
      || payload.profileImageMime != null
    ) {
      profileInput.profileImageBody = payload.profileImageBody;
      profileInput.profileImageBodyXs = payload.profileImageBodyXs;
      profileInput.profileImageMime = payload.profileImageMime;
    }
    const profile = normalizeProfilePayload(profileInput);

    let userId = admin?.id ?? 0;

    await withInstallDatabase(this.deps.settingsPath, async () => {
      userId = await upsertInstallAdminUser({
        username,
        email,
        passwordHash: hash,
        existingAdminId: admin?.id,
      });
      await configureControlPlaneAutoIncrement(
        'base_users',
        'id',
        USER_ID_SEQUENCE_START,
        readControlPlaneProvider(),
      );
      await backfillBootstrapAdminAuditFields(userId);
    });

    if (userId && hasProfilePayloadValue(profile)) {
      await withInstallDatabase(this.deps.settingsPath, async () => {
        await upsertUserProfile(userId, profile, null, { useNullFallbackForImages: true });
      });
    }

    return {
      body: {
        success: true as const,
        message: 'Admin account configured.',
      },
    };
  }

  saveCapabilities(payload: InstallCapabilitiesPayload) {
    assertInstallNotComplete(this.deps.settingsPath);
    const capabilities = parseNodeCapabilities(payload.capabilities);
    if (!capabilities) {
      throw new HttpError(400, 'capabilities must be a non-empty array of service, platform, and/or worker.');
    }

    const validation = validateNodeCapabilities(capabilities);
    if (!validation.valid) {
      throw new HttpError(400, validation.message);
    }

    const nodeName = String(payload.nodeName ?? '').trim();
    if (!nodeName) {
      throw new HttpError(400, 'nodeName is required.');
    }

    writeInstallSettings(this.deps.settingsPath, { capabilities, nodeName, pending: true });
    persistRuntimeCapabilities(this.deps.settingsPath, capabilities, nodeName);

    return {
      body: {
        success: true as const,
        capabilities,
        nodeName,
      },
    };
  }

  async testRedis(payload: InstallRedisPayload) {
    assertInstallNotComplete(this.deps.settingsPath);
    const host = String(payload.host ?? '').trim() || '127.0.0.1';
    const port = Number(payload.port ?? 6379);
    const password = payload.password ? String(payload.password) : undefined;
    const dbIndex = Number(payload.dbIndex ?? 0);

    const result = await cacheManager.testRedisConnection({
      host,
      port,
      password,
      dbIndex: Number.isFinite(dbIndex) ? dbIndex : 0,
      retryStrategy: DEFAULT_CACHE_SETTINGS.storeSettings.redis.retryStrategy,
    });

    return {
      body: {
        success: true as const,
        result,
      },
    };
  }

  async saveCache(payload: InstallCachePayload) {
    assertInstallNotComplete(this.deps.settingsPath);
    const driver = payload.driver === 'redis' ? 'redis' : 'memory';

    if (driver === 'memory') {
      const current = mergeCacheSettingsPatch(DEFAULT_CACHE_SETTINGS, { driver: 'memory' });
      const stripped = await syncCacheRedisPassword(current);
      await persistInstallPlatformBlob(
        this.deps.settingsPath,
        'cache',
        stripped as unknown as Record<string, unknown>,
        (path, blob) => saveCacheSettingsToFile(path, blob as typeof stripped),
      );
      await cacheManager.loadSettings(current);
      return {
        body: {
          success: true as const,
          driver: 'memory' as const,
          message: 'Memory cache settings saved.',
        },
      };
    }

    const redisPayload = payload.redis ?? ({} as InstallRedisPayload);
    const host = String(redisPayload.host ?? '').trim() || '127.0.0.1';
    const port = Number(redisPayload.port ?? 6379);
    const password = redisPayload.password ? String(redisPayload.password) : undefined;
    const dbIndex = Number(redisPayload.dbIndex ?? 0);

    const test = await cacheManager.testRedisConnection({
      host,
      port,
      password,
      dbIndex: Number.isFinite(dbIndex) ? dbIndex : 0,
      retryStrategy: DEFAULT_CACHE_SETTINGS.storeSettings.redis.retryStrategy,
    });
    if (!test.success) {
      throw new HttpError(400, test.message || 'Redis connection failed.');
    }

    const current = mergeCacheSettingsPatch(DEFAULT_CACHE_SETTINGS, {
      driver: 'redis',
      storeSettings: {
        redis: {
          host,
          port,
          password,
          dbIndex: Number.isFinite(dbIndex) ? dbIndex : 0,
          retryStrategy: DEFAULT_CACHE_SETTINGS.storeSettings.redis.retryStrategy,
        },
      },
    });
    const stripped = await syncCacheRedisPassword(current);
    await persistInstallPlatformBlob(
      this.deps.settingsPath,
      'cache',
      stripped as unknown as Record<string, unknown>,
      (path, blob) => saveCacheSettingsToFile(path, blob as typeof stripped),
    );
    await cacheManager.loadSettings(current);

    return {
      body: {
        success: true as const,
        driver: 'redis' as const,
        message: 'Redis cache settings saved.',
      },
    };
  }

  async saveRedis(payload: InstallRedisPayload) {
    return this.saveCache({
      driver: 'redis',
      redis: payload,
    });
  }

  async testEmail(payload: InstallEmailPayload) {
    assertInstallNotComplete(this.deps.settingsPath);

    const resolvedPayload = await resolveInstallEmailPayload(this.deps.settingsPath, payload);
    const parsed = parseEmailPayload(resolvedPayload);
    const result = await verifySmtpSettings(toSmtpSettings(parsed));

    return {
      body: {
        success: true as const,
        result,
      },
    };
  }

  async saveEmail(payload: InstallEmailPayload) {
    assertInstallNotComplete(this.deps.settingsPath);
    const install = readInstallSettings(this.deps.settingsPath);
    if (!install.databaseInitialized) {
      throw new HttpError(400, 'Initialize the database before configuring outbound email.');
    }

    const resolvedPayload = await resolveInstallEmailPayload(this.deps.settingsPath, payload);
    const parsed = parseEmailPayload(resolvedPayload);
    // Install wizard always passes skipVerification — SMTP probe is optional on the email step only.
    const skipVerification = payload.skipVerification === true;
    if (!skipVerification) {
      const verification = await verifySmtpSettings(toSmtpSettings(parsed));
      if (!verification.success) {
        throw new HttpError(400, verification.message || 'SMTP connection failed.');
      }
    }

    const emailSection = buildInstallEmailSection(parsed);
    await withInstallDatabase(this.deps.settingsPath, async () => {
      if (isAppSettingsCacheInitialized()) {
        await replaceCachedSections({ email: emailSection }, null);
        return;
      }
      await syncSmtpPassword(parsed.smtpPass, false);
      await upsertSettingsSection('email', {
        ...emailSection,
        smtpPass: '',
        smtpHasPassword: true,
      }, null);
    });

    writeInstallSettings(this.deps.settingsPath, { emailConfigured: true });

    return {
      body: {
        success: true as const,
        message: 'Outbound email settings saved.',
      },
    };
  }

  async skipEmail() {
    assertInstallNotComplete(this.deps.settingsPath);
    const install = readInstallSettings(this.deps.settingsPath);
    if (!install.databaseInitialized) {
      throw new HttpError(400, 'Initialize the database before skipping email setup.');
    }

    const emailSection = defaultSectionValue('email');
    await withInstallDatabase(this.deps.settingsPath, async () => {
      if (isAppSettingsCacheInitialized()) {
        await replaceCachedSections({ email: emailSection }, null);
        return;
      }
      await upsertSettingsSection('email', emailSection, null);
    });

    writeInstallSettings(this.deps.settingsPath, { emailConfigured: true });

    return {
      body: {
        success: true as const,
        message: 'Email setup skipped. Configure outbound email later in Settings.',
      },
    };
  }

  getCapabilitiesGuide() {
    const install = readInstallSettings(this.deps.settingsPath);
    const capabilities = install.capabilities ?? DEFAULT_NODE_CAPABILITIES;
    const nodeName = install.nodeName ?? 'node-1';

    return {
      body: {
        success: true as const,
        capabilities,
        nodeName,
        envVars: buildCapabilityEnvGuide(capabilities, nodeName),
      },
    };
  }

  async runHealthChecks() {
    const install = readInstallSettings(this.deps.settingsPath);
    const capabilities = install.capabilities ?? normalizeNodeCapabilities({});
    const checks = install.databaseInitialized
      ? await withInstallDatabase(this.deps.settingsPath, () => runInstallHealthChecks({
        settingsPath: this.deps.settingsPath,
        capabilities,
      }))
      : await runInstallHealthChecks({
        settingsPath: this.deps.settingsPath,
        capabilities,
        skipDatabase: true,
      });
    const actionable = checks.filter((check) => check.status !== 'skip');
    const allPassed = actionable.every((check) => check.status === 'pass');

    return {
      body: {
        success: true as const,
        checks,
        allPassed,
      },
    };
  }

  async complete() {
    assertInstallNotComplete(this.deps.settingsPath);
    const install = readInstallSettings(this.deps.settingsPath);
    if (!install.capabilities?.length) {
      throw new HttpError(400, 'Select node capabilities before completing install.');
    }
    if (!install.nodeName) {
      throw new HttpError(400, 'Configure node name before completing install.');
    }

    if (!install.databaseInitialized) {
      throw new HttpError(400, 'Initialize the database before completing install.');
    }

    if (!isInstallServerPromoted() && isInstallPromotionAvailable()) {
      // Promotion already performs the equivalent control-plane connect + runtime init.
      // Re-running refreshServerRuntimeAfterInstall right after would tear down and rebind
      // the Prisma client the just-started background workers (e.g. WorkflowEngineWorker)
      // are already using, racing an in-flight query against $disconnect().
      await promoteInstallPendingServer(this.deps.settingsPath);
    } else {
      await refreshServerRuntimeAfterInstall(this.deps.settingsPath);
    }

    writeInstallSettings(this.deps.settingsPath, {
      pending: false,
      completedAt: new Date().toISOString(),
    });

    return {
      body: {
        success: true as const,
        message: 'Install complete.',
        redirectTo: INSTALL_COMPLETE_REDIRECT_PATH,
        restartRequired: false,
      },
    };
  }
}
