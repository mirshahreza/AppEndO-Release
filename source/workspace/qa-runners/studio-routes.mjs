/**
 * Studio route queue shared by smoke + overnight capture runners.
 * Keep aligned with `.claude/skills/appendo-qa-smoke-pass/ROUTES.md`.
 */

export const STUDIO_QUEUE_CORE = [
  { pageKey: 'dashboard', route: '/studio' },
  { pageKey: 'users', route: '/studio/users' },
  { pageKey: 'server-functions', route: '/studio/server-functions' },
  { pageKey: 'package-manager', route: '/studio/package-manager' },
  { pageKey: 'roles', route: '/studio/roles' },
  { pageKey: 'base-info', route: '/studio/base-info' },
  { pageKey: 'logs', route: '/studio/logs' },
  { pageKey: 'record-events', route: '/studio/record-events' },
  { pageKey: 'in-app-notifications', route: '/studio/in-app-notifications' },
  { pageKey: 'chat-history', route: '/studio/chat-history' },
  { pageKey: 'libraries', route: '/studio/libraries' },
  { pageKey: 'jobs', route: '/studio/jobs' },
  { pageKey: 'cache', route: '/studio/cache' },
  { pageKey: 'scheduled-tasks', route: '/studio/scheduled-tasks' },
  { pageKey: 'data-sources', route: '/studio/data-sources' },
  { pageKey: 'my-apis', route: '/studio/my-apis' },
  { pageKey: 'my-feedback', route: '/studio/my-feedback' },
  { pageKey: 'my-inbox', route: '/studio/my-inbox?kind=message_dispatch' },
  { pageKey: 'feedback-inbox', route: '/studio/feedback-inbox' },
  { pageKey: 'platform-portals', route: '/studio/platform-portals' },
  { pageKey: 'platform-navigations', route: '/studio/platform-navigations' },
  { pageKey: 'file-manager', route: '/studio/file-manager' },
  { pageKey: 'git', route: '/studio/git' },
  { pageKey: 'workbooks', route: '/studio/workbooks' },
  { pageKey: 'my-workbooks', route: '/studio/my-workbooks' },
  { pageKey: 'workflows', route: '/studio/workflows' },
  { pageKey: 'work-items', route: '/studio/work-items' },
  { pageKey: 'idea-foundry', route: '/studio/idea-foundry' },
  { pageKey: 'component-designer', route: '/studio/component-designer' },
  { pageKey: 'client-components', route: '/studio/client-components' },
  { pageKey: 'settings', route: '/studio/settings' },
  { pageKey: 'organization-chart', route: '/studio/organization-chart' },
  { pageKey: 'geographic-divisions', route: '/studio/geographic-divisions' },
  { pageKey: 'data-studio', route: '/studio/data-studio' },
  { pageKey: 'sql-console', route: '/studio/sql-console' },
  { pageKey: 'api-talk', route: '/studio/api-talk' },
  { pageKey: 'appearance', route: '/studio/appearance' },
  { pageKey: 'base-components', route: '/studio/base-components' },
  { pageKey: 'dev-reference', route: '/studio/dev-reference' },
  { pageKey: 'platform-transfer', route: '/studio/platform-transfer' },
];

export const STUDIO_QUEUE_PACKAGES = [
  { pageKey: 'cms-contents-list', route: '/studio/cms/contents' },
  { pageKey: 'cms-contents-edit-new', route: '/studio/cms/contents/edit/new' },
  { pageKey: 'cms-settings', route: '/studio/cms/settings' },
  { pageKey: 'cms-settings-types', route: '/studio/cms/settings/content-types' },
  { pageKey: 'cms-redirect', route: '/studio/cms' },
  { pageKey: 'ssh-hub', route: '/studio/ssh' },
  { pageKey: 'file-hub-sftp', route: '/studio/sftp' },
  { pageKey: 'rdp-hub', route: '/studio/rdp' },
];

/** Hawiety package surfaces (skip keys in capture if 404). */
export const HWY_STUDIO_ROUTES = [
  '/studio/hwy/members',
  '/studio/hwy/queues',
  '/studio/hwy/settings',
];

export function studioRoutesForCapture({ packages = false } = {}) {
  const core = STUDIO_QUEUE_CORE.map((e) => e.route);
  if (!packages) return core;
  return [...core, ...STUDIO_QUEUE_PACKAGES.map((e) => e.route)];
}
