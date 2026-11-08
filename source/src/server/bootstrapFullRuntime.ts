import { type Express, type Router } from 'express';
import { createPlatformAssetStaticHandler } from './app';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { Pool } from 'pg';
import { createEdgeDbQueryExecutor } from '../core/database/EdgeDbRouter';
import { initPinoRuntime, shutdownLogPersistence } from '../core/logging/PinoRuntime';
import { logger } from '../core/logging/Logger';
import { sanitizeMethodLogConfigs } from './utils/httpLogging';
import { PROJECT_STANDARDS } from '../config/projectStandards';
import { isAnonymousCmsPublicSiteUiApiPath } from '../core/packages/cmsPublicSitePack';
import {
  ensureFunctionStoreDirs,
} from '../core/functions/FunctionFileStore';
import {
  ensurePackageStorageDirs,
} from '../core/packages/PackageFileStore';
import {
  ensurePlatformRegistryDirs,
} from '../core/platform-registry/PlatformRegistryFileStore';
import { invalidatePlatformRuntimeConfig } from './services/platform/platformRuntimeConfig.service';
import { ensureDesignerStoragePaths } from './domain/component-designer/storage';
import {
  ensurePackageWorkspaceAssetsDir,
  getPackageWorkspaceAssetsRootPath,
} from './services/package/packageWorkspaceAssets.service';
import { ensurePwaAssetsDir, getPwaAssetsRootPath } from './services/pwaAssets.service';
import { ensureWebFontsAssetsDir, getWebFontsAssetsRootPath } from './services/platform/platformWebFonts.service';
import { PACKAGE_WORKSPACE_ASSETS_URL_PREFIX } from '../shared/lib/packageWorkspaceAssets';
import { PWA_PLATFORM_ASSETS_URL_PREFIX } from '../shared/lib/pwaAssets';
import { WEB_FONTS_PLATFORM_ASSETS_URL_PREFIX } from '../shared/lib/platformWebFonts';
import { readRuntimeSettings, resolveListenPort } from './config/settingsFile';
import { getDataSourcesFromSettings } from './db/dataSourcesStore';
import { closeControlPlanePool, initControlPlanePool } from './db/controlPlane';
import { closeControlPlaneSequelize } from './db/controlPlaneSequelize';
import {
  applyApplicationSettingsRuntime,
  type ApplicationSettingsRuntimeSlice,
} from './applyApplicationSettingsRuntime';
import { ensureControlPlaneBootDataAndCaches } from './parallelControlPlaneBoot';
import { ensureControlPlaneFeatureTables } from './db/ensureControlPlaneFeatureTables';
import { ensureControlPlaneInitialized } from './db/controlPlaneInit';
import { ensureDevSimpleAuthSettings } from './setup/greenfieldInstall';
import { initComponentUsagePersistence } from './services/component-usage/componentUsagePersistence.service';
import { shutdownComponentUsagePersistence } from './services/component-usage/componentUsagePersistence.service';
import {
  bindPrismaToPgPool,
  closePrismaControlPlane,
  initPrismaControlPlane,
} from './db/prismaControlPlane';
import { readControlPlaneDatabaseSettings } from './db/controlPlaneDatabase';
import { ensurePlatformOpsDashboards } from './domain/platform-ops-dashboards/seedPlatformOpsDashboards';
import { createUserRateLimiter } from './middleware/rateLimit';
import { requireAuth, tryAttachAuth } from './middleware/auth.middleware';
import { pageProfileRequestMiddleware } from './middleware/pageProfile.middleware';
import { wrapEdgeDbQueryExecutorWithPerf } from './domain/perf/wrapEdgeDbQueryExecutor';
import { mountAiRoutes } from './routes/ai.routes';
import { mountEuaRoutes } from './routes/eua.routes';
import { mountAuthRoutes } from './routes/auth.routes';
import { mountBaseInfoRoutes } from './routes/base-info.routes';
import { mountScopeMembershipsRoutes } from './routes/scope-memberships.routes';
import { mountRecordPolicyAdminRoutes } from './routes/record-policy-admin.routes';
import { mountCacheRoutes } from './routes/cache.routes';
import { mountSqlConsoleRoutes } from './routes/sql-console.routes';
import { mountWorkbooksRoutes } from './routes/workbooks.routes';
import { mountIdeaFoundryRoutes } from './routes/idea-foundry.routes';
import { mountDevToolbarRoutes } from './routes/dev-toolbar.routes';
import { mountHttpConnectionRoutes } from './routes/http-connections.routes';
import { mountApiTalkRoutes } from './routes/api-talk.routes';
import { mountFileManagerRoutes } from './routes/file-manager.routes';
import { mountGitRoutes } from './routes/git.routes';
import { mountSshHubRoutes } from './routes/ssh-hub.routes';
import { mountRdpHubRoutes } from './routes/rdp-hub.routes';
import { mountFileHubRoutes } from './routes/file-hub.routes';
import { mountComponentDesignerRoutes } from './routes/component-designer.routes';
import { mountComponentUsageRoutes } from './routes/component-usage.routes';
import { mountAccessAssistantRoutes } from './routes/access-assistant.routes';
import { mountWorkflowsRoutes } from './routes/workflows.routes';
import { mountWorkflowRuntimeRoutes } from './routes/workflow-runtime.routes';
import { mountWorkflowWorkItemsRoutes } from './routes/workflow-work-items.routes';
import { mountWorkflowProofRoutes } from './routes/workflow-proof.routes';
import { mountWorkflowHooksRoutes } from './routes/workflow-hooks.routes';
import { mountUserNotificationsRoutes } from './routes/user-notifications.routes';
import { mountUserMessageDispatchesRoutes } from './routes/user-message-dispatches.routes';
import { mountPersonalInboxRoutes } from './routes/personal-inbox.routes';
import { mountDirectMessagesRoutes } from './routes/direct-messages.routes';
import { mountWorkItemDelegationRulesRoutes } from './routes/work-item-delegation-rules.routes';
import { mountWorkItemSavedFiltersRoutes } from './routes/work-item-saved-filters.routes';
import { mountWorkflowBusinessHoursCalendarRoutes } from './routes/workflow-business-hours-calendar.routes';
import { startWorkflowEngineWorker } from './domain/workflow/engine/workflowEngineWorker';
import { ensureReservedScheduledStartFunctionRegistered } from './domain/workflow/publication/bindingAdapters/scheduleBindingAdapter';
import { registerCoreActionPack } from './domain/workflow/actions/corePack';
import { mountDataSourcesRoutes } from './routes/data-sources.routes';
import { mountDashboardCanvasRoutes, mountDataSourcePivotRoute } from './routes/dashboard-canvas.routes';
import { mountDbEnrichmentRoutes } from './routes/db-enrichment.routes';
import { DataSourcesService } from './services/data-sources.service';
import { mountDataApiRoutes } from './routes/data-api.routes';
import { mountServerFunctionRoutes } from './routes/server-functions.routes';
import { mountFunctionsRoutes } from './routes/functions.routes';
import {
  configureDeferredMethodLogConfigs,
  createSystemRouteDiscovery,
  registerRouteDiscoveryApp,
} from './utils/serverRouteDiscoveryRegistry';
import { mountLogsRoutes } from './routes/logs.routes';
import { mountRecordEventsRoutes } from './routes/record-events.routes';
import { mountRetentionRoutes } from './routes/retention.routes';
import { mountPackagesRoutes } from './routes/packages.routes';
import { mountLibrariesRoutes } from './routes/libraries.routes';
import { mountProfileRoutes } from './routes/profile.routes';
import { mountSettingsRoutes } from './routes/settings.routes';
import { mountSettingsAttributesRoutes } from './routes/settings-attributes.routes';
import { mountPwaRoutes } from './routes/pwa.routes';
import { mountUsersRoutes } from './routes/users.routes';
import { createManagedFunctionProxyMiddleware } from './middleware/managedFunctionProxy.middleware';
import { createPackageApiProxyMiddleware } from './middleware/packageApiProxy.middleware';
import { managedFunctionRouteRegistry } from './services/managedFunctionRouteRegistry';
import { builtinFunctionRegistry } from './services/builtinFunctionRegistry.service';
import { mountInstallRoutes } from './routes/install.routes';
import { mountJobsRoutes } from './routes/jobs.routes';
import { mountSchedulerRoutes } from './routes/scheduler.routes';
import { mountAppearancePresetRoutes } from './routes/appearance-presets.routes';
import { mountAppearanceRoutes } from './routes/appearance.routes';
import { mountSlotsRoutes } from './routes/slots.routes';
import { mountSampleMockRoutes } from './routes/sample-mock.routes';
import { mountDataExportRoutes } from './routes/data-export.routes';
import { mountDashboardRoutes } from './routes/dashboard.routes';
import { mountDocsRoutes } from './routes/docs.routes';
import { mountMcpRoutes } from './routes/mcp.routes';
import { mountPlatformRoutes } from './routes/platform.routes';
import { mountPlatformWebFontsRoutes } from './routes/platformWebFonts.routes';
import { mountPackageRoutes } from './routes/package.routes';
import { mountBootRoutes } from './routes/boot.routes';
import { mountFeedbackRoutes } from './routes/feedback.routes';
import { mountRouteLoadingRoutes } from './routes/routeLoading.routes';
import { mountCmsSiteRoutes } from './routes/cms-site.routes';
import { mountCmsHomeRoutes } from './routes/cms-home.routes';
import { openApiSpecService } from './services/openApiSpec.service';
import { startJobWorker } from './services/jobs/jobWorker.service';
import { SchedulerService, startSchedulerTicker } from './services/scheduler/scheduler.service';
import { reloadAllPlatformSettingsCaches } from './services/settings/bootstrapPlatformSettings';
import { getCachedLogDbPersistenceSettings } from './services/settings/appSettingsCache';
import {
  applyAppSettingsRuntimeEffects,
  readAppLoggingSettings,
} from './services/settings/appSettings.service';
import { preloadAllRoleAttributesCache, invalidateAllRoleAttributes, warmRoleAttributesCacheInBackground } from './services/attributes/roleAttributesCache';
import { ensureExperienceRegistryCleanupInBackground } from './services/platform/experienceRoutePropagation.service';
import { loadConfigurableProfileFields } from './services/attributes/profileFields';
import { readPgPoolConfigFromSettings } from './setup/installDatabase';
import { resolveActiveNodeCapabilities, resolveActiveNodeName, type NodeCapability } from '../shared/nodeCapabilities';
import { createNodeCapabilityMiddleware } from './middleware/nodeCapability.middleware';
import { evaluateNodeReadiness } from './services/nodeReadiness.service';
import { runDeferredServerRuntimeWarmup, runDeferredServerRuntimeWarmupSafe } from './deferredServerRuntimeWarmup';
export type FullServerRuntime = {
  settingsPath: string;
  cpPool?: Pool;
  edgeDbQuery: ReturnType<typeof createEdgeDbQueryExecutor>;
  aiSettings: ApplicationSettingsRuntimeSlice['aiSettings'];
  schedulerSettings: ApplicationSettingsRuntimeSlice['schedulerSettings'];
  loggingSettings: ReturnType<typeof readAppLoggingSettings>;
  port: number;
  capabilities: NodeCapability[];
  nodeName: string;
  controlPlaneEngine: 'pg-pool' | 'prisma';
};

const connectControlPlane = async (settingsPath: string): Promise<{ cpPool?: Pool; engine: 'pg-pool' | 'prisma' }> => {
  const dbSettings = readControlPlaneDatabaseSettings(settingsPath);
  const usePrisma = dbSettings.engine === 'prisma' || dbSettings.provider !== 'postgresql';

  if (usePrisma) {
    console.log(`[AppEndO] Connecting to control plane via Prisma (${dbSettings.provider})…`);
    const { pgPool } = await initPrismaControlPlane(settingsPath);

    if (pgPool) {
      initControlPlanePool(pgPool);
    }

    return { cpPool: pgPool, engine: 'prisma' };
  }

  if (dbSettings.provider !== 'postgresql') {
    throw new Error(
      `Control plane provider "${dbSettings.provider}" cannot use the PostgreSQL pg-pool engine. Provider is chosen at setup and must not change on restart.`,
    );
  }

  const poolConfig = readPgPoolConfigFromSettings(settingsPath);
  const cpPool = new Pool({
    ...poolConfig,
    max: 10,
    idleTimeoutMillis: 30000,
  });
  initControlPlanePool(cpPool);

  console.log('[AppEndO] Connecting to PostgreSQL…');
  await cpPool.query('SELECT 1');
  console.log('[AppEndO] Binding Prisma to control plane pool…');
  await bindPrismaToPgPool(cpPool);
  return { cpPool, engine: 'pg-pool' };
};

/** Generate default PNG icons in public/ when missing (fresh clone). */
function ensureBuiltinPwaPublicAssets(): void {
  const marker = path.join(process.cwd(), 'public', 'pwa-192x192.png');
  if (fs.existsSync(marker)) return;
  try {
    console.log('[AppEndO] Generating built-in PWA icons (public/)…');
    execSync('npm run pwa:assets', { stdio: 'inherit', cwd: process.cwd() });
  } catch {
    console.warn('[AppEndO] Missing built-in PWA icons in public/. Run: npm run pwa:assets');
  }
}

function scheduleBuiltinPwaPublicAssets(): void {
  setImmediate(() => {
    ensureBuiltinPwaPublicAssets();
  });
}

export async function initializeFullServerRuntime(settingsPath: string): Promise<FullServerRuntime> {
  const { cpPool, engine } = await connectControlPlane(settingsPath);
  await ensureControlPlaneBootDataAndCaches(settingsPath);
  initPinoRuntime(cpPool, getCachedLogDbPersistenceSettings());
  console.log('[AppEndO] Database ready.');

  // Real gap found and closed (2026-07-16): nothing in this file ever called this before — the
  // in-process Workflow Action Registry (doc 04, Slice 3) was populated only inside each test
  // file's own `beforeAll`, never by the actual running server. A live ACTION node referencing any
  // corePack Action (text.template, date.diff, integration.http-request, …) failed both publish
  // validation and dispatch with `WF_ACTION_IMPLEMENTATION_UNAVAILABLE` — every prior live-HTTP
  // verification happened to only exercise END/WORK_ITEM-only graphs, so this was never caught.
  // Unconditional (not gated behind the `worker` node capability) because publish-time Action
  // resolution validation needs the registry on every node that serves the Designer API, not just
  // nodes that run the background dispatch worker.
  registerCoreActionPack();

  const { aiSettings, schedulerSettings } = await applyApplicationSettingsRuntime(settingsPath);

  ensureFunctionStoreDirs();
  ensureDesignerStoragePaths();
  ensurePackageWorkspaceAssetsDir();
  ensurePwaAssetsDir();
  ensureWebFontsAssetsDir();
  scheduleBuiltinPwaPublicAssets();
  ensurePackageStorageDirs();
  ensurePlatformRegistryDirs();
  const { isHawietyRuntimeEnabled } = await import('./services/hawiety/hawietyRuntime');
  if (isHawietyRuntimeEnabled()) {
    const { ensureHawietyPortalShellBrand } = await import('./domain/hwy/ensureHawietyPortalShellBrand');
    await ensureHawietyPortalShellBrand();
  }
  invalidatePlatformRuntimeConfig();

  const edgeDbQuery = wrapEdgeDbQueryExecutorWithPerf(createEdgeDbQueryExecutor({
    getDataSources: () => getDataSourcesFromSettings(settingsPath),
  }));

  applyAppSettingsRuntimeEffects();
  const loggingSettings = readAppLoggingSettings();
  const runtime = readRuntimeSettings(settingsPath);
  const capabilities = resolveActiveNodeCapabilities({ capabilities: runtime.capabilities });
  const nodeName = resolveActiveNodeName(runtime.nodeName);

  return {
    settingsPath,
    cpPool,
    edgeDbQuery,
    aiSettings,
    schedulerSettings,
    loggingSettings,
    port: resolveListenPort(runtime),
    capabilities,
    nodeName,
    controlPlaneEngine: engine,
  };
}

/** Reconnect the process-global control-plane pool from settings.json. */
export async function rebindControlPlanePool(settingsPath: string): Promise<Pool | undefined> {
  const dbSettings = readControlPlaneDatabaseSettings(settingsPath);
  const usePrisma = dbSettings.engine === 'prisma' || dbSettings.provider !== 'postgresql';

  if (usePrisma) {
    await closePrismaControlPlane();
    await closeControlPlanePool();
    const { pgPool } = await initPrismaControlPlane(settingsPath);
    if (pgPool) {
      initControlPlanePool(pgPool);
      await pgPool.query('SELECT 1');
    }
    return pgPool;
  }

  if (dbSettings.provider !== 'postgresql') {
    throw new Error(
      `Control plane provider "${dbSettings.provider}" cannot use the PostgreSQL pg-pool engine. Provider is chosen at setup and must not change on restart.`,
    );
  }

  const poolConfig = readPgPoolConfigFromSettings(settingsPath);
  await closePrismaControlPlane();
  await closeControlPlanePool();
  const cpPool = new Pool({
    ...poolConfig,
    max: 10,
    idleTimeoutMillis: 30000,
  });
  initControlPlanePool(cpPool);
  await cpPool.query('SELECT 1');
  await bindPrismaToPgPool(cpPool);
  return cpPool;
}

/** Rebind pools and in-memory caches after install completes on an already-running full server. */
export async function refreshServerRuntimeAfterInstall(settingsPath: string): Promise<void> {
  console.log('[AppEndO] Install complete — refreshing in-memory server runtime (no restart).');

  const cpPool = await rebindControlPlanePool(settingsPath);
  await ensureControlPlaneInitialized(settingsPath, { pushSchema: false });
  await closeControlPlaneSequelize();
  await Promise.all([
    ensureControlPlaneFeatureTables(settingsPath),
    reloadAllPlatformSettingsCaches(settingsPath),
  ]);
  initComponentUsagePersistence();
  await ensureDevSimpleAuthSettings(null);

  await shutdownComponentUsagePersistence();
  await shutdownLogPersistence();
  initPinoRuntime(cpPool, getCachedLogDbPersistenceSettings());

  await applyApplicationSettingsRuntime(settingsPath);

  ensurePlatformRegistryDirs();
  invalidatePlatformRuntimeConfig();
  await runDeferredServerRuntimeWarmup(settingsPath);
  void ensurePlatformOpsDashboards(settingsPath).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Server', `Ops dashboard seed after install failed: ${message}`);
  });

  await invalidateAllRoleAttributes();
  await preloadAllRoleAttributesCache();
  await loadConfigurableProfileFields();

  applyAppSettingsRuntimeEffects();
  await warmFullServerRouteCaches();

  logger.info('Server', 'Install wizard finished — server runtime refreshed.');
  console.log('[AppEndO] Server runtime refreshed after install.');
}

type MountFullServerRoutesOptions = {
  parentApp: Express;
  includeInstallRoutes?: boolean;
  includeCoreApiEndpoints?: boolean;
};

export async function mountFullServerRoutes(
  target: Express | Router,
  runtime: FullServerRuntime,
  options: MountFullServerRoutesOptions,
): Promise<void> {
  const { settingsPath, cpPool, edgeDbQuery, aiSettings, schedulerSettings, loggingSettings, port, capabilities, nodeName } = runtime;
  const { parentApp, includeInstallRoutes = true, includeCoreApiEndpoints = true } = options;
  // Install promotion passes an API Router; normal boot passes the root Express app — same mount surface.
  const routeHost = target as Express;

  if (!aiSettings.enabled) {
    logger.warn('Server', 'AI is disabled in settings.json ai block.');
  } else if (aiSettings.models.filter((model) => model.enabled).length === 0) {
    logger.warn('Server', 'No enabled AI models are configured in settings.json.');
  }

  if (includeCoreApiEndpoints) {
    routeHost.get('/api/health', (_req, res) => {
      res.json({
        status: 'ok',
        nodeName,
        capabilities,
      });
    });

    routeHost.get('/api/ready', async (_req, res) => {
      const report = await evaluateNodeReadiness({
        pool: cpPool,
        settingsPath,
        capabilities,
        nodeName,
      });
      if (report.status === 'ready') {
        res.json(report);
        return;
      }
      res.status(503).json(report);
    });

    routeHost.get('/api/project-standards', (_req, res) => {
      res.json({ success: true, resource: PROJECT_STANDARDS });
    });
  }

  const aiChatRateLimiter = createUserRateLimiter({
    keyPrefix: 'ai-chat',
    maxPerMinute: aiSettings.chatRateLimitPerMinute,
  });
  const euaRateLimiter = createUserRateLimiter({
    keyPrefix: 'eua-field-assist',
    maxPerMinute: aiSettings.chatRateLimitPerMinute,
  });

  mountAuthRoutes(routeHost);

  mountBootRoutes(routeHost, { settingsPath });
  mountFeedbackRoutes(routeHost, settingsPath);
  mountRouteLoadingRoutes(routeHost, settingsPath);

  if (includeInstallRoutes) {
    mountInstallRoutes(routeHost, { settingsPath });
  }

  routeHost.use('/api', pageProfileRequestMiddleware);

  routeHost.use('/api', createNodeCapabilityMiddleware(capabilities));

  routeHost.use(createPackageApiProxyMiddleware({ activeCapabilities: capabilities }));

  routeHost.use('/api', async (req, res, next) => {
    const pathname = (req.originalUrl || '').split('?')[0] || '';
    const apiRelativePath = pathname.startsWith('/api')
      ? pathname.slice(4) || '/'
      : req.path;
    if (
      apiRelativePath === '/health'
      || apiRelativePath === '/ready'
      || apiRelativePath === '/boot'
      || apiRelativePath.startsWith('/install')
      || apiRelativePath === '/project-standards'
      || apiRelativePath === '/pwa/config'
      || (req.method === 'GET' && /^\/pwa\/icons\/[^/]+\/file$/.test(apiRelativePath))
      || apiRelativePath === '/platform/runtime-config'
      || (apiRelativePath === '/platform/cultures' && req.method === 'GET')
      || (req.method === 'GET' && /^\/platform\/culture-translations\/bundle\/[^/]+$/.test(apiRelativePath))
      || apiRelativePath.startsWith('/auth/')
      // p-68 WHOOK Part A: external callers authenticate with the URL's webhook secret, not a
      // session — this route intentionally never reaches requireAuth below.
      || apiRelativePath.startsWith('/workflow-hooks/')
      // p-99/WFT-13: the inbound MCP host authenticates external clients with its own admin-issued
      // API key (`requireInboundMcpApiKey`, checked inside `mountMcpRoutes`), never a session — same
      // shape as the WHOOK exclusion above. Without this, a real external MCP client's bearer API
      // key is mis-parsed as a session JWT here and rejected before its own auth check ever runs.
      || apiRelativePath === '/mcp'
      || (req.method === 'GET' && apiRelativePath.startsWith('/cms-site/'))
      || (req.method === 'GET' && isAnonymousCmsPublicSiteUiApiPath(apiRelativePath))
      // Hawiety public portal (self-registration, login) — no studio session.
      || apiRelativePath.startsWith('/hwy/public/')
      || (req.method === 'GET' && /^\/hwy\/institutes\/\d+\/logo$/.test(apiRelativePath))
    ) {
      next();
      return;
    }

    try {
      await builtinFunctionRegistry.ensureLoaded();
      if (builtinFunctionRegistry.isPublicBuiltInRoute(req.method, pathname)) {
        tryAttachAuth(req);
        next();
        return;
      }
    } catch {
      // Fall through when the built-in registry is unavailable.
    }

    try {
      await managedFunctionRouteRegistry.ensureLoaded();
      if (managedFunctionRouteRegistry.isPublicManagedRoute(req.method, pathname)) {
        tryAttachAuth(req);
        next();
        return;
      }
    } catch {
      // Fall through to standard auth when the managed route registry is unavailable.
    }

    requireAuth(req, res, next);
  });

  mountProfileRoutes(routeHost);
  mountUsersRoutes(routeHost);
  mountBaseInfoRoutes(routeHost);
  mountScopeMembershipsRoutes(routeHost);
  mountRecordPolicyAdminRoutes(routeHost);
  mountDataSourcesRoutes(routeHost, { settingsPath, edgeDbQuery });
  mountDashboardCanvasRoutes(routeHost);
  mountDataSourcePivotRoute(routeHost);
  mountDbEnrichmentRoutes(routeHost, { settingsPath, edgeDbQuery });
  mountDataApiRoutes(routeHost, { settingsPath, edgeDbQuery });
  mountFunctionsRoutes(routeHost, {
    discoverSystemRoutes: createSystemRouteDiscovery({ includePreviewCode: true }),
  });
  mountServerFunctionRoutes(routeHost, {
    edgeDbQuery,
    settingsPath,
    discoverSystemRoutes: createSystemRouteDiscovery({ includePreviewCode: true }),
  });
  mountAiRoutes(routeHost, { settingsPath, aiChatRateLimiter, edgeDbQuery });
  mountEuaRoutes(routeHost, { euaRateLimiter });
  mountPackagesRoutes(routeHost, {
    discoverSystemRoutes: createSystemRouteDiscovery(),
    settingsPath,
    edgeDbQuery,
  });
  mountLibrariesRoutes(routeHost);
  routeHost.use(PACKAGE_WORKSPACE_ASSETS_URL_PREFIX, createPlatformAssetStaticHandler(getPackageWorkspaceAssetsRootPath()));
  routeHost.use(PWA_PLATFORM_ASSETS_URL_PREFIX, createPlatformAssetStaticHandler(getPwaAssetsRootPath()));
  routeHost.use(WEB_FONTS_PLATFORM_ASSETS_URL_PREFIX, createPlatformAssetStaticHandler(getWebFontsAssetsRootPath()));
  mountComponentDesignerRoutes(routeHost, { serverPort: port });
  mountComponentUsageRoutes(routeHost);
  mountAccessAssistantRoutes(routeHost, {
    discoverSystemRoutes: createSystemRouteDiscovery({ includePreviewCode: true }),
  });
  mountWorkflowsRoutes(routeHost);
  mountWorkflowRuntimeRoutes(routeHost);
  mountWorkflowWorkItemsRoutes(routeHost);
  mountWorkflowProofRoutes(routeHost);
  mountWorkflowHooksRoutes(routeHost);
  mountUserNotificationsRoutes(routeHost);
  mountUserMessageDispatchesRoutes(routeHost);
  mountPersonalInboxRoutes(routeHost, settingsPath);
  mountDirectMessagesRoutes(routeHost, settingsPath);
  mountWorkItemDelegationRulesRoutes(routeHost);
  mountWorkItemSavedFiltersRoutes(routeHost);
  mountWorkflowBusinessHoursCalendarRoutes(routeHost);
  mountCacheRoutes(routeHost);
  mountSqlConsoleRoutes(routeHost);
  mountWorkbooksRoutes(routeHost);
  mountIdeaFoundryRoutes(routeHost);
  mountDevToolbarRoutes(routeHost);
  mountApiTalkRoutes(routeHost);
  mountHttpConnectionRoutes(routeHost);
  mountFileManagerRoutes(routeHost);
  mountGitRoutes(routeHost);
  mountSshHubRoutes(routeHost);
  mountRdpHubRoutes(routeHost);
  mountFileHubRoutes(routeHost);
  mountLogsRoutes(routeHost, { settingsPath });
  {
    // Always mount; requireHawietyPackage returns 404 until install enables runtime (no server restart).
    const { mountHwyRoutes } = await import('./routes/hwy.routes');
    mountHwyRoutes(routeHost);
  }
  mountRecordEventsRoutes(routeHost);
  mountRetentionRoutes(routeHost);
  mountSettingsRoutes(routeHost, { settingsPath });
  mountSettingsAttributesRoutes(routeHost);
  mountPwaRoutes(routeHost, { settingsPath });
  mountJobsRoutes(routeHost);
  mountSchedulerRoutes(routeHost, { settingsPath });
  mountAppearancePresetRoutes(routeHost);
  mountAppearanceRoutes(routeHost);
  mountSlotsRoutes(routeHost);
  mountSampleMockRoutes(routeHost);
  mountDataExportRoutes(routeHost);
  mountDashboardRoutes(routeHost, { settingsPath });
  mountCmsSiteRoutes(routeHost, { settingsPath, edgeDbQuery });
  mountCmsHomeRoutes(routeHost);
  mountPlatformWebFontsRoutes(routeHost);
  mountPlatformRoutes(routeHost);
  mountPackageRoutes(routeHost);
  openApiSpecService.configure({
    discoverSystemRoutes: createSystemRouteDiscovery({ includePreviewCode: true }),
  });
  mountDocsRoutes(routeHost);
  mountMcpRoutes(routeHost);

  logger.setMethodConfigs(sanitizeMethodLogConfigs(loggingSettings.methodConfigs));
  configureDeferredMethodLogConfigs(loggingSettings.methodConfigs);

  routeHost.use(createManagedFunctionProxyMiddleware(edgeDbQuery, {
    activeCapabilities: capabilities,
    settingsPath,
  }));

  routeHost.use('/api', (_req, res) => {
    res.status(404).json({ success: false, error: 'API route not found.' });
  });

  registerRouteDiscoveryApp(parentApp);
}

export async function warmFullServerRouteCaches(): Promise<void> {
  try {
    await managedFunctionRouteRegistry.ensureLoaded();
    await builtinFunctionRegistry.ensureLoaded();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Server', `Managed function route cache warm-up failed: ${message}`);
  }
}

export function startFullServerBackgroundWorkers(runtime: FullServerRuntime): void {
  if (!runtime.capabilities.includes('worker')) {
    logger.info('Server', 'Background job worker and scheduler tick are disabled — worker capability is off.');
    return;
  }

  startJobWorker({
    edgeDbQuery: runtime.edgeDbQuery,
    dataSourcesService: new DataSourcesService({ settingsPath: runtime.settingsPath, edgeDbQuery: runtime.edgeDbQuery }),
  });
  const schedulerService = new SchedulerService({ settingsPath: runtime.settingsPath });
  startSchedulerTicker(schedulerService, runtime.schedulerSettings.tickIntervalSec);
  startWorkflowEngineWorker();

  // WFV2-3 — idempotent; no-op once the reserved record exists. Must happen before the scheduler
  // ticker's first tick can find a SCHEDULE-start workflow revision pointing at it.
  void ensureReservedScheduledStartFunctionRegistered().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Server', `Failed to register reserved Workflow scheduled-start function: ${message}`);
  });
}

/**
 * Background boot work must not race the first SPA paint. Empirically, starting
 * workers/cleanup ~15s after listen still pinned multi‑GB RAM and froze /api/boot
 * on Windows. Keep the quiet window long enough for a full first page load.
 */
const POST_LISTEN_BACKGROUND_DELAY_MS = 60_000;

export function startPostListenBackgroundTasks(runtime: FullServerRuntime): void {
  runDeferredServerRuntimeWarmupSafe(runtime.settingsPath);

  void ensurePlatformOpsDashboards(runtime.settingsPath).catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    logger.warn('Server', `Ops dashboard bootstrap failed: ${message}`);
  });

  console.log(
    `[AppEndO] Background workers (jobs/scheduler/route caches) start in ${POST_LISTEN_BACKGROUND_DELAY_MS / 1000}s…`,
  );
  setTimeout(() => {
    // Role-attr warm is cheap; run it. Defer experience cleanup + workers — those
    // contended with Vite transforms and made the UI look permanently stuck.
    warmRoleAttributesCacheInBackground();
    startFullServerBackgroundWorkers(runtime);
    void warmFullServerRouteCaches();
    // Experience registry cleanup can be heavy (DB + mount sync). Run last / separately.
    setTimeout(() => {
      ensureExperienceRegistryCleanupInBackground();
    }, 30_000);
    // Code embeddings stay behind CODE_EMBEDDINGS_ENABLED (status-only when off).
    void import('../shared/api/contracts/ai/codeEmbeddingsGate')
      .then(async ({ CODE_EMBEDDINGS_ENABLED }) => {
        if (!CODE_EMBEDDINGS_ENABLED) return;
        const { warmLocalEmbeddingsModelInBackground } = await import(
          '../core/ai/providers/localEmbeddingsModelLifecycle'
        );
        warmLocalEmbeddingsModelInBackground();
      })
      .catch(() => {
        // Gate module missing would be a build bug; ignore warm failure.
      });
  }, POST_LISTEN_BACKGROUND_DELAY_MS);
}
