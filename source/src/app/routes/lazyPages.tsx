import { lazy, type ComponentType } from 'react';

const lazyNamed = <T extends ComponentType<unknown>>(
  loader: () => Promise<Record<string, T>>,
  exportName: string,
) => lazy(async () => {
  const module = await loader();
  const component = module[exportName];
  if (!component) {
    throw new Error(`Lazy route export "${exportName}" was not found.`);
  }
  return { default: component };
});

export const ServerFunctionsPage = lazyNamed(
  () => import('../../features/server-functions/ServerFunctionsPage'),
  'ServerFunctionsPage',
);

export const ComponentDesignerPage = lazyNamed(
  () => import('../../features/component-designer/ComponentDesignerPage'),
  'ComponentDesignerPage',
);

export const ComponentDesignerOutlinePreviewPage = lazyNamed(
  () => import('../../features/component-designer/ComponentDesignerOutlinePreviewPage'),
  'ComponentDesignerOutlinePreview',
);

export const LogsPage = lazyNamed(
  () => import('../../features/logs/LogsPage'),
  'LogsPage',
);

export const RecordEventsPage = lazyNamed(
  () => import('../../features/record-events/RecordEventsPage'),
  'RecordEventsPage',
);

export const PlatformPortalsPage = lazyNamed(
  () => import('../../features/platform-portals/PlatformPortalsPage'),
  'PlatformPortalsPage',
);

export const PlatformNavigationsPage = lazyNamed(
  () => import('../../features/platform-navigations/PlatformNavigationsPage'),
  'PlatformNavigationsPage',
);

export const PackageManagerPage = lazyNamed(
  () => import('../../features/packages/PackageManagerPage'),
  'PackageManagerPage',
);

export const LibrariesPage = lazyNamed(
  () => import('../../features/libraries/LibrariesPage'),
  'LibrariesPage',
);

export const RolesPage = lazyNamed(
  () => import('../../features/roles/RolesPage'),
  'RolesPage',
);

export const DataSourcesPage = lazyNamed(
  () => import('../../features/data-sources/DataSourcesPage'),
  'DataSourcesPage',
);

export const DataStudioPage = lazyNamed(
  () => import('../../features/data-studio/DataStudioPage'),
  'DataStudioPage',
);

export const SqlConsolePage = lazyNamed(
  () => import('../../features/sql-console/SqlConsolePage'),
  'SqlConsolePage',
);

export const WorkbooksPage = lazyNamed(
  () => import('../../features/workbooks/WorkbooksPage'),
  'WorkbooksPage',
);

export const MyWorkbooksPage = lazyNamed(
  () => import('../../features/workbooks/MyWorkbooksPage'),
  'MyWorkbooksPage',
);

export const SharedWorkbookPage = lazyNamed(
  () => import('../../features/workbooks/SharedWorkbookPage'),
  'SharedWorkbookPage',
);

export const DashboardSnapshotPage = lazyNamed(
  () => import('../../features/dashboard-canvas/DashboardSnapshotPage'),
  'DashboardSnapshotPage',
);

export const IdeaFoundryPage = lazyNamed(
  () => import('../../features/idea-foundry/IdeaFoundryPage'),
  'IdeaFoundryPage',
);

export const ApiTalkPage = lazyNamed(
  () => import('../../features/api-talk/ApiTalkPage'),
  'ApiTalkPage',
);

export const CachePage = lazyNamed(
  () => import('../../features/cache'),
  'CachePage',
);

export const ScheduledTasksPage = lazyNamed(
  () => import('../../features/scheduled-tasks/ScheduledTasksPage'),
  'ScheduledTasksPage',
);

export const JobsPage = lazyNamed(
  () => import('../../features/jobs/JobsPage'),
  'JobsPage',
);

export const WorkflowsPage = lazyNamed(
  () => import('../../features/workflows/WorkflowsPage'),
  'WorkflowsPage',
);

export const MyInboxPage = lazyNamed(
  () => import('./MyInboxPage'),
  'MyInboxPage',
);

export const GitPage = lazyNamed(
  () => import('../../features/git/GitPage'),
  'GitPage',
);

export const FileManagerPage = lazyNamed(
  () => import('../../features/file-manager/FileManagerPage'),
  'FileManagerPage',
);

export const BaseComponentsPage = lazyNamed(
  () => import('../../features/base-components/BaseComponentsPage'),
  'BaseComponentsPage',
);

export const AppearancePage = lazyNamed(
  () => import('../../features/appearance/AppearancePage'),
  'AppearancePage',
);

export const DevReferencePage = lazyNamed(
  () => import('../../features/dev-reference/DevReferencePage'),
  'DevReferencePage',
);

export const DashboardPage = lazyNamed(
  () => import('../../features/dashboard/DashboardPage'),
  'Dashboard',
);

export const UsersPage = lazyNamed(
  () => import('../../features/users/UsersPage'),
  'Users',
);

export const SettingsPage = lazyNamed(
  () => import('../../features/settings/SettingsPage'),
  'Settings',
);

export const PlatformTransferPage = lazyNamed(
  () => import('../../features/platform-transfer/PlatformTransferPage'),
  'PlatformTransferPage',
);

export const BaseInfoPage = lazyNamed(
  () => import('../../features/base-info/BaseInfoPage'),
  'BaseInfo',
);

export const OrganizationChartPage = lazyNamed(
  () => import('../../features/org-geo/OrganizationChartPage'),
  'OrganizationChartPage',
);

export const GeographicDivisionsPage = lazyNamed(
  () => import('../../features/org-geo/GeographicDivisionsPage'),
  'GeographicDivisionsPage',
);

export const ChatHistoryPage = lazyNamed(
  () => import('../../features/chat-history/ChatHistoryPage'),
  'ChatHistory',
);

export const InAppNotificationsPage = lazyNamed(
  () => import('../../features/in-app-notifications/InAppNotificationsPage'),
  'InAppNotifications',
);

export const LoginPage = lazyNamed(
  () => import('../../pages/Login'),
  'Login',
);

export const HwySelfRegistrationPage = lazyNamed(
  () => import('../../pages/HwySelfRegistration'),
  'HwySelfRegistration',
);

export const HwyTrackRegistrationPage = lazyNamed(
  () => import('../../pages/HwyTrackRegistration'),
  'HwyTrackRegistration',
);

export const HwyPublicLoginPage = lazyNamed(
  () => import('../../pages/HwyPublicLogin'),
  'HwyPublicLogin',
);

export const HwyRegistrationDevPortalPage = lazyNamed(
  () => import('../../pages/HwyRegistrationDevPortal'),
  'HwyRegistrationDevPortal',
);

export const RegisterPage = lazyNamed(
  () => import('../../pages/Register'),
  'Register',
);

export const ForgotPasswordPage = lazyNamed(
  () => import('../../pages/ForgotPassword'),
  'ForgotPassword',
);

export const ResetPasswordPage = lazyNamed(
  () => import('../../pages/ResetPassword'),
  'ResetPassword',
);

export const VerifyEmailPage = lazyNamed(
  () => import('../../pages/VerifyEmail'),
  'VerifyEmail',
);

export const InstallPage = lazyNamed(
  () => import('../../pages/Install'),
  'Install',
);

export const MyApisPage = lazyNamed(
  () => import('../../features/my-apis/MyApisPage'),
  'MyApis',
);

export const FeedbackInboxPage = lazyNamed(
  () => import('../../features/feedback/FeedbackInboxPage'),
  'FeedbackInboxPage',
);

export const MyFeedbackPage = lazyNamed(
  () => import('../../features/feedback/MyFeedbackPage'),
  'MyFeedbackPage',
);

