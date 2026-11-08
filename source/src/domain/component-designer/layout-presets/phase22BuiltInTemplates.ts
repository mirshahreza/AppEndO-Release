/**
 * Phase 22 — new high-value built-in layout presets (CRUD, 404/error, advanced search).
 * Level-1 style: explicit paletteItemId on every node, binding-ready stubs, no dead Inspector fields.
 */
import {
  createDynamicAction,
  createDynamicActionsEventBindingDefinition,
} from '../bindingDynamicActionsEngine';
import {
  DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS,
  DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON,
  serializeDesignerDataGridColumns,
} from '../designerDataGridColumns';
import { createActionGroupColumn } from '../designerGridActionColumns';
import {
  DEFAULT_GRID_TOOLBAR_PRESET,
  serializeDesignerGridToolbarConfig,
} from '../designerGridToolbarConfig';
import {
  SHELL_ERROR_PAGE_TEMPLATE,
  SHELL_NOT_FOUND_PAGE_TEMPLATE,
} from '../shellChromeTemplates';
import type { TemplateNodeSeed } from '../types';
import type { NewLayoutPresetId } from './types';

const btnSm = 'inline-flex rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground no-underline hover:opacity-90';
const btnOutline = 'inline-flex rounded-md border border-default-300 px-3 py-1.5 text-xs font-semibold text-default-700 no-underline hover:bg-default-50';
const card = 'rounded-xl border border-default-200 bg-content1 p-4 shadow-sm';

const bindingReadySubmit = {
  'event:onSubmit': {
    sourceType: 'apiRef' as const,
  },
};

const bindingReadyGridList = {
  gridListResource: {
    sourceType: 'apiRef' as const,
    loadOperation: 'list' as const,
  },
};

const templates: Partial<Record<NewLayoutPresetId, TemplateNodeSeed[]>> = {};
const add = (key: NewLayoutPresetId, value: TemplateNodeSeed[]) => {
  templates[key] = value;
};

/** Shared Create/Edit record form body (name + status fields) — reused for both modals below. */
const buildCrudRecordFormFields = (): TemplateNodeSeed[] => [
  {
    type: 'container',
    paletteItemId: 'heroui.input-text',
    props: {
      name: 'name',
      label: 'Name',
      placeholder: 'Name',
      hint: 'Required. Enter the record name.',
      ariaLabel: 'Name',
      size: 'sm',
      isRequired: true,
    },
  },
  {
    type: 'container',
    paletteItemId: 'heroui.select',
    props: {
      name: 'status',
      label: 'Status',
      placeholder: 'Status',
      hint: 'Choose status from the available options.',
      ariaLabel: 'Status',
      size: 'sm',
      items: '[{"id":"active","textValue":"Active"},{"id":"inactive","textValue":"Inactive"}]',
    },
  },
];

/**
 * Row-actions column (Edit + Delete) reusing the same `createActionGroupColumn` helper Phase 19/20
 * use for real generated grids. `behavior` is intentionally left unset (kind: 'none' equivalent) —
 * a hand-authored static template cannot pre-reference a sibling modal's future runtime node id
 * — wire each action to the Edit/Delete overlay below via the Binding Inspector's row
 * action editor once dropped on the canvas.
 */
const crudCollectionPageColumnsJson = serializeDesignerDataGridColumns([
  ...DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS,
  createActionGroupColumn(
    [
      { actionId: 'edit', icon: 'Pencil', intent: 'edit', tooltip: 'Edit' },
      { actionId: 'delete', icon: 'Trash2', intent: 'delete', tooltip: 'Delete' },
    ],
    { label: 'Actions' },
  ),
]);

/**
 * Delete confirm dialog body — reuses the exact dynamic-action chain
 * (`callMutation` delete + `refreshDataSource` + `showToast`) used by CRUD collection
 * templates, so this built-in's Delete flow is the same logic, not a re-derived copy.
 * `dataSourceRef` is a
 * placeholder id ('primaryRecordSource') — point it at a real data source in Binding Inspector.
 */
const buildCrudDeleteConfirmSeeds = (): TemplateNodeSeed[] => {
  const deleteMutation = createDynamicAction('callMutation');
  deleteMutation.dataSourceRef = 'primaryRecordSource';
  deleteMutation.mutationOperation = 'delete';
  deleteMutation.mutationRecordIdStorePath = 'selection.id';

  const refresh = createDynamicAction('refreshDataSource');
  refresh.dataSourceRef = 'primaryRecordSource';

  const toast = createDynamicAction('showToast');
  toast.toastTitle = 'Deleted';
  toast.toastVariant = 'success';

  return [
    {
      type: 'text',
      paletteItemId: 'html.text',
      props: { text: 'Delete this record? This cannot be undone.', className: 'text-sm text-amber-900' },
    },
    {
      type: 'container',
      paletteItemId: 'layout.flex-row',
      props: { className: 'mt-4 flex flex-row justify-end gap-2' },
      children: [
        {
          type: 'link',
          paletteItemId: 'heroui.button-outline',
          props: { text: 'Cancel', href: '#', target: '_self', rel: '', className: btnOutline },
        },
        {
          type: 'link',
          paletteItemId: 'heroui.button-solid',
          props: { text: 'Delete', href: '#', target: '_self', rel: '', className: btnSm },
          binding: {
            'event:onClick': createDynamicActionsEventBindingDefinition('onClick', [
              deleteMutation,
              refresh,
              toast,
            ]),
          },
        },
      ],
    },
  ];
};

/**
 * Binding-ready CRUD page scaffold — List + Create + Edit + Delete: an
 * `heroui.app-table-grid` with Edit/Delete row actions, a Create modal, an Edit modal, and a
 * Delete confirm dialog whose button chain reuses the same dynamic-action primitives
 * (`createDynamicAction`/`createDynamicActionsEventBindingDefinition`). Wire endpoints + row
 * action targets in the Binding Inspector.
 */
add('crud-collection-page', [{
  type: 'container',
  paletteItemId: 'html.section',
  props: { className: 'mx-auto flex w-full max-w-6xl flex-col gap-4' },
  children: [
    {
      type: 'container',
      paletteItemId: 'layout.flex-row',
      props: { className: 'flex flex-row flex-wrap items-end justify-between gap-3' },
      children: [
        {
          type: 'container',
          paletteItemId: 'layout.flex-column',
          props: { className: 'flex flex-col gap-1' },
          children: [
            {
              type: 'heading',
              paletteItemId: 'html.heading',
              props: { text: 'Records', className: 'text-2xl font-semibold tracking-tight text-foreground' },
            },
            {
              type: 'text',
              paletteItemId: 'html.text',
              props: {
                text: 'Binding-ready List + Create + Edit + Delete page — connect the grid, forms, and row actions to your collection API.',
                className: 'text-sm text-default-500',
              },
            },
          ],
        },
        {
          type: 'link',
          paletteItemId: 'heroui.button-solid',
          props: { text: 'Create record', href: '#', target: '_self', rel: '', className: btnSm },
        },
      ],
    },
    {
      type: 'container',
      paletteItemId: 'heroui.app-table-grid',
      props: {
        className: 'w-full min-h-0 rounded-lg border border-slate-200 bg-white p-3',
        columns: crudCollectionPageColumnsJson,
        gridQueryMode: 'server',
        pageSize: 50,
        page: 1,
        total: 0,
        presentation: 'auto',
        cardBelow: 'tablet',
        enableColumnLayout: true,
        showSortControls: true,
        showListModeControls: true,
        listMode: 'paging',
        rowKeyField: 'id',
        defaultSortBy: 'created_at',
        toolbarConfig: serializeDesignerGridToolbarConfig({
          ...DEFAULT_GRID_TOOLBAR_PRESET,
          create: { ...DEFAULT_GRID_TOOLBAR_PRESET.create, enabled: true, label: 'Create' },
          search: { ...DEFAULT_GRID_TOOLBAR_PRESET.search, enabled: true },
          refresh: { ...DEFAULT_GRID_TOOLBAR_PRESET.refresh, enabled: true },
        }),
        loadingMessage: 'Loading records…',
        emptyContent: 'No records found.',
        errorContent: 'Could not load records.',
      },
      binding: bindingReadyGridList,
    },
    {
      type: 'container',
      paletteItemId: 'heroui.modal',
      props: {
        title: 'Create record',
        className: 'w-full max-w-lg',
      },
      children: [
        {
          type: 'container',
          paletteItemId: 'html.form',
          props: { className: 'flex flex-col gap-3', method: 'post', action: '' },
          binding: bindingReadySubmit,
          children: [
            ...buildCrudRecordFormFields(),
            {
              type: 'container',
              paletteItemId: 'layout.flex-row',
              props: { className: 'mt-2 flex flex-row justify-end gap-2' },
              children: [
                {
                  type: 'link',
                  paletteItemId: 'heroui.button-outline',
                  props: { text: 'Cancel', href: '#', target: '_self', rel: '', className: btnOutline },
                },
                {
                  type: 'link',
                  paletteItemId: 'heroui.button-solid',
                  props: { text: 'Save', href: '#', target: '_self', rel: '', className: btnSm },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'container',
      paletteItemId: 'heroui.modal',
      props: {
        title: 'Edit record',
        className: 'w-full max-w-lg',
      },
      children: [
        {
          type: 'container',
          paletteItemId: 'html.form',
          props: { className: 'flex flex-col gap-3', method: 'post', action: '' },
          binding: bindingReadySubmit,
          children: [
            ...buildCrudRecordFormFields(),
            {
              type: 'container',
              paletteItemId: 'layout.flex-row',
              props: { className: 'mt-2 flex flex-row justify-end gap-2' },
              children: [
                {
                  type: 'link',
                  paletteItemId: 'heroui.button-outline',
                  props: { text: 'Cancel', href: '#', target: '_self', rel: '', className: btnOutline },
                },
                {
                  type: 'link',
                  paletteItemId: 'heroui.button-solid',
                  props: { text: 'Save changes', href: '#', target: '_self', rel: '', className: btnSm },
                },
              ],
            },
          ],
        },
      ],
    },
    {
      type: 'container',
      paletteItemId: 'heroui.alert-dialog',
      props: {
        title: 'Delete record?',
        className: 'w-full max-w-md',
      },
      children: buildCrudDeleteConfirmSeeds(),
    },
  ],
}]);

/** Branded 404 + error page pair using shell chrome templates (Phase 16 wiring). */
add('not-found-error-pages', [
  {
    type: 'container',
    paletteItemId: 'layout.flex-column',
    props: { className: 'mx-auto flex w-full max-w-5xl flex-col gap-6' },
    children: [
      {
        type: 'heading',
        paletteItemId: 'html.heading',
        props: {
          text: 'Error & Not Found Pages',
          className: 'text-2xl font-semibold tracking-tight text-foreground',
        },
      },
      {
        type: 'text',
        paletteItemId: 'html.text',
        props: {
          text: 'Drop these into a portal shell layout — shell.not-found connects to the live 404 route.',
          className: 'text-sm text-default-500',
        },
      },
      ...(SHELL_NOT_FOUND_PAGE_TEMPLATE as TemplateNodeSeed[]),
      ...(SHELL_ERROR_PAGE_TEMPLATE as TemplateNodeSeed[]),
    ],
  },
]);

/** Advanced search / filter strip + results grid. */
add('advanced-search-results', [{
  type: 'container',
  paletteItemId: 'html.section',
  props: { className: 'mx-auto flex w-full max-w-6xl flex-col gap-4' },
  children: [
    {
      type: 'heading',
      paletteItemId: 'html.heading',
      props: { text: 'Advanced Search', className: 'text-2xl font-semibold tracking-tight text-foreground' },
    },
    {
      type: 'container',
      paletteItemId: 'tailwind.card',
      props: { className: `${card} flex flex-col gap-3` },
      children: [
        {
          type: 'heading',
          paletteItemId: 'html.heading',
          props: { text: 'Filters', className: 'text-base font-semibold text-foreground' },
        },
        {
          type: 'container',
          paletteItemId: 'layout.grid-2',
          props: { className: 'grid grid-cols-1 gap-3 md:grid-cols-3' },
          children: [
            {
              type: 'container',
              paletteItemId: 'heroui.entity-picker',
              props: {
                label: 'Entity',
                placeholder: 'Select entity…',
                entityRef: '/api/entities',
                searchParam: 'search',
                returnField: 'id',
                displayField: 'label',
                className: 'w-full',
                size: 'sm',
              },
            },
            {
              type: 'container',
              paletteItemId: 'heroui.select',
              props: {
                label: 'Status',
                placeholder: 'Any status',
                name: 'status',
                ariaLabel: 'Status',
                size: 'sm',
                items: '[{"id":"any","textValue":"Any"},{"id":"active","textValue":"Active"},{"id":"archived","textValue":"Archived"}]',
              },
            },
            {
              type: 'container',
              paletteItemId: 'heroui.input-text',
              props: {
                label: 'Keyword',
                placeholder: 'Search…',
                name: 'q',
                ariaLabel: 'Keyword',
                size: 'sm',
              },
            },
          ],
        },
        {
          type: 'container',
          paletteItemId: 'layout.flex-row',
          props: { className: 'flex flex-row flex-wrap gap-2' },
          children: [
            {
              type: 'link',
              paletteItemId: 'heroui.button-solid',
              props: { text: 'Apply filters', href: '#', target: '_self', rel: '', className: btnSm },
            },
            {
              type: 'link',
              paletteItemId: 'heroui.button-outline',
              props: { text: 'Reset', href: '#', target: '_self', rel: '', className: btnOutline },
            },
          ],
        },
      ],
    },
    {
      type: 'container',
      paletteItemId: 'heroui.data-grid',
      props: {
        className: 'w-full min-h-0 rounded-lg border border-slate-200 bg-white p-3',
        columns: DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON,
        gridQueryMode: 'client',
        pageSize: 15,
        page: 1,
        total: 0,
      },
      binding: bindingReadyGridList,
    },
  ],
}]);

export const PHASE22_BUILT_IN_TEMPLATES = templates;

export const getPhase22BuiltInTemplate = (presetId: NewLayoutPresetId): TemplateNodeSeed[] =>
  PHASE22_BUILT_IN_TEMPLATES[presetId] ?? [];
