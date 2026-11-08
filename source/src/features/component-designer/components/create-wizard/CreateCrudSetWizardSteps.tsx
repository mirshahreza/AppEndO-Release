import * as React from 'react';
import {
  Columns3,
  FileSpreadsheet,
  Layers,
  Link2,
  ListFilter,
  ListTree,
  Loader2,
  MousePointerClick,
  Plus,
  Trash2,
} from 'lucide-react';
import type { DesignerApiOperationMethod } from '../../../../domain/component-designer/types';
import type { ApiFormField } from '../../../../domain/component-designer/apiFieldSchema';
import { inferResourceNameFromEndpoint } from '../../../../domain/component-designer/bindingResourceModel';
import {
  CRUD_SET_COLLECTION_MODE_LABELS,
  CRUD_SET_CREATE_LAYOUT_LABELS,
  CRUD_SET_CREATE_LAYOUTS,
  CRUD_SET_DEFAULT_ACTIONS,
  CRUD_SET_DEFAULT_DIALOGS,
  CRUD_SET_DEFAULT_GRID,
  CRUD_SET_DEFAULT_KANBAN,
  CRUD_SET_DEFAULT_PAGING,
  CRUD_SET_DEFAULT_SORTING,
  CRUD_SET_EXPORT_FORMATS,
  CRUD_SET_EXPORT_FORMAT_LABELS,
  CRUD_SET_FIRST_QUESTION,
  CRUD_SET_LIST_BODY_KINDS,
  CRUD_SET_LIST_BODY_LABELS,
  CRUD_SET_PATCH_OPEN_FROM_ACTIONS,
  allocateCrudSetColumnId,
  crudSetColumnId,
  crudSetHumanizeField,
  crudSetRequiresReadOne,
  isCrudSetCollectionMode,
  isCrudSetCreateLayout,
  migrateCrudSetSpecForKanbanBody,
  parseCrudSetListBody,
  toggleCrudSetExportFormat,
  type CrudSetActionsConfig,
  type CrudSetCollectionMode,
  type CrudSetCreateApi,
  type CrudSetCreateLayout,
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
  type CrudSetPatchInteraction,
  type CrudSetPatchKind,
  type CrudSetSortingConfig,
  type CrudSetSpec,
} from '../../../../domain/component-designer/crudSetSpec';
import {
  suggestCrudSetColumnFromField,
  suggestCrudSetColumns,
  suggestCrudSetFilterBar,
  suggestCrudSetFilterFromField,
  suggestCrudSetPieces,
  type CrudSetRouteHint,
} from '../../../../domain/component-designer/crudSetSuggestions';
import { useAccessibleApiRoutesQuery } from '../../../../shared/api/queries/my-apis';
import {
  resolveEndpointResponseFormFieldsFromOpenApi,
  useApiEndpointSchemaQuery,
} from '../../../../shared/api/queries/api-endpoint-schema';
import { AppButton } from '../../../../shared/ui/AppButton';
import { AppSurfaceBox } from '../../../../shared/ui/AppSurfaceBox';
import { CrudSetColumnList } from '../../../../shared/ui/CrudSetColumnList';
import { CrudSetDialogFields } from '../../../../shared/ui/CrudSetDialogFields';
import { CrudSetFilterBarFilterFields } from '../../../../shared/ui/CrudSetFilterBarFields';
import { CrudSetGridFields } from '../../../../shared/ui/CrudSetGridFields';
import { CrudSetKanbanFields } from '../../../../shared/ui/CrudSetKanbanFields';
import { CrudSetPagingFields } from '../../../../shared/ui/CrudSetPagingFields';
import { CrudSetSortingFields } from '../../../../shared/ui/CrudSetSortingFields';
import {
  FormField,
  FormSection,
  UiCheckbox,
  UiInput,
  UiRadioChoiceGroup,
  UiSelect,
} from '../../../../shared/ui';
import type { StepWizardStepDef } from '../../../../shared/ui/StepWizardShell';
import { BindingApiEndpointPicker } from '../BindingApiEndpointPicker';
import { findAccessibleApiRouteMatch } from '../../lib/bindingApiEndpointSearch';
import { type CatalogCreateKind, type CreateComponentIdentity } from './catalogCreateKinds';

export const CRUD_SET_WIZARD_CONTENT_STEPS: readonly StepWizardStepDef[] = [
  { title: 'Collection', icon: Layers, description: CRUD_SET_FIRST_QUESTION },
  { title: 'List API', icon: Link2, description: 'Pick the list GET, body, grid chrome, pagination, and paging.' },
  { title: 'Columns', icon: Columns3, description: 'Name each column, then Edit for field, label, display, sort, filter, and width. Default sort lives here.' },
  { title: 'Filter bar', icon: ListFilter, description: 'Search and toolbar field filters. Each filter has its own properties.' },
  { title: 'Create', icon: Plus, description: 'Optional create APIs. Two or more become a dropdown.' },
  { title: 'Patch', icon: MousePointerClick, description: 'Optional content and purpose patches.' },
  { title: 'Delete', icon: Trash2, description: 'Optional delete and the read-one API when needed.' },
  { title: 'Export', icon: FileSpreadsheet, description: 'Toolbar export opens a dialog. Form and confirm dialog chrome. No PDF.' },
];

export const CRUD_SET_WIZARD_LIST_STEP_INDEX = 1;
export const CRUD_SET_WIZARD_COLUMNS_STEP_INDEX = 2;
export const CRUD_SET_WIZARD_FILTER_BAR_STEP_INDEX = 3;
export const CRUD_SET_WIZARD_CREATE_STEP_INDEX = 4;
export const CRUD_SET_WIZARD_PATCH_STEP_INDEX = 5;
export const CRUD_SET_WIZARD_DELETE_STEP_INDEX = 6;
export const CRUD_SET_WIZARD_EXPORT_STEP_INDEX = 7;
export const CRUD_SET_WIZARD_NAME_STEP_INDEX = CRUD_SET_WIZARD_CONTENT_STEPS.length;

type CreateDraft = CrudSetCreateApi;
type PatchDraft = CrudSetPatchApi & { openFromColumnId?: string };
type CollectionModeDraft = CrudSetCollectionMode | '';

const newItemId = (prefix: string): string => (
  `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
);

const SuggestionNote: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AppSurfaceBox tone="indigo" className="px-3 py-2 text-sm text-slate-700">
    {children}
  </AppSurfaceBox>
);

const FieldChecklist: React.FC<{
  fields: readonly ApiFormField[];
  selected: readonly string[];
  onChange: (next: string[]) => void;
  ariaLabel: string;
}> = ({ fields, selected, onChange, ariaLabel }) => {
  const selectedSet = new Set(selected);
  return (
    <div className="flex flex-col gap-1" role="group" aria-label={ariaLabel}>
      {fields.map((field) => (
        <UiCheckbox
          key={field.name}
          size="sm"
          checked={selectedSet.has(field.name)}
          onChange={(event) => {
            if (event.target.checked) {
              onChange([...selected, field.name]);
              return;
            }
            onChange(selected.filter((name) => name !== field.name));
          }}
        >
          {crudSetHumanizeField(field.name)}
          <span className="ms-1 font-mono text-[10px] text-slate-400">{field.name}</span>
        </UiCheckbox>
      ))}
      {fields.length === 0 ? (
        <p className="text-sm text-slate-500">No fields yet. Pick a list API first.</p>
      ) : null}
    </div>
  );
};

export type CreateCrudSetWizardHandle = {
  validateStep: (stepIndex: number) => boolean;
  handleNext: (stepIndex: number, nameStepIndex: number) => { jumpTo: number } | boolean;
  getSpec: (identity: CreateComponentIdentity) => CrudSetSpec | null;
  suggestedName: string;
};

export type CreateCrudSetWizardStepsProps = {
  open: boolean;
  visibleStep: number;
};

export const CreateCrudSetWizardSteps = React.forwardRef<CreateCrudSetWizardHandle, CreateCrudSetWizardStepsProps>(
  function CreateCrudSetWizardSteps({ open, visibleStep }, ref) {
  const routesQuery = useAccessibleApiRoutesQuery();
  const [collectionMode, setCollectionMode] = React.useState<CollectionModeDraft>('');
  const [listPath, setListPath] = React.useState('');
  const [listMethod, setListMethod] = React.useState<DesignerApiOperationMethod>('GET');
  const [listBody, setListBody] = React.useState<CrudSetListBodyKind>('grid');
  const [pagination, setPagination] = React.useState(true);
  const [paging, setPaging] = React.useState<CrudSetPagingConfig>({ ...CRUD_SET_DEFAULT_PAGING });
  const [sorting, setSorting] = React.useState<CrudSetSortingConfig>({ ...CRUD_SET_DEFAULT_SORTING });
  const [grid, setGrid] = React.useState<CrudSetGridConfig>({ ...CRUD_SET_DEFAULT_GRID });
  const [kanban, setKanban] = React.useState<CrudSetKanbanConfig>({ ...CRUD_SET_DEFAULT_KANBAN });
  const [actions, setActions] = React.useState<CrudSetActionsConfig>({ ...CRUD_SET_DEFAULT_ACTIONS });
  const [dialogs, setDialogs] = React.useState<CrudSetDialogsConfig>({ ...CRUD_SET_DEFAULT_DIALOGS });
  const [columns, setColumns] = React.useState<CrudSetGridColumn[]>([]);
  const [filterBar, setFilterBar] = React.useState<CrudSetFilterBarConfig>({ enabled: true, search: true, searchClear: true, filters: [] });
  const [creates, setCreates] = React.useState<CreateDraft[]>([]);
  const [includeCreate, setIncludeCreate] = React.useState(false);
  const [patches, setPatches] = React.useState<PatchDraft[]>([]);
  const [includePatches, setIncludePatches] = React.useState(false);
  const [includeDelete, setIncludeDelete] = React.useState(false);
  const [deletePath, setDeletePath] = React.useState('');
  const [deleteMethod, setDeleteMethod] = React.useState<DesignerApiOperationMethod>('DELETE');
  const [readOnePath, setReadOnePath] = React.useState('');
  const [readOneMethod, setReadOneMethod] = React.useState<DesignerApiOperationMethod>('GET');
  const [exportEnabled, setExportEnabled] = React.useState(true);
  const [exportFormats, setExportFormats] = React.useState<CrudSetExportFormat[]>([...CRUD_SET_EXPORT_FORMATS]);
  const [exportFormat, setExportFormat] = React.useState<CrudSetExportFormat>('xlsx');
  const [exportIncludeHeader, setExportIncludeHeader] = React.useState(true);
  const [refreshEnabled, setRefreshEnabled] = React.useState(true);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = React.useState(false);
  const [createLayout, setCreateLayout] = React.useState<CrudSetCreateLayout>('split');
  const [validationError, setValidationError] = React.useState<string | null>(null);
  const columnsTouchedRef = React.useRef(false);
  const filterBarTouchedRef = React.useRef(false);

  React.useEffect(() => {
    if (!open) {
      return;
    }
    setCollectionMode('');
    setListPath('');
    setListMethod('GET');
    setListBody('grid');
    setPagination(true);
    setPaging({ ...CRUD_SET_DEFAULT_PAGING });
    setSorting({ ...CRUD_SET_DEFAULT_SORTING });
    setGrid({ ...CRUD_SET_DEFAULT_GRID });
    setKanban({ ...CRUD_SET_DEFAULT_KANBAN });
    setActions({ ...CRUD_SET_DEFAULT_ACTIONS });
    setDialogs({ ...CRUD_SET_DEFAULT_DIALOGS });
    setColumns([]);
    setFilterBar({ enabled: true, search: true, searchClear: true, filters: [] });
    setCreates([]);
    setIncludeCreate(false);
    setPatches([]);
    setIncludePatches(false);
    setIncludeDelete(false);
    setDeletePath('');
    setDeleteMethod('DELETE');
    setReadOnePath('');
    setReadOneMethod('GET');
    setExportEnabled(true);
    setExportFormats([...CRUD_SET_EXPORT_FORMATS]);
    setExportFormat('xlsx');
    setExportIncludeHeader(true);
    setRefreshEnabled(true);
    setAutoRefreshEnabled(false);
    setCreateLayout('split');
    setValidationError(null);
    columnsTouchedRef.current = false;
    filterBarTouchedRef.current = false;
  }, [open]);

  const routes = routesQuery.data ?? [];
  const matchedList = React.useMemo(
    () => findAccessibleApiRouteMatch(routes, listPath, listMethod),
    [listMethod, listPath, routes],
  );
  const schemaQuery = useApiEndpointSchemaQuery(open ? matchedList?.id ?? null : null, {
    refresh: visibleStep >= CRUD_SET_WIZARD_LIST_STEP_INDEX,
  });
  const listFields = React.useMemo(
    () => (schemaQuery.data ? resolveEndpointResponseFormFieldsFromOpenApi(schemaQuery.data, listMethod) : []),
    [listMethod, schemaQuery.data],
  );

  React.useEffect(() => {
    if (columnsTouchedRef.current || listFields.length === 0) {
      return;
    }
    setColumns(suggestCrudSetColumns(listFields));
  }, [listFields]);

  React.useEffect(() => {
    if (filterBarTouchedRef.current || listFields.length === 0) {
      return;
    }
    setFilterBar(suggestCrudSetFilterBar(listFields));
  }, [listFields]);

  const routeHints: CrudSetRouteHint[] = React.useMemo(
    () => routes.map((route) => ({
      id: route.id,
      name: route.name,
      method: route.method,
      path: route.path,
    })),
    [routes],
  );

  const applySuggestions = React.useCallback(() => {
    const suggested = suggestCrudSetPieces({
      listPath,
      listFields,
      routes: routeHints,
    });
    setListBody(suggested.listBody);
    setPagination(suggested.pagination);
    setPaging(suggested.paging);
    setSorting(suggested.sorting);
    setGrid(suggested.grid);
    setKanban(suggested.kanban ?? { ...CRUD_SET_DEFAULT_KANBAN });
    setActions(suggested.actions);
    setDialogs(suggested.dialogs);
    setColumns(suggested.columns.length > 0 ? suggested.columns : [{ field: 'id', label: 'Id' }]);
    columnsTouchedRef.current = false;
    setFilterBar(suggested.filterBar);
    filterBarTouchedRef.current = false;
    setCreates(suggested.createApis);
    setIncludeCreate(suggested.createApis.length > 0);
    setPatches(suggested.patches);
    setIncludePatches(suggested.patches.length > 0);
    setIncludeDelete(Boolean(suggested.deleteApi));
    setDeletePath(suggested.deleteApi?.endpointId ?? '');
    setReadOnePath(suggested.readOneApi?.endpointId ?? '');
    setExportEnabled(suggested.export.enabled !== false);
    setExportFormats(suggested.export.formats?.length ? [...suggested.export.formats] : [...CRUD_SET_EXPORT_FORMATS]);
    setExportFormat(suggested.export.defaultFormat ?? 'xlsx');
    setExportIncludeHeader(suggested.export.defaultIncludeHeader !== false);
    setRefreshEnabled(suggested.refresh !== false);
    setAutoRefreshEnabled(false);
    setCreateLayout('split');
  }, [listFields, listPath, routeHints]);

  const buildSpec = React.useCallback((identity: CreateComponentIdentity): CrudSetSpec | null => {
    const enabledColumns = columns.filter((column) => column.field.trim());
    if (!listPath.trim() || enabledColumns.length === 0) {
      return null;
    }
    const createApis = includeCreate
      ? creates.filter((create) => create.endpointId.trim() && create.label.trim())
      : [];
    const patchApis = includePatches
      ? patches.filter((patch) => patch.endpointId.trim() && patch.label.trim())
      : [];
    const spec: CrudSetSpec = {
      name: identity.name,
      tags: undefined,
      listApi: { endpointId: listPath.trim() },
      listBody,
      pagination: (listBody === 'grid' || listBody === 'kanban') ? pagination : false,
      paging: (listBody === 'grid' || listBody === 'kanban') && pagination ? paging : undefined,
      sorting,
      grid,
      actions,
      dialogs,
      columns: enabledColumns,
      filterBar: {
        enabled: filterBar.enabled !== false,
        search: filterBar.search !== false,
        searchClear: filterBar.searchClear !== false,
        searchPlaceholder: filterBar.searchPlaceholder?.trim() || undefined,
        filters: (filterBar.filters ?? []).filter((filter) => (
          filter.field.trim()
          && (
            filter.optionsFrom === 'distinct-rows'
            || filter.options.some((option) => option.value.trim())
          )
        )),
      },
      createApis,
      createLayout: createApis.length >= 2 ? createLayout : undefined,
      patches: patchApis.map((patch) => ({
        ...patch,
        openFromColumnId: patch.openFromColumnId?.trim() || undefined,
      })),
      export: {
        enabled: exportEnabled,
        formats: exportFormats,
        defaultFormat: exportFormats.includes(exportFormat) ? exportFormat : exportFormats[0] ?? 'xlsx',
        defaultIncludeHeader: exportIncludeHeader,
      },
      refresh: refreshEnabled,
      autoRefresh: refreshEnabled && autoRefreshEnabled ? { enabled: true, seconds: 5 } : undefined,
    };
    if (listBody === 'kanban') {
      spec.kanban = kanban;
    }
    if (includeDelete && deletePath.trim()) {
      spec.deleteApi = { endpointId: deletePath.trim() };
    }
    if (readOnePath.trim()) {
      spec.readOneApi = { endpointId: readOnePath.trim() };
    }
    return spec;
  }, [
    columns,
    creates,
    createLayout,
    deletePath,
    dialogs,
    exportEnabled,
    exportFormat,
    exportFormats,
    exportIncludeHeader,
    filterBar,
    grid,
    kanban,
    actions,
    includeCreate,
    includeDelete,
    includePatches,
    listBody,
    listPath,
    pagination,
    paging,
    patches,
    readOnePath,
    refreshEnabled,
    autoRefreshEnabled,
    sorting,
  ]);

  const validateStep = React.useCallback((stepIndex: number): boolean => {
    if (stepIndex === 0) {
      if (!isCrudSetCollectionMode(collectionMode)) {
        setValidationError('Choose how to fill the CRUD Set options.');
        return false;
      }
    }
    if (stepIndex === CRUD_SET_WIZARD_LIST_STEP_INDEX) {
      if (!listPath.trim()) {
        setValidationError('Pick a list API.');
        return false;
      }
    }
    if (stepIndex === CRUD_SET_WIZARD_COLUMNS_STEP_INDEX && columns.filter((column) => column.field.trim()).length === 0) {
      setValidationError('Choose at least one column.');
      return false;
    }
    setValidationError(null);
    return true;
  }, [collectionMode, columns, listPath]);

  const handleNext = React.useCallback((stepIndex: number, nameStepIndex: number): { jumpTo: number } | boolean => {
    if (!validateStep(stepIndex)) {
      return false;
    }
    if (collectionMode === 'suggest-then-cut' && stepIndex === CRUD_SET_WIZARD_LIST_STEP_INDEX) {
      applySuggestions();
      return { jumpTo: nameStepIndex };
    }
    return true;
  }, [applySuggestions, collectionMode, validateStep]);

  const getSpec = React.useCallback((identity: CreateComponentIdentity): CrudSetSpec | null => {
    if (!isCrudSetCollectionMode(collectionMode)) {
      setValidationError('Choose how to fill the CRUD Set options.');
      return null;
    }
    if (!listPath.trim()) {
      setValidationError('Pick a list API.');
      return null;
    }
    const spec = buildSpec(identity);
    if (!spec) {
      setValidationError('Choose at least one column.');
      return null;
    }
    if (crudSetRequiresReadOne(spec) && !spec.readOneApi?.endpointId.trim()) {
      setValidationError('Form patches and delete need a read-one API.');
      return null;
    }
    setValidationError(null);
    return spec;
  }, [buildSpec, collectionMode, listPath]);

  React.useImperativeHandle(ref, () => ({
    validateStep,
    handleNext,
    getSpec,
    suggestedName: inferResourceNameFromEndpoint(listPath) || 'records',
  }), [getSpec, handleNext, listPath, validateStep]);

  const booleanFields = listFields.filter((field) => field.type === 'boolean');

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1">
      {validationError ? (
        <AppSurfaceBox tone="rose" className="shrink-0 px-3 py-2 text-sm">
          {validationError}
        </AppSurfaceBox>
      ) : null}

      {visibleStep === 0 ? (
        <FormSection title="Collection" ink="accent">
          <p className="text-sm text-slate-700">{CRUD_SET_FIRST_QUESTION}</p>
          <UiRadioChoiceGroup
            ariaLabel="CRUD Set collection mode"
            value={collectionMode}
            onChange={(value) => {
              setCollectionMode(isCrudSetCollectionMode(value) ? value : '');
              setValidationError(null);
            }}
            options={[
              { value: 'suggest-then-cut', label: CRUD_SET_COLLECTION_MODE_LABELS['suggest-then-cut'] },
              { value: 'decide-now', label: CRUD_SET_COLLECTION_MODE_LABELS['decide-now'] },
            ]}
          />
          <SuggestionNote>
            Suggest-then-cut fills every later option after you pick the list API, then jumps to Name.
            You can still go back and cut. Decide-now walks each step with the suggestion shown.
          </SuggestionNote>
        </FormSection>
      ) : null}

      {visibleStep === 1 ? (
        <FormSection title="List API" ink="accent">
          <SuggestionNote>
            Suggestion: grid unless the rows look hierarchical; pagination on for a grid with numbered pages, page size 50, footer sort on. Tree-grid is never paged. The grid is the only required body; every other chrome piece is on/off.
          </SuggestionNote>
          <p className="text-sm text-slate-600">Choose a GET list endpoint. Columns come from the response row schema.</p>
          <BindingApiEndpointPicker
            value={listPath}
            method={listMethod}
            onChange={(path) => {
              setListPath(path);
              columnsTouchedRef.current = false;
              filterBarTouchedRef.current = false;
              setValidationError(null);
            }}
            onMethodChange={setListMethod}
            methodFilter={['GET']}
            autoFocus
          />
          {schemaQuery.isFetching ? (
            <p className="inline-flex items-center gap-2 text-sm text-slate-500">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Reading OpenAPI response schema…
            </p>
          ) : null}
          {!schemaQuery.isFetching && matchedList && listFields.length > 0 ? (
            <p className="text-sm text-emerald-700">
              Detected {listFields.length} response field{listFields.length === 1 ? '' : 's'}.
            </p>
          ) : null}
          <FormField label="Widget">
            <UiRadioChoiceGroup
              ariaLabel="List widget"
              value={listBody}
              onChange={(value) => {
                const nextBody = parseCrudSetListBody(value);
                if (nextBody === 'kanban') {
                  const migrated = migrateCrudSetSpecForKanbanBody({ kanban, filterBar });
                  setKanban(migrated.kanban ?? kanban);
                  setFilterBar(migrated.filterBar ?? filterBar);
                  if (!pagination) {
                    setPagination(true);
                  }
                }
                setListBody(nextBody);
              }}
              options={CRUD_SET_LIST_BODY_KINDS.map((kind) => ({
                value: kind,
                label: CRUD_SET_LIST_BODY_LABELS[kind],
              }))}
            />
          </FormField>
          {listBody === 'kanban' ? (
            <CrudSetKanbanFields
              kanban={kanban}
              columns={columns}
              fieldOptions={listFields.map((item) => item.name)}
              onChange={setKanban}
            />
          ) : null}
          {listBody === 'map' ? (
            <p className="text-sm text-slate-500">Pins use latitude and longitude. Never paged.</p>
          ) : null}
          {listBody === 'grid' || listBody === 'tree-grid' ? (
          <CrudSetGridFields
            grid={grid}
            actions={actions}
            listBody={listBody}
            onGridChange={setGrid}
            onActionsChange={setActions}
          />
          ) : null}
          {listBody === 'grid' || listBody === 'kanban' ? (
            <FormSection title="Paging" ink="complement" divided>
              <UiCheckbox
                size="sm"
                checked={pagination}
                onChange={(event) => setPagination(event.target.checked)}
              >
                Pagination (suggested on). Off shows the full queried set with no paging footer.
              </UiCheckbox>
              {pagination ? (
                <CrudSetPagingFields
                  paging={paging}
                  onChange={setPaging}
                  footerSort={{
                    enabled: sorting.footer !== false,
                    onChange: (checked) => setSorting((current) => ({ ...current, footer: checked })),
                  }}
                />
              ) : null}
            </FormSection>
          ) : (
            <p className="text-sm text-slate-500">
              {listBody === 'tree-grid' ? 'Tree-grid is never paged.' : 'Map is never paged.'}
            </p>
          )}
          <UiCheckbox
            size="sm"
            checked={refreshEnabled}
            onChange={(event) => setRefreshEnabled(event.target.checked)}
          >
            Refresh on the toolbar (suggested on)
          </UiCheckbox>
          {refreshEnabled ? (
            <UiCheckbox
              size="sm"
              checked={autoRefreshEnabled}
              onChange={(event) => setAutoRefreshEnabled(event.target.checked)}
            >
              Auto-refresh checkbox (suggested off)
            </UiCheckbox>
          ) : null}
        </FormSection>
      ) : null}

      {visibleStep === 2 ? (
        <FormSection title="Columns" ink="accent">
          <SuggestionNote>
            Suggestion: identity plus a few meaningful fields, not internals. Pick the dataset
            field each column reads. Each column has label, display, transform, optional
            stacked secondary field, card role, hide-below, conditional format, form control,
            visible-when, sort, filter, and
            width. Array order is left to right. The actions column is appended last. Columns cannot
            be turned off — they are the grid. Default sort is the first sortable column, ascending.
          </SuggestionNote>
          <CrudSetSortingFields
            sorting={sorting}
            columns={columns}
            showFooter={(listBody === 'grid' || listBody === 'kanban') && pagination}
            onChange={setSorting}
          />
          <div className="flex flex-col gap-3">
            <CrudSetColumnList
              columns={columns}
              enableColumnLayout={grid.enableColumnLayout === true}
              fieldOptions={listFields.map((item) => item.name)}
              resolveFieldMeta={(name) => {
                const match = listFields.find((item) => item.name === name);
                return match
                  ? {
                    type: match.type,
                    format: match.format,
                    enum: match.enum,
                    itemType: match.itemType,
                  }
                  : undefined;
              }}
              onChange={(next) => {
                columnsTouchedRef.current = true;
                setColumns(next);
              }}
            />
            {listFields.length === 0 ? (
              <p className="text-sm text-slate-500">Pick a list API first so fields can load.</p>
            ) : null}
            {listFields.filter((field) => !columns.some((column) => column.field === field.name)).length > 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Add column</p>
                <div className="flex flex-wrap gap-1">
                  {listFields
                    .filter((field) => !columns.some((column) => column.field === field.name))
                    .map((field) => (
                      <AppButton
                        key={field.name}
                        size="sm"
                        intent="utility"
                        aria-label={`Add column ${field.name}`}
                        onClick={() => {
                          columnsTouchedRef.current = true;
                          setColumns((prev) => [...prev, {
                            ...suggestCrudSetColumnFromField(field),
                            id: allocateCrudSetColumnId(prev, field.name),
                          }]);
                        }}
                      >
                        <Plus className="h-3.5 w-3.5" />
                        {crudSetHumanizeField(field.name)}
                      </AppButton>
                    ))}
                </div>
              </div>
            ) : null}
          </div>
        </FormSection>
      ) : null}

      {visibleStep === CRUD_SET_WIZARD_FILTER_BAR_STEP_INDEX ? (
        <FormSection title="Filter bar" ink="accent">
          <SuggestionNote>
            Suggestion: keep the filter bar on, with search on and at most a couple of toolbar
            filters. Off hides the whole left toolbar cluster. Column-header filters stay on the grid.
          </SuggestionNote>
          <UiCheckbox
            size="sm"
            checked={filterBar.enabled !== false}
            onChange={(event) => {
              filterBarTouchedRef.current = true;
              setFilterBar((current) => ({ ...current, enabled: event.target.checked }));
            }}
          >
            Include filter bar (suggested on)
          </UiCheckbox>
          {filterBar.enabled !== false ? (
            <>
          <UiCheckbox
            size="sm"
            checked={filterBar.search !== false}
            onChange={(event) => {
              filterBarTouchedRef.current = true;
              setFilterBar((current) => ({ ...current, search: event.target.checked }));
            }}
          >
            Search (suggested on)
          </UiCheckbox>
          {filterBar.search !== false ? (
            <UiCheckbox
              size="sm"
              checked={filterBar.searchClear !== false}
              onChange={(event) => {
                filterBarTouchedRef.current = true;
                setFilterBar((current) => ({ ...current, searchClear: event.target.checked }));
              }}
            >
              Search clear button (suggested on)
            </UiCheckbox>
          ) : null}
          <FormField label="Search placeholder">
            <UiInput
              size="sm"
              autoDir={false}
              value={filterBar.searchPlaceholder ?? ''}
              onChange={(event) => {
                filterBarTouchedRef.current = true;
                setFilterBar((current) => ({ ...current, searchPlaceholder: event.target.value }));
              }}
              ariaLabel="Filter bar search placeholder"
            />
          </FormField>
          <div className="flex flex-col gap-3">
            {(filterBar.filters ?? []).map((filter, index) => (
              <AppSurfaceBox key={filter.id} className="flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Filter {index + 1}
                  </span>
                  <AppButton
                    size="icon-sm"
                    intent="destructive-soft"
                    aria-label={`Remove filter ${index + 1}`}
                    onClick={() => {
                      filterBarTouchedRef.current = true;
                      setFilterBar((current) => ({
                        ...current,
                        filters: (current.filters ?? []).filter((item) => item.id !== filter.id),
                      }));
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </AppButton>
                </div>
                <CrudSetFilterBarFilterFields
                  filter={filter}
                  fieldOptions={listFields.map((field) => field.name)}
                  onChange={(next) => {
                    filterBarTouchedRef.current = true;
                    setFilterBar((current) => ({
                      ...current,
                      filters: (current.filters ?? []).map((item) => (
                        item.id === filter.id ? next : item
                      )),
                    }));
                  }}
                />
              </AppSurfaceBox>
            ))}
            <AppButton
              size="sm"
              intent="create"
              onClick={() => {
                filterBarTouchedRef.current = true;
                const used = new Set((filterBar.filters ?? []).map((item) => item.field));
                const nextField = listFields.find((field) => !used.has(field.name)) ?? listFields[0];
                const created: CrudSetFilterBarFilter = nextField
                  ? suggestCrudSetFilterFromField(nextField)
                  : {
                    id: newItemId('filter'),
                    field: '',
                    label: 'Filter',
                    controlType: 'select',
                    options: [],
                  };
                setFilterBar((current) => ({
                  ...current,
                  filters: [...(current.filters ?? []), created],
                }));
              }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add toolbar filter
            </AppButton>
          </div>
            </>
          ) : null}
        </FormSection>
      ) : null}

      {visibleStep === CRUD_SET_WIZARD_CREATE_STEP_INDEX ? (
        <FormSection title="Create" ink="accent">
          <SuggestionNote>
            Suggestion: include Create when a matching POST exists. Off hides the toolbar button.
            Empty accepted fields is confirm-only. Two or more creates become a dropdown unless
            layout is Adjacent (two labeled Create buttons, for identity Individual/Company).
          </SuggestionNote>
          <UiCheckbox
            size="sm"
            checked={includeCreate}
            onChange={(event) => setIncludeCreate(event.target.checked)}
          >
            Include Create on the toolbar
          </UiCheckbox>
          {includeCreate ? (
          <div className="flex flex-col gap-3">
            {creates.length >= 2 ? (
              <FormField label="Create layout">
                <UiSelect
                  size="sm"
                  value={createLayout}
                  onChange={(event) => {
                    if (isCrudSetCreateLayout(event.target.value)) {
                      setCreateLayout(event.target.value);
                    }
                  }}
                  ariaLabel="CRUD Set create layout"
                >
                  {CRUD_SET_CREATE_LAYOUTS.map((layout) => (
                    <option key={layout} value={layout}>{CRUD_SET_CREATE_LAYOUT_LABELS[layout]}</option>
                  ))}
                </UiSelect>
              </FormField>
            ) : null}
            {creates.map((create, index) => (
              <AppSurfaceBox key={create.id} className="flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Create {index + 1}
                  </span>
                  <AppButton
                    size="icon-sm"
                    intent="destructive-soft"
                    aria-label={`Remove create ${index + 1}`}
                    onClick={() => setCreates((prev) => prev.filter((item) => item.id !== create.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </AppButton>
                </div>
                <FormField label="Toolbar label" required>
                  <UiInput
                    size="sm"
                    autoDir={false}
                    value={create.label}
                    onChange={(event) => setCreates((prev) => prev.map((item) => (
                      item.id === create.id ? { ...item, label: event.target.value } : item
                    )))}
                    ariaLabel={`Create ${index + 1} label`}
                  />
                </FormField>
                <BindingApiEndpointPicker
                  value={create.endpointId}
                  method="POST"
                  onChange={(path) => setCreates((prev) => prev.map((item) => (
                    item.id === create.id ? { ...item, endpointId: path } : item
                  )))}
                  onMethodChange={() => undefined}
                  methodFilter={['POST']}
                />
                <FormField label="Purpose">
                  <UiInput
                    size="sm"
                    autoDir={false}
                    value={create.purpose ?? ''}
                    onChange={(event) => setCreates((prev) => prev.map((item) => (
                      item.id === create.id ? { ...item, purpose: event.target.value } : item
                    )))}
                    ariaLabel={`Create ${index + 1} purpose`}
                  />
                </FormField>
                <FieldChecklist
                  fields={listFields}
                  selected={create.acceptedFields}
                  ariaLabel={`Create ${index + 1} accepted fields`}
                  onChange={(next) => setCreates((prev) => prev.map((item) => (
                    item.id === create.id ? { ...item, acceptedFields: next } : item
                  )))}
                />
              </AppSurfaceBox>
            ))}
            <AppButton
              size="sm"
              intent="create"
              onClick={() => setCreates((prev) => [...prev, {
                id: newItemId('create'),
                label: 'Add record',
                endpointId: '',
                acceptedFields: [],
              }])}
            >
              <Plus className="h-3.5 w-3.5" />
              Add create API
            </AppButton>
          </div>
          ) : null}
        </FormSection>
      ) : null}

      {visibleStep === CRUD_SET_WIZARD_PATCH_STEP_INDEX ? (
        <FormSection title="Patch" ink="accent">
          <SuggestionNote>
            Suggestion: include patches when matching PATCH APIs exist. Off hides row-action patches.
            One content patch for the main record editor. Purpose patches for lock, archive, approve.
          </SuggestionNote>
          <UiCheckbox
            size="sm"
            checked={includePatches}
            onChange={(event) => setIncludePatches(event.target.checked)}
          >
            Include patches
          </UiCheckbox>
          {includePatches ? (
          <div className="flex flex-col gap-3">
            {patches.map((patch, index) => (
              <AppSurfaceBox key={patch.id} className="flex flex-col gap-2 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Patch {index + 1}
                  </span>
                  <AppButton
                    size="icon-sm"
                    intent="destructive-soft"
                    aria-label={`Remove patch ${index + 1}`}
                    onClick={() => setPatches((prev) => prev.filter((item) => item.id !== patch.id))}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </AppButton>
                </div>
                <FormField label="Label" required>
                  <UiInput
                    size="sm"
                    autoDir={false}
                    value={patch.label}
                    onChange={(event) => setPatches((prev) => prev.map((item) => (
                      item.id === patch.id ? { ...item, label: event.target.value } : item
                    )))}
                    ariaLabel={`Patch ${index + 1} label`}
                  />
                </FormField>
                <BindingApiEndpointPicker
                  value={patch.endpointId}
                  method="PATCH"
                  onChange={(path) => setPatches((prev) => prev.map((item) => (
                    item.id === patch.id ? { ...item, endpointId: path } : item
                  )))}
                  onMethodChange={() => undefined}
                  methodFilter={['PATCH', 'PUT']}
                />
                <FormField label="Kind">
                  <UiSelect
                    size="sm"
                    nested
                    value={patch.kind}
                    onChange={(event) => setPatches((prev) => prev.map((item) => (
                      item.id === patch.id ? { ...item, kind: event.target.value as CrudSetPatchKind } : item
                    )))}
                    aria-label={`Patch ${index + 1} kind`}
                  >
                    <option value="content">Content</option>
                    <option value="purpose">Purpose</option>
                  </UiSelect>
                </FormField>
                <FormField label="Interaction">
                  <UiSelect
                    size="sm"
                    nested
                    value={patch.interaction ?? 'form'}
                    onChange={(event) => setPatches((prev) => prev.map((item) => (
                      item.id === patch.id
                        ? { ...item, interaction: event.target.value as CrudSetPatchInteraction }
                        : item
                    )))}
                    aria-label={`Patch ${index + 1} interaction`}
                  >
                    <option value="form">Form</option>
                    <option value="boolean-toggle">Boolean toggle</option>
                  </UiSelect>
                </FormField>
                {(patch.interaction ?? 'form') === 'boolean-toggle' ? (
                  <>
                    <FormField label="Boolean field">
                      <UiSelect
                        size="sm"
                        nested
                        value={patch.acceptedFields[0] ?? ''}
                        onChange={(event) => setPatches((prev) => prev.map((item) => (
                          item.id === patch.id ? { ...item, acceptedFields: event.target.value ? [event.target.value] : [] } : item
                        )))}
                        aria-label={`Patch ${index + 1} boolean field`}
                      >
                        <option value="">Select field</option>
                        {(booleanFields.length > 0 ? booleanFields : listFields).map((field) => (
                          <option key={field.name} value={field.name}>{field.name}</option>
                        ))}
                      </UiSelect>
                    </FormField>
                    <UiCheckbox
                      size="sm"
                      checked={patch.toggleConfirm === true}
                      onChange={(event) => setPatches((prev) => prev.map((item) => (
                        item.id === patch.id ? { ...item, toggleConfirm: event.target.checked } : item
                      )))}
                    >
                      Confirm first (suggested on for lock/archive)
                    </UiCheckbox>
                  </>
                ) : (
                  <FieldChecklist
                    fields={listFields}
                    selected={patch.acceptedFields}
                    ariaLabel={`Patch ${index + 1} accepted fields`}
                    onChange={(next) => setPatches((prev) => prev.map((item) => (
                      item.id === patch.id ? { ...item, acceptedFields: next } : item
                    )))}
                  />
                )}
                <FormField label="Open from column (optional)">
                  <UiSelect
                    size="sm"
                    nested
                    value={
                      patch.openFromColumnId === CRUD_SET_PATCH_OPEN_FROM_ACTIONS
                        ? CRUD_SET_PATCH_OPEN_FROM_ACTIONS
                        : (patch.openFromColumnId ?? '')
                    }
                    onChange={(event) => setPatches((prev) => prev.map((item) => (
                      item.id === patch.id ? {
                        ...item,
                        openFromColumnId: event.target.value === CRUD_SET_PATCH_OPEN_FROM_ACTIONS
                          ? CRUD_SET_PATCH_OPEN_FROM_ACTIONS
                          : (event.target.value.trim() || undefined),
                      } : item
                    )))}
                    aria-label={`Patch ${index + 1} open from column`}
                  >
                    <option value="">Auto (title / display / id)</option>
                    <option value={CRUD_SET_PATCH_OPEN_FROM_ACTIONS}>Actions column</option>
                    {columns.map((column) => (
                      <option key={crudSetColumnId(column)} value={crudSetColumnId(column)}>
                        {column.label || column.field}
                      </option>
                    ))}
                  </UiSelect>
                </FormField>
              </AppSurfaceBox>
            ))}
            <AppButton
              size="sm"
              intent="secondary"
              onClick={() => setPatches((prev) => [...prev, {
                id: newItemId('patch'),
                label: 'Edit record',
                endpointId: '',
                kind: prev.some((item) => item.kind === 'content') ? 'purpose' : 'content',
                acceptedFields: [],
                interaction: 'form',
              }])}
            >
              <Plus className="h-3.5 w-3.5" />
              Add patch API
            </AppButton>
          </div>
          ) : null}
        </FormSection>
      ) : null}

      {visibleStep === CRUD_SET_WIZARD_DELETE_STEP_INDEX ? (
        <FormSection title="Delete" ink="accent">
          <SuggestionNote>
            Suggestion: include delete when a DELETE route exists. Behavior is locked: read-one display,
            then rose confirm sends the primary key. Read-one is required for form patches and delete,
            not for boolean-toggle only.
          </SuggestionNote>
          <UiCheckbox
            size="sm"
            checked={includeDelete}
            onChange={(event) => setIncludeDelete(event.target.checked)}
          >
            Include delete
          </UiCheckbox>
          {includeDelete ? (
            <BindingApiEndpointPicker
              value={deletePath}
              method={deleteMethod}
              onChange={setDeletePath}
              onMethodChange={setDeleteMethod}
              methodFilter={['DELETE']}
            />
          ) : null}
          <FormField label="Read-one API">
            <BindingApiEndpointPicker
              value={readOnePath}
              method={readOneMethod}
              onChange={setReadOnePath}
              onMethodChange={setReadOneMethod}
              methodFilter={['GET']}
            />
          </FormField>
        </FormSection>
      ) : null}

      {visibleStep === CRUD_SET_WIZARD_EXPORT_STEP_INDEX ? (
        <div className="flex flex-col gap-1">
        <FormSection title="Export" ink="accent">
          <SuggestionNote>
            Suggestion: keep Export on with both Excel and CSV. Default Excel with headers. The operator
            still picks a format in the runtime dialog. Export is always the full queried set. No PDF.
          </SuggestionNote>
          <UiCheckbox
            size="sm"
            checked={exportEnabled}
            onChange={(event) => setExportEnabled(event.target.checked)}
          >
            Include Export on the toolbar
          </UiCheckbox>
          {exportEnabled ? (
            <>
              <FormField
                label="Formats"
                hint="The runtime dialog offers every checked format. Suggestion is both Excel and CSV. No PDF."
              >
                <div className="flex flex-col gap-1" role="group" aria-label="Export formats">
                  {CRUD_SET_EXPORT_FORMATS.map((format) => (
                    <UiCheckbox
                      key={format}
                      size="sm"
                      checked={exportFormats.includes(format)}
                      onChange={(event) => {
                        const next = toggleCrudSetExportFormat(exportFormats, format, event.target.checked);
                        setExportFormats(next);
                        if (!next.includes(exportFormat)) {
                          setExportFormat(next[0] ?? 'xlsx');
                        }
                      }}
                    >
                      {CRUD_SET_EXPORT_FORMAT_LABELS[format]}
                    </UiCheckbox>
                  ))}
                </div>
              </FormField>
              {exportFormats.length > 1 ? (
                <FormField label="Default format">
                  <UiSelect
                    size="sm"
                    nested
                    value={exportFormats.includes(exportFormat) ? exportFormat : exportFormats[0]}
                    onChange={(event) => setExportFormat(event.target.value === 'csv' ? 'csv' : 'xlsx')}
                    aria-label="Default export format"
                  >
                    {exportFormats.map((format) => (
                      <option key={format} value={format}>{CRUD_SET_EXPORT_FORMAT_LABELS[format]}</option>
                    ))}
                  </UiSelect>
                </FormField>
              ) : null}
              <UiCheckbox
                size="sm"
                checked={exportIncludeHeader}
                onChange={(event) => setExportIncludeHeader(event.target.checked)}
              >
                Include column headers by default
              </UiCheckbox>
            </>
          ) : null}
        </FormSection>
        <FormSection title="Dialogs" ink="complement" divided>
          <SuggestionNote>
            Suggestion: form dialogs large, confirm small, close and Escape on, confirm focus on
            Cancel. View body is a record form unless the operator needs JSON or a message thread.
            Delete stays danger. These apply to create, form patch, export, delete, view, and
            toggle-confirm.
          </SuggestionNote>
          <CrudSetDialogFields dialogs={dialogs} onChange={setDialogs} />
        </FormSection>
        </div>
      ) : null}

      {visibleStep === 1 && listBody === 'tree-grid' ? (
        <p className="sr-only">
          <ListTree className="h-3.5 w-3.5" />
        </p>
      ) : null}
    </div>
  );
});

CreateCrudSetWizardSteps.displayName = 'CreateCrudSetWizardSteps';
