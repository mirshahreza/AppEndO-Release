export type DashboardLayoutBlockId =
  | 'kpi'
  | 'insights'
  | 'my-inbox'
  | 'feedback'
  | 'health'
  | 'quick-actions'
  | 'my-links'
  | 'my-shortcuts';

export const DASHBOARD_LAYOUT_BLOCK_IDS: readonly DashboardLayoutBlockId[] = [
  'kpi',
  'insights',
  'my-inbox',
  'feedback',
  'health',
  'quick-actions',
  'my-links',
  'my-shortcuts',
] as const;

const BLOCK_ID_SET = new Set<string>(DASHBOARD_LAYOUT_BLOCK_IDS);

export const isDashboardLayoutBlockId = (value: unknown): value is DashboardLayoutBlockId =>
  typeof value === 'string' && BLOCK_ID_SET.has(value);
