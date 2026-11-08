import type {
  DesignerKanbanBoard,
  DesignerKanbanCard,
  DesignerKanbanColumn,
  DesignerSheetData,
  DesignerTimelineEvent,
  DesignerTreeNode,
} from './visualizationDataModel';
import { sanitizeTrueActions } from './bindingDynamicActionsEngine';
import type { DesignerDynamicAction } from './types';

export type VizWidgetKind = 'tree' | 'timeline' | 'gantt' | 'kanban' | 'sheet';

export type DesignerVizTreeFieldMapping = {
  kind: 'tree';
  idField: string;
  labelField: string;
  parentIdField?: string;
};

export type DesignerVizTimelineFieldMapping = {
  kind: 'timeline' | 'gantt';
  idField?: string;
  titleField: string;
  startField: string;
  endField?: string;
  descriptionField?: string;
  /** Gantt only — maps an API percent-complete column onto each bar's filled portion. */
  progressField?: string;
};

export type DesignerVizKanbanColumnDef = {
  id: string;
  title: string;
};

export type DesignerVizKanbanFieldMapping = {
  kind: 'kanban';
  cardIdField: string;
  cardTitleField: string;
  cardDescriptionField?: string;
  cardColumnField: string;
  columnOrder?: DesignerVizKanbanColumnDef[];
};

export type DesignerVizSheetColumnMapping = {
  header: string;
  field: string;
  type?: 'text' | 'number' | 'select' | 'formula';
  options?: string[];
  formula?: string;
  onCellChangeAction?: DesignerDynamicAction[];
};

export type DesignerVizSheetFieldMapping = {
  kind: 'sheet';
  columns: DesignerVizSheetColumnMapping[];
};

export type DesignerVizFieldMapping =
  | DesignerVizTreeFieldMapping
  | DesignerVizTimelineFieldMapping
  | DesignerVizKanbanFieldMapping
  | DesignerVizSheetFieldMapping;

const readStringField = (row: Record<string, unknown>, field: string, fallback = ''): string => {
  const value = row[field];
  if (value === undefined || value === null) {
    return fallback;
  }
  return String(value);
};

export const parseDesignerVizFieldMapping = (raw: unknown): DesignerVizFieldMapping | null => {
  if (typeof raw === 'string') {
    try {
      return parseDesignerVizFieldMapping(JSON.parse(raw));
    } catch {
      return null;
    }
  }

  if (typeof raw !== 'object' || raw === null || typeof (raw as { kind?: unknown }).kind !== 'string') {
    return null;
  }

  const mapping = raw as DesignerVizFieldMapping;
  switch (mapping.kind) {
    case 'tree': {
      const idField = mapping.idField?.trim();
      const labelField = mapping.labelField?.trim();
      if (!idField || !labelField) {
        return null;
      }
      return {
        kind: 'tree',
        idField,
        labelField,
        ...(mapping.parentIdField?.trim() ? { parentIdField: mapping.parentIdField.trim() } : {}),
      };
    }
    case 'timeline':
    case 'gantt': {
      const titleField = mapping.titleField?.trim();
      const startField = mapping.startField?.trim();
      if (!titleField || !startField) {
        return null;
      }
      return {
        kind: mapping.kind,
        titleField,
        startField,
        ...(mapping.idField?.trim() ? { idField: mapping.idField.trim() } : {}),
        ...(mapping.endField?.trim() ? { endField: mapping.endField.trim() } : {}),
        ...(mapping.descriptionField?.trim() ? { descriptionField: mapping.descriptionField.trim() } : {}),
        ...(mapping.progressField?.trim() ? { progressField: mapping.progressField.trim() } : {}),
      };
    }
    case 'kanban': {
      const cardIdField = mapping.cardIdField?.trim();
      const cardTitleField = mapping.cardTitleField?.trim();
      const cardColumnField = mapping.cardColumnField?.trim();
      if (!cardIdField || !cardTitleField || !cardColumnField) {
        return null;
      }
      return {
        kind: 'kanban',
        cardIdField,
        cardTitleField,
        cardColumnField,
        ...(mapping.cardDescriptionField?.trim() ? { cardDescriptionField: mapping.cardDescriptionField.trim() } : {}),
        ...(Array.isArray(mapping.columnOrder) && mapping.columnOrder.length > 0
          ? { columnOrder: mapping.columnOrder.filter((entry) => entry.id && entry.title) }
          : {}),
      };
    }
    case 'sheet': {
      const columns = Array.isArray(mapping.columns)
        ? mapping.columns
          .map((entry): DesignerVizSheetColumnMapping | null => {
            const header = entry.header?.trim();
            const field = entry.field?.trim();
            if (!header || !field) {
              return null;
            }
            const rawType = entry.type;
            const type = rawType === 'number' || rawType === 'select' || rawType === 'formula' ? rawType : 'text';
            const options = Array.isArray(entry.options)
              ? entry.options
                .map((option) => (typeof option === 'string' ? option.trim() : ''))
                .filter((option): option is string => option.length > 0)
              : [];
            const formula = typeof entry.formula === 'string' && entry.formula.trim().length > 0
              ? entry.formula.trim()
              : undefined;
            const onCellChangeAction = sanitizeTrueActions(
              entry.onCellChangeAction ?? (entry as { onCellChangeActions?: unknown }).onCellChangeActions,
            );
            return {
              header,
              field,
              type,
              ...(options.length > 0 ? { options } : {}),
              ...(type === 'formula' && formula ? { formula } : {}),
              ...(onCellChangeAction.length > 0 ? { onCellChangeAction } : {}),
            };
          })
          .filter((entry): entry is DesignerVizSheetColumnMapping => entry !== null)
        : [];
      if (columns.length === 0) {
        return null;
      }
      return { kind: 'sheet', columns };
    }
    default:
      return null;
  }
};

export const serializeDesignerVizFieldMapping = (mapping: DesignerVizFieldMapping): string =>
  JSON.stringify(mapping);

export const resolveVizWidgetKindFromPaletteId = (paletteItemId: string | undefined): VizWidgetKind | null => {
  if (!paletteItemId) {
    return null;
  }
  if (paletteItemId.startsWith('viz.tree-') || paletteItemId === 'viz.cascader') {
    return 'tree';
  }
  if (paletteItemId === 'viz.timeline') {
    return 'timeline';
  }
  if (paletteItemId === 'viz.gantt') {
    return 'gantt';
  }
  if (paletteItemId === 'viz.kanban') {
    return 'kanban';
  }
  if (paletteItemId === 'viz.sheet') {
    return 'sheet';
  }
  return null;
};

export const buildDefaultVizFieldMapping = (
  kind: VizWidgetKind,
  fields: string[],
): DesignerVizFieldMapping => {
  switch (kind) {
    case 'tree':
      return {
        kind: 'tree',
        idField: fields.find((field) => field === 'id') ?? fields[0] ?? 'id',
        labelField: fields.find((field) => ['label', 'name', 'title'].includes(field)) ?? fields[1] ?? 'label',
        parentIdField: fields.find((field) => ['parentId', 'parent_id', 'parent'].includes(field)),
      };
    case 'timeline':
    case 'gantt':
      return {
        kind,
        idField: fields.find((field) => field === 'id'),
        titleField: fields.find((field) => ['title', 'name', 'label'].includes(field)) ?? fields[0] ?? 'title',
        startField: fields.find((field) => ['start', 'startDate', 'date'].includes(field)) ?? fields[1] ?? 'start',
        endField: fields.find((field) => ['end', 'endDate', 'dueDate'].includes(field)),
        descriptionField: fields.find((field) => ['description', 'details', 'summary'].includes(field)),
        ...(kind === 'gantt'
          ? { progressField: fields.find((field) => ['progress', 'percentComplete', 'percent_complete', 'completion'].includes(field)) }
          : {}),
      };
    case 'kanban':
      return {
        kind: 'kanban',
        cardIdField: fields.find((field) => field === 'id') ?? fields[0] ?? 'id',
        cardTitleField: fields.find((field) => ['title', 'name'].includes(field)) ?? fields[1] ?? 'title',
        cardDescriptionField: fields.find((field) => ['description', 'details'].includes(field)),
        cardColumnField: fields.find((field) => ['status', 'column', 'columnId', 'stage'].includes(field)) ?? 'status',
      };
    case 'sheet':
      return {
        kind: 'sheet',
        columns: fields.slice(0, 6).map((field) => ({ header: field, field, type: 'text' as const })),
      };
    default:
      return { kind: 'sheet', columns: [{ header: 'Value', field: 'value' }] };
  }
};

const buildTreeFromFlatRows = (
  rows: Array<Record<string, unknown>>,
  mapping: DesignerVizTreeFieldMapping,
): DesignerTreeNode[] => {
  const parentField = mapping.parentIdField?.trim();
  if (!parentField) {
    return rows.map((row, index) => ({
      id: readStringField(row, mapping.idField, `node-${index + 1}`),
      label: readStringField(row, mapping.labelField, `Item ${index + 1}`),
    }));
  }

  const nodeMap = new Map<string, DesignerTreeNode>();
  for (const row of rows) {
    const id = readStringField(row, mapping.idField);
    if (!id) {
      continue;
    }
    nodeMap.set(id, {
      id,
      label: readStringField(row, mapping.labelField, id),
      children: [],
    });
  }

  const roots: DesignerTreeNode[] = [];
  for (const row of rows) {
    const id = readStringField(row, mapping.idField);
    if (!id) {
      continue;
    }
    const node = nodeMap.get(id);
    if (!node) {
      continue;
    }
    const parentId = readStringField(row, parentField);
    if (parentId && nodeMap.has(parentId)) {
      const parent = nodeMap.get(parentId)!;
      parent.children = [...(parent.children ?? []), node];
    } else {
      roots.push(node);
    }
  }

  const pruneEmptyChildren = (nodes: DesignerTreeNode[]): DesignerTreeNode[] =>
    nodes.map((node) => ({
      id: node.id,
      label: node.label,
      ...(node.children && node.children.length > 0 ? { children: pruneEmptyChildren(node.children) } : {}),
    }));

  return pruneEmptyChildren(roots);
};

export const transformApiRowsToTreeNodes = (
  rows: Array<Record<string, unknown>>,
  mapping: DesignerVizTreeFieldMapping,
): DesignerTreeNode[] => buildTreeFromFlatRows(rows, mapping);

const readNumberField = (row: Record<string, unknown>, field: string): number | undefined => {
  const value = row[field];
  const parsed = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
};

export const transformApiRowsToTimelineEvents = (
  rows: Array<Record<string, unknown>>,
  mapping: DesignerVizTimelineFieldMapping,
): DesignerTimelineEvent[] =>
  rows.map((row, index) => {
    const progress = mapping.progressField ? readNumberField(row, mapping.progressField) : undefined;
    return {
      ...(mapping.idField ? { id: readStringField(row, mapping.idField, `evt-${index + 1}`) } : { id: `evt-${index + 1}` }),
      title: readStringField(row, mapping.titleField, `Event ${index + 1}`),
      start: readStringField(row, mapping.startField),
      ...(mapping.endField ? { end: readStringField(row, mapping.endField) } : {}),
      ...(mapping.descriptionField ? { description: readStringField(row, mapping.descriptionField) } : {}),
      ...(progress !== undefined ? { progress } : {}),
    };
  });

export const transformApiRowsToKanbanBoard = (
  rows: Array<Record<string, unknown>>,
  mapping: DesignerVizKanbanFieldMapping,
): DesignerKanbanBoard => {
  const cardsByColumn = new Map<string, DesignerKanbanCard[]>();

  rows.forEach((row, index) => {
    const columnKey = readStringField(row, mapping.cardColumnField, 'default');
    const card: DesignerKanbanCard = {
      id: readStringField(row, mapping.cardIdField, `card-${index + 1}`),
      title: readStringField(row, mapping.cardTitleField, `Card ${index + 1}`),
      ...(mapping.cardDescriptionField
        ? { description: readStringField(row, mapping.cardDescriptionField) }
        : {}),
    };
    cardsByColumn.set(columnKey, [...(cardsByColumn.get(columnKey) ?? []), card]);
  });

  const columnOrder = mapping.columnOrder && mapping.columnOrder.length > 0
    ? mapping.columnOrder
    : Array.from(cardsByColumn.keys()).map((key) => ({ id: key, title: key }));

  const columns: DesignerKanbanColumn[] = columnOrder.map((columnDef) => ({
    id: columnDef.id,
    title: columnDef.title,
    cards: cardsByColumn.get(columnDef.id) ?? cardsByColumn.get(columnDef.title) ?? [],
  }));

  for (const [columnKey, cards] of cardsByColumn.entries()) {
    if (!columns.some((column) => column.id === columnKey || column.title === columnKey)) {
      columns.push({ id: columnKey, title: columnKey, cards });
    }
  }

  return { columns };
};

export const transformApiRowsToSheetData = (
  rows: Array<Record<string, unknown>>,
  mapping: DesignerVizSheetFieldMapping,
): DesignerSheetData => ({
  columns: mapping.columns.map((column) => ({
    key: column.field,
    header: column.header,
    type: column.type ?? 'text',
    ...(Array.isArray(column.options) && column.options.length > 0 ? { options: [...column.options] } : {}),
    ...(column.type === 'formula' && column.formula ? { formula: column.formula } : {}),
    ...(Array.isArray(column.onCellChangeAction) && column.onCellChangeAction.length > 0
      ? { onCellChangeAction: column.onCellChangeAction.map((action) => ({ ...action })) }
      : {}),
  })),
  rows: rows.map((row) => mapping.columns.reduce<Record<string, unknown>>((acc, column) => {
    acc[column.field] = row[column.field];
    return acc;
  }, {})),
});

export const transformApiRowsToVizData = (
  rows: Array<Record<string, unknown>>,
  mapping: DesignerVizFieldMapping,
): DesignerTreeNode[] | DesignerTimelineEvent[] | DesignerKanbanBoard | DesignerSheetData => {
  switch (mapping.kind) {
    case 'tree':
      return transformApiRowsToTreeNodes(rows, mapping);
    case 'timeline':
    case 'gantt':
      return transformApiRowsToTimelineEvents(rows, mapping);
    case 'kanban':
      return transformApiRowsToKanbanBoard(rows, mapping);
    case 'sheet':
      return transformApiRowsToSheetData(rows, mapping);
    default:
      return [];
  }
};

export const resolveVizTransformCodegenHelper = (kind: VizWidgetKind): string => {
  switch (kind) {
    case 'tree':
      return 'transformApiRowsToTreeNodes';
    case 'timeline':
    case 'gantt':
      return 'transformApiRowsToTimelineEvents';
    case 'kanban':
      return 'transformApiRowsToKanbanBoard';
    case 'sheet':
      return 'transformApiRowsToSheetData';
    default:
      return 'transformApiRowsToTreeNodes';
  }
};
