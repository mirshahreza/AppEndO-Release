/**
 * Inventory of first-class platform HTTP APIs keyed by control-plane objectName.
 * Data Studio modeler APIs section merges this with EdgeApiDefinition rows so
 * operators (and agents) see how a `base_*` table is actually exposed.
 *
 * These are Express/built-in routes — not Data API definitions. Do not publish
 * them through DataApiExecutor; reserved prefixes stay on their controllers.
 */

export type PlatformObjectApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type PlatformObjectApiOperation = {
  method: PlatformObjectApiMethod;
  pathPattern: string;
};

export type PlatformObjectApi = {
  key: string;
  label: string;
  basePath: string;
  operations: PlatformObjectApiOperation[];
};

const api = (
  key: string,
  label: string,
  basePath: string,
  operations: PlatformObjectApiOperation[],
): PlatformObjectApi => ({ key, label, basePath, operations });

const AUTH = api('platform-auth', 'Auth', '/api/auth', [
  { method: 'POST', pathPattern: '/api/auth/login' },
  { method: 'POST', pathPattern: '/api/auth/register' },
  { method: 'GET', pathPattern: '/api/auth/me' },
  { method: 'POST', pathPattern: '/api/auth/refresh' },
  { method: 'POST', pathPattern: '/api/auth/logout' },
  { method: 'GET', pathPattern: '/api/auth/sessions' },
  { method: 'GET', pathPattern: '/api/auth/oauth/:providerId/start' },
  { method: 'GET', pathPattern: '/api/auth/audit-logs' },
]);

const AUTH_AUDIT = api('platform-auth-audit', 'Auth Audit Logs', '/api/auth/audit-logs', [
  { method: 'GET', pathPattern: '/api/auth/audit-logs' },
]);

const USERS = api('platform-users', 'Users', '/api/users', [
  { method: 'GET', pathPattern: '/api/users' },
  { method: 'POST', pathPattern: '/api/users' },
  { method: 'PUT', pathPattern: '/api/users/:id' },
  { method: 'DELETE', pathPattern: '/api/users/:id' },
  { method: 'PATCH', pathPattern: '/api/users/:id/lock' },
  { method: 'PATCH', pathPattern: '/api/users/:id/locked' },
  { method: 'PATCH', pathPattern: '/api/users/:id/unlock' },
  { method: 'PUT', pathPattern: '/api/users/:id/profile' },
  { method: 'PUT', pathPattern: '/api/users/:id/roles' },
  { method: 'GET', pathPattern: '/api/users/:id/attributes' },
]);

const PROFILE = api('platform-profile', 'Profile', '/api/profile', [
  { method: 'GET', pathPattern: '/api/profile' },
  { method: 'PUT', pathPattern: '/api/profile' },
  { method: 'PUT', pathPattern: '/api/profile/me' },
  { method: 'GET', pathPattern: '/api/profile/me/linked-identities' },
  { method: 'GET', pathPattern: '/api/profile/me/editable-attributes' },
]);

const ROLES = api('platform-roles', 'Roles', '/api/roles', [
  { method: 'GET', pathPattern: '/api/roles' },
  { method: 'POST', pathPattern: '/api/roles' },
  { method: 'PUT', pathPattern: '/api/roles/:id' },
  { method: 'DELETE', pathPattern: '/api/roles/:id' },
  { method: 'GET', pathPattern: '/api/roles/:id/attributes' },
]);

const BASE_INFO = api('platform-base-info', 'Base Info', '/api/base-info', [
  { method: 'GET', pathPattern: '/api/base-info/tree' },
  { method: 'GET', pathPattern: '/api/base-info/options' },
  { method: 'GET', pathPattern: '/api/base-info/:id' },
  { method: 'POST', pathPattern: '/api/base-info' },
  { method: 'PUT', pathPattern: '/api/base-info/:id' },
  { method: 'DELETE', pathPattern: '/api/base-info/:id' },
]);

const LOGS = api('platform-logs', 'Application Logs', '/api/logs', [
  { method: 'GET', pathPattern: '/api/logs' },
  { method: 'GET', pathPattern: '/api/logs/:id' },
  { method: 'DELETE', pathPattern: '/api/logs' },
  { method: 'GET', pathPattern: '/api/logs/config' },
  { method: 'POST', pathPattern: '/api/logs/config' },
]);

const JOBS = api('platform-jobs', 'Jobs', '/api/jobs', [
  { method: 'GET', pathPattern: '/api/jobs' },
  { method: 'POST', pathPattern: '/api/jobs' },
  { method: 'GET', pathPattern: '/api/jobs/:id' },
  { method: 'POST', pathPattern: '/api/jobs/:id/cancel' },
  { method: 'POST', pathPattern: '/api/jobs/:id/retry' },
]);

const SCOPE_MEMBERSHIPS = api(
  'platform-scope-memberships',
  'Scope Memberships',
  '/api/scope-memberships',
  [
    { method: 'GET', pathPattern: '/api/scope-memberships' },
    { method: 'POST', pathPattern: '/api/scope-memberships' },
    { method: 'DELETE', pathPattern: '/api/scope-memberships/:id' },
    { method: 'GET', pathPattern: '/api/scope-memberships/events' },
    { method: 'GET', pathPattern: '/api/scope-memberships/roles' },
    { method: 'POST', pathPattern: '/api/scope-memberships/roles' },
  ],
);

const SETTINGS = api('platform-settings', 'Settings', '/api/settings', [
  { method: 'GET', pathPattern: '/api/settings' },
  { method: 'POST', pathPattern: '/api/settings' },
  { method: 'GET', pathPattern: '/api/settings/security' },
  { method: 'PUT', pathPattern: '/api/settings/security' },
]);

const SETTINGS_ATTRIBUTES = api(
  'platform-settings-attributes',
  'Settings Attributes',
  '/api/settings/attributes',
  [
    { method: 'GET', pathPattern: '/api/settings/attributes' },
    { method: 'POST', pathPattern: '/api/settings/attributes' },
    { method: 'PUT', pathPattern: '/api/settings/attributes/:id' },
    { method: 'DELETE', pathPattern: '/api/settings/attributes/:id' },
    { method: 'GET', pathPattern: '/api/settings/attributes/profile-fields' },
    { method: 'PUT', pathPattern: '/api/settings/attributes/profile-fields' },
  ],
);

const AI = api('platform-ai', 'AI', '/api/ai', [
  { method: 'GET', pathPattern: '/api/ai/chats' },
  { method: 'POST', pathPattern: '/api/ai/chats' },
  { method: 'GET', pathPattern: '/api/ai/chats/:id' },
  { method: 'DELETE', pathPattern: '/api/ai/chats/:id' },
  { method: 'POST', pathPattern: '/api/ai/chat' },
  { method: 'POST', pathPattern: '/api/ai/agent/apply' },
  { method: 'GET', pathPattern: '/api/ai/agent/traces/:sessionId' },
  { method: 'GET', pathPattern: '/api/ai/mcp-access/roles/:roleName' },
]);

const FEEDBACK = api('platform-feedback', 'Feedback', '/api/feedback', [
  { method: 'POST', pathPattern: '/api/feedback' },
  { method: 'GET', pathPattern: '/api/feedback/mine' },
  { method: 'GET', pathPattern: '/api/feedback/inbox' },
  { method: 'GET', pathPattern: '/api/feedback/:id' },
  { method: 'POST', pathPattern: '/api/feedback/:id/messages' },
  { method: 'GET', pathPattern: '/api/feedback/attachments/:id' },
]);

const NOTIFICATIONS = api('platform-notifications', 'Notifications', '/api/notifications', [
  { method: 'GET', pathPattern: '/api/notifications' },
  { method: 'GET', pathPattern: '/api/notifications/unread-count' },
  { method: 'GET', pathPattern: '/api/notifications/unseen-count' },
  { method: 'POST', pathPattern: '/api/notifications/bell-seen' },
  { method: 'POST', pathPattern: '/api/notifications/:notificationId/read' },
  { method: 'POST', pathPattern: '/api/notifications/read-all' },
]);

const USER_MESSAGE_DISPATCHES = api(
  'platform-user-message-dispatches',
  'User message dispatches',
  '/api/user-message-dispatches',
  [
    { method: 'GET', pathPattern: '/api/user-message-dispatches' },
    { method: 'GET', pathPattern: '/api/user-message-dispatches/:dispatchId' },
  ],
);

const WORKFLOWS = api('platform-workflows', 'Workflows', '/api/workflows', [
  { method: 'GET', pathPattern: '/api/workflows/definitions' },
  { method: 'POST', pathPattern: '/api/workflows/definitions' },
  { method: 'POST', pathPattern: '/api/workflows/execute/run' },
  { method: 'GET', pathPattern: '/api/workflows/definitions/:definitionId/revisions' },
]);

const WORK_ITEMS = api(
  'platform-workflow-work-items',
  'Workflow Work Items',
  '/api/workflow-work-items',
  [
    { method: 'GET', pathPattern: '/api/workflow-work-items/inbox' },
    { method: 'GET', pathPattern: '/api/workflow-work-items/:workItemId' },
    { method: 'POST', pathPattern: '/api/workflow-work-items/:workItemId/claim' },
    { method: 'POST', pathPattern: '/api/workflow-work-items/:workItemId/complete' },
    { method: 'GET', pathPattern: '/api/workflow-work-items/:workItemId/transitions' },
  ],
);

const IDEA_FOUNDRY = api('platform-idea-foundry', 'Idea Foundry', '/api/idea-foundry', [
  { method: 'GET', pathPattern: '/api/idea-foundry' },
  { method: 'POST', pathPattern: '/api/idea-foundry' },
  { method: 'GET', pathPattern: '/api/idea-foundry/:id' },
  { method: 'PUT', pathPattern: '/api/idea-foundry/:id' },
]);

const SAMPLE_MOCK = api('platform-sample-mock', 'Sample Mock', '/api/sample-mock', [
  { method: 'GET', pathPattern: '/api/sample-mock/records' },
  { method: 'POST', pathPattern: '/api/sample-mock/records' },
  { method: 'POST', pathPattern: '/api/sample-mock/records/bulk' },
  { method: 'GET', pathPattern: '/api/sample-mock/records/:id' },
  { method: 'PATCH', pathPattern: '/api/sample-mock/records/:id' },
  { method: 'PATCH', pathPattern: '/api/sample-mock/records/:id/approve' },
  { method: 'PATCH', pathPattern: '/api/sample-mock/records/:id/lock' },
  { method: 'DELETE', pathPattern: '/api/sample-mock/records/:id' },
  { method: 'GET', pathPattern: '/api/sample-mock/lookups' },
]);

/**
 * Object → platform APIs. Same API may appear on several tables that share a
 * controller. Tables with no HTTP surface (write-only pipelines) are omitted.
 */
export const BASE_OBJECT_PLATFORM_APIS: Record<string, readonly PlatformObjectApi[]> = {
  base_users: [USERS, AUTH, PROFILE],
  base_user_profiles: [USERS, PROFILE],
  base_user_identities: [AUTH, PROFILE],
  base_user_roles: [USERS, ROLES],
  base_users_attributes: [USERS, PROFILE],
  base_roles: [ROLES],
  base_roles_attributes: [ROLES],
  base_role_mcp_grants: [AI],
  base_otp_challenges: [AUTH],
  base_auth_refresh_tokens: [AUTH],
  base_info: [BASE_INFO],
  base_scope_memberships: [SCOPE_MEMBERSHIPS],
  base_scope_membership_events: [SCOPE_MEMBERSHIPS],
  base_scope_role_memberships: [SCOPE_MEMBERSHIPS],
  base_scope_role_membership_events: [SCOPE_MEMBERSHIPS],
  base_settings_sections: [SETTINGS],
  base_settings_attributes: [SETTINGS_ATTRIBUTES],
  base_settings_profile_fields: [SETTINGS_ATTRIBUTES],
  base_logs_app: [LOGS],
  base_logs_auth_audit: [AUTH_AUDIT],
  base_jobs: [JOBS],
  base_ai_chat_sessions: [AI],
  base_ai_agent_traces: [AI],
  base_ai_agent_apply_snapshots: [AI],
  base_app_feedback: [FEEDBACK],
  base_app_feedback_messages: [FEEDBACK],
  base_app_feedback_attachments: [FEEDBACK],
  base_app_feedback_read_cursors: [FEEDBACK],
  base_user_notifications: [NOTIFICATIONS],
  base_workflow_definitions: [WORKFLOWS],
  base_workflow_revisions: [WORKFLOWS],
  base_workflow_instances: [WORKFLOWS],
  base_workflow_node_instances: [WORKFLOWS],
  base_workflow_execution_attempts: [WORKFLOWS],
  base_workflow_waits: [WORKFLOWS],
  base_workflow_event_inbox: [WORKFLOWS],
  base_workflow_branch_tokens: [WORKFLOWS],
  base_workflow_join_arrivals: [WORKFLOWS],
  base_workflow_dead_letters: [WORKFLOWS],
  base_workflow_traces: [WORKFLOWS],
  base_workflow_simulation_runs: [WORKFLOWS],
  base_workflow_validation_reports: [WORKFLOWS],
  base_workflow_designer_views: [WORKFLOWS],
  base_workflow_secret_references: [WORKFLOWS],
  base_workflow_webhook_bindings: [WORKFLOWS],
  base_workflow_vector_documents: [WORKFLOWS],
  base_work_items: [WORK_ITEMS],
  base_work_item_transitions: [WORK_ITEMS],
  base_work_item_escalations: [WORK_ITEMS],
  base_idea_cards: [IDEA_FOUNDRY],
  base_sample_mock_records: [SAMPLE_MOCK],
  base_sample_mock_details: [SAMPLE_MOCK],
  base_sample_mock_record_tags: [SAMPLE_MOCK],
  base_sample_mock_statuses: [SAMPLE_MOCK],
  base_sample_mock_people: [SAMPLE_MOCK],
  base_sample_mock_tags: [SAMPLE_MOCK],
  base_sample_mock_comments: [SAMPLE_MOCK],
};

export const normalizePlatformApiPath = (path: string): string => {
  const withoutQuery = path.split('?')[0]?.trim() || '/';
  if (withoutQuery.length > 1 && withoutQuery.endsWith('/')) {
    return withoutQuery.slice(0, -1);
  }
  return withoutQuery;
};

const pathMatchesBasePath = (path: string, basePath: string): boolean => {
  const normalizedPath = normalizePlatformApiPath(path);
  const normalizedBase = normalizePlatformApiPath(basePath);
  return normalizedPath === normalizedBase || normalizedPath.startsWith(`${normalizedBase}/`);
};

export const listPlatformBasePathsForObject = (objectName: string): string[] => (
  [...new Set(listPlatformApisForObject(objectName).map((item) => normalizePlatformApiPath(item.basePath)))]
);

const listAllPlatformBasePaths = (): string[] => {
  const paths = new Set<string>();
  for (const apis of Object.values(BASE_OBJECT_PLATFORM_APIS)) {
    for (const item of apis) {
      paths.add(normalizePlatformApiPath(item.basePath));
    }
  }
  return [...paths].sort((left, right) => right.length - left.length);
};

/** Longest catalog prefix that owns this route — `/api/settings/attributes` wins over `/api/settings`. */
export const bestPlatformBasePathForPath = (path: string): string | null => {
  for (const basePath of listAllPlatformBasePaths()) {
    if (pathMatchesBasePath(path, basePath)) {
      return basePath;
    }
  }
  return null;
};

export const platformPathBelongsToObject = (path: string, objectName: string): boolean => {
  const best = bestPlatformBasePathForPath(path);
  if (!best) {
    return false;
  }
  return listPlatformBasePathsForObject(objectName).includes(best);
};

export const listPlatformApisForObject = (objectName: string): PlatformObjectApi[] => {
  const key = objectName.trim().toLowerCase();
  if (!key) {
    return [];
  }
  return [...(BASE_OBJECT_PLATFORM_APIS[key] ?? [])];
};

export const listUniquePlatformApis = (): PlatformObjectApi[] => {
  const map = new Map<string, PlatformObjectApi>();
  for (const apis of Object.values(BASE_OBJECT_PLATFORM_APIS)) {
    for (const api of apis) {
      map.set(api.key, api);
    }
  }
  return [...map.values()].sort((left, right) => left.label.localeCompare(right.label));
};

export const listObjectNamesForPlatformApi = (apiKey: string): string[] => {
  const key = apiKey.trim();
  if (!key) return [];
  return Object.entries(BASE_OBJECT_PLATFORM_APIS)
    .filter(([, apis]) => apis.some((item) => item.key === key))
    .map(([objectName]) => objectName);
};
