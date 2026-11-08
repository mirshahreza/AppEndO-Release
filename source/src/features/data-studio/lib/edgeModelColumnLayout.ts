import { z } from 'zod';
import type {
  ColumnFormWidget,
  ColumnFormWidgetProps,
  ColumnFilterRole,
  ColumnSearchRole,
  EdgeModelColumn,
  EdgeModelStudioColumnMeta,
} from '../../../shared/api/contracts/data-api';
import {
  DEFAULT_COLUMN_FILTER_ROLE,
  DEFAULT_COLUMN_SEARCH_ROLE,
  pruneColumnFormWidgetProps,
} from '../../../shared/api/contracts/data-api';

/** Empty string = ungrouped bucket. */
export const UNGROUPED_COLUMN_GROUP = '';

/** Persists named group order (including empty groups) in studio-meta.extensions. */
export const COLUMN_GROUP_ORDER_EXTENSION_KEY = 'columnGroupOrder';
/** Persists per-group icon/color presentation in studio-meta.extensions. */
export const COLUMN_GROUP_PRESENTATION_EXTENSION_KEY = 'columnGroupPresentation';

const columnGroupOrderExtensionSchema = z.array(z.string());
const columnGroupPresentationEntrySchema = z.object({
  icon: z.string().optional(),
  color: z.string().optional(),
}).strict();
const columnGroupPresentationExtensionSchema = z.record(
  z.string(),
  columnGroupPresentationEntrySchema,
);

export type ColumnGroupPresentationEntry = z.infer<typeof columnGroupPresentationEntrySchema>;

export type EdgeModelColumnStudioLayout = {
  columnDisplayLabels: Record<string, string>;
  /** Navigation icon ref (`pack:icon-name`) per column name. */
  columnIcons: Record<string, string>;
  /** Form display widget per column name. */
  columnFormWidgets: Record<string, ColumnFormWidget>;
  /** Widget-specific props per column name. */
  columnFormWidgetProps: Record<string, ColumnFormWidgetProps>;
  /** Required-in-form flag per column name (true entries only). */
  columnRequired: Record<string, boolean>;
  /** List search participation per column name. */
  columnSearchRoles: Record<string, ColumnSearchRole>;
  /** List Where builder participation per column name. */
  columnFilterRoles: Record<string, ColumnFilterRole>;
  columnDeveloperNotes: Record<string, string>;
  columnInterfaceNotes: Record<string, string>;
  columnGroups: Record<string, string>;
  columnSortOrders: Record<string, number>;
  /** Named groups in display order (ungrouped is always first and omitted here). */
  columnGroupOrder: string[];
  /** Navigation icon ref per named group. */
  columnGroupIcons: Record<string, string>;
  /** Tailwind text color class per named group. */
  columnGroupColors: Record<string, string>;
  /** ROLAP cube measure annotation per column name. */
  columnCubeMeasures?: Record<string, NonNullable<EdgeModelStudioColumnMeta['cubeMeasure']>>;
  /** Record-event history settings per column name. */
  columnHistories?: Record<string, NonNullable<EdgeModelStudioColumnMeta['history']>>;
};

export type ColumnLayoutBucket = {
  id: string;
  title: string;
  columnNames: string[];
};

const renameRecordKey = <T,>(
  record: Record<string, T>,
  fromName: string,
  toName: string,
): Record<string, T> => {
  if (fromName === toName || !(fromName in record)) {
    return record;
  }
  const next = { ...record };
  next[toName] = next[fromName];
  delete next[fromName];
  return next;
};

export const renameColumnLayoutKeys = (
  layout: EdgeModelColumnStudioLayout,
  fromName: string,
  toName: string,
): EdgeModelColumnStudioLayout => ({
  columnDisplayLabels: renameRecordKey(layout.columnDisplayLabels, fromName, toName),
  columnIcons: renameRecordKey(layout.columnIcons, fromName, toName),
  columnFormWidgets: renameRecordKey(layout.columnFormWidgets, fromName, toName),
  columnFormWidgetProps: renameRecordKey(layout.columnFormWidgetProps, fromName, toName),
  columnRequired: renameRecordKey(layout.columnRequired, fromName, toName),
  columnSearchRoles: renameRecordKey(layout.columnSearchRoles, fromName, toName),
  columnFilterRoles: renameRecordKey(layout.columnFilterRoles, fromName, toName),
  columnDeveloperNotes: renameRecordKey(layout.columnDeveloperNotes, fromName, toName),
  columnInterfaceNotes: renameRecordKey(layout.columnInterfaceNotes, fromName, toName),
  columnGroups: renameRecordKey(layout.columnGroups, fromName, toName),
  columnSortOrders: renameRecordKey(layout.columnSortOrders, fromName, toName),
  columnGroupOrder: layout.columnGroupOrder,
  columnGroupIcons: layout.columnGroupIcons,
  columnGroupColors: layout.columnGroupColors,
  columnCubeMeasures: layout.columnCubeMeasures
    ? renameRecordKey(layout.columnCubeMeasures, fromName, toName)
    : layout.columnCubeMeasures,
  columnHistories: layout.columnHistories
    ? renameRecordKey(layout.columnHistories, fromName, toName)
    : layout.columnHistories,
});

export const removeColumnLayoutKeys = (
  layout: EdgeModelColumnStudioLayout,
  columnName: string,
): EdgeModelColumnStudioLayout => {
  const columnDisplayLabels = { ...layout.columnDisplayLabels };
  const columnIcons = { ...layout.columnIcons };
  const columnFormWidgets = { ...layout.columnFormWidgets };
  const columnFormWidgetProps = { ...layout.columnFormWidgetProps };
  const columnRequired = { ...layout.columnRequired };
  const columnSearchRoles = { ...layout.columnSearchRoles };
  const columnFilterRoles = { ...layout.columnFilterRoles };
  const columnDeveloperNotes = { ...layout.columnDeveloperNotes };
  const columnInterfaceNotes = { ...layout.columnInterfaceNotes };
  const columnGroups = { ...layout.columnGroups };
  const columnSortOrders = { ...layout.columnSortOrders };
  const columnCubeMeasures = { ...(layout.columnCubeMeasures ?? {}) };
  const columnHistories = { ...(layout.columnHistories ?? {}) };
  delete columnDisplayLabels[columnName];
  delete columnIcons[columnName];
  delete columnFormWidgets[columnName];
  delete columnFormWidgetProps[columnName];
  delete columnRequired[columnName];
  delete columnSearchRoles[columnName];
  delete columnFilterRoles[columnName];
  delete columnDeveloperNotes[columnName];
  delete columnInterfaceNotes[columnName];
  delete columnGroups[columnName];
  delete columnSortOrders[columnName];
  delete columnCubeMeasures[columnName];
  delete columnHistories[columnName];
  return {
    ...layout,
    columnDisplayLabels,
    columnIcons,
    columnFormWidgets,
    columnFormWidgetProps,
    columnRequired,
    columnSearchRoles,
    columnFilterRoles,
    columnDeveloperNotes,
    columnInterfaceNotes,
    columnGroups,
    columnSortOrders,
    columnGroupIcons: layout.columnGroupIcons,
    columnGroupColors: layout.columnGroupColors,
    columnCubeMeasures,
    columnHistories,
  };
};

export const buildDefaultColumnSortOrders = (
  columns: ReadonlyArray<Pick<EdgeModelColumn, 'name' | 'isPrimaryKey'>>,
): Record<string, number> => {
  const primaryKeys = columns.filter((column) => column.isPrimaryKey).map((column) => column.name);
  const others = columns.filter((column) => !column.isPrimaryKey).map((column) => column.name);
  const orders: Record<string, number> = {};
  [...primaryKeys, ...others].forEach((name, index) => {
    orders[name] = index;
  });
  return orders;
};

export const columnMetaToStudioLayout = (
  columnMeta: EdgeModelStudioColumnMeta[],
  columns: ReadonlyArray<Pick<EdgeModelColumn, 'name' | 'isPrimaryKey'>>,
): EdgeModelColumnStudioLayout => {
  const columnDisplayLabels: Record<string, string> = {};
  const columnIcons: Record<string, string> = {};
  const columnFormWidgets: Record<string, ColumnFormWidget> = {};
  const columnFormWidgetProps: Record<string, ColumnFormWidgetProps> = {};
  const columnRequired: Record<string, boolean> = {};
  const columnSearchRoles: Record<string, ColumnSearchRole> = {};
  const columnFilterRoles: Record<string, ColumnFilterRole> = {};
  const columnDeveloperNotes: Record<string, string> = {};
  const columnInterfaceNotes: Record<string, string> = {};
  const columnGroups: Record<string, string> = {};
  const columnSortOrders: Record<string, number> = {};
  const columnGroupOrder: string[] = [];
  const seenGroups = new Set<string>();

  for (const item of columnMeta) {
    if (item.displayLabel?.trim()) {
      columnDisplayLabels[item.columnName] = item.displayLabel.trim();
    }
    if (item.icon?.trim()) {
      columnIcons[item.columnName] = item.icon.trim();
    }
    if (item.formWidget) {
      columnFormWidgets[item.columnName] = item.formWidget;
    }
    const widgetProps = pruneColumnFormWidgetProps(item.formWidget, item.formWidgetProps);
    if (widgetProps) {
      columnFormWidgetProps[item.columnName] = widgetProps;
    }
    if (item.required === true) {
      columnRequired[item.columnName] = true;
    }
    if (item.searchRole && item.searchRole !== DEFAULT_COLUMN_SEARCH_ROLE) {
      columnSearchRoles[item.columnName] = item.searchRole;
    }
    if (item.filterRole && item.filterRole !== DEFAULT_COLUMN_FILTER_ROLE) {
      columnFilterRoles[item.columnName] = item.filterRole;
    }
    if (item.developerNotes?.trim()) {
      columnDeveloperNotes[item.columnName] = item.developerNotes;
    }
    if (item.interfaceNotes?.trim()) {
      columnInterfaceNotes[item.columnName] = item.interfaceNotes;
    }
    const group = item.group?.trim() ?? '';
    if (group) {
      columnGroups[item.columnName] = group;
      if (!seenGroups.has(group)) {
        seenGroups.add(group);
        columnGroupOrder.push(group);
      }
    }
    if (item.sortOrder !== undefined) {
      columnSortOrders[item.columnName] = item.sortOrder;
    }
  }

  const columnCubeMeasures: Record<string, NonNullable<EdgeModelStudioColumnMeta['cubeMeasure']>> = {};
  const columnHistories: Record<string, NonNullable<EdgeModelStudioColumnMeta['history']>> = {};
  for (const item of columnMeta) {
    if (item.cubeMeasure) {
      columnCubeMeasures[item.columnName] = item.cubeMeasure;
    }
    if (item.history) {
      columnHistories[item.columnName] = item.history;
    }
  }

  const hasAnyOrder = columns.some((column) => columnSortOrders[column.name] !== undefined);
  if (!hasAnyOrder) {
    Object.assign(columnSortOrders, buildDefaultColumnSortOrders(columns));
  } else {
    let maxOrder = Math.max(-1, ...Object.values(columnSortOrders));
    for (const column of columns) {
      if (columnSortOrders[column.name] === undefined) {
        maxOrder += 1;
        columnSortOrders[column.name] = maxOrder;
      }
    }
  }

  return {
    columnDisplayLabels,
    columnIcons,
    columnFormWidgets,
    columnFormWidgetProps,
    columnRequired,
    columnSearchRoles,
    columnFilterRoles,
    columnDeveloperNotes,
    columnInterfaceNotes,
    columnGroups,
    columnSortOrders,
    columnGroupOrder,
    columnGroupIcons: {},
    columnGroupColors: {},
    columnCubeMeasures,
    columnHistories,
  };
};

/** Read persisted named-group order (keeps empty groups across autosave). */
export const readColumnGroupOrderFromExtensions = (
  extensions: Record<string, unknown> | null | undefined,
): string[] | null => {
  if (!extensions) {
    return null;
  }
  const parsed = columnGroupOrderExtensionSchema.safeParse(
    extensions[COLUMN_GROUP_ORDER_EXTENSION_KEY],
  );
  if (!parsed.success) {
    return null;
  }
  return sanitizeColumnGroupOrder(parsed.data);
};

/** Preferred order first; append groups derived from column assignments. */
export const mergeColumnGroupOrder = (
  preferred: string[] | null | undefined,
  derivedFromColumns: string[],
): string[] => {
  if (!preferred || preferred.length === 0) {
    return sanitizeColumnGroupOrder(derivedFromColumns);
  }
  const seen = new Set<string>();
  const result: string[] = [];
  for (const group of [...preferred, ...derivedFromColumns]) {
    const trimmed = group.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

export const sanitizeColumnGroupOrder = (groups: string[]): string[] => {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const group of groups) {
    const trimmed = group.trim();
    if (!trimmed) {
      continue;
    }
    const key = trimmed.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(trimmed);
  }
  return result;
};

export const readColumnGroupPresentationFromExtensions = (
  extensions: Record<string, unknown> | null | undefined,
): { columnGroupIcons: Record<string, string>; columnGroupColors: Record<string, string> } => {
  if (!extensions) {
    return { columnGroupIcons: {}, columnGroupColors: {} };
  }
  const parsed = columnGroupPresentationExtensionSchema.safeParse(
    extensions[COLUMN_GROUP_PRESENTATION_EXTENSION_KEY],
  );
  if (!parsed.success) {
    return { columnGroupIcons: {}, columnGroupColors: {} };
  }
  const columnGroupIcons: Record<string, string> = {};
  const columnGroupColors: Record<string, string> = {};
  for (const [groupName, entry] of Object.entries(parsed.data)) {
    const trimmed = groupName.trim();
    if (!trimmed) {
      continue;
    }
    if (entry.icon?.trim()) {
      columnGroupIcons[trimmed] = entry.icon.trim();
    }
    if (entry.color?.trim()) {
      columnGroupColors[trimmed] = entry.color.trim();
    }
  }
  return { columnGroupIcons, columnGroupColors };
};

export const studioLayoutToColumnGroupPresentation = (
  layout: Pick<
    EdgeModelColumnStudioLayout,
    'columnGroupOrder' | 'columnGroupIcons' | 'columnGroupColors'
  >,
): Record<string, ColumnGroupPresentationEntry> => {
  const presentation: Record<string, ColumnGroupPresentationEntry> = {};
  for (const groupName of sanitizeColumnGroupOrder(layout.columnGroupOrder)) {
    const icon = layout.columnGroupIcons[groupName]?.trim() || undefined;
    const color = layout.columnGroupColors[groupName]?.trim() || undefined;
    if (!icon && !color) {
      continue;
    }
    presentation[groupName] = {
      ...(icon ? { icon } : {}),
      ...(color ? { color } : {}),
    };
  }
  return presentation;
};

export const pruneColumnGroupPresentation = (
  layout: Pick<
    EdgeModelColumnStudioLayout,
    'columnGroupOrder' | 'columnGroupIcons' | 'columnGroupColors'
  >,
): Pick<EdgeModelColumnStudioLayout, 'columnGroupIcons' | 'columnGroupColors'> => {
  const known = new Set(sanitizeColumnGroupOrder(layout.columnGroupOrder));
  const columnGroupIcons: Record<string, string> = {};
  const columnGroupColors: Record<string, string> = {};
  for (const [groupName, icon] of Object.entries(layout.columnGroupIcons)) {
    const trimmed = groupName.trim();
    if (known.has(trimmed) && icon.trim()) {
      columnGroupIcons[trimmed] = icon.trim();
    }
  }
  for (const [groupName, color] of Object.entries(layout.columnGroupColors)) {
    const trimmed = groupName.trim();
    if (known.has(trimmed) && color.trim()) {
      columnGroupColors[trimmed] = color.trim();
    }
  }
  return { columnGroupIcons, columnGroupColors };
};

export const studioLayoutToColumnMeta = (
  columnNames: string[],
  layout: EdgeModelColumnStudioLayout,
): EdgeModelStudioColumnMeta[] => {
  return columnNames.map((columnName) => {
    const displayLabel = layout.columnDisplayLabels[columnName]?.trim() || undefined;
    const icon = layout.columnIcons[columnName]?.trim() || undefined;
    // Empty string means Auto — omit so Zod enum validation never sees "".
    const formWidget = layout.columnFormWidgets[columnName] || undefined;
    const formWidgetProps = pruneColumnFormWidgetProps(
      formWidget,
      layout.columnFormWidgetProps[columnName],
    );
    const required = layout.columnRequired[columnName] === true ? true : undefined;
    const searchRoleRaw = layout.columnSearchRoles[columnName];
    const searchRole = searchRoleRaw && searchRoleRaw !== DEFAULT_COLUMN_SEARCH_ROLE
      ? searchRoleRaw
      : undefined;
    const filterRoleRaw = layout.columnFilterRoles[columnName];
    const filterRole = filterRoleRaw && filterRoleRaw !== DEFAULT_COLUMN_FILTER_ROLE
      ? filterRoleRaw
      : undefined;
    const developerNotes = layout.columnDeveloperNotes[columnName]?.trim() || undefined;
    const interfaceNotes = layout.columnInterfaceNotes[columnName]?.trim() || undefined;
    const group = layout.columnGroups[columnName]?.trim() || undefined;
    const sortOrder = layout.columnSortOrders[columnName];
    const item: EdgeModelStudioColumnMeta = { columnName };
    if (displayLabel) {
      item.displayLabel = displayLabel;
    }
    if (icon) {
      item.icon = icon;
    }
    if (formWidget) {
      item.formWidget = formWidget;
    }
    if (formWidgetProps) {
      item.formWidgetProps = formWidgetProps;
    }
    if (required) {
      item.required = true;
    }
    if (searchRole) {
      item.searchRole = searchRole;
    }
    if (filterRole) {
      item.filterRole = filterRole;
    }
    if (developerNotes) {
      item.developerNotes = developerNotes;
    }
    if (interfaceNotes) {
      item.interfaceNotes = interfaceNotes;
    }
    if (group) {
      item.group = group;
    }
    if (sortOrder !== undefined) {
      item.sortOrder = sortOrder;
    }
    const cubeMeasure = layout.columnCubeMeasures?.[columnName];
    if (cubeMeasure) {
      item.cubeMeasure = cubeMeasure;
    }
    const history = layout.columnHistories?.[columnName];
    if (history) {
      item.history = history;
    }
    return item;
  }).filter((item) => (
    Boolean(item.displayLabel)
    || Boolean(item.icon)
    || Boolean(item.formWidget)
    || Boolean(item.formWidgetProps)
    || item.required === true
    || Boolean(item.searchRole)
    || Boolean(item.filterRole)
    || Boolean(item.developerNotes)
    || Boolean(item.interfaceNotes)
    || Boolean(item.group?.trim())
    || item.sortOrder !== undefined
    || Boolean(item.cubeMeasure)
    || Boolean(item.history)
  ));
};

export const buildColumnLayoutBuckets = (
  columns: ReadonlyArray<Pick<EdgeModelColumn, 'name'>>,
  layout: Pick<EdgeModelColumnStudioLayout, 'columnGroups' | 'columnSortOrders' | 'columnGroupOrder'>,
): ColumnLayoutBucket[] => {
  const sortByOrder = (left: string, right: string) => (
    (layout.columnSortOrders[left] ?? 0) - (layout.columnSortOrders[right] ?? 0)
  );

  const ungrouped = columns
    .map((column) => column.name)
    .filter((name) => !layout.columnGroups[name]?.trim())
    .sort(sortByOrder);

  const buckets: ColumnLayoutBucket[] = [
    {
      id: UNGROUPED_COLUMN_GROUP,
      title: 'Ungrouped',
      columnNames: ungrouped,
    },
  ];

  const knownGroups = new Set(layout.columnGroupOrder.map((group) => group.trim()).filter(Boolean));
  for (const group of layout.columnGroupOrder) {
    const trimmed = group.trim();
    if (!trimmed) {
      continue;
    }
    buckets.push({
      id: trimmed,
      title: trimmed,
      columnNames: columns
        .map((column) => column.name)
        .filter((name) => (layout.columnGroups[name]?.trim() ?? '') === trimmed)
        .sort(sortByOrder),
    });
  }

  // Orphan groups referenced by columns but missing from order.
  for (const column of columns) {
    const group = layout.columnGroups[column.name]?.trim() ?? '';
    if (!group || knownGroups.has(group)) {
      continue;
    }
    knownGroups.add(group);
    buckets.push({
      id: group,
      title: group,
      columnNames: columns
        .map((item) => item.name)
        .filter((name) => (layout.columnGroups[name]?.trim() ?? '') === group)
        .sort(sortByOrder),
    });
  }

  // Keep empty named groups so the user can drop columns into them.
  return buckets;
};

export const createNamedColumnGroup = (
  layout: EdgeModelColumnStudioLayout,
  groupName?: string,
): { layout: EdgeModelColumnStudioLayout; groupName: string } => {
  const name = (groupName?.trim() || nextAutoGroupName(layout.columnGroupOrder));
  if (layout.columnGroupOrder.some((group) => group.trim().toLowerCase() === name.toLowerCase())) {
    return { layout, groupName: name };
  }
  return {
    groupName: name,
    layout: {
      ...layout,
      columnGroupOrder: [...layout.columnGroupOrder, name],
    },
  };
};

export const renameNamedColumnGroup = (
  layout: EdgeModelColumnStudioLayout,
  fromName: string,
  toName: string,
): EdgeModelColumnStudioLayout => {
  const from = fromName.trim();
  const to = toName.trim();
  if (!from || !to || from === to) {
    return layout;
  }
  if (layout.columnGroupOrder.some((group) => (
    group.trim().toLowerCase() === to.toLowerCase() && group.trim() !== from
  ))) {
    return layout;
  }

  const columnGroups: Record<string, string> = {};
  for (const [columnName, group] of Object.entries(layout.columnGroups)) {
    columnGroups[columnName] = group.trim() === from ? to : group;
  }

  return {
    ...layout,
    columnGroups,
    columnGroupOrder: layout.columnGroupOrder.map((group) => (
      group.trim() === from ? to : group
    )),
    columnGroupIcons: renameRecordKey(layout.columnGroupIcons, from, to),
    columnGroupColors: renameRecordKey(layout.columnGroupColors, from, to),
  };
};

export const removeNamedColumnGroup = (
  layout: EdgeModelColumnStudioLayout,
  groupName: string,
): EdgeModelColumnStudioLayout => {
  const target = groupName.trim();
  if (!target) {
    return layout;
  }

  const columnGroups: Record<string, string> = {};
  for (const [columnName, group] of Object.entries(layout.columnGroups)) {
    if (group.trim() !== target) {
      columnGroups[columnName] = group;
    }
  }
  const columnGroupIcons = { ...layout.columnGroupIcons };
  const columnGroupColors = { ...layout.columnGroupColors };
  delete columnGroupIcons[target];
  delete columnGroupColors[target];

  return {
    ...layout,
    columnGroups,
    columnGroupOrder: layout.columnGroupOrder.filter((group) => group.trim() !== target),
    columnGroupIcons,
    columnGroupColors,
  };
};

export const flattenBucketsToLayout = (
  buckets: ColumnLayoutBucket[],
  previous: EdgeModelColumnStudioLayout,
): EdgeModelColumnStudioLayout => {
  const columnGroups: Record<string, string> = {};
  const columnSortOrders: Record<string, number> = {};
  const columnGroupOrder: string[] = [];
  let order = 0;

  for (const bucket of buckets) {
    const groupId = bucket.id.trim();
    if (groupId && groupId !== UNGROUPED_COLUMN_GROUP) {
      columnGroupOrder.push(groupId);
    }
    for (const columnName of bucket.columnNames) {
      if (groupId && groupId !== UNGROUPED_COLUMN_GROUP) {
        columnGroups[columnName] = groupId;
      }
      columnSortOrders[columnName] = order;
      order += 1;
    }
  }

  const presentation = pruneColumnGroupPresentation({
    columnGroupOrder,
    columnGroupIcons: previous.columnGroupIcons,
    columnGroupColors: previous.columnGroupColors,
  });

  return {
    columnDisplayLabels: previous.columnDisplayLabels,
    columnIcons: previous.columnIcons,
    columnFormWidgets: previous.columnFormWidgets,
    columnFormWidgetProps: previous.columnFormWidgetProps,
    columnRequired: previous.columnRequired,
    columnSearchRoles: previous.columnSearchRoles,
    columnFilterRoles: previous.columnFilterRoles,
    columnDeveloperNotes: previous.columnDeveloperNotes,
    columnInterfaceNotes: previous.columnInterfaceNotes,
    columnGroups,
    columnSortOrders,
    columnGroupOrder,
    columnGroupIcons: presentation.columnGroupIcons,
    columnGroupColors: presentation.columnGroupColors,
    columnCubeMeasures: previous.columnCubeMeasures,
    columnHistories: previous.columnHistories,
  };
};

export const moveColumnInBuckets = (
  buckets: ColumnLayoutBucket[],
  activeColumnName: string,
  overColumnOrBucketId: string,
  overIsBucket: boolean,
): ColumnLayoutBucket[] | null => {
  const next = buckets.map((bucket) => ({
    ...bucket,
    columnNames: [...bucket.columnNames],
  }));
  const fromBucket = next.find((bucket) => bucket.columnNames.includes(activeColumnName));
  if (!fromBucket) {
    return null;
  }

  const toBucket = overIsBucket
    ? next.find((bucket) => bucket.id === overColumnOrBucketId)
    : next.find((bucket) => bucket.columnNames.includes(overColumnOrBucketId));
  if (!toBucket) {
    return null;
  }

  const fromIndex = fromBucket.columnNames.indexOf(activeColumnName);
  if (fromIndex < 0) {
    return null;
  }

  if (fromBucket.id === toBucket.id) {
    if (overIsBucket) {
      return null;
    }
    const toIndex = toBucket.columnNames.indexOf(overColumnOrBucketId);
    if (toIndex < 0 || fromIndex === toIndex) {
      return null;
    }
    const [moved] = fromBucket.columnNames.splice(fromIndex, 1);
    // Same-list move: keep the original target index (arrayMove semantics).
    toBucket.columnNames.splice(toIndex, 0, moved);
    return next;
  }

  const [moved] = fromBucket.columnNames.splice(fromIndex, 1);
  if (overIsBucket) {
    toBucket.columnNames.push(moved);
  } else {
    const toIndex = toBucket.columnNames.indexOf(overColumnOrBucketId);
    toBucket.columnNames.splice(toIndex < 0 ? toBucket.columnNames.length : toIndex, 0, moved);
  }
  return next;
};

export const moveColumnGroupInBuckets = (
  buckets: ColumnLayoutBucket[],
  groupId: string,
  direction: -1 | 1,
): ColumnLayoutBucket[] | null => {
  const index = buckets.findIndex((bucket) => bucket.id === groupId);
  if (index <= 0) {
    return null;
  }

  const targetIndex = index + direction;
  if (targetIndex <= 0 || targetIndex >= buckets.length) {
    return null;
  }

  const next = buckets.map((bucket) => ({
    ...bucket,
    columnNames: [...bucket.columnNames],
  }));
  [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
  return next;
};

export const nextAutoGroupName = (existingGroupNames: string[]): string => {
  const used = new Set(existingGroupNames.map((name) => name.trim().toLowerCase()));
  let index = 1;
  while (used.has(`group ${index}`)) {
    index += 1;
  }
  return `Group ${index}`;
};
