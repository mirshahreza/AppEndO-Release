/**
 * CD-O01 — Canonical visualization data shapes for Phase O widgets.
 * @see specs/component-designer/04-visualization-data-model.md
 */

import type { UiKanbanTone } from '../../shared/ui/UiKanbanBoard';

export type DesignerChartDataRow = Record<string, string | number> & {
  label?: string;
  color?: string;
};

export type DesignerTreeNode = {
  id: string;
  label: string;
  /** Optional Lucide icon name shown before the label (see viz.tree-view `showIcons`). */
  icon?: string;
  children?: DesignerTreeNode[];
};

export type DesignerTimelineEvent = {
  id?: string;
  title: string;
  start: string;
  end?: string;
  description?: string;
  /** Gantt-only, 0-100 — renders a filled portion of the bar. Ignored by Timeline. */
  progress?: number;
};

export type DesignerGanttViewMode = 'day' | 'week' | 'month';

export type DesignerGanttDependency = {
  fromTaskId: string;
  toTaskId: string;
};

export type DesignerGanttMilestone = {
  taskId: string;
  label: string;
};

export type DesignerKanbanCard = {
  id: string;
  title: string;
  description?: string;
  /** Compact label chips under the title (e.g. "3 days in stage"). Mirrors `UiKanbanCard`. */
  badges?: Array<{ label: string; tone?: 'default' | 'info' | 'warning' | 'danger' }>;
  /** Small identity chip (e.g. customer initials). Mirrors `UiKanbanCard`. */
  avatar?: { label: string; tone?: UiKanbanTone };
  /** Secondary meta line (e.g. amount, close date). Mirrors `UiKanbanCard`. */
  meta?: string;
  /** Left accent bar tone (e.g. `danger` for an overdue close date). Mirrors `UiKanbanCard`. */
  accent?: 'default' | 'warning' | 'danger';
};

export type DesignerKanbanColumn = {
  id: string;
  title: string;
  cards: DesignerKanbanCard[];
};

export type DesignerKanbanBoard = {
  columns: DesignerKanbanColumn[];
};

export type DesignerSheetData = {
  columns: Array<{
    key: string;
    header: string;
    type?: 'text' | 'number' | 'select' | 'formula';
    options?: string[];
    formula?: string;
    onCellChangeAction?: import('./types').DesignerDynamicAction[];
  }>;
  rows: Array<Record<string, unknown>>;
};

export const DEFAULT_CHART_X_AXIS_KEY = 'label';

export const parseDesignerChartData = (raw: unknown): DesignerChartDataRow[] => {
  if (typeof raw === 'string') {
    try {
      return parseDesignerChartData(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (row): row is DesignerChartDataRow =>
      typeof row === 'object' && row !== null && !Array.isArray(row),
  );
};

export const parseDesignerTreeNodes = (raw: unknown): DesignerTreeNode[] => {
  if (typeof raw === 'string') {
    try {
      return parseDesignerTreeNodes(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw
    .filter((node): node is DesignerTreeNode =>
      typeof node === 'object'
      && node !== null
      && typeof (node as DesignerTreeNode).id === 'string'
      && typeof (node as DesignerTreeNode).label === 'string',
    )
    .map(normalizeTreeNode);
};

const normalizeTreeNode = (node: DesignerTreeNode): DesignerTreeNode => ({
  id: node.id,
  label: node.label,
  ...(typeof node.icon === 'string' && node.icon.trim().length > 0 ? { icon: node.icon.trim() } : {}),
  ...(Array.isArray(node.children) && node.children.length > 0
    ? { children: node.children.map(normalizeTreeNode) }
    : {}),
});

export const parseDesignerTimelineEvents = (raw: unknown): DesignerTimelineEvent[] => {
  if (typeof raw === 'string') {
    try {
      return parseDesignerTimelineEvents(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (event): event is DesignerTimelineEvent =>
      typeof event === 'object'
      && event !== null
      && typeof (event as DesignerTimelineEvent).title === 'string'
      && typeof (event as DesignerTimelineEvent).start === 'string',
  );
};

export const parseDesignerGanttDependencies = (raw: unknown): DesignerGanttDependency[] => {
  if (typeof raw === 'string') {
    try {
      return parseDesignerGanttDependencies(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (entry): entry is DesignerGanttDependency =>
      typeof entry === 'object'
      && entry !== null
      && typeof (entry as DesignerGanttDependency).fromTaskId === 'string'
      && typeof (entry as DesignerGanttDependency).toTaskId === 'string',
  );
};

export const parseDesignerGanttMilestones = (raw: unknown): DesignerGanttMilestone[] => {
  if (typeof raw === 'string') {
    try {
      return parseDesignerGanttMilestones(JSON.parse(raw));
    } catch {
      return [];
    }
  }
  if (!Array.isArray(raw)) {
    return [];
  }
  return raw.filter(
    (entry): entry is DesignerGanttMilestone =>
      typeof entry === 'object'
      && entry !== null
      && typeof (entry as DesignerGanttMilestone).taskId === 'string'
      && typeof (entry as DesignerGanttMilestone).label === 'string',
  );
};

export const parseDesignerKanbanBoard = (raw: unknown): DesignerKanbanBoard => {
  if (typeof raw === 'string') {
    try {
      return parseDesignerKanbanBoard(JSON.parse(raw));
    } catch {
      return { columns: [] };
    }
  }
  if (typeof raw !== 'object' || raw === null || !Array.isArray((raw as DesignerKanbanBoard).columns)) {
    return { columns: [] };
  }
  return { columns: (raw as DesignerKanbanBoard).columns };
};

export const parseDesignerSheetData = (raw: unknown): DesignerSheetData => {
  if (typeof raw === 'string') {
    try {
      return parseDesignerSheetData(JSON.parse(raw));
    } catch {
      return { columns: [], rows: [] };
    }
  }
  if (typeof raw !== 'object' || raw === null) {
    return { columns: [], rows: [] };
  }
  const sheet = raw as {
    columns?: unknown;
    rows?: unknown;
  };
  const normalizedColumns = Array.isArray(sheet.columns)
    ? sheet.columns.map((column, index) => {
      if (typeof column === 'string') {
        const normalized: DesignerSheetData['columns'][number] = {
          key: `col_${index}`,
          header: column,
          type: 'text' as const,
        };
        return normalized;
      }
      if (typeof column !== 'object' || column === null) {
        const normalized: DesignerSheetData['columns'][number] = {
          key: `col_${index}`,
          header: `Column ${index + 1}`,
          type: 'text' as const,
        };
        return normalized;
      }
      const record = column as Record<string, unknown>;
      const key = typeof record.key === 'string' && record.key.trim().length > 0
        ? record.key.trim()
        : typeof record.field === 'string' && record.field.trim().length > 0
          ? record.field.trim()
          : `col_${index}`;
      const header = typeof record.header === 'string' && record.header.trim().length > 0
        ? record.header.trim()
        : key;
      const type = record.type === 'number' || record.type === 'select' || record.type === 'formula'
        ? record.type
        : 'text';
      const options = Array.isArray(record.options)
        ? record.options.map((option) => String(option)).filter((option) => option.trim().length > 0)
        : [];
      const formula = typeof record.formula === 'string' && record.formula.trim().length > 0
        ? record.formula.trim()
        : undefined;
      const normalized: DesignerSheetData['columns'][number] = {
        key,
        header,
        type,
        ...(options.length > 0 ? { options } : {}),
        ...(formula ? { formula } : {}),
        ...(Array.isArray(record.onCellChangeAction) ? { onCellChangeAction: record.onCellChangeAction as import('./types').DesignerDynamicAction[] } : {}),
      };
      return normalized;
    })
    : [];
  const normalizedRows = Array.isArray(sheet.rows)
    ? sheet.rows.map((row) => {
      if (Array.isArray(row)) {
        return normalizedColumns.reduce<Record<string, unknown>>((acc, column, index) => {
          acc[column.key] = row[index];
          return acc;
        }, {});
      }
      if (typeof row === 'object' && row !== null) {
        return { ...(row as Record<string, unknown>) };
      }
      return {};
    })
    : [];
  return {
    columns: normalizedColumns,
    rows: normalizedRows,
  };
};

export const parseSeriesKeys = (raw: unknown, fallback = 'value'): string[] => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return [fallback];
  }
  return raw.split(',').map((key) => key.trim()).filter((key) => key.length > 0);
};

export const CHART_SERIES_COLORS = [
  '#0ea5e9',
  '#8b5cf6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#6366f1',
] as const;

export const resolveChartNumericValue = (row: DesignerChartDataRow, key: string): number => {
  const value = row[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

export const flattenTreeNodes = (nodes: DesignerTreeNode[]): DesignerTreeNode[] => {
  const result: DesignerTreeNode[] = [];
  const walk = (items: DesignerTreeNode[]) => {
    for (const item of items) {
      result.push(item);
      if (item.children) {
        walk(item.children);
      }
    }
  };
  walk(nodes);
  return result;
};

export const findTreeNodeById = (nodes: DesignerTreeNode[], id: string): DesignerTreeNode | null => {
  for (const node of nodes) {
    if (node.id === id) {
      return node;
    }
    if (node.children) {
      const found = findTreeNodeById(node.children, id);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

/** Root→target chain of node references for `id` (used to seed Cascader levels/Tree Combobox from a bound value). */
export const findTreeNodeChainById = (nodes: DesignerTreeNode[], id: string): DesignerTreeNode[] => {
  const chain: DesignerTreeNode[] = [];
  const walk = (items: DesignerTreeNode[]): boolean => {
    for (const node of items) {
      chain.push(node);
      if (node.id === id) {
        return true;
      }
      if (node.children && walk(node.children)) {
        return true;
      }
      chain.pop();
    }
    return false;
  };
  walk(nodes);
  return chain;
};

export const buildTreeNodePath = (nodes: DesignerTreeNode[], id: string): string[] => {
  const path: string[] = [];
  const walk = (items: DesignerTreeNode[], ancestors: string[]): boolean => {
    for (const node of items) {
      const next = [...ancestors, node.label];
      if (node.id === id) {
        path.push(...next);
        return true;
      }
      if (node.children && walk(node.children, next)) {
        return true;
      }
    }
    return false;
  };
  walk(nodes, []);
  return path;
};
