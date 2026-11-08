import express from 'express';
import { describe, expect, it } from 'vitest';
import { INITIAL_FUNCTIONS } from '../../../shared/api/contracts/server-functions/initialFunctions';
import { isPackageServerFunction } from '../../../shared/api/contracts/server-functions/packageFunctions';
import { listManagedFunctionsFromStore } from '../../../core/functions/FunctionFileStore';
import { mountAiRoutes } from '../../routes/ai.routes';
import { mountBaseInfoRoutes } from '../../routes/base-info.routes';
import { mountScopeMembershipsRoutes } from '../../routes/scope-memberships.routes';
import { mountCacheRoutes } from '../../routes/cache.routes';
import { mountDashboardRoutes } from '../../routes/dashboard.routes';
import { mountDataSourcesRoutes } from '../../routes/data-sources.routes';
import { mountDocsRoutes } from '../../routes/docs.routes';
import { mountFunctionsRoutes } from '../../routes/functions.routes';
import { mountGitRoutes } from '../../routes/git.routes';
import { mountJobsRoutes } from '../../routes/jobs.routes';
import { mountLogsRoutes } from '../../routes/logs.routes';
import { mountMcpRoutes } from '../../routes/mcp.routes';
import { mountPackagesRoutes } from '../../routes/packages.routes';
import { mountPlatformRoutes } from '../../routes/platform.routes';
import { mountProfileRoutes } from '../../routes/profile.routes';
import { mountPwaRoutes } from '../../routes/pwa.routes';
import { mountSchedulerRoutes } from '../../routes/scheduler.routes';
import { mountServerFunctionRoutes } from '../../routes/server-functions.routes';
import { mountSettingsAttributesRoutes } from '../../routes/settings-attributes.routes';
import { mountSettingsRoutes } from '../../routes/settings.routes';
import { mountSlotsRoutes } from '../../routes/slots.routes';
import { mountUsersRoutes } from '../../routes/users.routes';
import { collectSystemApiRoutes } from '../../utils/systemApiRoutes';
import { buildMergedServerFunctionsCatalog } from '../serverFunctionsCatalog.service';

const mountRepresentativeApiRoutes = (app: express.Express) => {
  const settingsPath = 'settings.json';
  const discoverSystemRoutes = () => collectSystemApiRoutes(app);

  mountProfileRoutes(app);
  mountUsersRoutes(app);
  mountBaseInfoRoutes(app);
  mountScopeMembershipsRoutes(app);
  mountDataSourcesRoutes(app, { settingsPath, edgeDbQuery: async () => ({ data: [], count: 0 }) });
  mountFunctionsRoutes(app, { discoverSystemRoutes });
  mountServerFunctionRoutes(app, {
    settingsPath,
    edgeDbQuery: async () => ({ data: [], count: 0 }),
    discoverSystemRoutes,
  });
  mountAiRoutes(app, {
    settingsPath,
    aiChatRateLimiter: (_req, _res, next) => { next(); },
  });
  mountPackagesRoutes(app, { discoverSystemRoutes });
  mountCacheRoutes(app);
  mountGitRoutes(app);
  mountLogsRoutes(app, { settingsPath });
  mountSettingsRoutes(app, { settingsPath });
  mountSettingsAttributesRoutes(app);
  mountPwaRoutes(app, { settingsPath });
  mountJobsRoutes(app);
  mountSchedulerRoutes(app, { settingsPath });
  mountSlotsRoutes(app);
  mountDashboardRoutes(app, { settingsPath });
  mountPlatformRoutes(app);
  mountDocsRoutes(app);
  mountMcpRoutes(app);
};

describe('live server function catalog counts', () => {
  it('reports built-in, custom, package, and merged totals', async () => {
    const app = express();
    app.use(express.json());
    mountRepresentativeApiRoutes(app);

    const merged = await buildMergedServerFunctionsCatalog({
      discoverSystemRoutes: () => collectSystemApiRoutes(app),
    });

    const customFromStore = listManagedFunctionsFromStore();
    const builtIn = merged.filter((fn) => fn.isBuiltIn && !isPackageServerFunction(fn));
    const packageApis = merged.filter((fn) => isPackageServerFunction(fn));
    const custom = merged.filter((fn) => !fn.isBuiltIn && !isPackageServerFunction(fn));
    const discoveredRoutes = await collectSystemApiRoutes(app);

    const report = {
      totalMergedCatalog: merged.length,
      builtIn: builtIn.length,
      custom: custom.length,
      packageApis: packageApis.length,
      customFromFileStore: customFromStore.length,
      initialFunctionsSeedCount: INITIAL_FUNCTIONS.length,
      discoveredExpressRoutes: discoveredRoutes.length,
      visibleWhenBuiltInHidden: custom.length + packageApis.length,
      visibleWhenBuiltInShown: merged.length,
    };

    // eslint-disable-next-line no-console
    console.log('\n[server-function-counts]', JSON.stringify(report, null, 2));

    expect(merged.length).toBeGreaterThan(0);
    expect(report.totalMergedCatalog).toBe(
      report.builtIn + report.custom + report.packageApis,
    );
  });
});
