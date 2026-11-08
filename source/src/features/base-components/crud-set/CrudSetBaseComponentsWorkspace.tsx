import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { cn } from '../../../lib/utils';
import {
  AppSurfaceBox,
  CrudSet,
  CrudSetColumnList,
  CrudSetConfigCheckbox,
  CrudSetDialogFields,
  CrudSetGridFields,
  CrudSetKanbanFields,
  FormField,
  FormSection,
  pickChangeReasonPayload,
  omitChangeReasonTransport,
  UiInput,
  UiSelect,
  showAppFeedbackToast,
  type CrudSetRow,
} from '../../../shared/ui';
import {
  applyCrudSetExportQuery,
  crudSetColumnId,
  crudSetColumnLabel,
  crudSetOmittedUi,
  migrateCrudSetSpecForKanbanBody,
  crudSetPaginationEnabled,
  crudSetRequiresReadOne,
  parseCrudSetListBody,
  CRUD_SET_EXPORT_FORMATS,
  CRUD_SET_DEFAULT_ACTIONS,
  CRUD_SET_DEFAULT_DIALOGS,
  CRUD_SET_DEFAULT_GRID,
  CRUD_SET_DEFAULT_KANBAN,
  CRUD_SET_DEFAULT_PAGING,
  CRUD_SET_DEFAULT_SORTING,
  CRUD_SET_LIST_BODY_KINDS,
  CRUD_SET_LIST_BODY_LABELS,
  CRUD_SET_PATCH_OPEN_FROM_ACTIONS,
  CRUD_SET_CONDITIONAL_SAMPLE_BACKGROUNDS,
  type CrudSetActionsConfig,
  type CrudSetCreateApi,
  type CrudSetDialogsConfig,
  type CrudSetExportFormat,
  type CrudSetFilterBarConfig,
  type CrudSetFilterBarFilter,
  type CrudSetGridColumn,
  type CrudSetGridConfig,
  type CrudSetKanbanConfig,
  type CrudSetListBodyKind,
  type CrudSetPagingConfig,
  type CrudSetPatchApi,
  type CrudSetCreateLayout,
  type CrudSetViewKind,
  CRUD_SET_CREATE_LAYOUTS,
  CRUD_SET_CREATE_LAYOUT_LABELS,
  CRUD_SET_VIEW_KINDS,
  CRUD_SET_VIEW_KIND_LABELS,
  crudSetPatchOpenFromColumnId,
  isBooleanTogglePatch,
} from '../../../domain/component-designer/crudSetSpec';
import { BaseComponentsHeaderActions } from '../components/BaseComponentsPageHeaderContext';
import {
  BaseComponentsPreviewFrame,
  BASE_COMPONENTS_WORKSPACE_INSET_CLASS,
} from '../components/BaseComponentsWorkspacePanel';
import { BaseComponentsResetButton, BaseComponentsConfigToolbarControls } from '../components/BaseComponentsConfigDialog';
import { BaseComponentsConfigAccordion } from '../components/BaseComponentsConfigAccordion';
import { BaseComponentsCrudSetPagingFields } from '../components/BaseComponentsCrudSetPagingFields';
import { BaseComponentsCrudSetToolbarFields } from '../components/BaseComponentsCrudSetToolbarFields';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS,
  BASE_COMPONENTS_CONFIG_COLUMN_CLASS,
} from '../baseComponentsConfiguratorLayout';
import { APP_TABLE_GRID_AUDIT_COLUMN_WIDTH } from '../../../shared/ui/surfaceClasses';
import {
  ALL_SAMPLE_MOCK_RELATIONS_ON,
  SAMPLE_MOCK_RELATION_KINDS,
  SAMPLE_MOCK_RELATION_LABELS,
  sampleMockPhotoSrc,
  serializeSampleMockIncludes,
  type SampleMockRelationIncludes,
} from '../../../shared/api/contracts/sample-mock/records';
import {
  approveSampleMockRecord,
  createSampleMockRecord,
  createSampleMockRecordsBulk,
  deleteSampleMockRecord,
  fetchSampleMockRecords,
  lockSampleMockRecord,
  patchSampleMockRecord,
  isSampleMockDemoFallback,
} from '../../../shared/api/queries/sample-mock';
import { SAMPLE_MOCK_CHANGE_REASON } from '../../../shared/api/contracts/record-events';
import { useNamedApiChangeReasonPolicy } from '../../../shared/api/queries/namedApiChangeReason';

const STATUSES = ['Open', 'Approved', 'Shipped'] as const;
const DEMO_ACTORS = ['admin', 'nina.vale', 'sam.rivera', 'jordan.lee'] as const;
const DEMO_OPERATOR = 'admin';
const DEMO_CITIES = ['North Harbor', 'West Ridge', 'East Bay', 'South Dock'] as const;
const DEMO_CITY_COORDS = [
  { lat: 35.6892, lng: 51.389 },
  { lat: 41.0082, lng: 28.9784 },
  { lat: 25.2048, lng: 55.2708 },
  { lat: 30.0444, lng: 31.2357 },
] as const;
const DEMO_TAGS = ['Urgent', 'Billing', 'North', 'West', 'VIP', 'Archive'] as const;
const DEMO_COMMENTS = ['Need follow-up', 'Ready to ship', 'Customer called'] as const;

const DEMO_DATASET_FIELDS = [
  'code',
  'title',
  'subtitle',
  'parentTitle',
  'status',
  'owner',
  'city',
  'detailNote',
  'latitude',
  'longitude',
  'tags',
  'comments',
  'locked',
  'active',
  'photo',
  'website',
  'createdAt',
  'createdBy',
  'updatedAt',
  'updatedBy',
  'approvedAt',
  'approvedBy',
  'lockedAt',
  'lockedBy',
  'unlockedAt',
  'unlockedBy',
] as const;

const demoActor = (index: number): string => DEMO_ACTORS[index % DEMO_ACTORS.length];

const demoIso = (day: number, hour: number): string => (
  `2026-03-${String(((day - 1) % 28) + 1).padStart(2, '0')}T${String(hour).padStart(2, '0')}:30:00.000Z`
);

const demoNowIso = (): string => new Date().toISOString();

const demoPhoto = (index: number): string => sampleMockPhotoSrc(index);

const extraDemoFields = (
  index: number,
  context: { status: string; locked: boolean },
): Record<string, unknown> => {
  const createdBy = demoActor(index);
  const createdAt = demoIso(index + 1, 9);
  const patched = context.locked || context.status !== 'Open' || index % 2 === 1;
  const updatedBy = patched ? demoActor(index + 3) : createdBy;
  const updatedAt = patched ? demoIso(index + 3, 16) : createdAt;
  const approved = context.status === 'Approved' || context.status === 'Shipped';
  const origin = DEMO_CITY_COORDS[index % DEMO_CITY_COORDS.length];
  return {
    subtitle: `Customer ${index + 1}`,
    owner: demoActor(index + 1),
    city: DEMO_CITIES[index % DEMO_CITIES.length],
    detailNote: `Fulfill from ${DEMO_CITIES[index % DEMO_CITIES.length]}`,
    latitude: Number((origin.lat + ((index % 9) - 4) * 0.04).toFixed(5)),
    longitude: Number((origin.lng + ((index % 7) - 3) * 0.04).toFixed(5)),
    tags: DEMO_TAGS.slice(0, (index % 3) + 1),
    comments: DEMO_COMMENTS.slice(0, index % 3),
    website: `https://example.com/orders/${index + 1}`,
    active: index % 3 !== 0,
    createdAt,
    createdBy,
    updatedAt,
    updatedBy,
    photo: demoPhoto(index),
    ...(approved ? { approvedAt: updatedAt, approvedBy: updatedBy } : {}),
    ...(context.locked
      ? { lockedAt: updatedAt, lockedBy: updatedBy }
      : {}),
    personType: index % 2 === 0 ? 'individual' : 'company',
    companyName: index % 2 === 0 ? '' : `Northwind ${index + 1}`,
    secret: '',
    accent: index % 2 === 0 ? '#0EA5E9' : '#10B981',
    payload: JSON.stringify({ order: index + 1, status: context.status }, null, 2),
    hasChildren: index % 11 === 0,
    messages: [
      { role: 'user', body: `Please ship order ${index + 1}.` },
      { role: 'assistant', body: `Order ${index + 1} is ${context.status.toLowerCase()}.` },
    ],
  };
};

const DEFAULT_FILTER_BAR: CrudSetFilterBarConfig = {
  enabled: true,
  search: true,
  searchClear: true,
  filters: [{
    id: 'status',
    field: 'status',
    label: 'Status',
    controlType: 'radio-group',
    options: STATUSES.map((status) => ({ value: status, label: status })),
  }],
};

export type CrudSetDisplayState = 'default' | 'empty' | 'loading' | 'error';

const STANDARD_COLUMNS: CrudSetGridColumn[] = [
  {
    field: 'photo',
    label: 'Photo',
    cellKind: 'image',
    imageMask: 'circle',
    sortable: false,
    filterable: false,
    width: 64,
    cardRole: 'field',
    isRowHeader: false,
  },
  { field: 'code', label: 'Code', cellKind: 'text', sortable: true, filterable: true, width: 120, cardRole: 'title', isRowHeader: true },
  {
    field: 'parentTitle',
    label: 'Parent',
    cellKind: 'text',
    sortable: true,
    filterable: true,
    width: 140,
    cardRole: 'meta',
  },
  {
    field: 'title',
    label: 'Title',
    cellKind: 'text',
    secondaryField: 'subtitle',
    stack: 'stacked',
    sortable: true,
    filterable: true,
    width: 220,
    cardRole: 'subtitle',
  },
  {
    field: 'status',
    label: 'Status',
    cellKind: 'badge',
    secondaryField: 'approvedBy',
    stack: 'stacked',
    sortable: true,
    filterable: true,
    width: 120,
    cardRole: 'meta',
    conditionalFormat: [
      { when: 'equals', value: 'Open', background: CRUD_SET_CONDITIONAL_SAMPLE_BACKGROUNDS.open },
      { when: 'equals', value: 'Approved', background: CRUD_SET_CONDITIONAL_SAMPLE_BACKGROUNDS.approved },
      { when: 'equals', value: 'Shipped', background: CRUD_SET_CONDITIONAL_SAMPLE_BACKGROUNDS.shipped },
    ],
  },
  {
    field: 'owner',
    label: 'Owner',
    cellKind: 'text',
    sortable: true,
    filterable: true,
    width: 140,
    cardRole: 'meta',
  },
  {
    field: 'city',
    label: 'City',
    cellKind: 'text',
    secondaryField: 'detailNote',
    stack: 'stacked',
    sortable: true,
    filterable: true,
    width: 160,
    cardRole: 'meta',
  },
  {
    field: 'website',
    label: 'Website',
    cellKind: 'link',
    sortable: true,
    filterable: true,
    width: 160,
    hideBelow: 'lg',
    cardRole: 'meta',
  },
  {
    field: 'latitude',
    label: 'Latitude',
    cellKind: 'text',
    sortable: true,
    filterable: true,
    width: 110,
    hideBelow: 'lg',
    cardRole: 'hidden',
  },
  {
    field: 'longitude',
    label: 'Longitude',
    cellKind: 'text',
    sortable: true,
    filterable: true,
    width: 110,
    hideBelow: 'lg',
    cardRole: 'hidden',
  },
  {
    field: 'tags',
    label: 'Tags',
    cellKind: 'chips',
    sortable: false,
    filterable: false,
    width: 180,
    cardRole: 'field',
  },
  {
    field: 'comments',
    label: 'Comments',
    cellKind: 'chips',
    sortable: false,
    filterable: false,
    width: 200,
    cardRole: 'field',
  },
  {
    field: 'active',
    label: 'Active',
    cellKind: 'boolean-icon',
    formPlacement: 'side',
    sortable: true,
    filterable: true,
    width: 88,
    cardRole: 'field',
  },
  {
    field: 'locked',
    label: 'Locked',
    cellKind: 'lock-status',
    formPlacement: 'side',
    sortable: false,
    filterable: true,
    width: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
    cardRole: 'field',
  },
  {
    field: 'createdAt',
    label: 'Created',
    cellKind: 'audit',
    transform: 'date',
    secondaryField: 'createdBy',
    stack: 'stacked',
    sortable: true,
    filterable: true,
    width: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
    hideBelow: 'lg',
    cardRole: 'meta',
  },
  {
    field: 'updatedAt',
    label: 'Updated',
    cellKind: 'date',
    transform: 'date',
    secondaryField: 'updatedBy',
    stack: 'stacked',
    sortable: true,
    filterable: true,
    width: APP_TABLE_GRID_AUDIT_COLUMN_WIDTH,
    hideBelow: 'lg',
    cardRole: 'meta',
  },
];

const COLUMN_RELATION: Partial<Record<string, keyof SampleMockRelationIncludes>> = {
  parentTitle: 'parent',
  status: 'status',
  owner: 'owner',
  city: 'detail',
  comments: 'comments',
  tags: 'tags',
};

const FORM_RELATION_FIELDS: Partial<Record<string, keyof SampleMockRelationIncludes>> = {
  ...COLUMN_RELATION,
  parentId: 'parent',
  detailNote: 'detail',
};

export const filterCrudSetDemoAcceptedFields = (
  fields: readonly string[],
  relations: SampleMockRelationIncludes,
): string[] => fields.filter((field) => {
  const relation = FORM_RELATION_FIELDS[field];
  return !relation || relations[relation];
});

export type CrudSetBaseComponentsConfig = {
  listBody: CrudSetListBodyKind;
  pagination: boolean;
  paging: CrudSetPagingConfig;
  sorting: CrudSetSortingConfig;
  grid: CrudSetGridConfig;
  kanban: CrudSetKanbanConfig;
  actions: CrudSetActionsConfig;
  dialogs: CrudSetDialogsConfig;
  refreshEnabled: boolean;
  exportEnabled: boolean;
  exportFormats: CrudSetExportFormat[];
  exportFormat: CrudSetExportFormat;
  createApis: CrudSetCreateApi[];
  patches: CrudSetPatchApi[];
  deleteEnabled: boolean;
  createLayout: CrudSetCreateLayout;
  createWizard: boolean;
  autoRefreshEnabled: boolean;
  collectionClearEnabled: boolean;
  rowViewEnabled: boolean;
  columns: CrudSetGridColumn[];
  filterBar: CrudSetFilterBarConfig;
  displayState: CrudSetDisplayState;
  relations: SampleMockRelationIncludes;
};

export const CRUD_SET_DEMO_LIST_API = {
  endpointId: 'GET /api/sample-mock/records',
  label: 'List sample mock records',
} as const;

export const CRUD_SET_DEMO_READ_ONE_API = {
  endpointId: 'GET /api/sample-mock/records/:id',
  label: 'Get sample mock record',
} as const;

export const CRUD_SET_DEMO_DELETE_API = {
  endpointId: 'DELETE /api/sample-mock/records/:id',
  label: 'Delete sample mock record',
} as const;

export const CRUD_SET_DEMO_CREATE_APIS: CrudSetCreateApi[] = [
  {
    id: 'add-order',
    label: 'Add order',
    endpointId: 'POST /api/sample-mock/records',
    purpose: 'Single record',
    acceptedFields: [
      'code', 'title', 'subtitle', 'website', 'parentTitle', 'status', 'owner',
      'city', 'detailNote', 'tags', 'comments', 'latitude', 'longitude', 'active',
    ],
  },
  {
    id: 'add-bulk',
    label: 'Add bulk',
    endpointId: 'POST /api/sample-mock/records/bulk',
    purpose: 'Several records',
    acceptedFields: ['title'],
  },
];

export const CRUD_SET_DEMO_PATCH_APIS: CrudSetPatchApi[] = [
  {
    id: 'edit',
    label: 'Edit order',
    endpointId: 'PATCH /api/sample-mock/records/:id',
    kind: 'content',
    acceptedFields: [
      'title', 'subtitle', 'website', 'parentTitle', 'status', 'owner',
      'city', 'detailNote', 'tags', 'comments', 'latitude', 'longitude', 'active',
    ],
  },
  {
    id: 'approve',
    label: 'Approve',
    endpointId: 'PATCH /api/sample-mock/records/:id/approve',
    kind: 'purpose',
    acceptedFields: ['status'],
    interaction: 'form',
  },
  {
    id: 'lock',
    label: 'Lock',
    endpointId: 'PATCH /api/sample-mock/records/:id/lock',
    kind: 'purpose',
    acceptedFields: ['locked'],
    interaction: 'boolean-toggle',
    toggleConfirm: true,
  },
];

export const DEFAULT_CRUD_SET_BASE_COMPONENTS_CONFIG: CrudSetBaseComponentsConfig = {
  listBody: 'grid',
  pagination: true,
  paging: { ...CRUD_SET_DEFAULT_PAGING },
  sorting: { ...CRUD_SET_DEFAULT_SORTING, defaultField: 'code' },
  grid: { ...CRUD_SET_DEFAULT_GRID },
  kanban: { ...CRUD_SET_DEFAULT_KANBAN },
  actions: { ...CRUD_SET_DEFAULT_ACTIONS },
  dialogs: { ...CRUD_SET_DEFAULT_DIALOGS },
  refreshEnabled: true,
  exportEnabled: true,
  exportFormats: [...CRUD_SET_EXPORT_FORMATS],
  exportFormat: 'xlsx',
  createApis: CRUD_SET_DEMO_CREATE_APIS.map((create) => ({ ...create })),
  patches: CRUD_SET_DEMO_PATCH_APIS.map((patch) => ({ ...patch })),
  deleteEnabled: true,
  createLayout: 'split',
  createWizard: false,
  autoRefreshEnabled: false,
  collectionClearEnabled: false,
  rowViewEnabled: false,
  columns: STANDARD_COLUMNS,
  filterBar: DEFAULT_FILTER_BAR,
  displayState: 'default',
  relations: { ...ALL_SAMPLE_MOCK_RELATIONS_ON },
};

export const buildCrudSetDemoGridRows = (): CrudSetRow[] => (
  Array.from({ length: 80 }, (_, index) => {
    const status = STATUSES[index % STATUSES.length];
    const locked = index % 7 === 0;
    return {
      id: `order-${index + 1}`,
      code: `ORD-${String(index + 1).padStart(3, '0')}`,
      title: `Order ${index + 1}`,
      status,
      locked,
      ...extraDemoFields(index, { status, locked }),
    };
  })
);

export const buildCrudSetDemoTreeRows = (): CrudSetRow[] => {
  const rows: CrudSetRow[] = [];
  for (let region = 1; region <= 3; region += 1) {
    rows.push({
      id: `region-${region}`,
      code: `R${region}`,
      title: `Region ${region}`,
      status: 'Active',
      locked: false,
      __depth: 0,
      ...extraDemoFields(region, { status: 'Active', locked: false }),
    });
    for (let child = 1; child <= 4; child += 1) {
      const status = STATUSES[child % STATUSES.length];
      const locked = child === 1;
      rows.push({
        id: `region-${region}-order-${child}`,
        parentId: `region-${region}`,
        parentTitle: `Region ${region}`,
        code: `R${region}-${child}`,
        title: `Order ${region}.${child}`,
        status,
        locked,
        __depth: 1,
        ...extraDemoFields(region * 10 + child, { status, locked }),
      });
    }
  }
  return rows;
};

export const resolveCrudSetDemoColumns = (
  config: Pick<CrudSetBaseComponentsConfig, 'columns' | 'relations'>,
): CrudSetGridColumn[] => {
  const relations = config.relations ?? ALL_SAMPLE_MOCK_RELATIONS_ON;
  const standardByField = new Map(STANDARD_COLUMNS.map((column) => [column.field, column]));

  const isVisible = (field: string): boolean => {
    const relation = COLUMN_RELATION[field];
    return !relation || relations[relation];
  };

  const mergeWithStandard = (column: CrudSetGridColumn): CrudSetGridColumn => {
    const standard = standardByField.get(column.field);
    return standard ? { ...standard, ...column } : column;
  };

  const configured = (config.columns ?? [])
    .map(mergeWithStandard)
    .filter((column) => isVisible(column.field));

  if (configured.length > 0) {
    return configured;
  }

  return STANDARD_COLUMNS.filter((column) => isVisible(column.field));
};

const RECORDS_CHROME_COLUMNS: CrudSetGridColumn[] = [
  {
    field: 'personType',
    label: 'Person type',
    cellKind: 'badge',
    sortable: false,
    filterable: false,
    width: 120,
    cardRole: 'hidden',
  },
  {
    field: 'companyName',
    label: 'Company',
    cellKind: 'text',
    formControl: 'text',
    visibleWhen: { field: 'personType', equals: 'company' },
    sortable: false,
    filterable: false,
    width: 140,
    cardRole: 'hidden',
  },
  {
    field: 'secret',
    label: 'Secret',
    cellKind: 'text',
    formControl: 'password',
    formPlacement: 'side',
    sortable: false,
    filterable: false,
    cardRole: 'hidden',
  },
  {
    field: 'accent',
    label: 'Accent',
    cellKind: 'text',
    formControl: 'color',
    sortable: false,
    filterable: false,
    cardRole: 'hidden',
  },
  {
    field: 'payload',
    label: 'Payload',
    cellKind: 'text',
    formControl: 'json',
    sortable: false,
    filterable: false,
    cardRole: 'hidden',
  },
];

export function buildCrudSetSpecFromDemoConfig(config: CrudSetBaseComponentsConfig): CrudSetSpec {
  const baseFilterBar = config.filterBar ?? DEFAULT_FILTER_BAR;
  const baseKanban = config.kanban ?? { ...CRUD_SET_DEFAULT_KANBAN };
  const kanbanParts = config.listBody === 'kanban'
    ? migrateCrudSetSpecForKanbanBody({ kanban: baseKanban, filterBar: baseFilterBar })
    : null;
  const spec: CrudSetSpec = {
    name: 'Sample mock',
    listApi: { endpointId: CRUD_SET_DEMO_LIST_API.endpointId },
    listBody: config.listBody,
    pagination: config.pagination,
    paging: config.paging ?? CRUD_SET_DEFAULT_PAGING,
    sorting: config.sorting ?? CRUD_SET_DEFAULT_SORTING,
    grid: config.grid ?? CRUD_SET_DEFAULT_GRID,
    actions: config.actions ?? CRUD_SET_DEFAULT_ACTIONS,
    dialogs: config.dialogs ?? CRUD_SET_DEFAULT_DIALOGS,
    columns: [
      ...resolveCrudSetDemoColumns(config),
      ...(config.createWizard || config.rowViewEnabled ? RECORDS_CHROME_COLUMNS : []),
    ],
    filterBar: kanbanParts?.filterBar ?? baseFilterBar,
    refresh: config.refreshEnabled !== false,
    createLayout: config.createLayout,
    autoRefresh: config.autoRefreshEnabled ? { enabled: true, seconds: 5 } : undefined,
    collectionActions: config.collectionClearEnabled
      ? [{ id: 'clear-all', label: 'Clear all', intent: 'destructive-soft', confirm: true }]
      : undefined,
    rowActions: config.rowViewEnabled
      ? [{ id: 'view', label: 'View', interaction: 'view', intent: 'view' }]
      : undefined,
    createApis: (config.createApis ?? [])
      .filter((create) => create.endpointId.trim() && create.label.trim())
      .map((create) => {
        const acceptedFields = filterCrudSetDemoAcceptedFields(
          create.acceptedFields,
          config.relations ?? ALL_SAMPLE_MOCK_RELATIONS_ON,
        );
        const wizardFields = [...acceptedFields, 'personType', 'companyName', 'secret', 'accent']
          .filter((field, index, list) => list.indexOf(field) === index);
        return {
          ...create,
          acceptedFields: config.createWizard && create.id === 'add-order' ? wizardFields : acceptedFields,
          ...(config.createWizard && create.id === 'add-order'
            ? {
              steps: [
                { title: 'Identity', acceptedFields: ['code', 'title', 'personType'] },
                { title: 'Details', acceptedFields: ['subtitle', 'website', 'companyName', 'secret', 'accent'] },
                { title: 'Flags', acceptedFields: ['status', 'active'] },
              ],
            }
            : {}),
        };
      }),
    patches: (config.patches ?? [])
      .filter((patch) => patch.endpointId.trim() && patch.label.trim())
      .map((patch) => ({
        ...patch,
        acceptedFields: filterCrudSetDemoAcceptedFields(
          patch.acceptedFields,
          config.relations ?? ALL_SAMPLE_MOCK_RELATIONS_ON,
        ),
      })),
    export: {
      enabled: config.exportEnabled,
      formats: config.exportFormats?.length ? config.exportFormats : [...CRUD_SET_EXPORT_FORMATS],
      defaultFormat: (config.exportFormats ?? CRUD_SET_EXPORT_FORMATS).includes(config.exportFormat)
        ? config.exportFormat
        : (config.exportFormats?.[0] ?? 'xlsx'),
      defaultIncludeHeader: true,
    },
    ...(config.listBody === 'kanban' ? { kanban: kanbanParts?.kanban ?? baseKanban } : {}),
    ...(config.deleteEnabled ? { deleteApi: { endpointId: CRUD_SET_DEMO_DELETE_API.endpointId } } : {}),
    history: {
      subjectKind: 'base_sample_mock_records',
      trackedFields: ['title', 'status', 'locked', 'owner', 'parentTitle', 'code', 'city', 'tags'],
      fieldMap: {
        status: 'status_id',
        owner: 'owner_id',
        parentTitle: 'parent_id',
        city: 'detail.city',
      },
    },
  };

  if (crudSetRequiresReadOne(spec)) {
    spec.readOneApi = { endpointId: CRUD_SET_DEMO_READ_ONE_API.endpointId };
  }
  return spec;
}

export function resolveCrudSetPreviewRows(
  config: Pick<CrudSetBaseComponentsConfig, 'listBody' | 'displayState'>,
  rows: ReadonlyArray<CrudSetRow>,
): ReadonlyArray<CrudSetRow> {
  if (config.displayState === 'empty' || config.displayState === 'error') {
    return [];
  }
  return rows;
}

const seedRowsForBody = (listBody: CrudSetListBodyKind): CrudSetRow[] => (
  listBody === 'tree-grid' ? buildCrudSetDemoTreeRows() : buildCrudSetDemoGridRows()
);

export const CrudSetBaseComponentsWorkspace: React.FC = () => {
  const [config, setConfig] = useState<CrudSetBaseComponentsConfig>(DEFAULT_CRUD_SET_BASE_COMPONENTS_CONFIG);
  const [rows, setRows] = useState<CrudSetRow[]>(() => seedRowsForBody(DEFAULT_CRUD_SET_BASE_COMPONENTS_CONFIG.listBody));
  const spec = useMemo(() => buildCrudSetSpecFromDemoConfig(config), [config]);
  const changeReasonPolicy = useNamedApiChangeReasonPolicy(
    'PATCH',
    '/api/sample-mock/records/:id',
    SAMPLE_MOCK_CHANGE_REASON,
  );
  const omitted = crudSetOmittedUi(spec);
  const previewRows = resolveCrudSetPreviewRows(config, rows);
  const includeKey = serializeSampleMockIncludes(config.relations ?? ALL_SAMPLE_MOCK_RELATIONS_ON);

  const loadRows = useCallback(async (signal?: AbortSignal) => {
    try {
      const items = await fetchSampleMockRecords(includeKey, signal);
      if (!signal?.aborted) {
        setRows(items as CrudSetRow[]);
      }
    } catch {
      if (!signal?.aborted) {
        setRows(seedRowsForBody(config.listBody));
      }
    }
  }, [config.listBody, includeKey]);

  useEffect(() => {
    const controller = new AbortController();
    void loadRows(controller.signal);
    return () => controller.abort();
  }, [loadRows]);

  const configJson = useMemo(() => JSON.stringify({
    public: {
      spec: {
        listBody: spec.listBody,
        pagination: crudSetPaginationEnabled(spec),
        paging: spec.paging,
        sorting: spec.sorting,
        grid: spec.grid,
        actions: spec.actions,
        dialogs: spec.dialogs,
        columns: spec.columns,
        filterBar: spec.filterBar,
        refresh: spec.refresh,
        export: spec.export,
        createCount: spec.createApis.length,
        createApis: spec.createApis,
        patches: spec.patches,
        listApi: spec.listApi,
        readOneApi: spec.readOneApi,
        delete: Boolean(spec.deleteApi),
      },
    },
    composition: {
      contentPatch: spec.patches.some((patch) => patch.kind === 'content'),
      purposePatch: spec.patches.some(isBooleanTogglePatch)
        ? 'boolean-toggle'
        : spec.patches.some((patch) => patch.kind === 'purpose')
          ? 'form'
          : 'none',
      toggleConfirm: spec.patches.some((patch) => isBooleanTogglePatch(patch) && patch.toggleConfirm),
      openEditFromTitle: spec.patches.some((patch) => (
        patch.kind === 'content' && patch.openFromColumnId === 'title'
      )),
      openEditFromColumn: (() => {
        const contentPatch = spec.patches.find((patch) => patch.kind === 'content');
        return Boolean(contentPatch && crudSetPatchOpenFromColumnId(contentPatch, spec));
      })(),
    },
    demo: {
      fixtures: { rowCount: previewRows.length },
      scenarios: { state: config.displayState },
      relations: config.relations,
      omitted,
    },
  }, null, 2), [config, omitted, previewRows.length, spec]);

  const reset = () => {
    setConfig(DEFAULT_CRUD_SET_BASE_COMPONENTS_CONFIG);
  };

  const visibleColumns = resolveCrudSetDemoColumns(config);

  const toggleDemoCreate = (id: string, enabled: boolean) => {
    setConfig((current) => {
      if (enabled) {
        if (current.createApis.some((create) => create.id === id)) {
          return current;
        }
        const next = CRUD_SET_DEMO_CREATE_APIS
          .filter((mock) => mock.id === id || current.createApis.some((create) => create.id === mock.id))
          .map((mock) => current.createApis.find((create) => create.id === mock.id) ?? { ...mock });
        return { ...current, createApis: next };
      }
      return { ...current, createApis: current.createApis.filter((create) => create.id !== id) };
    });
  };

  const toggleDemoPatch = (id: string, enabled: boolean) => {
    setConfig((current) => {
      if (enabled) {
        if (current.patches.some((patch) => patch.id === id)) {
          return current;
        }
        const next = CRUD_SET_DEMO_PATCH_APIS
          .filter((mock) => mock.id === id || current.patches.some((patch) => patch.id === mock.id))
          .map((mock) => current.patches.find((patch) => patch.id === mock.id) ?? { ...mock });
        return { ...current, patches: next };
      }
      return { ...current, patches: current.patches.filter((patch) => patch.id !== id) };
    });
  };

  const updateDemoPatch = (id: string, partial: Partial<CrudSetPatchApi>) => {
    setConfig((current) => ({
      ...current,
      patches: current.patches.map((patch) => (patch.id === id ? { ...patch, ...partial } : patch)),
    }));
  };

  const updateVisibleColumns = (nextVisible: CrudSetGridColumn[]) => {
    setConfig((current) => ({ ...current, columns: nextVisible }));
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <BaseComponentsHeaderActions>
        <BaseComponentsConfigToolbarControls sectionId="crud-set" json={configJson}>
          <BaseComponentsResetButton onClick={reset} />
        </BaseComponentsConfigToolbarControls>
      </BaseComponentsHeaderActions>

      <div className={cn(BASE_COMPONENTS_SPLIT_WORKSPACE_CLASS, BASE_COMPONENTS_WORKSPACE_INSET_CLASS)}>
        <div className={BASE_COMPONENTS_CONFIG_COLUMN_CLASS}>
          <BaseComponentsConfigAccordion>
            <FormSection title="Body" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField label="Widget" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.listBody}
                    onChange={(event) => {
                      const listBody = parseCrudSetListBody(event.target.value);
                      setConfig((current) => {
                        const next = {
                          ...current,
                          listBody,
                          relations: listBody === 'kanban'
                            ? { ...current.relations, status: true }
                            : current.relations,
                          ...(listBody === 'kanban' && !current.pagination ? { pagination: true } : {}),
                        };
                        if (listBody === 'kanban') {
                          const migrated = migrateCrudSetSpecForKanbanBody({
                            kanban: current.kanban ?? { ...CRUD_SET_DEFAULT_KANBAN },
                            filterBar: current.filterBar ?? DEFAULT_FILTER_BAR,
                          });
                          return {
                            ...next,
                            kanban: migrated.kanban ?? current.kanban,
                            filterBar: migrated.filterBar ?? current.filterBar,
                          };
                        }
                        return next;
                      });
                    }}
                    ariaLabel="CRUD Set widget"
                  >
                    {CRUD_SET_LIST_BODY_KINDS.map((kind) => (
                      <option key={kind} value={kind}>{CRUD_SET_LIST_BODY_LABELS[kind]}</option>
                    ))}
                  </UiSelect>
                </FormField>
                {config.listBody === 'kanban' ? (
                  <CrudSetKanbanFields
                    kanban={config.kanban ?? CRUD_SET_DEFAULT_KANBAN}
                    columns={resolveCrudSetDemoColumns(config)}
                    fieldOptions={DEMO_DATASET_FIELDS}
                    onChange={(kanban) => setConfig((current) => ({ ...current, kanban }))}
                    fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                    selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  />
                ) : null}
                {config.listBody === 'map' ? (
                  <p className="text-[11px] leading-snug text-slate-500">Pins use latitude and longitude on each record.</p>
                ) : null}
                {config.listBody === 'grid' || config.listBody === 'tree-grid' ? (
                <CrudSetGridFields
                  grid={config.grid ?? CRUD_SET_DEFAULT_GRID}
                  actions={config.actions ?? CRUD_SET_DEFAULT_ACTIONS}
                  listBody={config.listBody}
                  onGridChange={(grid) => setConfig((current) => ({ ...current, grid }))}
                  onActionsChange={(actions) => setConfig((current) => ({ ...current, actions }))}
                  fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                />
                ) : null}
                <FormField label="State" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.displayState}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      displayState: event.target.value as CrudSetDisplayState,
                    }))}
                    ariaLabel="CRUD Set display state"
                  >
                    <option value="default">default</option>
                    <option value="empty">empty</option>
                    <option value="loading">loading</option>
                    <option value="error">error</option>
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>

            <BaseComponentsCrudSetPagingFields
              listBody={config.listBody}
              pagination={config.pagination}
              paging={config.paging ?? CRUD_SET_DEFAULT_PAGING}
              sorting={config.sorting ?? CRUD_SET_DEFAULT_SORTING}
              columns={visibleColumns}
              onPaginationChange={(enabled) => setConfig((current) => ({ ...current, pagination: enabled }))}
              onPagingChange={(paging) => setConfig((current) => ({ ...current, paging }))}
              onSortingChange={(sorting) => setConfig((current) => ({ ...current, sorting }))}
            />

            <FormSection title="Columns" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <CrudSetColumnList
                  columns={visibleColumns}
                  enableColumnLayout={config.grid?.enableColumnLayout === true}
                  fieldOptions={[...DEMO_DATASET_FIELDS]}
                  suggestedFields={DEMO_DATASET_FIELDS}
                  fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  onChange={updateVisibleColumns}
                />
              </div>
            </FormSection>

            <FormSection title="Dialogs" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <CrudSetDialogFields
                  dialogs={config.dialogs ?? CRUD_SET_DEFAULT_DIALOGS}
                  onChange={(dialogs) => setConfig((current) => ({ ...current, dialogs }))}
                  fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                />
              </div>
            </FormSection>

            <BaseComponentsCrudSetToolbarFields
              filterBar={config.filterBar}
              onFilterBarChange={(filterBar) => setConfig((current) => ({ ...current, filterBar }))}
              exportEnabled={config.exportEnabled}
              exportFormats={config.exportFormats ?? CRUD_SET_EXPORT_FORMATS}
              exportFormat={config.exportFormat}
              refreshEnabled={config.refreshEnabled !== false}
              onExportEnabledChange={(exportEnabled) => setConfig((current) => ({ ...current, exportEnabled }))}
              onExportFormatsChange={(exportFormats) => setConfig((current) => ({ ...current, exportFormats }))}
              onExportFormatChange={(exportFormat) => setConfig((current) => ({ ...current, exportFormat }))}
              onRefreshEnabledChange={(refreshEnabled) => setConfig((current) => ({ ...current, refreshEnabled }))}
              fieldOptions={[...DEMO_DATASET_FIELDS]}
              onAddFilter={() => {
                const used = new Set((config.filterBar.filters ?? []).map((item) => item.field));
                const field = visibleColumns.find((column) => !used.has(column.field))?.field ?? 'status';
                const next: CrudSetFilterBarFilter = {
                  id: `filter_${Date.now().toString(36)}`,
                  field,
                  label: field === 'status' ? 'Status' : field,
                  controlType: field === 'status' ? 'radio-group' : 'select',
                  options: field === 'status'
                    ? STATUSES.map((status) => ({ value: status, label: status }))
                    : [],
                };
                setConfig((current) => ({
                  ...current,
                  filterBar: {
                    ...current.filterBar,
                    filters: [...(current.filterBar.filters ?? []), next],
                  },
                }));
              }}
            />

            <FormSection title="Records chrome" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <p className="text-xs text-slate-500">
                  Extra CRUD Set pieces that cover Records-page gaps: adjacent creates,
                  create wizard, auto-refresh, collection clear, and a view row action.
                </p>
                <FormField label="Create layout" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.createLayout}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      createLayout: event.target.value === 'adjacent' ? 'adjacent' : 'split',
                    }))}
                    ariaLabel="CRUD Set create layout"
                  >
                    {CRUD_SET_CREATE_LAYOUTS.map((layout) => (
                      <option key={layout} value={layout}>{CRUD_SET_CREATE_LAYOUT_LABELS[layout]}</option>
                    ))}
                  </UiSelect>
                </FormField>
                <CrudSetConfigCheckbox
                  label="Create wizard"
                  checked={config.createWizard}
                  fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  onChange={(checked) => setConfig((current) => ({ ...current, createWizard: checked }))}
                />
                <CrudSetConfigCheckbox
                  label="Auto-refresh"
                  checked={config.autoRefreshEnabled}
                  fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  onChange={(checked) => setConfig((current) => ({ ...current, autoRefreshEnabled: checked }))}
                />
                <CrudSetConfigCheckbox
                  label="Clear all"
                  checked={config.collectionClearEnabled}
                  fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  onChange={(checked) => setConfig((current) => ({ ...current, collectionClearEnabled: checked }))}
                />
                <CrudSetConfigCheckbox
                  label="View row action"
                  checked={config.rowViewEnabled}
                  fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                  selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                  onChange={(checked) => setConfig((current) => ({ ...current, rowViewEnabled: checked }))}
                />
                <FormField label="View body" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.dialogs.viewKind ?? 'record-form'}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      dialogs: {
                        ...current.dialogs,
                        viewKind: (['record-form', 'json', 'thread'] as const).includes(
                          event.target.value as CrudSetViewKind,
                        )
                          ? event.target.value as CrudSetViewKind
                          : 'record-form',
                      },
                    }))}
                    ariaLabel="CRUD Set view body"
                  >
                    {CRUD_SET_VIEW_KINDS.map((kind) => (
                      <option key={kind} value={kind}>{CRUD_SET_VIEW_KIND_LABELS[kind]}</option>
                    ))}
                  </UiSelect>
                </FormField>
              </div>
            </FormSection>

            <FormSection title="Relations" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <p className="text-xs text-slate-500">
                  Every relation kind is on the list and in create/edit: parent (self-tree),
                  belongsTo status/owner, hasOne detail (city + note), hasMany comments,
                  belongsToMany tags. Turn a kind off to omit its include, column, and form fields.
                </p>
                {SAMPLE_MOCK_RELATION_KINDS.map((kind) => (
                  <CrudSetConfigCheckbox
                    key={kind}
                    label={SAMPLE_MOCK_RELATION_LABELS[kind]}
                    checked={(config.relations ?? ALL_SAMPLE_MOCK_RELATIONS_ON)[kind]}
                    fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                    selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    onChange={(checked) => setConfig((current) => ({
                      ...current,
                      relations: {
                        ...(current.relations ?? ALL_SAMPLE_MOCK_RELATIONS_ON),
                        [kind]: checked,
                      },
                    }))}
                  />
                ))}
              </div>
            </FormSection>

            <FormSection title="APIs" tone={BASE_COMPONENTS_CONFIG_SECTION_TONE}>
              <div className={BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS}>
                <FormField
                  label="List"
                  hint="Required. Fills, searches, and filters the grid."
                  className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                >
                  <p className="font-mono text-xs text-slate-700">{CRUD_SET_DEMO_LIST_API.endpointId}</p>
                  <p className="text-xs text-slate-500">{CRUD_SET_DEMO_LIST_API.label}</p>
                </FormField>
                <FormField
                  label="Read-one"
                  hint="Required when a form patch or delete is on. Boolean-toggle does not use it."
                  className={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                >
                  <p className="font-mono text-xs text-slate-700">{CRUD_SET_DEMO_READ_ONE_API.endpointId}</p>
                  <p className="text-xs text-slate-500">
                    {spec.readOneApi ? 'Bound — form patch or delete is on.' : 'Omitted — no form patch or delete.'}
                  </p>
                </FormField>
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Creates</p>
                <p className="text-xs text-slate-500">
                  None omits create chrome. One is a labeled Create button. Two or more become a dropdown.
                </p>
                {CRUD_SET_DEMO_CREATE_APIS.map((mock) => {
                  const included = spec.createApis.some((create) => create.id === mock.id);
                  return (
                    <AppSurfaceBox key={mock.id} className="flex flex-col gap-2 p-2">
                      <CrudSetConfigCheckbox
                        label={mock.label}
                        checked={included}
                        fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                        selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        onChange={(checked) => toggleDemoCreate(mock.id, checked)}
                      />
                      <p className="font-mono text-[11px] text-slate-600">{mock.endpointId}</p>
                      <p className="text-[11px] text-slate-500">
                        {mock.purpose}. Fields: {mock.acceptedFields.join(', ')}.
                        Stamps createdAt, createdBy, updatedAt, and updatedBy.
                      </p>
                    </AppSurfaceBox>
                  );
                })}
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Patches</p>
                <p className="text-xs text-slate-500">
                  Include a patch to see it. Open from the actions column, or from another grid column.
                  Boolean-toggle stays on the actions column.
                </p>
                {CRUD_SET_DEMO_PATCH_APIS.map((mock) => {
                  const included = spec.patches.find((patch) => patch.id === mock.id);
                  const toggle = isBooleanTogglePatch(mock);
                  return (
                    <AppSurfaceBox key={mock.id} className="flex flex-col gap-2 p-2">
                      <CrudSetConfigCheckbox
                        label={mock.label}
                        checked={Boolean(included)}
                        fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
                        selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                        onChange={(checked) => toggleDemoPatch(mock.id, checked)}
                      />
                      <p className="font-mono text-[11px] text-slate-600">{mock.endpointId}</p>
                      <p className="text-[11px] text-slate-500">
                        {mock.kind === 'content' ? 'Content edit' : 'Purpose'}
                        {toggle ? ' · boolean toggle' : ' · form'}
                        . Fields: {mock.acceptedFields.join(', ')}.
                        {mock.id === 'lock'
                          ? ' Stamps lockedAt/lockedBy or unlockedAt/unlockedBy, plus updatedAt/updatedBy.'
                          : mock.id === 'approve'
                            ? ' Stamps approvedAt/approvedBy and updatedAt/updatedBy.'
                            : ' Stamps updatedAt/updatedBy.'}
                      </p>
                      {included && !toggle ? (
                        <FormField label="Open from" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                          <UiSelect
                            size="sm"
                            className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                            value={
                              included.openFromColumnId === CRUD_SET_PATCH_OPEN_FROM_ACTIONS
                                ? CRUD_SET_PATCH_OPEN_FROM_ACTIONS
                                : (included.openFromColumnId ?? '')
                            }
                            onChange={(event) => updateDemoPatch(mock.id, {
                              openFromColumnId: event.target.value === CRUD_SET_PATCH_OPEN_FROM_ACTIONS
                                ? CRUD_SET_PATCH_OPEN_FROM_ACTIONS
                                : (event.target.value.trim() || undefined),
                            })}
                            ariaLabel={`Open ${mock.label} from`}
                          >
                            <option value="">Auto (title / display / id)</option>
                            <option value={CRUD_SET_PATCH_OPEN_FROM_ACTIONS}>Actions column</option>
                            {visibleColumns.map((column) => (
                              <option key={crudSetColumnId(column)} value={crudSetColumnId(column)}>
                                {crudSetColumnLabel(column)} column
                              </option>
                            ))}
                          </UiSelect>
                        </FormField>
                      ) : null}
                      {included && toggle ? (
                        <FormField label="Toggle confirm" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                          <UiSelect
                            size="sm"
                            className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                            value={included.toggleConfirm ? 'on' : 'off'}
                            onChange={(event) => updateDemoPatch(mock.id, {
                              toggleConfirm: event.target.value === 'on',
                            })}
                            ariaLabel={`${mock.label} toggle confirm`}
                          >
                            <option value="off">apply on click</option>
                            <option value="on">confirm first</option>
                          </UiSelect>
                        </FormField>
                      ) : null}
                    </AppSurfaceBox>
                  );
                })}
                <FormField label="Delete" className={BASE_COMPONENTS_CONFIG_FIELD_CLASS} reserveHintSlot={false}>
                  <UiSelect
                    size="sm"
                    className={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
                    value={config.deleteEnabled ? 'on' : 'off'}
                    onChange={(event) => setConfig((current) => ({
                      ...current,
                      deleteEnabled: event.target.value === 'on',
                    }))}
                    ariaLabel="CRUD Set delete"
                  >
                    <option value="on">on</option>
                    <option value="off">off</option>
                  </UiSelect>
                </FormField>
                <p className="font-mono text-[11px] text-slate-600">{CRUD_SET_DEMO_DELETE_API.endpointId}</p>
              </div>
            </FormSection>
          </BaseComponentsConfigAccordion>
        </div>

        <BaseComponentsPreviewFrame sectionId="crud-set" fill>
          <div className="flex h-full min-h-0 flex-1 flex-col">
            <CrudSet
              spec={spec}
              rows={previewRows}
              changeReasonPolicy={changeReasonPolicy}
              contained
              isLoading={config.displayState === 'loading'}
              isError={config.displayState === 'error'}
              errorMessage="Could not load sample mock records."
              onRefresh={() => { void loadRows(); }}
              currentRowKey="order-1"
              onHostAction={async (action, row) => {
                showAppFeedbackToast(`${action.label}: ${String(row.title ?? row.id)}`, { type: 'success' });
              }}
              onCollectionAction={async (action) => {
                if (action.id === 'clear-all') {
                  setRows([]);
                }
              }}
              onFetchExportRows={async (query) => {
                const items = await fetchSampleMockRecords(includeKey);
                return applyCrudSetExportQuery(items as CrudSetRow[], spec, query);
              }}
              onCreate={async (create, values) => {
                try {
                  if (create.id === 'add-bulk') {
                    await createSampleMockRecordsBulk({ title: values.title });
                  } else {
                    await createSampleMockRecord(values);
                  }
                  await loadRows();
                } catch (error) {
                  if (!isSampleMockDemoFallback(error)) {
                    throw error;
                  }
                  const now = demoNowIso();
                  setRows((current) => [{
                    ...omitChangeReasonTransport(values),
                    id: `order-${Date.now()}`,
                    code: String(values.code || `ORD-${current.length + 1}`),
                    title: String(values.title || 'New order'),
                    status: typeof values.status === 'string' && values.status.trim() ? values.status : 'Open',
                    active: values.active !== false,
                    locked: false,
                    createdAt: now,
                    createdBy: DEMO_OPERATOR,
                    updatedAt: now,
                    updatedBy: DEMO_OPERATOR,
                    photo: demoPhoto(current.length),
                    __depth: config.listBody === 'tree-grid' ? 0 : undefined,
                  }, ...current]);
                }
              }}
              onPatch={async (patch, row, values) => {
                const key = String(row.id ?? '');
                try {
                  if (patch.id === 'lock') {
                    await lockSampleMockRecord(key, {
                      locked: values.locked,
                      ...pickChangeReasonPayload(values),
                    });
                  } else if (patch.id === 'approve') {
                    await approveSampleMockRecord(key, {
                      status: values.status,
                      ...pickChangeReasonPayload(values),
                    });
                  } else {
                    await patchSampleMockRecord(key, values);
                  }
                  await loadRows();
                } catch (error) {
                  if (!isSampleMockDemoFallback(error)) {
                    throw error;
                  }
                  const now = demoNowIso();
                  const rowValues = omitChangeReasonTransport(values);
                  const nextLocked = Object.prototype.hasOwnProperty.call(rowValues, 'locked')
                    ? Boolean(rowValues.locked)
                    : Boolean(row.locked);
                  const nextStatus = typeof rowValues.status === 'string' ? rowValues.status : String(row.status ?? '');
                  const lockAudit = patch.id === 'lock' || Object.prototype.hasOwnProperty.call(rowValues, 'locked')
                    ? (nextLocked
                      ? { lockedAt: now, lockedBy: DEMO_OPERATOR, unlockedAt: undefined, unlockedBy: undefined }
                      : { unlockedAt: now, unlockedBy: DEMO_OPERATOR })
                    : {};
                  const approveAudit = nextStatus === 'Approved' || nextStatus === 'Shipped'
                    ? { approvedAt: now, approvedBy: DEMO_OPERATOR }
                    : {};
                  setRows((current) => current.map((entry) => (
                    String(entry.id ?? '') === key
                      ? {
                        ...entry,
                        ...rowValues,
                        ...lockAudit,
                        ...approveAudit,
                        updatedAt: now,
                        updatedBy: DEMO_OPERATOR,
                      }
                      : entry
                  )));
                }
              }}
              onDelete={async (row, values) => {
                const key = String(row.id ?? '');
                try {
                  await deleteSampleMockRecord(key, values);
                  await loadRows();
                } catch (error) {
                  if (!isSampleMockDemoFallback(error)) {
                    throw error;
                  }
                  setRows((current) => current.filter((entry) => String(entry.id ?? '') !== key));
                }
              }}
            />
          </div>
        </BaseComponentsPreviewFrame>
      </div>
    </div>
  );
};
