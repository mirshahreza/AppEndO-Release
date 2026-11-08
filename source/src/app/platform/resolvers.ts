import React, { lazy, type ComponentType } from 'react';
import { parseDesignerShellEntry } from '../../shared/lib/designerShellEntry';
import { SITE_SHELL_LAYOUT_KEY } from '../../shared/api/contracts/platform/mountConstants';
import {
  BaseInfoPage,
  CachePage,
  ChatHistoryPage,
  InAppNotificationsPage,
  ComponentDesignerPage,
  DashboardPage,
  DataStudioPage,
  DataSourcesPage,
  SqlConsolePage,
  WorkbooksPage,
  MyWorkbooksPage,
  IdeaFoundryPage,
  ApiTalkPage,
  FileManagerPage,
  GitPage,
  JobsPage,
  LogsPage,
  RecordEventsPage,
  MyApisPage,
  MyInboxPage,
  MyFeedbackPage,
  FeedbackInboxPage,
  OrganizationChartPage,
  GeographicDivisionsPage,
  PackageManagerPage,
  LibrariesPage,
  PlatformPortalsPage,
  PlatformNavigationsPage,
  PlatformTransferPage,
  RolesPage,
  BaseComponentsPage,
  AppearancePage,
  DevReferencePage,
  ScheduledTasksPage,
  ServerFunctionsPage,
  SettingsPage,
  UsersPage,
  WorkflowsPage,
} from '../routes/lazyPages';

export type ResolvedComponent = ComponentType<unknown>;

export type PageResolverEntry = {
  component: ResolvedComponent;
  lazy?: boolean;
};

const CORE_SHELL_LAZY_LOADERS: Record<string, () => Promise<{ default: ResolvedComponent }>> = {
  'core:AdminLayout': () => import('../../layouts/AdminLayout').then((module) => ({ default: module.AdminLayout })),
  'core:AppShell': () => import('../../layouts/appShell').then((module) => ({ default: module.AppShell })),
  'core:SiteLayout': () => import('./DesignerPublishedShell').then((module) => ({
    default: module.createDesignerPublishedShellComponent(SITE_SHELL_LAYOUT_KEY),
  })),
  'core:ComponentAlone': () => import('../../layouts/ComponentAloneLayout').then((module) => ({ default: module.ComponentAloneLayout })),
  'core:DesignerShell': () => import('../../layouts/DesignerShell').then((module) => ({ default: module.DesignerShell })),
};

const coreShellComponentCache = new Map<string, ResolvedComponent>();
const designerShellResolverCache = new Map<string, ResolvedComponent>();

const CORE_PAGE_RESOLVERS: Record<string, PageResolverEntry> = {
  'core:Dashboard': { component: DashboardPage, lazy: true },
  'core:Users': { component: UsersPage, lazy: true },
  'core:Roles': { component: RolesPage, lazy: true },
  'core:ComponentDesigner': { component: ComponentDesignerPage, lazy: true },
  'core:PackageManager': { component: PackageManagerPage, lazy: true },
  'core:Libraries': { component: LibrariesPage, lazy: true },
  'core:BaseComponents': { component: BaseComponentsPage, lazy: true },
  'core:Appearance': { component: AppearancePage, lazy: true },
  'core:DevReference': { component: DevReferencePage, lazy: true },
  'core:Settings': { component: SettingsPage, lazy: true },
  'core:ServerFunctions': { component: ServerFunctionsPage, lazy: true },
  'core:DataStudio': { component: DataStudioPage, lazy: true },
  'core:DataSources': { component: DataSourcesPage, lazy: true },
  'core:SqlConsole': { component: SqlConsolePage, lazy: true },
  'core:Workbooks': { component: WorkbooksPage, lazy: true },
  'core:MyWorkbooks': { component: MyWorkbooksPage, lazy: true },
  'core:IdeaFoundry': { component: IdeaFoundryPage, lazy: true },
  'core:ApiTalk': { component: ApiTalkPage, lazy: true },
  'core:Cache': { component: CachePage, lazy: true },
  'core:Git': { component: GitPage, lazy: true },
  'core:FileManager': { component: FileManagerPage, lazy: true },
  'core:Logs': { component: LogsPage, lazy: true },
  'core:RecordEvents': { component: RecordEventsPage, lazy: true },
  'core:Jobs': { component: JobsPage, lazy: true },
  'core:Workflows': { component: WorkflowsPage, lazy: true },
  'core:MyInbox': { component: MyInboxPage, lazy: true },
  'core:MyFeedback': { component: MyFeedbackPage, lazy: true },
  'core:FeedbackInbox': { component: FeedbackInboxPage, lazy: true },
  'core:ScheduledTasks': { component: ScheduledTasksPage, lazy: true },
  'core:BaseInfo': { component: BaseInfoPage, lazy: true },
  'core:OrganizationChart': { component: OrganizationChartPage, lazy: true },
  'core:GeographicDivisions': { component: GeographicDivisionsPage, lazy: true },
  'core:ChatHistory': { component: ChatHistoryPage, lazy: true },
  'core:InAppNotifications': { component: InAppNotificationsPage, lazy: true },
  'core:MyApis': { component: MyApisPage, lazy: true },
  'core:PlatformPortals': { component: PlatformPortalsPage, lazy: true },
  'core:PlatformNavigations': { component: PlatformNavigationsPage, lazy: true },
  'core:PlatformTransfer': { component: PlatformTransferPage, lazy: true },
};

export function resolveShellComponent(entry: string): ResolvedComponent | null {
  const designerShell = parseDesignerShellEntry(entry);
  if (designerShell) {
    const cacheKey = `${designerShell.shellKey}@${designerShell.publishedVersion ?? 'current'}`;
    const cached = designerShellResolverCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const LazyShell = lazy(() =>
      import('./DesignerPublishedShell').then((module) => ({
        default: module.createDesignerPublishedShellComponent(
          designerShell.shellKey,
          designerShell.publishedVersion,
        ),
      })),
    );
    designerShellResolverCache.set(cacheKey, LazyShell as ResolvedComponent);
    return LazyShell as ResolvedComponent;
  }

  const lazyLoader = CORE_SHELL_LAZY_LOADERS[entry];
  if (!lazyLoader) {
    return null;
  }

  const cached = coreShellComponentCache.get(entry);
  if (cached) {
    return cached;
  }

  const LazyShell = lazy(lazyLoader);
  coreShellComponentCache.set(entry, LazyShell as ResolvedComponent);
  return LazyShell as ResolvedComponent;
}

export function resolvePageModule(loaderRef: string): PageResolverEntry | null {
  return CORE_PAGE_RESOLVERS[loaderRef] ?? null;
}
