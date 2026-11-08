import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { InspectorCrudSetApiFields } from './InspectorCrudSetApiFields';
import {
  CRUD_SET_CREATE_LAYOUT_LABELS,
  CRUD_SET_SUGGESTED_COLUMN_FIELDS,
  CRUD_SET_CREATE_LAYOUTS,
  CRUD_SET_DEFAULT_ACTIONS,
  CRUD_SET_DEFAULT_DIALOGS,
  CRUD_SET_DEFAULT_GRID,
  CRUD_SET_DEFAULT_KANBAN,
  CRUD_SET_DEFAULT_PAGING,
  CRUD_SET_DEFAULT_SORTING,
  CRUD_SET_DEFAULT_SPEC,
  CRUD_SET_EXPORT_FORMAT_LABELS,
  CRUD_SET_EXPORT_FORMATS,
  CRUD_SET_LIST_BODY_KINDS,
  CRUD_SET_LIST_BODY_LABELS,
  CRUD_SET_VIEW_KIND_LABELS,
  CRUD_SET_VIEW_KINDS,
  migrateCrudSetSpecForKanbanBody,
  parseCrudSetListBody,
  parseCrudSetSpec,
  toggleCrudSetExportFormat,
  type CrudSetCreateLayout,
  type CrudSetExportFormat,
  type CrudSetFilterBarConfig,
  type CrudSetFilterBarFilter,
  type CrudSetSpec,
  type CrudSetViewKind,
} from '../../../domain/component-designer/crudSetSpec';
import type { DesignerAction, DesignerNode } from '../../../domain/component-designer/types';
import {
  AppButton,
  AppSurfaceBox,
  CrudSetColumnList,
  CrudSetConfigCheckbox,
  CrudSetDialogFields,
  CrudSetFilterBarFilterFields,
  CrudSetGridFields,
  CrudSetKanbanFields,
  CrudSetPagingFields,
  CrudSetSortingFields,
  FormField,
  FormFieldLayoutProvider,
  UiInput,
  UiSelect,
} from '../../../shared/ui';
import { cn } from '../../../lib/utils';
import { ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_DELETE_CLASS } from '../../../shared/ui/surfaceClasses';

export type InspectorLivingSection = {
  id: string;
  title: string;
  panel: React.ReactNode;
};

type InspectorCrudSetLivingFieldsProps = {
  node: DesignerNode;
  dispatch: React.Dispatch<DesignerAction>;
};

const FIELD_CLASS = 'min-w-0';
const SELECT_CLASS = 'w-full';
const STACK_CLASS = 'flex flex-col gap-2';
const GROUP_LABEL_CLASS = 'text-xs font-semibold uppercase tracking-wide text-slate-500';
const DEFAULT_FILTER_BAR: CrudSetFilterBarConfig = { enabled: true, search: true, filters: [] };

export const CRUD_SET_LIVING_SECTION_IDS = [
  'living-body',
  'living-paging',
  'living-columns',
  'living-dialogs',
  'living-toolbar',
  'living-records',
  'living-apis',
] as const;

const resolveSpec = (node: DesignerNode): CrudSetSpec =>
  parseCrudSetSpec(node.props.spec) ?? { ...CRUD_SET_DEFAULT_SPEC };

const wrapPanel = (panel: React.ReactNode): React.ReactNode => (
  <FormFieldLayoutProvider layout="side">{panel}</FormFieldLayoutProvider>
);

/**
 * Same living-sample sections as Base Components → CRUD Set.
 * Rendered as top-level Properties accordion items — not nested under Content.
 */
export const buildInspectorCrudSetLivingSections = (
  node: DesignerNode,
  dispatch: React.Dispatch<DesignerAction>,
): InspectorLivingSection[] => {
  const spec = resolveSpec(node);
  const listBody = spec.listBody;
  const pagedBody = listBody === 'grid' || listBody === 'kanban';
  const pagination = spec.pagination !== false;
  const paging = spec.paging ?? CRUD_SET_DEFAULT_PAGING;
  const sorting = spec.sorting ?? CRUD_SET_DEFAULT_SORTING;
  const grid = spec.grid ?? CRUD_SET_DEFAULT_GRID;
  const actions = spec.actions ?? CRUD_SET_DEFAULT_ACTIONS;
  const dialogs = spec.dialogs ?? CRUD_SET_DEFAULT_DIALOGS;
  const filterBar = spec.filterBar ?? DEFAULT_FILTER_BAR;
  const exportEnabled = spec.export?.enabled !== false;
  const exportFormats = spec.export?.formats?.length
    ? spec.export.formats
    : [...CRUD_SET_EXPORT_FORMATS];
  const exportFormat: CrudSetExportFormat = (
    spec.export?.defaultFormat && exportFormats.includes(spec.export.defaultFormat)
      ? spec.export.defaultFormat
      : (exportFormats[0] ?? 'xlsx')
  );
  const fieldOptions = spec.columns.map((column) => column.field).filter(Boolean);
  const createLayout: CrudSetCreateLayout = spec.createLayout === 'adjacent' ? 'adjacent' : 'split';
  const createWizard = spec.createApis.some((create) => (create.steps?.length ?? 0) >= 2);
  const autoRefresh = spec.autoRefresh?.enabled === true;
  const collectionClear = (spec.collectionActions ?? []).some((action) => action.id === 'clear-all');
  const rowView = (spec.rowActions ?? []).some((action) => action.interaction === 'view');
  const viewKind: CrudSetViewKind = spec.dialogs?.viewKind && CRUD_SET_VIEW_KINDS.includes(spec.dialogs.viewKind)
    ? spec.dialogs.viewKind
    : 'record-form';

  const writeSpec = (next: CrudSetSpec) => {
    dispatch({ type: 'set-node-prop', nodeId: node.id, key: 'spec', value: next });
  };

  return [
    {
      id: 'living-body',
      title: 'Body',
      panel: wrapPanel(
        <div className={STACK_CLASS}>
          <FormField label="Widget" className={FIELD_CLASS} reserveHintSlot={false}>
            <UiSelect
              size="sm"
              className={SELECT_CLASS}
              value={listBody}
              onChange={(event) => {
                const nextBody = parseCrudSetListBody(event.target.value);
                const next: CrudSetSpec = {
                  ...spec,
                  listBody: nextBody,
                  ...(nextBody === 'kanban' && !spec.pagination ? { pagination: true } : {}),
                };
                if (nextBody === 'kanban') {
                  const migrated = migrateCrudSetSpecForKanbanBody({
                    kanban: spec.kanban ?? { ...CRUD_SET_DEFAULT_KANBAN },
                    filterBar: spec.filterBar ?? DEFAULT_FILTER_BAR,
                  });
                  writeSpec({
                    ...next,
                    kanban: migrated.kanban ?? spec.kanban,
                    filterBar: migrated.filterBar ?? spec.filterBar,
                  });
                  return;
                }
                writeSpec(next);
              }}
              ariaLabel="CRUD Set widget"
            >
              {CRUD_SET_LIST_BODY_KINDS.map((kind) => (
                <option key={kind} value={kind}>{CRUD_SET_LIST_BODY_LABELS[kind]}</option>
              ))}
            </UiSelect>
          </FormField>
          {listBody === 'kanban' ? (
            <CrudSetKanbanFields
              kanban={spec.kanban ?? CRUD_SET_DEFAULT_KANBAN}
              columns={spec.columns}
              fieldOptions={fieldOptions}
              onChange={(kanban) => writeSpec({ ...spec, kanban })}
              fieldClassName={FIELD_CLASS}
              selectClassName={SELECT_CLASS}
            />
          ) : null}
          {listBody === 'map' ? (
            <p className="text-[11px] leading-snug text-slate-500">
              Pins use latitude and longitude on each record.
            </p>
          ) : null}
          {listBody === 'grid' || listBody === 'tree-grid' ? (
            <CrudSetGridFields
              grid={grid}
              actions={actions}
              listBody={listBody}
              onGridChange={(nextGrid) => writeSpec({ ...spec, grid: nextGrid })}
              onActionsChange={(nextActions) => writeSpec({ ...spec, actions: nextActions })}
              fieldClassName={FIELD_CLASS}
              selectClassName={SELECT_CLASS}
            />
          ) : null}
        </div>,
      ),
    },
    {
      id: 'living-paging',
      title: 'Paging',
      panel: wrapPanel(
        <div className={STACK_CLASS}>
          {pagedBody ? (
            <>
              <FormField label="Paging" className={FIELD_CLASS} reserveHintSlot={false}>
                <UiSelect
                  size="sm"
                  className={SELECT_CLASS}
                  value={pagination ? 'on' : 'off'}
                  onChange={(event) => writeSpec({ ...spec, pagination: event.target.value === 'on' })}
                  ariaLabel="CRUD Set paging"
                >
                  <option value="on">on</option>
                  <option value="off">off</option>
                </UiSelect>
              </FormField>
              {pagination ? (
                <CrudSetPagingFields
                  paging={paging}
                  onChange={(nextPaging) => writeSpec({ ...spec, paging: nextPaging })}
                  footerSort={{
                    enabled: sorting.footer !== false,
                    onChange: (checked) => writeSpec({ ...spec, sorting: { ...sorting, footer: checked } }),
                  }}
                  fieldClassName={FIELD_CLASS}
                  selectClassName={SELECT_CLASS}
                />
              ) : (
                <p className="text-[11px] leading-snug text-slate-500">
                  Off shows the full queried set with no paging footer.
                </p>
              )}
            </>
          ) : (
            <p className="text-[11px] leading-snug text-slate-500">
              {listBody === 'tree-grid' ? 'Tree-grid is never paged.' : 'Map is never paged.'}
            </p>
          )}
          <CrudSetSortingFields
            sorting={sorting}
            columns={spec.columns}
            showFooter={pagedBody && pagination}
            onChange={(nextSorting) => writeSpec({ ...spec, sorting: nextSorting })}
            fieldClassName={FIELD_CLASS}
            selectClassName={SELECT_CLASS}
          />
        </div>,
      ),
    },
    {
      id: 'living-columns',
      title: 'Columns',
      panel: wrapPanel(
        <CrudSetColumnList
          columns={spec.columns}
          enableColumnLayout={grid.enableColumnLayout === true}
          fieldClassName={FIELD_CLASS}
          suggestedFields={CRUD_SET_SUGGESTED_COLUMN_FIELDS}
          onChange={(columns) => writeSpec({ ...spec, columns })}
        />,
      ),
    },
    {
      id: 'living-dialogs',
      title: 'Dialogs',
      panel: wrapPanel(
        <div className={STACK_CLASS}>
          <CrudSetDialogFields
            dialogs={dialogs}
            onChange={(nextDialogs) => writeSpec({ ...spec, dialogs: nextDialogs })}
            fieldClassName={FIELD_CLASS}
            selectClassName={SELECT_CLASS}
          />
        </div>,
      ),
    },
    {
      id: 'living-toolbar',
      title: 'Toolbar',
      panel: wrapPanel(
        <div className={STACK_CLASS}>
          <p className={GROUP_LABEL_CLASS}>Filter bar</p>
          <FormField label="Include" className={FIELD_CLASS} reserveHintSlot={false}>
            <UiSelect
              size="sm"
              className={SELECT_CLASS}
              value={filterBar.enabled !== false ? 'on' : 'off'}
              onChange={(event) => writeSpec({
                ...spec,
                filterBar: { ...filterBar, enabled: event.target.value === 'on' },
              })}
              ariaLabel="CRUD Set filter bar"
            >
              <option value="on">on</option>
              <option value="off">off</option>
            </UiSelect>
          </FormField>
          {filterBar.enabled !== false ? (
            <>
              <CrudSetConfigCheckbox
                label="Search"
                checked={filterBar.search !== false}
                fieldClassName={FIELD_CLASS}
                selectClassName={SELECT_CLASS}
                onChange={(checked) => writeSpec({
                  ...spec,
                  filterBar: { ...filterBar, search: checked },
                })}
              />
              {filterBar.search !== false ? (
                <CrudSetConfigCheckbox
                  label="Search clear"
                  checked={filterBar.searchClear !== false}
                  fieldClassName={FIELD_CLASS}
                  selectClassName={SELECT_CLASS}
                  onChange={(checked) => writeSpec({
                    ...spec,
                    filterBar: { ...filterBar, searchClear: checked },
                  })}
                />
              ) : null}
              <FormField label="Search placeholder" className={FIELD_CLASS} reserveHintSlot={false}>
                <UiInput
                  size="sm"
                  autoDir={false}
                  className={SELECT_CLASS}
                  value={filterBar.searchPlaceholder ?? ''}
                  onChange={(event) => writeSpec({
                    ...spec,
                    filterBar: { ...filterBar, searchPlaceholder: event.target.value },
                  })}
                  ariaLabel="CRUD Set search placeholder"
                />
              </FormField>
              {(filterBar.filters ?? []).map((filter, index) => (
                <AppSurfaceBox key={filter.id} className="flex flex-col gap-2 p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className={GROUP_LABEL_CLASS}>Filter {index + 1}</span>
                    <AppButton
                      type="button"
                      size="icon-sm"
                      className={cn(ICON_ACTION_BUTTON_BASE_CLASS, ICON_ACTION_DELETE_CLASS)}
                      aria-label={`Remove filter ${index + 1}`}
                      onClick={() => writeSpec({
                        ...spec,
                        filterBar: {
                          ...filterBar,
                          filters: (filterBar.filters ?? []).filter((item) => item.id !== filter.id),
                        },
                      })}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </AppButton>
                  </div>
                  <CrudSetFilterBarFilterFields
                    filter={filter}
                    fieldClassName={FIELD_CLASS}
                    fieldOptions={fieldOptions}
                    onChange={(next) => writeSpec({
                      ...spec,
                      filterBar: {
                        ...filterBar,
                        filters: (filterBar.filters ?? []).map((item) => (
                          item.id === filter.id ? next : item
                        )),
                      },
                    })}
                  />
                </AppSurfaceBox>
              ))}
              <AppButton
                size="sm"
                intent="utility"
                onClick={() => {
                  const used = new Set((filterBar.filters ?? []).map((item) => item.field));
                  const field = spec.columns.find((column) => !used.has(column.field))?.field ?? 'status';
                  const next: CrudSetFilterBarFilter = {
                    id: `filter_${Date.now().toString(36)}`,
                    field,
                    label: field,
                    controlType: 'select',
                    options: [],
                  };
                  writeSpec({
                    ...spec,
                    filterBar: { ...filterBar, filters: [...(filterBar.filters ?? []), next] },
                  });
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                Add toolbar filter
              </AppButton>
            </>
          ) : null}

          <p className={GROUP_LABEL_CLASS}>Actions</p>
          <FormField label="Export" className={FIELD_CLASS} reserveHintSlot={false}>
            <UiSelect
              size="sm"
              className={SELECT_CLASS}
              value={exportEnabled ? 'on' : 'off'}
              onChange={(event) => writeSpec({
                ...spec,
                export: {
                  enabled: event.target.value === 'on',
                  formats: exportFormats,
                  defaultFormat: exportFormat,
                  defaultIncludeHeader: spec.export?.defaultIncludeHeader !== false,
                },
              })}
              ariaLabel="CRUD Set export"
            >
              <option value="on">on</option>
              <option value="off">off</option>
            </UiSelect>
          </FormField>
          <CrudSetConfigCheckbox
            label="Refresh"
            checked={spec.refresh !== false}
            fieldClassName={FIELD_CLASS}
            selectClassName={SELECT_CLASS}
            onChange={(checked) => writeSpec({ ...spec, refresh: checked })}
          />
          {exportEnabled ? (
            CRUD_SET_EXPORT_FORMATS.map((format) => (
              <CrudSetConfigCheckbox
                key={format}
                label={CRUD_SET_EXPORT_FORMAT_LABELS[format]}
                checked={exportFormats.includes(format)}
                fieldClassName={FIELD_CLASS}
                selectClassName={SELECT_CLASS}
                onChange={(checked) => {
                  const nextFormats = toggleCrudSetExportFormat([...exportFormats], format, checked);
                  writeSpec({
                    ...spec,
                    export: {
                      enabled: true,
                      formats: nextFormats,
                      defaultFormat: nextFormats.includes(exportFormat)
                        ? exportFormat
                        : (nextFormats[0] ?? 'xlsx'),
                      defaultIncludeHeader: spec.export?.defaultIncludeHeader !== false,
                    },
                  });
                }}
              />
            ))
          ) : null}
        </div>,
      ),
    },
    {
      id: 'living-records',
      title: 'Records chrome',
      panel: wrapPanel(
        <div className={STACK_CLASS}>
          <FormField label="Create layout" className={FIELD_CLASS} reserveHintSlot={false}>
            <UiSelect
              size="sm"
              className={SELECT_CLASS}
              value={createLayout}
              onChange={(event) => writeSpec({
                ...spec,
                createLayout: event.target.value === 'adjacent' ? 'adjacent' : 'split',
              })}
              ariaLabel="CRUD Set create layout"
            >
              {CRUD_SET_CREATE_LAYOUTS.map((layout) => (
                <option key={layout} value={layout}>{CRUD_SET_CREATE_LAYOUT_LABELS[layout]}</option>
              ))}
            </UiSelect>
          </FormField>
          <CrudSetConfigCheckbox
            label="Create wizard"
            checked={createWizard}
            fieldClassName={FIELD_CLASS}
            selectClassName={SELECT_CLASS}
            onChange={(checked) => writeSpec({
              ...spec,
              createApis: spec.createApis.map((create, index) => (
                index === 0
                  ? {
                    ...create,
                    steps: checked
                      ? [
                        { title: 'Identity', acceptedFields: create.acceptedFields.slice(0, 2) },
                        { title: 'Details', acceptedFields: create.acceptedFields.slice(2) },
                      ].filter((step) => step.acceptedFields.length > 0)
                      : undefined,
                  }
                  : create
              )),
            })}
          />
          <CrudSetConfigCheckbox
            label="Auto-refresh"
            checked={autoRefresh}
            fieldClassName={FIELD_CLASS}
            selectClassName={SELECT_CLASS}
            onChange={(checked) => writeSpec({
              ...spec,
              autoRefresh: checked ? { enabled: true, seconds: spec.autoRefresh?.seconds ?? 5 } : undefined,
            })}
          />
          <CrudSetConfigCheckbox
            label="Clear all"
            checked={collectionClear}
            fieldClassName={FIELD_CLASS}
            selectClassName={SELECT_CLASS}
            onChange={(checked) => writeSpec({
              ...spec,
              collectionActions: checked
                ? [{ id: 'clear-all', label: 'Clear all', intent: 'destructive-soft', confirm: true }]
                : undefined,
            })}
          />
          <CrudSetConfigCheckbox
            label="View row action"
            checked={rowView}
            fieldClassName={FIELD_CLASS}
            selectClassName={SELECT_CLASS}
            onChange={(checked) => writeSpec({
              ...spec,
              rowActions: checked
                ? [{ id: 'view', label: 'View', interaction: 'view', intent: 'view' }]
                : undefined,
            })}
          />
          <FormField label="View body" className={FIELD_CLASS} reserveHintSlot={false}>
            <UiSelect
              size="sm"
              className={SELECT_CLASS}
              value={viewKind}
              onChange={(event) => writeSpec({
                ...spec,
                dialogs: {
                  ...dialogs,
                  viewKind: CRUD_SET_VIEW_KINDS.includes(event.target.value as CrudSetViewKind)
                    ? event.target.value as CrudSetViewKind
                    : 'record-form',
                },
              })}
              ariaLabel="CRUD Set view body"
            >
              {CRUD_SET_VIEW_KINDS.map((kind) => (
                <option key={kind} value={kind}>{CRUD_SET_VIEW_KIND_LABELS[kind]}</option>
              ))}
            </UiSelect>
          </FormField>
        </div>,
      ),
    },
    {
      id: 'living-apis',
      title: 'APIs',
      panel: wrapPanel(
        <InspectorCrudSetApiFields spec={spec} onChange={writeSpec} />,
      ),
    },
  ];
};

export const InspectorCrudSetLivingFields: React.FC<InspectorCrudSetLivingFieldsProps> = ({
  node,
  dispatch,
}) => {
  const sections = buildInspectorCrudSetLivingSections(node, dispatch);
  return (
    <div className={STACK_CLASS}>
      {sections.map((section) => (
        <div key={section.id}>{section.panel}</div>
      ))}
    </div>
  );
};
