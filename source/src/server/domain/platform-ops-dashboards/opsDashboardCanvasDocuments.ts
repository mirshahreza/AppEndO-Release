import type { DesignerDocument, DesignerNode } from '../../../domain/component-designer/types';
import { DESIGNER_DOCUMENT_SCHEMA_VERSION } from '../../../domain/component-designer/documentSchema';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../../../domain/component-designer/propRegistry';
import { CHART_FIELD_MAPPING_PROP } from '../../../domain/component-designer/bindingChartEngine';
import {
  DASHBOARD_CANVAS_CONFIG_PROP,
  DASHBOARD_PERSONALIZABLE_PROP,
  DASHBOARD_WIDGET_GRID_PROP,
  serializeDashboardCanvasPageConfig,
  type DashboardCanvasPageConfig,
  type DashboardFilterDeclaration,
} from '../../../shared/api/contracts/dashboard-canvas';
import type { DashboardWidgetFieldMapping, DashboardWidgetVizConfig } from '../../../shared/lib/dashboardCanvas';
import {
  OPS_DASHBOARD_DATE_RANGE_DEFAULT,
  OPS_DASHBOARD_DRAFT_IDS,
  OPS_DASHBOARD_MODELS,
  assertOpsDashboardExposedFields,
  opsDashboardExposedFields,
  type OpsDashboardPageKey,
} from '../../../shared/lib/opsDashboardCatalog';
import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import type { StoredDataSource } from '../../db/dataSourcesStore';

type WidgetKind = 'kpi' | 'chart' | 'table';
type ChartKind = 'bar' | 'line' | 'pie';

type WidgetSpec = {
  nodeId: string;
  kind: WidgetKind;
  tab: string;
  x: number;
  y: number;
  w: number;
  h: number;
  domain: string;
  title: string;
  metric?: string;
  aggregation?: DashboardWidgetFieldMapping['aggregation'];
  dimension?: string;
  dimensionB?: string;
  dimensionGrain?: DashboardWidgetFieldMapping['dimensionGrain'];
  chartKind?: ChartKind;
  filters?: DashboardWidgetFieldMapping['filters'];
  emptyText?: string;
};

const paletteFor = (kind: WidgetKind, chartKind?: ChartKind): string => {
  if (kind === 'kpi') return 'content.stat-trend';
  if (kind === 'table') return 'viz.sheet';
  if (chartKind === 'line') return 'viz.chart-line';
  if (chartKind === 'pie') return 'viz.chart-pie';
  return 'viz.chart-bar';
};

const eq = (field: string, value: string | number): DashboardWidgetFieldMapping['filters'] => (
  { [field]: { eq: value } }
);

const domainRef = (
  dataSource: StoredDataSource,
  models: Map<string, EdgeModelDefinition>,
  domainId: string,
) => {
  const model = models.get(domainId);
  const spec = OPS_DASHBOARD_MODELS.find((item) => item.id === domainId);
  if (!model || !spec) {
    throw new Error(`Ops dashboard domain "${domainId}" was not seeded.`);
  }
  return {
    id: domainId,
    label: spec.label,
    dataSourceRef: {
      id: dataSource.id,
      dataSourceId: dataSource.id,
      edgeModelId: model.id,
    },
    exposedFields: assertOpsDashboardExposedFields(opsDashboardExposedFields(spec)),
  };
};

const nodeFromSpec = (spec: WidgetSpec, order: number): DesignerNode => {
  const mapping: DashboardWidgetFieldMapping = {
    title: spec.title,
    metric: spec.metric ?? 'id',
    aggregation: spec.aggregation ?? 'count',
    dimension: spec.dimension,
    dimensionB: spec.dimensionB,
    dimensionGrain: spec.dimensionGrain,
    chartKind: spec.chartKind,
    filters: spec.filters,
  };
  const vizConfig: DashboardWidgetVizConfig = spec.emptyText ? { emptyText: spec.emptyText } : {};
  return {
    id: spec.nodeId,
    type: 'container',
    parentId: 'canvas',
    order,
    props: {
      [DESIGNER_PALETTE_ITEM_ID_PROP]: paletteFor(spec.kind, spec.chartKind),
      dashboardDomainEntryId: spec.domain,
      dashboardTabId: spec.tab,
      [DASHBOARD_WIDGET_GRID_PROP]: { x: spec.x, y: spec.y, w: spec.w, h: spec.h },
      title: spec.title,
      [CHART_FIELD_MAPPING_PROP]: mapping,
      vizConfig,
    },
    layout: {},
    binding: {},
    children: [],
  };
};

const buildDocument = (
  pageKey: OpsDashboardPageKey,
  config: DashboardCanvasPageConfig,
  widgets: WidgetSpec[],
): DesignerDocument => {
  const now = new Date().toISOString();
  const widgetNodes = widgets.map((widget, index) => nodeFromSpec(widget, index));
  const canvas: DesignerNode = {
    id: 'canvas',
    type: 'container',
    parentId: 'root',
    order: 0,
    props: {
      [DESIGNER_PALETTE_ITEM_ID_PROP]: 'viz.dashboard-canvas',
      [DASHBOARD_CANVAS_CONFIG_PROP]: serializeDashboardCanvasPageConfig(config),
      [DASHBOARD_PERSONALIZABLE_PROP]: true,
    },
    layout: {},
    binding: {},
    children: widgetNodes.map((node) => node.id),
  };
  const root: DesignerNode = {
    id: 'root',
    type: 'root',
    parentId: null,
    order: 0,
    props: {
      [DASHBOARD_CANVAS_CONFIG_PROP]: serializeDashboardCanvasPageConfig(config),
      [DASHBOARD_PERSONALIZABLE_PROP]: true,
    },
    layout: {},
    binding: {},
    children: ['canvas'],
  };
  const nodes: Record<string, DesignerNode> = { root, canvas };
  for (const node of widgetNodes) {
    nodes[node.id] = node;
  }
  return {
    schemaVersion: DESIGNER_DOCUMENT_SCHEMA_VERSION,
    id: OPS_DASHBOARD_DRAFT_IDS[pageKey],
    name: pageKey,
    rootNodeId: 'root',
    pageAccess: {
      accessMode: 'specific',
      allowRoles: ['ADMIN'],
      allowUsers: [],
      denyRoles: [],
      denyUsers: [],
    },
    nodes,
    metadata: { createdAt: now, updatedAt: now },
    diagnostics: [],
  };
};

const opsWidgets = (): WidgetSpec[] => [
  { nodeId: 'ops-ov-kpi-failed', kind: 'kpi', tab: 'overview', x: 0, y: 0, w: 3, h: 3, domain: 'ops_jobs', title: 'Failed jobs', filters: eq('status', 'failed'), emptyText: 'No jobs in this date range.' },
  { nodeId: 'ops-ov-kpi-running', kind: 'kpi', tab: 'overview', x: 3, y: 0, w: 3, h: 3, domain: 'ops_jobs', title: 'Running jobs', filters: eq('status', 'running') },
  { nodeId: 'ops-ov-kpi-errors', kind: 'kpi', tab: 'overview', x: 6, y: 0, w: 3, h: 3, domain: 'ops_logs', title: 'Error logs', filters: eq('level', 'ERROR'), emptyText: 'No log volume in this date range.' },
  { nodeId: 'ops-ov-kpi-ds-down', kind: 'kpi', tab: 'overview', x: 9, y: 0, w: 3, h: 3, domain: 'ops_data_sources', title: 'Sources not connected', filters: { status: { ne: 'connected' } }, emptyText: 'No data sources registered.' },
  { nodeId: 'ops-ov-chart-job-status', kind: 'chart', tab: 'overview', x: 0, y: 3, w: 6, h: 8, domain: 'ops_jobs', title: 'Jobs by status', dimension: 'status', chartKind: 'bar', emptyText: 'No jobs in this date range.' },
  { nodeId: 'ops-ov-chart-log-level', kind: 'chart', tab: 'overview', x: 6, y: 3, w: 6, h: 8, domain: 'ops_logs', title: 'Log volume by level', dimension: 'level', chartKind: 'bar', emptyText: 'No log volume in this date range.' },
  { nodeId: 'ops-ov-chart-jobs-day', kind: 'chart', tab: 'overview', x: 0, y: 11, w: 6, h: 8, domain: 'ops_jobs', title: 'Jobs per day', dimension: 'created_at', dimensionGrain: 'day', chartKind: 'line', emptyText: 'No jobs in this date range.' },
  { nodeId: 'ops-ov-chart-ds-status', kind: 'chart', tab: 'overview', x: 6, y: 11, w: 6, h: 8, domain: 'ops_data_sources', title: 'Sources by status', dimension: 'status', chartKind: 'pie', emptyText: 'No data sources registered.' },
  { nodeId: 'ops-jb-kpi-pending', kind: 'kpi', tab: 'jobs', x: 0, y: 0, w: 3, h: 3, domain: 'ops_jobs', title: 'Pending', filters: eq('status', 'pending') },
  { nodeId: 'ops-jb-kpi-running', kind: 'kpi', tab: 'jobs', x: 3, y: 0, w: 3, h: 3, domain: 'ops_jobs', title: 'Running', filters: eq('status', 'running') },
  { nodeId: 'ops-jb-kpi-completed', kind: 'kpi', tab: 'jobs', x: 6, y: 0, w: 3, h: 3, domain: 'ops_jobs', title: 'Completed', filters: eq('status', 'completed') },
  { nodeId: 'ops-jb-kpi-failed', kind: 'kpi', tab: 'jobs', x: 9, y: 0, w: 3, h: 3, domain: 'ops_jobs', title: 'Failed', filters: eq('status', 'failed') },
  { nodeId: 'ops-jb-chart-type', kind: 'chart', tab: 'jobs', x: 0, y: 3, w: 6, h: 8, domain: 'ops_jobs', title: 'Jobs by type', dimension: 'job_type', chartKind: 'bar', emptyText: 'No jobs in this date range.' },
  { nodeId: 'ops-jb-chart-status', kind: 'chart', tab: 'jobs', x: 6, y: 3, w: 6, h: 8, domain: 'ops_jobs', title: 'Jobs by status', dimension: 'status', chartKind: 'pie', emptyText: 'No jobs in this date range.' },
  { nodeId: 'ops-jb-chart-day-type', kind: 'chart', tab: 'jobs', x: 0, y: 11, w: 12, h: 8, domain: 'ops_jobs', title: 'Jobs per day by type', dimension: 'created_at', dimensionGrain: 'day', dimensionB: 'job_type', chartKind: 'line', emptyText: 'No jobs in this date range.' },
  { nodeId: 'ops-jb-table-type-status', kind: 'table', tab: 'jobs', x: 0, y: 19, w: 12, h: 8, domain: 'ops_jobs', title: 'Jobs by type and status', dimension: 'job_type', dimensionB: 'status', emptyText: 'No jobs in this date range.' },
  { nodeId: 'ops-lg-kpi-error', kind: 'kpi', tab: 'logs', x: 0, y: 0, w: 3, h: 3, domain: 'ops_logs', title: 'Errors', filters: eq('level', 'ERROR') },
  { nodeId: 'ops-lg-kpi-warn', kind: 'kpi', tab: 'logs', x: 3, y: 0, w: 3, h: 3, domain: 'ops_logs', title: 'Warnings', filters: eq('level', 'WARN') },
  { nodeId: 'ops-lg-kpi-duration', kind: 'kpi', tab: 'logs', x: 6, y: 0, w: 3, h: 3, domain: 'ops_logs', title: 'Avg duration (ms)', metric: 'duration_ms', aggregation: 'avg' },
  { nodeId: 'ops-lg-kpi-msgsize', kind: 'kpi', tab: 'logs', x: 9, y: 0, w: 3, h: 3, domain: 'ops_logs', title: 'Avg message size', metric: 'message_size', aggregation: 'avg' },
  { nodeId: 'ops-lg-chart-level', kind: 'chart', tab: 'logs', x: 0, y: 3, w: 6, h: 8, domain: 'ops_logs', title: 'Logs by level', dimension: 'level', chartKind: 'pie', emptyText: 'No log volume in this date range.' },
  { nodeId: 'ops-lg-chart-context', kind: 'chart', tab: 'logs', x: 6, y: 3, w: 6, h: 8, domain: 'ops_logs', title: 'Logs by context', dimension: 'context', chartKind: 'bar', emptyText: 'No log volume in this date range.' },
  { nodeId: 'ops-lg-chart-day', kind: 'chart', tab: 'logs', x: 0, y: 11, w: 12, h: 8, domain: 'ops_logs', title: 'Log volume per day', dimension: 'created_at', dimensionGrain: 'day', chartKind: 'line', emptyText: 'No log volume in this date range.' },
  { nodeId: 'ops-lg-table-ctx-level', kind: 'table', tab: 'logs', x: 0, y: 19, w: 12, h: 8, domain: 'ops_logs', title: 'Context by level', dimension: 'context', dimensionB: 'level', emptyText: 'No log volume in this date range.' },
];

const workWidgets = (): WidgetSpec[] => [
  { nodeId: 'wk-q-kpi-open', kind: 'kpi', tab: 'queue', x: 0, y: 0, w: 3, h: 3, domain: 'ops_work_queue', title: 'Open', filters: eq('status', 'OPEN'), emptyText: 'No work items in this date range. Run a workflow with a human task to populate this queue.' },
  { nodeId: 'wk-q-kpi-claimed', kind: 'kpi', tab: 'queue', x: 3, y: 0, w: 3, h: 3, domain: 'ops_work_queue', title: 'Claimed', filters: eq('status', 'CLAIMED') },
  { nodeId: 'wk-q-kpi-overdue', kind: 'kpi', tab: 'queue', x: 6, y: 0, w: 3, h: 3, domain: 'ops_work_queue', title: 'Overdue', filters: eq('is_overdue', 1) },
  { nodeId: 'wk-q-kpi-dl', kind: 'kpi', tab: 'queue', x: 9, y: 0, w: 3, h: 3, domain: 'ops_dead_letters', title: 'Open dead letters', filters: eq('status', 'OPEN'), emptyText: 'No dead letters.' },
  { nodeId: 'wk-q-chart-status', kind: 'chart', tab: 'queue', x: 0, y: 3, w: 6, h: 8, domain: 'ops_work_queue', title: 'Work items by status', dimension: 'status', chartKind: 'bar', emptyText: 'No work items in this date range. Run a workflow with a human task to populate this queue.' },
  { nodeId: 'wk-q-chart-wf', kind: 'chart', tab: 'queue', x: 6, y: 3, w: 6, h: 8, domain: 'ops_work_queue', title: 'Work items by workflow', dimension: 'workflow_key', chartKind: 'bar' },
  { nodeId: 'wk-q-chart-type', kind: 'chart', tab: 'queue', x: 0, y: 11, w: 6, h: 8, domain: 'ops_work_queue', title: 'Work items by type', dimension: 'work_item_type', chartKind: 'pie' },
  { nodeId: 'wk-q-chart-claimant', kind: 'chart', tab: 'queue', x: 6, y: 11, w: 6, h: 8, domain: 'ops_work_queue', title: 'Claimed by user', dimension: 'claimed_by_username', chartKind: 'bar' },
  { nodeId: 'wk-q-table-wf-status', kind: 'table', tab: 'queue', x: 0, y: 19, w: 12, h: 8, domain: 'ops_work_queue', title: 'Queue by workflow and status', dimension: 'workflow_key', dimensionB: 'status' },
  { nodeId: 'wk-w-kpi-running', kind: 'kpi', tab: 'workflows', x: 0, y: 0, w: 3, h: 3, domain: 'ops_workflow_instances', title: 'Running instances', filters: eq('status', 'RUNNING'), emptyText: 'No workflow instances in this date range.' },
  { nodeId: 'wk-w-kpi-suspended', kind: 'kpi', tab: 'workflows', x: 3, y: 0, w: 3, h: 3, domain: 'ops_workflow_instances', title: 'Suspended', filters: eq('status', 'SUSPENDED') },
  { nodeId: 'wk-w-kpi-failed', kind: 'kpi', tab: 'workflows', x: 6, y: 0, w: 3, h: 3, domain: 'ops_workflow_instances', title: 'Failed instances', filters: eq('status', 'FAILED') },
  { nodeId: 'wk-w-kpi-active-def', kind: 'kpi', tab: 'workflows', x: 9, y: 0, w: 3, h: 3, domain: 'ops_workflow_defs', title: 'Active definitions', filters: eq('lifecycle_status', 'ACTIVE'), emptyText: 'No workflow definitions yet.' },
  { nodeId: 'wk-w-chart-inst-status', kind: 'chart', tab: 'workflows', x: 0, y: 3, w: 6, h: 8, domain: 'ops_workflow_instances', title: 'Instances by status', dimension: 'status', chartKind: 'bar', emptyText: 'No workflow instances in this date range.' },
  { nodeId: 'wk-w-chart-def-life', kind: 'chart', tab: 'workflows', x: 6, y: 3, w: 6, h: 8, domain: 'ops_workflow_defs', title: 'Definitions by lifecycle', dimension: 'lifecycle_status', chartKind: 'pie', emptyText: 'No workflow definitions yet.' },
  { nodeId: 'wk-w-chart-inst-day', kind: 'chart', tab: 'workflows', x: 0, y: 11, w: 6, h: 8, domain: 'ops_workflow_instances', title: 'Instances per day', dimension: 'created_at', dimensionGrain: 'day', chartKind: 'line' },
  { nodeId: 'wk-w-chart-dl-class', kind: 'chart', tab: 'workflows', x: 6, y: 11, w: 6, h: 8, domain: 'ops_dead_letters', title: 'Dead letters by error class', dimension: 'error_class', chartKind: 'bar', emptyText: 'No dead letters.' },
  { nodeId: 'wk-w-chart-start', kind: 'chart', tab: 'workflows', x: 0, y: 19, w: 6, h: 8, domain: 'ops_workflow_instances', title: 'Instances by start type', dimension: 'start_type', chartKind: 'pie' },
  { nodeId: 'wk-w-chart-dl-code', kind: 'chart', tab: 'workflows', x: 6, y: 19, w: 6, h: 8, domain: 'ops_dead_letters', title: 'Dead letters by error code', dimension: 'error_code', chartKind: 'bar' },
  { nodeId: 'wk-f-kpi-new', kind: 'kpi', tab: 'feedback', x: 0, y: 0, w: 3, h: 3, domain: 'ops_feedback', title: 'New', filters: eq('status', 'NEW'), emptyText: 'No feedback in this date range.' },
  { nodeId: 'wk-f-kpi-wip', kind: 'kpi', tab: 'feedback', x: 3, y: 0, w: 3, h: 3, domain: 'ops_feedback', title: 'In progress', filters: eq('status', 'IN_PROGRESS') },
  { nodeId: 'wk-f-kpi-crit', kind: 'kpi', tab: 'feedback', x: 6, y: 0, w: 3, h: 3, domain: 'ops_feedback', title: 'Critical', filters: eq('priority', 'CRITICAL') },
  { nodeId: 'wk-f-kpi-resolved', kind: 'kpi', tab: 'feedback', x: 9, y: 0, w: 3, h: 3, domain: 'ops_feedback', title: 'Resolved', filters: eq('status', 'RESOLVED') },
  { nodeId: 'wk-f-chart-status', kind: 'chart', tab: 'feedback', x: 0, y: 3, w: 6, h: 8, domain: 'ops_feedback', title: 'Feedback by status', dimension: 'status', chartKind: 'bar', emptyText: 'No feedback in this date range.' },
  { nodeId: 'wk-f-chart-type', kind: 'chart', tab: 'feedback', x: 6, y: 3, w: 6, h: 8, domain: 'ops_feedback', title: 'Feedback by subject', dimension: 'type', chartKind: 'pie' },
  { nodeId: 'wk-f-chart-priority', kind: 'chart', tab: 'feedback', x: 0, y: 11, w: 6, h: 8, domain: 'ops_feedback', title: 'Feedback by priority', dimension: 'priority', chartKind: 'bar' },
  { nodeId: 'wk-f-chart-page', kind: 'chart', tab: 'feedback', x: 6, y: 11, w: 6, h: 8, domain: 'ops_feedback', title: 'Feedback by page', dimension: 'page_key', chartKind: 'bar' },
  { nodeId: 'wk-f-chart-day', kind: 'chart', tab: 'feedback', x: 0, y: 19, w: 12, h: 8, domain: 'ops_feedback', title: 'Feedback submitted per day', dimension: 'submitted_at', dimensionGrain: 'day', chartKind: 'line' },
];

const peopleWidgets = (): WidgetSpec[] => [
  { nodeId: 'pp-p-kpi-people', kind: 'kpi', tab: 'people', x: 0, y: 0, w: 3, h: 3, domain: 'ops_user_directory', title: 'People', emptyText: 'No users.' },
  { nodeId: 'pp-p-kpi-no-role', kind: 'kpi', tab: 'people', x: 3, y: 0, w: 3, h: 3, domain: 'ops_user_directory', title: 'Without a role', filters: eq('has_role', 0) },
  { nodeId: 'pp-p-kpi-locked', kind: 'kpi', tab: 'people', x: 6, y: 0, w: 3, h: 3, domain: 'ops_user_directory', title: 'Locked', filters: eq('locked', 1) },
  { nodeId: 'pp-p-kpi-never', kind: 'kpi', tab: 'people', x: 9, y: 0, w: 3, h: 3, domain: 'ops_user_directory', title: 'Never signed in', filters: eq('never_logged_in', 1) },
  { nodeId: 'pp-p-chart-role', kind: 'chart', tab: 'people', x: 0, y: 3, w: 6, h: 8, domain: 'ops_people_roles', title: 'People by role', dimension: 'role_name', metric: 'user_id', chartKind: 'bar', emptyText: 'No role assignments yet.' },
  { nodeId: 'pp-p-chart-type', kind: 'chart', tab: 'people', x: 6, y: 3, w: 6, h: 8, domain: 'ops_user_directory', title: 'People by person type', dimension: 'person_type_code', chartKind: 'pie' },
  { nodeId: 'pp-p-table-role-type', kind: 'table', tab: 'people', x: 0, y: 11, w: 6, h: 8, domain: 'ops_people_roles', title: 'People by role and type', dimension: 'role_name', dimensionB: 'person_type_code', metric: 'user_id' },
  { nodeId: 'pp-p-chart-locked', kind: 'chart', tab: 'people', x: 6, y: 11, w: 6, h: 8, domain: 'ops_user_directory', title: 'Locked vs open', dimension: 'locked', chartKind: 'pie' },
  { nodeId: 'pp-p-table-role-locked', kind: 'table', tab: 'people', x: 0, y: 19, w: 12, h: 8, domain: 'ops_people_roles', title: 'People by role and lock', dimension: 'role_name', dimensionB: 'locked', metric: 'user_id' },
  { nodeId: 'pp-p-chart-created', kind: 'chart', tab: 'people', x: 0, y: 27, w: 6, h: 8, domain: 'ops_user_directory', title: 'Accounts created per day', dimension: 'created_at', dimensionGrain: 'day', chartKind: 'line' },
  { nodeId: 'pp-p-chart-builtin', kind: 'chart', tab: 'people', x: 6, y: 27, w: 6, h: 8, domain: 'ops_user_directory', title: 'Built-in vs regular', dimension: 'is_builtin', chartKind: 'pie' },
  { nodeId: 'pp-h-kpi-profile', kind: 'kpi', tab: 'hygiene', x: 0, y: 0, w: 3, h: 3, domain: 'ops_user_directory', title: 'No profile', filters: eq('has_profile', 0), emptyText: 'No people match this view.' },
  { nodeId: 'pp-h-kpi-unverified', kind: 'kpi', tab: 'hygiene', x: 3, y: 0, w: 3, h: 3, domain: 'ops_user_directory', title: 'Unverified email', filters: { has_email: { eq: 1 }, email_verified: { eq: 0 } } },
  { nodeId: 'pp-h-kpi-dormant', kind: 'kpi', tab: 'hygiene', x: 6, y: 0, w: 3, h: 3, domain: 'ops_user_directory', title: 'Dormant (30d)', filters: eq('is_dormant', 1) },
  { nodeId: 'pp-h-kpi-fail', kind: 'kpi', tab: 'hygiene', x: 9, y: 0, w: 3, h: 3, domain: 'ops_user_directory', title: 'Fail streak', filters: eq('has_fail_streak', 1) },
  { nodeId: 'pp-h-chart-signin', kind: 'chart', tab: 'hygiene', x: 0, y: 3, w: 6, h: 8, domain: 'ops_user_directory', title: 'Never signed in vs has signed in', dimension: 'never_logged_in', chartKind: 'pie' },
  { nodeId: 'pp-h-chart-role', kind: 'chart', tab: 'hygiene', x: 6, y: 3, w: 6, h: 8, domain: 'ops_user_directory', title: 'Has a role vs none', dimension: 'has_role', chartKind: 'pie' },
  { nodeId: 'pp-h-chart-sso', kind: 'chart', tab: 'hygiene', x: 0, y: 11, w: 6, h: 8, domain: 'ops_user_directory', title: 'SSO linked vs local only', dimension: 'has_identity', chartKind: 'pie' },
  { nodeId: 'pp-h-chart-scope', kind: 'chart', tab: 'hygiene', x: 6, y: 11, w: 6, h: 8, domain: 'ops_user_directory', title: 'Has scope vs none', dimension: 'has_scope', chartKind: 'pie' },
  { nodeId: 'pp-h-chart-provider', kind: 'chart', tab: 'hygiene', x: 0, y: 19, w: 6, h: 8, domain: 'ops_identities', title: 'Linked identities by provider', dimension: 'provider_kind', chartKind: 'bar', emptyText: 'No linked sign-in providers.' },
  { nodeId: 'pp-h-chart-dim', kind: 'chart', tab: 'hygiene', x: 6, y: 19, w: 6, h: 8, domain: 'ops_scope_memberships', title: 'Scope memberships by dimension', dimension: 'dimension_key', chartKind: 'bar', emptyText: 'No scope memberships.' },
  { nodeId: 'pp-s-kpi-ok', kind: 'kpi', tab: 'sign-in', x: 0, y: 0, w: 3, h: 3, domain: 'ops_auth_events', title: 'Login success', filters: eq('event_type', 'LOGIN_SUCCESS'), emptyText: 'No sign-in events in this date range.' },
  { nodeId: 'pp-s-kpi-fail', kind: 'kpi', tab: 'sign-in', x: 3, y: 0, w: 3, h: 3, domain: 'ops_auth_events', title: 'Login failed', filters: eq('event_type', 'LOGIN_FAILED') },
  { nodeId: 'pp-s-kpi-blocked', kind: 'kpi', tab: 'sign-in', x: 6, y: 0, w: 3, h: 3, domain: 'ops_auth_events', title: 'Blocked', filters: eq('event_type', 'LOGIN_BLOCKED') },
  { nodeId: 'pp-s-kpi-rate', kind: 'kpi', tab: 'sign-in', x: 9, y: 0, w: 3, h: 3, domain: 'ops_auth_events', title: 'Rate limited', filters: eq('event_type', 'LOGIN_RATE_LIMITED') },
  { nodeId: 'pp-s-chart-type', kind: 'chart', tab: 'sign-in', x: 0, y: 3, w: 6, h: 8, domain: 'ops_auth_events', title: 'Auth events by type', dimension: 'event_type', chartKind: 'bar', emptyText: 'No sign-in events in this date range.' },
  { nodeId: 'pp-s-chart-success-day', kind: 'chart', tab: 'sign-in', x: 6, y: 3, w: 6, h: 8, domain: 'ops_auth_events', title: 'Success vs fail per day', dimension: 'created_at', dimensionGrain: 'day', dimensionB: 'success', chartKind: 'line' },
  { nodeId: 'pp-s-chart-fail-user', kind: 'chart', tab: 'sign-in', x: 0, y: 11, w: 6, h: 8, domain: 'ops_auth_events', title: 'Failed sign-ins by username', dimension: 'username', chartKind: 'bar', filters: eq('event_type', 'LOGIN_FAILED'), emptyText: 'No failed sign-ins in this date range.' },
  { nodeId: 'pp-s-chart-day', kind: 'chart', tab: 'sign-in', x: 6, y: 11, w: 6, h: 8, domain: 'ops_auth_events', title: 'Auth events per day', dimension: 'created_at', dimensionGrain: 'day', chartKind: 'line' },
];

const ids = (widgets: WidgetSpec[], predicate: (widget: WidgetSpec) => boolean): string[] => (
  widgets.filter(predicate).map((widget) => widget.nodeId)
);

const dateRange = (
  id: string,
  label: string,
  domain: string,
  field: string,
  appliesTo: string[],
  defaultValue: string | null = OPS_DASHBOARD_DATE_RANGE_DEFAULT,
): DashboardFilterDeclaration => ({
  id,
  label,
  domainEntryId: domain,
  field,
  controlType: 'dateRange',
  appliesToWidgetIds: appliesTo,
  ...(defaultValue ? { defaultValue } : {}),
});

export const buildOpsDashboardDocuments = (
  dataSource: StoredDataSource,
  models: Map<string, EdgeModelDefinition>,
): Record<OpsDashboardPageKey, DesignerDocument> => {
  const ops = opsWidgets();
  const work = workWidgets();
  const people = peopleWidgets();
  const opsDoc = buildDocument('studio-insights-ops', {
    personalizable: true,
    domain: ['ops_jobs', 'ops_logs', 'ops_data_sources'].map((id) => domainRef(dataSource, models, id)),
    tabs: [
      { id: 'overview', label: 'Overview' },
      { id: 'jobs', label: 'Jobs' },
      { id: 'logs', label: 'Logs' },
    ],
    filters: [
      dateRange('ops-range', 'Jobs dates', 'ops_jobs', 'created_at', ids(ops, (widget) => widget.domain === 'ops_jobs')),
      dateRange('ops-log-range', 'Logs dates', 'ops_logs', 'created_at', ids(ops, (widget) => widget.domain === 'ops_logs')),
      {
        id: 'ops-job-status',
        label: 'Job status',
        domainEntryId: 'ops_jobs',
        field: 'status',
        controlType: 'multiSelect',
        appliesToWidgetIds: ['ops-ov-chart-job-status', 'ops-jb-chart-type', 'ops-jb-chart-status', 'ops-jb-chart-day-type', 'ops-jb-table-type-status'],
      },
      {
        id: 'ops-log-level',
        label: 'Log level',
        domainEntryId: 'ops_logs',
        field: 'level',
        controlType: 'multiSelect',
        appliesToWidgetIds: ['ops-lg-chart-level', 'ops-lg-chart-context', 'ops-lg-chart-day', 'ops-lg-table-ctx-level'],
      },
      {
        id: 'ops-job-type',
        label: 'Job type',
        domainEntryId: 'ops_jobs',
        field: 'job_type',
        controlType: 'multiSelect',
        appliesToWidgetIds: ids(ops, (widget) => widget.tab === 'jobs'),
      },
    ],
    dashboardLinks: [
      { label: 'Jobs', target: { url: '/studio/jobs' } },
      { label: 'Logs', target: { url: '/studio/logs' } },
      { label: 'Data Sources', target: { url: '/studio/data-sources' } },
      { label: 'Scheduled tasks', target: { url: '/studio/scheduled-tasks' } },
      { label: 'Cache', target: { url: '/studio/cache' } },
      { label: 'Work queue', target: { pageId: 'studio-insights-work' } },
    ],
  }, ops);

  const workDoc = buildDocument('studio-insights-work', {
    personalizable: true,
    domain: ['ops_work_queue', 'ops_workflow_instances', 'ops_workflow_defs', 'ops_dead_letters', 'ops_feedback']
      .map((id) => domainRef(dataSource, models, id)),
    tabs: [
      { id: 'queue', label: 'Queue' },
      { id: 'workflows', label: 'Workflows' },
      { id: 'feedback', label: 'Feedback' },
    ],
    filters: [
      dateRange('work-range', 'Queue dates', 'ops_work_queue', 'created_at', ids(work, (widget) => widget.domain === 'ops_work_queue')),
      {
        id: 'work-status',
        label: 'Work item status',
        domainEntryId: 'ops_work_queue',
        field: 'status',
        controlType: 'multiSelect',
        appliesToWidgetIds: ids(work, (widget) => widget.tab === 'queue' && widget.kind !== 'kpi'),
      },
      {
        id: 'work-wf',
        label: 'Workflow',
        domainEntryId: 'ops_work_queue',
        field: 'workflow_key',
        controlType: 'multiSelect',
        appliesToWidgetIds: ids(work, (widget) => widget.tab === 'queue'),
      },
      dateRange('wf-inst-range', 'Workflow dates', 'ops_workflow_instances', 'created_at', ids(work, (widget) => widget.domain === 'ops_workflow_instances')),
      dateRange('fb-range', 'Feedback dates', 'ops_feedback', 'submitted_at', ids(work, (widget) => widget.domain === 'ops_feedback')),
      {
        id: 'fb-status',
        label: 'Feedback status',
        domainEntryId: 'ops_feedback',
        field: 'status',
        controlType: 'multiSelect',
        appliesToWidgetIds: ids(work, (widget) => widget.tab === 'feedback' && widget.kind !== 'kpi'),
      },
    ],
    dashboardLinks: [
      { label: 'Workflows', target: { url: '/studio/workflows' } },
      { label: 'My work items', target: { url: '/studio/my-inbox' } },
      { label: 'Feedback inbox', target: { url: '/studio/feedback' } },
      { label: 'Studio operations', target: { pageId: 'studio-insights-ops' } },
    ],
  }, work);

  const peopleDoc = buildDocument('studio-insights-people', {
    personalizable: true,
    domain: ['ops_user_directory', 'ops_people_roles', 'ops_identities', 'ops_scope_memberships', 'ops_auth_events']
      .map((id) => domainRef(dataSource, models, id)),
    tabs: [
      { id: 'people', label: 'People' },
      { id: 'hygiene', label: 'Hygiene' },
      { id: 'sign-in', label: 'Sign-in' },
    ],
    filters: [
      {
        id: 'ppl-role',
        label: 'Role',
        domainEntryId: 'ops_people_roles',
        field: 'role_name',
        controlType: 'multiSelect',
        appliesToWidgetIds: ids(people, (widget) => widget.domain === 'ops_people_roles'),
      },
      {
        id: 'ppl-type',
        label: 'Person type',
        domainEntryId: 'ops_user_directory',
        field: 'person_type_code',
        controlType: 'multiSelect',
        appliesToWidgetIds: ['pp-p-chart-type', 'pp-p-chart-created'],
      },
      dateRange('ppl-created', 'Created dates', 'ops_user_directory', 'created_at', ['pp-p-chart-created'], null),
      {
        id: 'hyg-role-flag',
        label: 'Has a role',
        domainEntryId: 'ops_user_directory',
        field: 'has_role',
        controlType: 'select',
        appliesToWidgetIds: ids(people, (widget) => widget.tab === 'hygiene' && widget.kind !== 'kpi'),
      },
      dateRange('auth-range', 'Sign-in dates', 'ops_auth_events', 'created_at', ids(people, (widget) => widget.tab === 'sign-in')),
    ],
    dashboardLinks: [
      { label: 'Users', target: { url: '/studio/users' } },
      { label: 'Roles', target: { url: '/studio/roles' } },
      { label: 'Logs', target: { url: '/studio/logs' } },
    ],
  }, people);

  return {
    'studio-insights-ops': opsDoc,
    'studio-insights-work': workDoc,
    'studio-insights-people': peopleDoc,
  };
};
