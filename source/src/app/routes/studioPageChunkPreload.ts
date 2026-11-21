import type { PlatformRuntimeConfig } from '../../shared/api/contracts/platform/types';
import {
  buildPackageUiModuleUrl,
  parsePackagePageLoaderRef,
} from '../../shared/api/contracts/package-manifest/extensionUiRoutes';
import { getPageModuleByKey } from '../platform/platformConfigHelpers';
import { warmPackagePageModuleUrl } from '../platform/PackagePageModule';

const CORE_PAGE_CHUNK_PRELOAD: Record<string, () => Promise<unknown>> = {
  'core:Dashboard': () => import('../../features/dashboard/DashboardPage'),
  'core:Users': () => import('../../features/users/UsersPage'),
  'core:Roles': () => import('../../features/roles/RolesPage'),
  'core:ComponentDesigner': () => import('../../features/component-designer/ComponentDesignerPage'),
  'core:PackageManager': () => import('../../features/packages/PackageManagerPage'),
  'core:Libraries': () => import('../../features/libraries/LibrariesPage'),
  'core:BaseComponents': () => import('../../features/base-components/BaseComponentsPage'),
  'core:Appearance': () => import('../../features/appearance/AppearancePage'),
  'core:DevReference': () => import('../../features/dev-reference/DevReferencePage'),
  'core:Settings': () => import('../../features/settings/SettingsPage'),
  'core:ServerFunctions': () => import('../../features/server-functions/ServerFunctionsPage'),
  'core:DataStudio': () => import('../../features/data-studio/DataStudioPage'),
  'core:DataSources': () => import('../../features/data-sources/DataSourcesPage'),
  'core:SqlConsole': () => import('../../features/sql-console/SqlConsolePage'),
  'core:Workbooks': () => import('../../features/workbooks/WorkbooksPage'),
  'core:MyWorkbooks': () => import('../../features/workbooks/MyWorkbooksPage'),
  'core:IdeaFoundry': () => import('../../features/idea-foundry/IdeaFoundryPage'),
  'core:ApiTalk': () => import('../../features/api-talk/ApiTalkPage'),
  'core:Cache': () => import('../../features/cache'),
  'core:Git': () => import('../../features/git/GitPage'),
  'core:FileManager': () => import('../../features/file-manager/FileManagerPage'),
  'core:Logs': () => import('../../features/logs/LogsPage'),
  'core:RecordEvents': () => import('../../features/record-events/RecordEventsPage'),
  'core:Jobs': () => import('../../features/jobs/JobsPage'),
  'core:Workflows': () => import('../../features/workflows/WorkflowsPage'),
  'core:MyInbox': () => import('./MyInboxPage'),
  'core:MyFeedback': () => import('../../features/feedback/MyFeedbackPage'),
  'core:FeedbackInbox': () => import('../../features/feedback/FeedbackInboxPage'),
  'core:ScheduledTasks': () => import('../../features/scheduled-tasks/ScheduledTasksPage'),
  'core:BaseInfo': () => import('../../features/base-info/BaseInfoPage'),
  'core:OrganizationChart': () => import('../../features/org-geo/OrganizationChartPage'),
  'core:GeographicDivisions': () => import('../../features/org-geo/GeographicDivisionsPage'),
  'core:ChatHistory': () => import('../../features/chat-history/ChatHistoryPage'),
  'core:InAppNotifications': () => import('../../features/in-app-notifications/InAppNotificationsPage'),
  'core:MyApis': () => import('../../features/my-apis/MyApisPage'),
  'core:PlatformPortals': () => import('../../features/platform-portals/PlatformPortalsPage'),
  'core:PlatformNavigations': () => import('../../features/platform-navigations/PlatformNavigationsPage'),
  'core:PlatformTransfer': () => import('../../features/platform-transfer/PlatformTransferPage'),
};

const warmedPageKeys = new Set<string>();

/** Landing routes worth warming on idle bandwidth after the active page chunk starts. */
const IDLE_WARM_PAGE_KEYS = ['dashboard'] as const;

let idleWarmupScheduled = false;

/** After first paint, prefetch likely next hop (dashboard) without blocking the critical path. */
export function scheduleIdleStudioPageWarmup(
  config: PlatformRuntimeConfig,
  platformRuntimeVersion: string,
  activePageKey: string | undefined,
): void {
  if (idleWarmupScheduled || typeof window === 'undefined') {
    return;
  }
  idleWarmupScheduled = true;

  const run = () => {
    for (const pageKey of IDLE_WARM_PAGE_KEYS) {
      if (pageKey === activePageKey?.trim()) {
        continue;
      }
      preloadStudioPageChunk(config, platformRuntimeVersion, pageKey);
    }
  };

  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(run, { timeout: 5_000 });
  } else {
    window.setTimeout(run, 2_000);
  }
}

/** Prefetch core Vite chunks or package UI modules before the operator clicks a sidebar link. */
export function preloadStudioPageChunk(
  config: PlatformRuntimeConfig,
  platformRuntimeVersion: string,
  pageKey: string | undefined,
): void {
  const trimmedKey = pageKey?.trim();
  if (!trimmedKey) {
    return;
  }

  const dedupeKey = `${platformRuntimeVersion}:${trimmedKey}`;
  if (warmedPageKeys.has(dedupeKey)) {
    return;
  }

  const module = getPageModuleByKey(config, trimmedKey);
  if (!module?.enabled) {
    return;
  }

  if (module.loaderKind === 'package') {
    const parsed = parsePackagePageLoaderRef(module.loaderRef);
    if (!parsed) {
      return;
    }
    warmedPageKeys.add(dedupeKey);
    const moduleUrl = buildPackageUiModuleUrl(
      parsed.packageId,
      parsed.pageKey,
      platformRuntimeVersion,
    );
    warmPackagePageModuleUrl(moduleUrl);
    return;
  }

  const loaderRef = module.loaderRef?.trim();
  const preload = loaderRef ? CORE_PAGE_CHUNK_PRELOAD[loaderRef] : undefined;
  if (!preload) {
    return;
  }

  warmedPageKeys.add(dedupeKey);
  void preload().catch(() => {
    warmedPageKeys.delete(dedupeKey);
  });
}