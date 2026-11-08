import { describe, expect, it } from 'vitest';
import {
  COLUMN_GROUP_ORDER_EXTENSION_KEY,
  COLUMN_GROUP_PRESENTATION_EXTENSION_KEY,
  UNGROUPED_COLUMN_GROUP,
  columnMetaToStudioLayout,
  createNamedColumnGroup,
  flattenBucketsToLayout,
  mergeColumnGroupOrder,
  moveColumnInBuckets,
  moveColumnGroupInBuckets,
  readColumnGroupOrderFromExtensions,
  readColumnGroupPresentationFromExtensions,
  renameNamedColumnGroup,
  removeNamedColumnGroup,
  studioLayoutToColumnGroupPresentation,
  studioLayoutToColumnMeta,
  type ColumnLayoutBucket,
} from '../edgeModelColumnLayout';

describe('edgeModelColumnLayout empty groups', () => {
  it('keeps empty named groups in columnGroupOrder', () => {
    const base = columnMetaToStudioLayout([], [
      { name: 'id', isPrimaryKey: true },
      { name: 'title', isPrimaryKey: false },
    ]);
    const { layout, groupName } = createNamedColumnGroup(base);
    expect(groupName).toBe('Group 1');
    expect(layout.columnGroupOrder).toEqual(['Group 1']);
  });

  it('round-trips empty groups through studio-meta extensions', () => {
    const columns = [
      { name: 'id', isPrimaryKey: true },
      { name: 'title', isPrimaryKey: false },
    ];
    const base = columnMetaToStudioLayout([], columns);
    const { layout } = createNamedColumnGroup(base, 'Details');

    const columnMeta = studioLayoutToColumnMeta(
      columns.map((column) => column.name),
      layout,
    );
    // Empty groups are not represented on any columnMeta row.
    expect(columnMeta.every((item) => !item.group)).toBe(true);

    const fromColumns = columnMetaToStudioLayout(columnMeta, columns);
    expect(fromColumns.columnGroupOrder).toEqual([]);

    const extensions = {
      [COLUMN_GROUP_ORDER_EXTENSION_KEY]: layout.columnGroupOrder,
    };
    const restored = mergeColumnGroupOrder(
      readColumnGroupOrderFromExtensions(extensions),
      fromColumns.columnGroupOrder,
    );
    expect(restored).toEqual(['Details']);
  });

  it('merges preferred empty groups with column-derived groups', () => {
    expect(mergeColumnGroupOrder(
      ['Empty', 'Shared'],
      ['Shared', 'Filled'],
    )).toEqual(['Empty', 'Shared', 'Filled']);
  });
});

describe('moveColumnInBuckets', () => {
  const buckets = (): ColumnLayoutBucket[] => ([
    {
      id: UNGROUPED_COLUMN_GROUP,
      title: 'Ungrouped',
      columnNames: ['a', 'b', 'c'],
    },
    {
      id: 'Details',
      title: 'Details',
      columnNames: [],
    },
    {
      id: 'Meta',
      title: 'Meta',
      columnNames: ['d'],
    },
  ]);

  it('reorders within the same group', () => {
    const moved = moveColumnInBuckets(buckets(), 'a', 'c', false);
    expect(moved?.find((bucket) => bucket.id === UNGROUPED_COLUMN_GROUP)?.columnNames)
      .toEqual(['b', 'c', 'a']);
  });

  it('drops a column into an empty named group', () => {
    const moved = moveColumnInBuckets(buckets(), 'b', 'Details', true);
    expect(moved?.find((bucket) => bucket.id === UNGROUPED_COLUMN_GROUP)?.columnNames)
      .toEqual(['a', 'c']);
    expect(moved?.find((bucket) => bucket.id === 'Details')?.columnNames)
      .toEqual(['b']);
  });

  it('inserts before a target column in another group', () => {
    const moved = moveColumnInBuckets(buckets(), 'a', 'd', false);
    expect(moved?.find((bucket) => bucket.id === UNGROUPED_COLUMN_GROUP)?.columnNames)
      .toEqual(['b', 'c']);
    expect(moved?.find((bucket) => bucket.id === 'Meta')?.columnNames)
      .toEqual(['a', 'd']);
  });

  it('flattens moved buckets into group + sort layout', () => {
    const moved = moveColumnInBuckets(buckets(), 'b', 'Details', true);
    expect(moved).not.toBeNull();
    const layout = flattenBucketsToLayout(moved!, {
      columnDisplayLabels: {},
      columnIcons: {},
      columnFormWidgets: {},
      columnFormWidgetProps: {},
      columnRequired: {},
      columnSearchRoles: {},
      columnFilterRoles: {},
      columnDeveloperNotes: {},
      columnInterfaceNotes: {},
      columnGroups: {},
      columnSortOrders: {},
      columnGroupOrder: ['Details', 'Meta'],
      columnGroupIcons: { Details: 'lucide:folder' },
      columnGroupColors: { Details: 'text-teal-500' },
    });
    expect(layout.columnGroups).toEqual({ b: 'Details', d: 'Meta' });
    expect(layout.columnGroupOrder).toEqual(['Details', 'Meta']);
    expect(layout.columnGroupIcons).toEqual({ Details: 'lucide:folder' });
    expect(layout.columnGroupColors).toEqual({ Details: 'text-teal-500' });
    expect(layout.columnSortOrders.b).toBeLessThan(layout.columnSortOrders.d);
  });
});

describe('moveColumnGroupInBuckets', () => {
  const buckets = (): ColumnLayoutBucket[] => ([
    {
      id: UNGROUPED_COLUMN_GROUP,
      title: 'Ungrouped',
      columnNames: ['a'],
    },
    {
      id: 'Details',
      title: 'Details',
      columnNames: ['b'],
    },
    {
      id: 'Meta',
      title: 'Meta',
      columnNames: ['c'],
    },
  ]);

  it('moves a named group down and updates flattened group order', () => {
    const moved = moveColumnGroupInBuckets(buckets(), 'Details', 1);
    expect(moved?.map((bucket) => bucket.id)).toEqual([
      UNGROUPED_COLUMN_GROUP,
      'Meta',
      'Details',
    ]);

    const layout = flattenBucketsToLayout(moved!, {
      columnDisplayLabels: {},
      columnIcons: {},
      columnFormWidgets: {},
      columnFormWidgetProps: {},
      columnRequired: {},
      columnSearchRoles: {},
      columnFilterRoles: {},
      columnDeveloperNotes: {},
      columnInterfaceNotes: {},
      columnGroups: { b: 'Details', c: 'Meta' },
      columnSortOrders: { a: 0, b: 1, c: 2 },
      columnGroupOrder: ['Details', 'Meta'],
      columnGroupIcons: {},
      columnGroupColors: {},
    });
    expect(layout.columnGroupOrder).toEqual(['Meta', 'Details']);
  });

  it('does not move ungrouped or past the first named group upward', () => {
    expect(moveColumnGroupInBuckets(buckets(), UNGROUPED_COLUMN_GROUP, -1)).toBeNull();
    expect(moveColumnGroupInBuckets(buckets(), 'Details', -1)).toBeNull();
    expect(moveColumnGroupInBuckets(buckets(), 'Meta', 1)).toBeNull();
  });
});

describe('studioLayoutToColumnMeta required', () => {
  it('round-trips required true and omits false/unset', () => {
    const columns = [
      { name: 'id', isPrimaryKey: true },
      { name: 'title', isPrimaryKey: false },
      { name: 'notes', isPrimaryKey: false },
    ];
    const base = columnMetaToStudioLayout([], columns);
    const layout = {
      ...base,
      columnRequired: { title: true },
    };
    const columnMeta = studioLayoutToColumnMeta(
      columns.map((column) => column.name),
      layout,
    );
    expect(columnMeta.find((item) => item.columnName === 'title')?.required).toBe(true);
    expect(columnMeta.find((item) => item.columnName === 'notes')?.required).toBeUndefined();

    const restored = columnMetaToStudioLayout(columnMeta, columns);
    expect(restored.columnRequired).toEqual({ title: true });
  });
});

describe('studioLayoutToColumnMeta formWidget', () => {
  it('omits empty Auto formWidget so studio-meta Zod enum never sees ""', () => {
    const columns = [
      { name: 'id', isPrimaryKey: true },
      { name: 'amount', isPrimaryKey: false },
    ];
    const base = columnMetaToStudioLayout([], columns);
    const layout = {
      ...base,
      columnGroups: { amount: 'Details' },
      columnSortOrders: { id: 0, amount: 1 },
      columnFormWidgets: { amount: '' as unknown as 'text' },
      columnGroupOrder: ['Details'],
    };
    const columnMeta = studioLayoutToColumnMeta(
      columns.map((column) => column.name),
      layout,
    );
    const amount = columnMeta.find((item) => item.columnName === 'amount');
    expect(amount).toBeDefined();
    expect(amount).not.toHaveProperty('formWidget');
    expect(JSON.stringify(amount)).not.toContain('"formWidget"');
  });
});

describe('edgeModelColumnLayout group presentation', () => {
  it('round-trips group icon/color through studio-meta extensions', () => {
    const layout = {
      ...columnMetaToStudioLayout([], [{ name: 'title', isPrimaryKey: false }]),
      columnGroupOrder: ['Details'],
      columnGroupIcons: { Details: 'lucide:folder' },
      columnGroupColors: { Details: 'text-teal-500' },
    };
    const serialized = studioLayoutToColumnGroupPresentation(layout);
    expect(serialized).toEqual({
      Details: { icon: 'lucide:folder', color: 'text-teal-500' },
    });
    const restored = readColumnGroupPresentationFromExtensions({
      [COLUMN_GROUP_PRESENTATION_EXTENSION_KEY]: serialized,
    });
    expect(restored).toEqual({
      columnGroupIcons: { Details: 'lucide:folder' },
      columnGroupColors: { Details: 'text-teal-500' },
    });
  });

  it('renames and removes group presentation with the group', () => {
    const base = {
      ...columnMetaToStudioLayout([], [{ name: 'title', isPrimaryKey: false }]),
      columnGroupOrder: ['Details'],
      columnGroupIcons: { Details: 'lucide:folder' },
      columnGroupColors: { Details: 'text-teal-500' },
    };
    const renamed = renameNamedColumnGroup(base, 'Details', 'Meta');
    expect(renamed.columnGroupIcons).toEqual({ Meta: 'lucide:folder' });
    expect(renamed.columnGroupColors).toEqual({ Meta: 'text-teal-500' });

    const removed = removeNamedColumnGroup(renamed, 'Meta');
    expect(removed.columnGroupIcons).toEqual({});
    expect(removed.columnGroupColors).toEqual({});
  });
});
