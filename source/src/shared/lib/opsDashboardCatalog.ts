/**
 * Platform Ops Dashboards (p-120) — field whitelist, deny-list, and stable identities.
 * Seed and Pivot APIs must not expose anything in OPS_DASHBOARD_DENIED_FIELDS.
 */

export const OPS_DASHBOARD_PAGE_KEYS = [
  'studio-insights-ops',
  'studio-insights-work',
  'studio-insights-people',
] as const;

export type OpsDashboardPageKey = (typeof OPS_DASHBOARD_PAGE_KEYS)[number];

export const isOpsDashboardPageKey = (pageKey: string): pageKey is OpsDashboardPageKey => (
  (OPS_DASHBOARD_PAGE_KEYS as readonly string[]).includes(pageKey)
);

export const OPS_DASHBOARD_ROUTES: Record<OpsDashboardPageKey, { pattern: string; title: string }> = {
  'studio-insights-ops': { pattern: 'insights/operations', title: 'Studio operations' },
  'studio-insights-work': { pattern: 'insights/work', title: 'Work queue' },
  'studio-insights-people': { pattern: 'insights/people', title: 'People and access' },
};

export const OPS_DASHBOARD_DRAFT_IDS: Record<OpsDashboardPageKey, string> = {
  'studio-insights-ops': 'studio-insights-ops',
  'studio-insights-work': 'studio-insights-work',
  'studio-insights-people': 'studio-insights-people',
};

export const OPS_DASHBOARD_BUILTIN_IDS: Record<OpsDashboardPageKey, string> = {
  'studio-insights-ops': 'builtin:studio-insights-ops',
  'studio-insights-work': 'builtin:studio-insights-work',
  'studio-insights-people': 'builtin:studio-insights-people',
};

export const OPS_DASHBOARD_DATE_RANGE_DEFAULT = 'last:7d';

/** Physical names that must never appear in exposedFields or VIEW output. */
export const OPS_DASHBOARD_DENIED_FIELDS = [
  'password_hash',
  'email',
  'mobile',
  'locked_by',
  'unlocked_by',
  'firstname',
  'lastname',
  'fathername',
  'grandfathername',
  'nickname',
  'national_code',
  'phone',
  'gender_code',
  'company_name',
  'registration_number',
  'website',
  'profile_image_body',
  'profile_image_body_xs',
  'subject',
  'profile_json',
  'provider_id',
  'ip_address',
  'user_agent',
  'reason',
  'metadata_json',
  'message',
  'failure_reason',
  'meta_json',
  'payload_json',
  'result_json',
  'error_message',
  'progress_message',
  'host',
  'port',
  'database',
  'options_json',
  'input_json',
  'output_json',
  'output_schema_json',
  'assignment_evidence_json',
  'title_text',
  'summary_text',
  'context_json',
  'draft_definition_json',
  'evidence_json',
  'resolution_note',
  'title',
  'anonymous_contact_json',
  'node_id',
] as const;

const DENIED_FIELD_SET = new Set<string>(OPS_DASHBOARD_DENIED_FIELDS);

const SECRET_NAME_PATTERN = /(password|secret|token|hash|salt|vault|jwt|cookie|cipher|encrypted)/i;

export type OpsDashboardColumnKind = 'id' | 'string' | 'int' | 'bigint' | 'date' | 'bool';

export type OpsDashboardModelSpec = {
  id: string;
  edgeModelId: string;
  apiId: string;
  apiKey: string;
  objectName: string;
  objectType: 'TABLE' | 'VIEW';
  label: string;
  primaryKey: string | readonly string[];
  columns: ReadonlyArray<{ name: string; kind: OpsDashboardColumnKind; allowNull?: boolean }>;
};

export const OPS_DASHBOARD_MODELS: readonly OpsDashboardModelSpec[] = [
  {
    id: 'ops_jobs',
    edgeModelId: 'em_ops_jobs',
    apiId: 'ea_ops_jobs_pivot',
    apiKey: 'ops-jobs-pivot',
    objectName: 'base_jobs',
    objectType: 'TABLE',
    label: 'Jobs',
    primaryKey: 'id',
    columns: [
      { name: 'id', kind: 'id' },
      { name: 'job_type', kind: 'string' },
      { name: 'status', kind: 'string' },
      { name: 'progress', kind: 'int' },
      { name: 'attempt_count', kind: 'int' },
      { name: 'max_attempts', kind: 'int' },
      { name: 'queued_at', kind: 'date', allowNull: true },
      { name: 'started_at', kind: 'date', allowNull: true },
      { name: 'finished_at', kind: 'date', allowNull: true },
      { name: 'created_at', kind: 'date', allowNull: true },
    ],
  },
  {
    id: 'ops_logs',
    edgeModelId: 'em_ops_logs',
    apiId: 'ea_ops_logs_pivot',
    apiKey: 'ops-logs-pivot',
    objectName: 'base_logs_app',
    objectType: 'TABLE',
    label: 'Logs',
    primaryKey: 'id',
    columns: [
      { name: 'id', kind: 'id' },
      { name: 'level', kind: 'string' },
      { name: 'context', kind: 'string' },
      { name: 'actor', kind: 'string' },
      { name: 'call_success', kind: 'int', allowNull: true },
      { name: 'duration_ms', kind: 'int', allowNull: true },
      { name: 'message_size', kind: 'int' },
      { name: 'has_meta', kind: 'int' },
      { name: 'created_at', kind: 'date', allowNull: true },
    ],
  },
  {
    id: 'ops_data_sources',
    edgeModelId: 'em_ops_data_sources',
    apiId: 'ea_ops_data_sources_pivot',
    apiKey: 'ops-data-sources-pivot',
    objectName: 'base_data_sources',
    objectType: 'TABLE',
    label: 'Data sources',
    primaryKey: 'id',
    columns: [
      { name: 'id', kind: 'string' },
      { name: 'name', kind: 'string' },
      { name: 'type', kind: 'string' },
      { name: 'status', kind: 'string' },
      { name: 'created_at', kind: 'date', allowNull: true },
    ],
  },
  {
    id: 'ops_workflow_instances',
    edgeModelId: 'em_ops_workflow_instances',
    apiId: 'ea_ops_workflow_instances_pivot',
    apiKey: 'ops-workflow-instances-pivot',
    objectName: 'base_workflow_instances',
    objectType: 'TABLE',
    label: 'Workflow instances',
    primaryKey: 'id',
    columns: [
      { name: 'id', kind: 'id' },
      { name: 'status', kind: 'string' },
      { name: 'start_type', kind: 'string', allowNull: true },
      { name: 'started_by_type', kind: 'string' },
      { name: 'created_at', kind: 'date', allowNull: true },
      { name: 'updated_at', kind: 'date', allowNull: true },
    ],
  },
  {
    id: 'ops_workflow_defs',
    edgeModelId: 'em_ops_workflow_defs',
    apiId: 'ea_ops_workflow_defs_pivot',
    apiKey: 'ops-workflow-defs-pivot',
    objectName: 'base_workflow_definitions',
    objectType: 'TABLE',
    label: 'Workflow definitions',
    primaryKey: 'id',
    columns: [
      { name: 'id', kind: 'id' },
      { name: 'key', kind: 'string' },
      { name: 'lifecycle_status', kind: 'string' },
      { name: 'created_at', kind: 'date', allowNull: true },
      { name: 'last_published_at', kind: 'date', allowNull: true },
    ],
  },
  {
    id: 'ops_dead_letters',
    edgeModelId: 'em_ops_dead_letters',
    apiId: 'ea_ops_dead_letters_pivot',
    apiKey: 'ops-dead-letters-pivot',
    objectName: 'base_workflow_dead_letters',
    objectType: 'TABLE',
    label: 'Dead letters',
    primaryKey: 'id',
    columns: [
      { name: 'id', kind: 'id' },
      { name: 'status', kind: 'string' },
      { name: 'error_class', kind: 'string', allowNull: true },
      { name: 'error_code', kind: 'string', allowNull: true },
      { name: 'node_key', kind: 'string' },
      { name: 'created_at', kind: 'date', allowNull: true },
      { name: 'resolved_at', kind: 'date', allowNull: true },
    ],
  },
  {
    id: 'ops_feedback',
    edgeModelId: 'em_ops_feedback',
    apiId: 'ea_ops_feedback_pivot',
    apiKey: 'ops-feedback-pivot',
    objectName: 'base_app_feedback',
    objectType: 'TABLE',
    label: 'Feedback',
    primaryKey: 'id',
    columns: [
      { name: 'id', kind: 'id' },
      { name: 'type', kind: 'string' },
      { name: 'status', kind: 'string' },
      { name: 'priority', kind: 'string' },
      { name: 'submitted_at', kind: 'date' },
      { name: 'page_key', kind: 'string', allowNull: true },
      { name: 'portal_slug', kind: 'string', allowNull: true },
      { name: 'assignee_role_name', kind: 'string', allowNull: true },
      { name: 'message_count', kind: 'int' },
    ],
  },
  {
    id: 'ops_identities',
    edgeModelId: 'em_ops_identities',
    apiId: 'ea_ops_identities_pivot',
    apiKey: 'ops-identities-pivot',
    objectName: 'base_user_identities',
    objectType: 'TABLE',
    label: 'Identities',
    primaryKey: 'id',
    columns: [
      { name: 'id', kind: 'id' },
      { name: 'user_id', kind: 'bigint' },
      { name: 'provider_kind', kind: 'string' },
      { name: 'linked_at', kind: 'date', allowNull: true },
    ],
  },
  {
    id: 'ops_scope_memberships',
    edgeModelId: 'em_ops_scope_memberships',
    apiId: 'ea_ops_scope_memberships_pivot',
    apiKey: 'ops-scope-memberships-pivot',
    objectName: 'base_scope_memberships',
    objectType: 'TABLE',
    label: 'Scope memberships',
    primaryKey: 'id',
    columns: [
      { name: 'id', kind: 'id' },
      { name: 'user_id', kind: 'bigint' },
      { name: 'dimension_key', kind: 'string' },
      { name: 'created_at', kind: 'date', allowNull: true },
    ],
  },
  {
    id: 'ops_work_queue',
    edgeModelId: 'em_ops_work_queue',
    apiId: 'ea_ops_work_queue_pivot',
    apiKey: 'ops-work-queue-pivot',
    objectName: 'base_ops_work_item_queue',
    objectType: 'VIEW',
    label: 'Work queue',
    primaryKey: 'id',
    columns: [
      { name: 'id', kind: 'id' },
      { name: 'status', kind: 'string' },
      { name: 'work_item_type', kind: 'string' },
      { name: 'priority', kind: 'int' },
      { name: 'claimed_by_user_id', kind: 'bigint', allowNull: true },
      { name: 'claimed_by_username', kind: 'string', allowNull: true },
      { name: 'due_at', kind: 'date', allowNull: true },
      { name: 'created_at', kind: 'date', allowNull: true },
      { name: 'completed_at', kind: 'date', allowNull: true },
      { name: 'claimed_at', kind: 'date', allowNull: true },
      { name: 'workflow_instance_id', kind: 'bigint' },
      { name: 'workflow_instance_status', kind: 'string' },
      { name: 'workflow_key', kind: 'string' },
      { name: 'workflow_lifecycle_status', kind: 'string' },
      { name: 'is_overdue', kind: 'int' },
    ],
  },
  {
    id: 'ops_user_directory',
    edgeModelId: 'em_ops_user_directory',
    apiId: 'ea_ops_user_directory_pivot',
    apiKey: 'ops-user-directory-pivot',
    objectName: 'base_ops_user_directory',
    objectType: 'VIEW',
    label: 'User directory',
    primaryKey: 'id',
    columns: [
      { name: 'id', kind: 'id' },
      { name: 'username', kind: 'string' },
      { name: 'locked', kind: 'int' },
      { name: 'is_builtin', kind: 'int' },
      { name: 'login_fail_count', kind: 'int' },
      { name: 'last_login_at', kind: 'date', allowNull: true },
      { name: 'created_at', kind: 'date', allowNull: true },
      { name: 'person_type_code', kind: 'string', allowNull: true },
      { name: 'role_count', kind: 'int' },
      { name: 'has_profile', kind: 'int' },
      { name: 'has_role', kind: 'int' },
      { name: 'has_identity', kind: 'int' },
      { name: 'has_scope', kind: 'int' },
      { name: 'has_email', kind: 'int' },
      { name: 'email_verified', kind: 'int' },
      { name: 'never_logged_in', kind: 'int' },
      { name: 'is_dormant', kind: 'int' },
      { name: 'has_fail_streak', kind: 'int' },
    ],
  },
  {
    id: 'ops_people_roles',
    edgeModelId: 'em_ops_people_roles',
    apiId: 'ea_ops_people_roles_pivot',
    apiKey: 'ops-people-roles-pivot',
    objectName: 'base_ops_people_roles',
    objectType: 'VIEW',
    label: 'People roles',
    primaryKey: ['user_id', 'role_name'],
    columns: [
      { name: 'user_id', kind: 'bigint' },
      { name: 'username', kind: 'string' },
      { name: 'role_name', kind: 'string' },
      { name: 'locked', kind: 'int' },
      { name: 'is_builtin', kind: 'int' },
      { name: 'person_type_code', kind: 'string', allowNull: true },
      { name: 'never_logged_in', kind: 'int' },
      { name: 'created_at', kind: 'date', allowNull: true },
    ],
  },
  {
    id: 'ops_auth_events',
    edgeModelId: 'em_ops_auth_events',
    apiId: 'ea_ops_auth_events_pivot',
    apiKey: 'ops-auth-events-pivot',
    objectName: 'base_ops_auth_events',
    objectType: 'VIEW',
    label: 'Auth events',
    primaryKey: 'id',
    columns: [
      { name: 'id', kind: 'id' },
      { name: 'event_type', kind: 'string' },
      { name: 'success', kind: 'int' },
      { name: 'created_at', kind: 'date', allowNull: true },
      { name: 'user_id', kind: 'bigint', allowNull: true },
      { name: 'username', kind: 'string', allowNull: true },
    ],
  },
] as const;

export const OPS_DASHBOARD_VIEW_NAMES = [
  'base_ops_work_item_queue',
  'base_ops_user_directory',
  'base_ops_people_roles',
  'base_ops_auth_events',
] as const;

export const opsDashboardExposedFields = (spec: OpsDashboardModelSpec): string[] =>
  spec.columns.map((column) => column.name);

export const isOpsDashboardDeniedField = (field: string): boolean => {
  const trimmed = field.trim();
  if (!trimmed) {
    return true;
  }
  return DENIED_FIELD_SET.has(trimmed) || SECRET_NAME_PATTERN.test(trimmed);
};

export const assertOpsDashboardExposedFields = (fields: readonly string[]): string[] => {
  const denied = fields.filter((field) => isOpsDashboardDeniedField(field));
  if (denied.length > 0) {
    throw new Error(`Ops dashboard domain cannot expose: ${denied.join(', ')}.`);
  }
  return [...fields];
};

export const findOpsDashboardModel = (id: string): OpsDashboardModelSpec | undefined =>
  OPS_DASHBOARD_MODELS.find((model) => model.id === id);
