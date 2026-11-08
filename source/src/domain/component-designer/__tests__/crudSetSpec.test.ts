import { describe, expect, it } from 'vitest';
import {
  applyCrudSetFilterBar,
  applyCrudSetGridChrome,
  CRUD_SET_CELL_KINDS,
  CRUD_SET_COLLECTION_MODE_LABELS,
  CRUD_SET_COLLECTION_MODES,
  CRUD_SET_FIRST_QUESTION,
  crudSetColumnCellKind,
  crudSetColumnCellClassName,
  crudSetColumnHeaderClassName,
  crudSetColumnIsImageColumn,
  crudSetDefaultContentPatchOpenFromColumnId,
  crudSetPatchOpenFromColumnId,
  CRUD_SET_PATCH_OPEN_FROM_ACTIONS,
  crudSetColumnConditionalBackground,
  crudSetColumnFilterable,
  crudSetColumnId,
  crudSetColumnLabel,
  crudSetColumnStack,
  crudSetColumnTransform,
  crudSetColumnSortable,
  crudSetColumnWidth,
  crudSetNormalizeConditionalBackground,
  formatCrudSetColumnExportValue,
  formatCrudSetColumnText,
  resolveCrudSetLinkHref,
  crudSetExportDefaultFormat,
  crudSetExportFormats,
  crudSetGridColumnFields,
  crudSetHumanizeField,
  crudSetLockedExportExtension,
  crudSetOmittedUi,
  crudSetPaginationEnabled,
  crudSetPagingDefaultPageSize,
  crudSetPagingFirstLastEnabled,
  crudSetPagingPageNumbersEnabled,
  crudSetPagingPageSizes,
  crudSetPagingPattern,
  crudSetSortingDefaultDirection,
  crudSetSortingDefaultField,
  crudSetSortingFooterEnabled,
  crudSetKanbanColumnLayout,
  crudSetKanbanColumnTone,
  crudSetKanbanColoredColumns,
  crudSetKanbanHeight,
  crudSetKanbanWipLimit,
  crudSetFilterBarFiltersForBody,
  deriveCrudSetKanbanStatusColumns,
  migrateCrudSetSpecForKanbanBody,
  crudSetGridChrome,
  crudSetGridUsesCardPresentation,
  crudSetGridEffectiveBorderWidth,
  crudSetGridEffectiveMargin,
  crudSetGridMargin,
  crudSetGridDensity,
  crudSetGridFillHeight,
  crudSetGridPresentation,
  crudSetGridSelection,
  crudSetActionsMaxVisible,
  crudSetActionsAlign,
  crudSetCreateLayout,
  crudSetDisabledWhenMatches,
  crudSetFilterOptionsFrom,
  crudSetJsonViewText,
  crudSetThreadMessages,
  crudSetViewKind,
  resolveCrudSetFilterBarOptions,
  crudSetDialogFormSize,
  crudSetDialogFormSizeForFieldCount,
  crudSetDialogConfirmSize,
  crudSetDialogConfirmInitialFocus,
  crudSetDialogSidePanelTitle,
  crudSetDialogSidePanelPlacement,
  crudSetDialogSidePanelPinnable,
  crudSetDialogSidePanelSplitter,
  crudSetDialogSidePanelShowTitle,
  crudSetDialogSidePanelTitleInHeader,
  crudSetDialogSidePanelBackground,
  crudSetDialogSidePanelBackgroundColor,
  resolveRecordFormSidePanelBackgroundColor,
  crudSetDialogShowHeader,
  crudSetDialogShowFooter,
  crudSetDialogSubHeaderCount,
  crudSetDialogSubFooterCount,
  recordFormSidePanelPhysicallyLeft,
  crudSetColumnFormPlacement,
  recordFormFieldsIncludeSidePanel,
  crudSetColumnCardRole,
  crudSetColumnIsRowHeader,
  crudSetFilterBarSearchClearEnabled,
  crudSetRequiresReadOne,
  crudSetSuggestedExportFilename,
  toggleCrudSetExportFormat,
  toggleCrudSetPageSize,
  isBooleanTogglePatch,
  isCrudSetCollectionMode,
  toCrudSetCellKind,
  crudSetWriteChangeReasonRoute,
  type CrudSetSpec,
} from '../crudSetSpec';

const baseList = (): CrudSetSpec => ({
  name: 'orders',
  listApi: { endpointId: 'orders.list' },
  listBody: 'grid',
  columns: [
    { field: 'code', label: 'Code' },
    { field: 'title' },
    { field: 'status' },
  ],
  createApis: [],
  patches: [],
});

describe('crudSetSpec helpers', () => {
  it('requires read-one for form patches and delete, not for boolean-toggle only', () => {
    expect(crudSetRequiresReadOne(baseList())).toBe(false);
    expect(crudSetRequiresReadOne({
      ...baseList(),
      deleteApi: { endpointId: 'orders.delete' },
    })).toBe(true);
    expect(crudSetRequiresReadOne({
      ...baseList(),
      patches: [{
        id: 'approve',
        label: 'Approve',
        endpointId: 'orders.approve',
        kind: 'purpose',
        acceptedFields: ['status'],
      }],
    })).toBe(true);
    expect(crudSetRequiresReadOne({
      ...baseList(),
      patches: [{
        id: 'archive',
        label: 'Archive',
        endpointId: 'orders.archive',
        kind: 'purpose',
        acceptedFields: ['archived'],
        interaction: 'boolean-toggle',
      }],
    })).toBe(false);
  });

  it('treats a single-boolean purpose patch as a click toggle', () => {
    expect(isBooleanTogglePatch({
      kind: 'purpose',
      acceptedFields: ['locked'],
      interaction: 'boolean-toggle',
    })).toBe(true);
    expect(isBooleanTogglePatch({
      kind: 'content',
      acceptedFields: ['locked'],
      interaction: 'boolean-toggle',
    })).toBe(false);
    expect(isBooleanTogglePatch({
      kind: 'purpose',
      acceptedFields: ['locked', 'status'],
      interaction: 'boolean-toggle',
    })).toBe(false);
  });

  it('omits chrome for missing APIs and disabled export', () => {
    const omitted = crudSetOmittedUi({
      ...baseList(),
      export: { enabled: false },
    });
    expect(omitted).toEqual({
      create: true,
      patches: true,
      delete: true,
      export: true,
      paging: false,
      filterBar: false,
      refresh: false,
      collection: true,
      autoRefresh: true,
      rowActions: true,
    });
    expect(crudSetOmittedUi(baseList()).export).toBe(false);
  });

  it('defaults grid pagination on and never pages a tree-grid', () => {
    expect(crudSetPaginationEnabled(baseList())).toBe(true);
    expect(crudSetPaginationEnabled({ ...baseList(), pagination: false })).toBe(false);
    expect(crudSetOmittedUi({ ...baseList(), pagination: false }).paging).toBe(true);
    expect(crudSetPaginationEnabled({ ...baseList(), listBody: 'tree-grid' })).toBe(false);
    expect(crudSetPaginationEnabled({ ...baseList(), listBody: 'tree-grid', pagination: true })).toBe(false);
    expect(crudSetPaginationEnabled({ ...baseList(), listBody: 'kanban', pagination: true })).toBe(true);
    expect(crudSetPaginationEnabled({ ...baseList(), listBody: 'kanban', pagination: false })).toBe(false);
    expect(crudSetPaginationEnabled({ ...baseList(), listBody: 'map', pagination: true })).toBe(false);
  });

  it('resolves kanban board chrome from spec.kanban', () => {
    const spec = {
      ...baseList(),
      listBody: 'kanban' as const,
      kanban: {
        height: 'auto' as const,
        columnLayout: 'fill' as const,
        coloredColumns: false,
        tone: 'violet' as const,
        wipLimit: 5,
      },
    };
    expect(crudSetKanbanHeight(spec)).toBe('auto');
    expect(crudSetKanbanColumnLayout(spec)).toBe('fill');
    expect(crudSetKanbanColoredColumns(spec)).toBe(false);
    expect(crudSetKanbanWipLimit(spec)).toBe(5);
    expect(crudSetKanbanColumnTone(0, spec)).toBeUndefined();
    expect(crudSetKanbanColumnTone(1, { ...spec, kanban: { coloredColumns: true } })).toBe('cyan');
    expect(crudSetKanbanColumnLayout({ ...baseList(), kanban: {} })).toBe('fill');
  });

  it('omits the kanban status field from toolbar filters and migrates it into kanban.statusColumns', () => {
    const filterBar = {
      enabled: true,
      search: true,
      filters: [{
        id: 'status',
        field: 'status',
        label: 'Status',
        controlType: 'radio-group' as const,
        options: [
          { value: 'Open', label: 'Open' },
          { value: 'Approved', label: 'Approved' },
        ],
      }],
    };
    const migrated = migrateCrudSetSpecForKanbanBody({ kanban: {}, filterBar });
    expect(migrated.kanban?.statusColumns).toEqual([
      { value: 'Open', label: 'Open' },
      { value: 'Approved', label: 'Approved' },
    ]);
    expect(crudSetFilterBarFiltersForBody({
      listBody: 'kanban',
      kanban: migrated.kanban,
      filterBar: migrated.filterBar,
    })).toEqual([]);
    expect(deriveCrudSetKanbanStatusColumns({
      kanban: migrated.kanban,
      filterBar: migrated.filterBar,
    }, [{ status: 'Open' }, { status: 'Shipped' }])).toEqual([
      { value: 'Open', label: 'Open' },
      { value: 'Approved', label: 'Approved' },
    ]);
  });

  it('customizes paging footer chrome and sort defaults', () => {
    expect(crudSetPagingPattern(baseList())).toBe('numbered');
    expect(crudSetPagingDefaultPageSize(baseList())).toBe(50);
    expect(crudSetPagingPageSizes(baseList())).toEqual([50, 100, 500, 1000, 10000]);
    expect(crudSetPagingPageNumbersEnabled(baseList())).toBe(true);
    expect(crudSetPagingFirstLastEnabled(baseList())).toBe(true);
    expect(toggleCrudSetPageSize([50, 100], 50, false)).toEqual([100]);
    expect(toggleCrudSetPageSize([50], 50, false)).toEqual([50]);

    const prevNext = { ...baseList(), paging: { pattern: 'prev-next' as const, defaultPageSize: 100, pageSizes: [100, 500], summary: false, firstLast: true } };
    expect(crudSetPagingPattern(prevNext)).toBe('prev-next');
    expect(crudSetPagingDefaultPageSize(prevNext)).toBe(100);
    expect(crudSetPagingPageSizes(prevNext)).toEqual([100, 500]);
    expect(crudSetPagingPageNumbersEnabled(prevNext)).toBe(false);
    expect(crudSetPagingFirstLastEnabled(prevNext)).toBe(false);

    expect(crudSetSortingFooterEnabled(baseList())).toBe(true);
    expect(crudSetSortingFooterEnabled({ ...baseList(), pagination: false })).toBe(false);
    expect(crudSetSortingFooterEnabled({ ...baseList(), sorting: { footer: false } })).toBe(false);
    expect(crudSetSortingDefaultField(baseList())).toBe('code');
    expect(crudSetSortingDefaultField({
      ...baseList(),
      columns: [
        { field: 'locked', sortable: false },
        { field: 'title' },
      ],
    })).toBe('title');
    expect(crudSetSortingDefaultDirection({ ...baseList(), sorting: { defaultDirection: 'desc' } })).toBe('desc');
  });

  it('exposes AppTableGrid, row-action, and dialog public chrome with Users defaults', () => {
    expect(crudSetGridChrome(baseList())).toBe('classic');
    expect(crudSetGridDensity(baseList())).toBe('default');
    expect(crudSetGridFillHeight(baseList())).toBe(true);
    expect(crudSetGridPresentation(baseList())).toBe('auto');
    expect(crudSetGridPresentation({ ...baseList(), listBody: 'tree-grid', grid: { presentation: 'table-scroll' } })).toBe('auto');
    expect(crudSetGridSelection(baseList())).toBe('none');
    expect(crudSetActionsMaxVisible(baseList())).toBe(3);
    expect(crudSetActionsAlign(baseList())).toBe('end');
    expect(crudSetDialogFormSize(baseList())).toBe('lg');
    expect(crudSetDialogConfirmSize(baseList())).toBe('sm');
    expect(crudSetDialogConfirmInitialFocus(baseList())).toBe('cancel');
    expect(crudSetColumnCardRole({ field: 'code' }, [{ field: 'code' }, { field: 'status' }], 0)).toBe('title');
    expect(crudSetColumnCardRole({ field: 'status' }, [{ field: 'code' }, { field: 'status' }], 1)).toBe('field');
    expect(crudSetColumnCardRole({ field: 'photo', cellKind: 'image' }, [{ field: 'photo', cellKind: 'image' }], 0)).toBe('media');
    expect(crudSetColumnCardRole({ field: 'title' }, [{ field: 'code' }, { field: 'title' }], 1)).toBe('field');
    expect(crudSetColumnIsRowHeader({ field: 'code' }, 0)).toBe(true);
    expect(crudSetFilterBarSearchClearEnabled(baseList())).toBe(true);
    expect(crudSetFilterBarSearchClearEnabled({
      ...baseList(),
      filterBar: { search: true, searchClear: false },
    })).toBe(false);

    const hero = {
      ...baseList(),
      grid: { chrome: 'hero' as const, density: 'compact' as const, presentation: 'cards' as const, selection: 'multiple' as const },
      actions: { maxVisible: 2, align: 'start' as const },
      dialogs: { formSize: 'sm' as const, confirmSize: 'lg' as const, confirmInitialFocus: 'confirm' as const },
    };
    expect(crudSetGridChrome(hero)).toBe('hero');
    expect(crudSetGridMargin(hero)).toBeUndefined();
    expect(crudSetGridEffectiveMargin(hero)).toBe(4);
    expect(crudSetGridEffectiveBorderWidth(hero)).toBe(5);
    expect(applyCrudSetGridChrome({ chrome: 'classic' }, 'hero')).toMatchObject({
      chrome: 'hero',
      margin: 4,
      borderWidth: 5,
    });
    expect(applyCrudSetGridChrome({ chrome: 'hero', margin: 4, borderWidth: 5 }, 'classic')).toMatchObject({
      chrome: 'classic',
      margin: 0,
      borderWidth: 0,
    });
    expect(crudSetGridDensity(hero)).toBe('compact');
    expect(crudSetGridPresentation(hero)).toBe('cards');
    expect(crudSetGridUsesCardPresentation(hero)).toBe(true);
    expect(crudSetGridUsesCardPresentation({
      ...baseList(),
      grid: { presentation: 'table', compact: { tabletLayout: 'cards' } },
    })).toBe(true);
    expect(crudSetGridSelection(hero)).toBe('multiple');
    expect(crudSetActionsMaxVisible(hero)).toBe(2);
    expect(crudSetActionsAlign(hero)).toBe('start');
    expect(crudSetDialogFormSize(hero)).toBe('sm');
    expect(crudSetDialogConfirmSize(hero)).toBe('lg');
    expect(crudSetDialogConfirmInitialFocus(hero)).toBe('confirm');
  });

  it('starts collection with a two-path first question and a suggestion label for each', () => {
    expect(CRUD_SET_FIRST_QUESTION).toContain('suggestions');
    expect(CRUD_SET_FIRST_QUESTION).toContain('decide everything now');
    expect(CRUD_SET_COLLECTION_MODES).toEqual(['suggest-then-cut', 'decide-now']);
    expect(isCrudSetCollectionMode('suggest-then-cut')).toBe(true);
    expect(CRUD_SET_COLLECTION_MODE_LABELS['suggest-then-cut']).toContain('cut later');
    expect(CRUD_SET_COLLECTION_MODE_LABELS['decide-now']).toContain('Decide everything now');
  });

  it('keeps grid column fields in spec array order', () => {
    expect(crudSetGridColumnFields(baseList())).toEqual(['code', 'title', 'status']);
  });

  it('humanizes field keys and prefers an explicit column label', () => {
    expect(crudSetHumanizeField('customerId')).toBe('Customer Id');
    expect(crudSetColumnLabel({ field: 'title' })).toBe('Title');
    expect(crudSetColumnLabel({ field: 'title', label: 'Order title' })).toBe('Order title');
  });

  it('gives each grid column its own display properties with safe defaults', () => {
    expect(CRUD_SET_CELL_KINDS).toContain('lock-status');
    expect(toCrudSetCellKind('status-badge')).toBe('badge');
    expect(toCrudSetCellKind('avatar')).toBe('image');
    expect(crudSetColumnCellKind({ field: 'status' })).toBe('text');
    expect(crudSetColumnCellKind({ field: 'status', cellKind: 'badge' })).toBe('badge');
    expect(crudSetColumnSortable({ field: 'title' })).toBe(true);
    expect(crudSetColumnSortable({ field: 'locked', sortable: false })).toBe(false);
    expect(crudSetColumnFilterable({ field: 'title' })).toBe(true);
    expect(crudSetColumnFilterable({ field: 'tags', filterable: false })).toBe(false);
    expect(crudSetColumnWidth({ field: 'code', width: 120 }, 0)).toBe(120);
    expect(crudSetColumnWidth({ field: 'title' }, 0)).toBe(180);
    expect(crudSetColumnWidth({ field: 'status' }, 1)).toBe(140);
  });

  it('keeps grid header and cell alignment in sync', () => {
    const dateColumn = { field: 'createdAt', cellKind: 'date' as const };
    const imageColumn = { field: 'avatar', cellKind: 'image' as const };
    const lockColumn = { field: 'locked', cellKind: 'lock-status' as const };
    const stackedDateColumn = { field: 'createdAt', cellKind: 'date' as const, secondaryField: 'updatedAt' };
    const textColumn = { field: 'title' };
    const codeColumn = { field: 'code', label: 'Code' };

    expect(crudSetColumnCellClassName(dateColumn)).toBe('text-center');
    expect(crudSetColumnHeaderClassName(dateColumn)).toBe('text-center');
    expect(crudSetColumnCellClassName(imageColumn)).toBe('text-center');
    expect(crudSetColumnHeaderClassName(imageColumn)).toBe('text-center');
    expect(crudSetColumnCellClassName(lockColumn)).toBe('text-start');
    expect(crudSetColumnHeaderClassName(lockColumn)).toBe('text-start');
    expect(crudSetColumnCellClassName(stackedDateColumn)).toBe('text-start');
    expect(crudSetColumnHeaderClassName(stackedDateColumn)).toBe('text-start');
    expect(crudSetColumnCellClassName(textColumn)).toBe('text-start');
    expect(crudSetColumnHeaderClassName(textColumn)).toBe('text-start');
    expect(crudSetColumnCellClassName(codeColumn)).toBe('text-start');
    expect(crudSetColumnHeaderClassName(codeColumn)).toBe('text-start');
  });

  it('keeps image columns center-aligned and never uses them for content-edit open', () => {
    const imageColumn = { field: 'photo', cellKind: 'image' as const };
    const spec = {
      columns: [
        imageColumn,
        { field: 'code', label: 'Code' },
        { field: 'title', label: 'Title' },
      ],
    };

    expect(crudSetColumnIsImageColumn(imageColumn)).toBe(true);
    expect(crudSetColumnCellClassName(imageColumn)).toBe('text-center');
    expect(crudSetColumnHeaderClassName(imageColumn)).toBe('text-center');
    expect(crudSetDefaultContentPatchOpenFromColumnId(spec)).toBe('title');
    expect(crudSetDefaultContentPatchOpenFromColumnId({ columns: [imageColumn] })).toBeUndefined();
  });

  it('opens content-edit from a display column by default, not actions', () => {
    const spec = {
      columns: [
        { field: 'code', label: 'Code' },
        { field: 'title', label: 'Title' },
      ],
    };
    const contentPatch = {
      id: 'edit',
      label: 'Edit',
      endpointId: 'orders.edit',
      kind: 'content' as const,
      acceptedFields: ['title'],
    };

    expect(crudSetDefaultContentPatchOpenFromColumnId(spec)).toBe('title');
    expect(crudSetPatchOpenFromColumnId(contentPatch, spec)).toBe('title');
    expect(crudSetPatchOpenFromColumnId({
      ...contentPatch,
      openFromColumnId: CRUD_SET_PATCH_OPEN_FROM_ACTIONS,
    }, spec)).toBeUndefined();
    expect(crudSetPatchOpenFromColumnId({
      ...contentPatch,
      openFromColumnId: 'code',
    }, spec)).toBe('code');
  });

  it('falls back to row id column when no display column exists', () => {
    const spec = {
      columns: [
        { field: 'status', label: 'Status', cellKind: 'badge' as const },
        { field: 'createdAt', label: 'Created', cellKind: 'date' as const },
        { field: 'id', label: 'Id' },
      ],
    };

    expect(crudSetDefaultContentPatchOpenFromColumnId(spec)).toBe('id');
  });

  it('transforms dataset values and can stack a secondary field', () => {
    expect(crudSetColumnId({ field: 'title', id: 'title-2' })).toBe('title-2');
    expect(crudSetColumnTransform({ field: 'createdAt', cellKind: 'date' })).toBe('date');
    expect(formatCrudSetColumnText(
      { field: 'createdAt', transform: 'date' },
      '2026-03-15T14:30:00.000Z',
    )).toBe('2026-03-15');
    expect(formatCrudSetColumnText(
      { field: 'createdAt', transform: 'date-year' },
      '2026-03-15T14:30:00.000Z',
    )).toBe('2026');
    expect(formatCrudSetColumnText(
      { field: 'createdAt', transform: 'date-custom', transformFormat: 'YYYY/MM' },
      '2026-03-15T14:30:00.000Z',
    )).toBe('2026/03');
    expect(formatCrudSetColumnText({ field: 'active', transform: 'boolean-yes-no' }, true)).toBe('Yes');
    expect(formatCrudSetColumnText({ field: 'active', transform: 'boolean-on-off' }, false)).toBe('Off');
    expect(crudSetColumnStack({ field: 'title', secondaryField: 'code' })).toBe('stacked');
    expect(formatCrudSetColumnExportValue(
      { field: 'title', secondaryField: 'code', stack: 'stacked' },
      { title: 'First order', code: 'ORD-001' },
    )).toBe('First order / ORD-001');
    expect(crudSetColumnConditionalBackground(
      { field: 'status', conditionalFormat: [{ when: 'equals', value: 'Open', background: '#F0F9FF' }] },
      'Open',
    )).toBe('#F0F9FF');
    expect(crudSetNormalizeConditionalBackground('#ecf')).toBe('#EECCFF');
    expect(crudSetColumnConditionalBackground(
      { field: 'status', conditionalFormat: [{ when: 'equals', value: 'Open', background: '#F0F9FF' }] },
      'Approved',
    )).toBeUndefined();
  });

  it('applies toolbar field filters and can omit search', () => {
    const spec: CrudSetSpec = {
      ...baseList(),
      filterBar: {
        search: false,
        filters: [{
          id: 'status',
          field: 'status',
          label: 'Status',
          controlType: 'radio-group',
          options: [
            { value: 'Open', label: 'Open' },
            { value: 'Approved', label: 'Approved' },
          ],
        }],
      },
    };
    const rows = [
      { id: '1', code: 'A', title: 'Alpha', status: 'Open' },
      { id: '2', code: 'B', title: 'Beta', status: 'Approved' },
    ];
    expect(applyCrudSetFilterBar(rows, spec, {
      searchText: 'Beta',
      checkboxSelections: {},
      radioSelections: {},
      matchLogicByFilterId: {},
    }).map((row) => row.id)).toEqual(['1', '2']);
    expect(applyCrudSetFilterBar(rows, spec, {
      searchText: '',
      checkboxSelections: {},
      radioSelections: { status: 'Open' },
      matchLogicByFilterId: {},
    }).map((row) => row.id)).toEqual(['1']);
  });

  it('ignores search and field filters when the filter bar is off', () => {
    const spec: CrudSetSpec = {
      ...baseList(),
      filterBar: {
        enabled: false,
        search: true,
        filters: [{
          id: 'status',
          field: 'status',
          label: 'Status',
          controlType: 'radio-group',
          options: [
            { value: 'Open', label: 'Open' },
            { value: 'Approved', label: 'Approved' },
          ],
        }],
      },
    };
    const rows = [
      { id: '1', code: 'A', title: 'Alpha', status: 'Open' },
      { id: '2', code: 'B', title: 'Beta', status: 'Approved' },
    ];
    expect(applyCrudSetFilterBar(rows, spec, {
      searchText: 'Beta',
      checkboxSelections: {},
      radioSelections: { status: 'Open' },
      matchLogicByFilterId: {},
    }).map((row) => row.id)).toEqual(['1', '2']);
    expect(crudSetOmittedUi({ ...spec, createApis: [], patches: [] }).filterBar).toBe(true);
    expect(crudSetOmittedUi({ ...baseList(), refresh: false }).refresh).toBe(true);
  });

  it('lets the operator choose create dialog fields instead of dumping the API', () => {
    const spec: CrudSetSpec = {
      ...baseList(),
      createApis: [{
        id: 'add-order',
        label: 'Add order',
        endpointId: 'orders.create',
        acceptedFields: ['title', 'customerId'],
      }],
    };
    expect(spec.createApis[0]?.acceptedFields).toEqual(['title', 'customerId']);
  });

  it('offers both Excel and CSV by default and cannot drop the last format', () => {
    expect(crudSetExportFormats({})).toEqual(['xlsx', 'csv']);
    expect(crudSetExportFormats({ export: { formats: ['csv'] } })).toEqual(['csv']);
    expect(crudSetExportFormats({ export: { formats: [] } })).toEqual(['xlsx', 'csv']);
    expect(crudSetExportDefaultFormat({})).toBe('xlsx');
    expect(crudSetExportDefaultFormat({ export: { formats: ['csv'], defaultFormat: 'xlsx' } })).toBe('csv');
    expect(toggleCrudSetExportFormat(['xlsx', 'csv'], 'xlsx', false)).toEqual(['csv']);
    expect(toggleCrudSetExportFormat(['csv'], 'csv', false)).toEqual(['csv']);
    expect(toggleCrudSetExportFormat([], 'csv', true)).toEqual(['xlsx', 'csv']);
  });

  it('prefills an export filename stem and locks the extension to the format', () => {
    expect(crudSetSuggestedExportFilename({ name: 'orders' }, new Date('2026-08-16T12:00:00Z')))
      .toBe('orders-2026-08-16');
    expect(crudSetSuggestedExportFilename({ name: 'Order List' }, new Date('2026-08-16T12:00:00Z')))
      .toBe('Order-List-2026-08-16');
    expect(crudSetLockedExportExtension('xlsx')).toBe('.xlsx');
    expect(crudSetLockedExportExtension('csv')).toBe('.csv');
  });

  it('places boolean and lock columns in the side panel unless overridden', () => {
    expect(crudSetColumnFormPlacement({ field: 'title' })).toBe('main');
    expect(crudSetColumnFormPlacement({ field: 'active', cellKind: 'boolean-icon' })).toBe('side');
    expect(crudSetColumnFormPlacement({ field: 'locked', cellKind: 'lock-status' })).toBe('side');
    expect(crudSetColumnFormPlacement({
      field: 'active',
      cellKind: 'boolean-icon',
      formPlacement: 'main',
    })).toBe('main');
    expect(recordFormFieldsIncludeSidePanel(
      [{ field: 'title' }, { field: 'active', cellKind: 'boolean-icon' }],
      ['title', 'active'],
    )).toBe(true);
    expect(recordFormFieldsIncludeSidePanel(
      [{ field: 'title' }, { field: 'active', cellKind: 'boolean-icon' }],
      ['title'],
    )).toBe(false);
  });

  it('widens create/edit/view past four fields unless maximized or full', () => {
    expect(crudSetDialogFormSizeForFieldCount(baseList(), 4)).toBe('lg');
    expect(crudSetDialogFormSizeForFieldCount(baseList(), 5)).toBe('4xl');
    expect(crudSetDialogFormSizeForFieldCount({
      ...baseList(),
      dialogs: { formSize: 'sm' },
    }, 5)).toBe('4xl');
    expect(crudSetDialogFormSizeForFieldCount({
      ...baseList(),
      dialogs: { formSize: 'maximized' },
    }, 8)).toBe('maximized');
    expect(crudSetDialogSidePanelTitle(baseList())).toBe('Flags');
    expect(crudSetDialogSidePanelTitle({
      ...baseList(),
      dialogs: { sidePanelTitle: ' Status flags ' },
    })).toBe('Status flags');
    expect(crudSetDialogSidePanelPlacement(baseList())).toBe('end');
    expect(crudSetDialogSidePanelPlacement({
      ...baseList(),
      dialogs: { sidePanelPlacement: 'left' },
    })).toBe('left');
    expect(crudSetDialogSidePanelPinnable(baseList())).toBe(false);
    expect(crudSetDialogSidePanelSplitter(baseList())).toBe(true);
    expect(crudSetDialogSidePanelSplitter({
      ...baseList(),
      dialogs: { sidePanelSplitter: false },
    })).toBe(false);
    expect(crudSetDialogSidePanelShowTitle(baseList())).toBe(true);
    expect(crudSetDialogSidePanelTitleInHeader(baseList())).toBe(false);
    expect(crudSetDialogSidePanelBackground(baseList())).toBe('theme');
    expect(crudSetDialogSidePanelBackgroundColor(baseList())).toBe('#F1F5F9');
    expect(crudSetDialogSidePanelBackground({
      ...baseList(),
      dialogs: { sidePanelBackground: 'custom', sidePanelBackgroundColor: 'e2e8f0' },
    })).toBe('custom');
    expect(crudSetDialogSidePanelBackgroundColor({
      ...baseList(),
      dialogs: { sidePanelBackgroundColor: 'e2e8f0' },
    })).toBe('#E2E8F0');
    expect(resolveRecordFormSidePanelBackgroundColor('theme')).toBe('var(--app-inspector-rail-bg)');
    expect(resolveRecordFormSidePanelBackgroundColor('custom', '#FFF7ED')).toBe('#FFF7ED');
    expect(crudSetDialogShowHeader(baseList())).toBe(true);
    expect(crudSetDialogShowFooter(baseList())).toBe(true);
    expect(crudSetDialogSubHeaderCount({ ...baseList(), dialogs: { subHeaderCount: 2 } })).toBe(2);
    expect(crudSetDialogSubFooterCount({ ...baseList(), dialogs: { subFooterCount: 1 } })).toBe(1);
    expect(recordFormSidePanelPhysicallyLeft('end', false)).toBe(false);
    expect(recordFormSidePanelPhysicallyLeft('end', true)).toBe(true);
    expect(recordFormSidePanelPhysicallyLeft('start', false)).toBe(true);
    expect(recordFormSidePanelPhysicallyLeft('left', true)).toBe(true);
    expect(recordFormSidePanelPhysicallyLeft('right', true)).toBe(false);
  });

  it('formats link column text from transform while keeping href resolvable', () => {
    const column = { field: 'website', label: 'Website', cellKind: 'link' as const };
    expect(crudSetColumnTransform(column)).toBe('link-domain');
    expect(formatCrudSetColumnText(column, 'https://www.example.com/docs/page')).toBe('example.com');
    expect(formatCrudSetColumnText(
      { ...column, transform: 'link-go-to' },
      'https://example.com',
    )).toBe('Go to');
    expect(formatCrudSetColumnText(
      { ...column, transform: 'link-custom-label', transformFormat: 'Visit us' },
      'https://example.com',
    )).toBe('Visit us');
    expect(resolveCrudSetLinkHref('example.com')).toBe('https://example.com');
    expect(resolveCrudSetLinkHref('user@example.com')).toBe('mailto:user@example.com');
  });

  it('defaults 2+ creates to a dropdown and allows adjacent buttons', () => {
    const twoCreates = {
      ...baseList(),
      createApis: [
        { id: 'add-one', label: 'Add one', endpointId: 'orders.create', acceptedFields: ['title'] },
        { id: 'add-two', label: 'Add two', endpointId: 'orders.create-bulk', acceptedFields: ['title'] },
      ],
    };
    expect(crudSetCreateLayout(twoCreates)).toBe('split');
    expect(crudSetCreateLayout({ ...twoCreates, createLayout: 'adjacent' })).toBe('adjacent');
    expect(crudSetCreateLayout({
      ...baseList(),
      createApis: [{ id: 'add-one', label: 'Add one', endpointId: 'orders.create', acceptedFields: ['title'] }],
      createLayout: 'adjacent',
    })).toBe('split');
  });

  it('matches disabledWhen rules for children, self, and field equals', () => {
    expect(crudSetDisabledWhenMatches({ rule: 'has-children' }, { hasChildren: true })).toBe(true);
    expect(crudSetDisabledWhenMatches({ rule: 'has-children' }, { hasChildren: false })).toBe(false);
    expect(crudSetDisabledWhenMatches(
      { rule: 'row-is-self' },
      { id: 'me' },
      'me',
      (row) => String(row.id ?? ''),
    )).toBe(true);
    expect(crudSetDisabledWhenMatches(
      { rule: 'field-equals', field: 'status', equals: 'Shipped' },
      { status: 'Shipped' },
    )).toBe(true);
  });

  it('fills filter options from distinct row values', () => {
    const filter = {
      id: 'status',
      field: 'status',
      label: 'Status',
      controlType: 'radio-group' as const,
      options: [] as { value: string; label: string }[],
      optionsFrom: 'distinct-rows' as const,
    };
    expect(crudSetFilterOptionsFrom(filter)).toBe('distinct-rows');
    expect(resolveCrudSetFilterBarOptions(filter, [
      { status: 'Open' },
      { status: 'Approved' },
      { status: 'Open' },
    ])).toEqual([
      { value: 'Approved', label: 'Approved' },
      { value: 'Open', label: 'Open' },
    ]);
  });

  it('reads view kind, json, and thread messages from dialogs', () => {
    expect(crudSetViewKind(baseList())).toBe('record-form');
    expect(crudSetViewKind({ dialogs: { viewKind: 'json' } })).toBe('json');
    expect(crudSetJsonViewText(
      { payload: '{"ok":true}' },
      { dialogs: { viewKind: 'json', jsonField: 'payload' } },
    )).toBe(JSON.stringify({ ok: true }, null, 2));
    expect(crudSetThreadMessages(
      { messages: [{ role: 'user', body: 'Please ship.' }] },
      { dialogs: { viewKind: 'thread' } },
    )).toEqual([{ role: 'user', body: 'Please ship.' }]);
  });

  it('parses METHOD /path and bare /path write routes', () => {
    expect(crudSetWriteChangeReasonRoute({
      createApis: [],
      patches: [{
        id: 'edit',
        label: 'Edit',
        endpointId: 'PATCH /api/sample-mock/records/:id',
        kind: 'content',
        acceptedFields: ['title'],
      }],
      deleteApi: { endpointId: 'DELETE /api/sample-mock/records/:id' },
    })).toEqual({ method: 'PATCH', path: '/api/sample-mock/records/:id' });
    expect(crudSetWriteChangeReasonRoute({
      createApis: [],
      patches: [{
        id: 'edit',
        label: 'Edit',
        endpointId: '/api/orders/:id',
        kind: 'content',
        acceptedFields: ['title'],
      }],
    })).toEqual({ method: 'PATCH', path: '/api/orders/:id' });
    expect(crudSetWriteChangeReasonRoute({
      createApis: [],
      patches: [{
        id: 'lock',
        label: 'Lock',
        endpointId: 'PATCH /api/sample-mock/records/:id/lock',
        kind: 'purpose',
        acceptedFields: ['locked'],
      }],
      deleteApi: { endpointId: 'DELETE /api/sample-mock/records/:id' },
    })).toEqual({ method: 'PATCH', path: '/api/sample-mock/records/:id/lock' });
    expect(crudSetWriteChangeReasonRoute({
      createApis: [],
      patches: [],
      deleteApi: { endpointId: 'DELETE /api/sample-mock/records/:id' },
    })).toEqual({ method: 'DELETE', path: '/api/sample-mock/records/:id' });
    expect(crudSetWriteChangeReasonRoute({
      createApis: [],
      patches: [{
        id: 'edit',
        label: 'Edit',
        endpointId: 'orders.edit',
        kind: 'content',
        acceptedFields: ['title'],
      }],
    })).toBeNull();
  });
});
