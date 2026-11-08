import type { FunctionAccessControl } from '../../shared/api/contracts/server-functions/accessControl';
import type {
  CreativeLandingMetadataV1,
  ShellDesignerMetadataV1,
} from '../../shared/api/contracts/shell-designer/types';
import type { DesignerCanvasComment } from './canvasComments';
import type {
  DataSourceGraphqlConfig,
  DataSourceStaticFileConfig,
  DesignerConnectorType,
} from './dataConnectorTypes';
import type { DesignerGridToolbarConfig } from './designerGridToolbarConfig';

export type { DesignerCanvasComment } from './canvasComments';

export type DesignerViewMode = 'design' | 'code' | 'nodetree' | 'split';

export type DesignerSourceType = 'static' | 'expression' | 'apiRef' | 'store' | 'regionColumn' | 'session' | 'formula';

/** Formal current-session fields — map onto ambient `designerStore.user.*` (Phase 25 / U6). */
export type DesignerSessionField = 'userId' | 'email' | 'role' | 'displayName';

export type DesignerBindingRole = 'general' | 'property' | 'event';

export type DesignerBindingValueMode = 'value' | 'defaultValue';

export type DesignerBindingActionType = 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type PayloadFieldTransform =
  | 'string'
  | 'number'
  | 'boolean'
  | 'nullableString'
  | 'nullableBoolean'
  | 'commaSeparatedArray';

export type CrossFieldRule = {
  id: string;
  fields: string[];
  rule: 'equals' | 'notEquals' | 'greaterThan' | 'lessThan' | 'expression';
  expression?: string;
  errorMessageKey: string;
  appliesTo: string;
};

export type DesignerViewportPreset = 'mobile' | 'tablet' | 'desktop' | 'custom';

export type DesignerCanvasFillMode = 'manual' | 'fill-width' | 'fill-height' | 'fill-both';

export type DesignerPaletteCategory =
  | 'html-primitives'
  | 'layout'
  | 'tailwind-ui-blocks'
  | 'heroui-general'
  | 'heroui-data-display'
  | 'heroui-forms-inputs'
  | 'heroui-navigation-overlays'
  | 'logic'
  | 'platform-slots'
  | 'platform-navigation'
  | 'shell-chrome'
  | 'reusable-components'
  | 'data-visualization'
  | 'content-media'
  | 'marketing'
  | 'feedback-status'
  /** Phase 8 — unified Toolbox group for Shell Chrome / Slots / Nav / Reusable / Custom */
  | 'platform-workspace';

export type DesignerPaletteSourceType = 'system' | 'reusable' | 'local' | 'custom';

export type DesignerDynamicActionType =
  | 'refreshDataSource'
  | 'setValue'
  | 'showHide'
  | 'showToast'
  | 'callMutation'
  | 'resetForm'
  | 'navigate'
  | 'updateFilterFromClick'
  | 'exportData'
  | 'triggerWorkflow';

export type DesignerToastVariant = 'default' | 'accent' | 'success' | 'warning' | 'danger';

/** Phase 48 — file format for Dynamic Action `exportData` / grid toolbar Export. */
export type DesignerExportFormat = 'csv' | 'xlsx' | 'pdf';

/** Phase 48 — which live widget payload `exportData` resolves (filtered/sorted view). */
export type DesignerExportDataSource = 'gridListResource' | 'chartDataResource';

export type DesignerDynamicAction = {
  id: string;
  type: DesignerDynamicActionType;
  /** Shared Data Source registry key for refreshDataSource actions. */
  dataSourceRef?: string;
  /** Target node for setValue / showHide actions. */
  targetNodeId?: string;
  /** Dot path within designerStore for setValue actions. */
  storePath?: string;
  valueSource?: 'static' | 'expression';
  staticValue?: string;
  valueExpression?: string;
  showHideEffect?: 'show' | 'hide' | 'toggle';
  /** Show Toast action — maps to HeroUI `toast(title, { description, variant, timeout })`. */
  toastTitle?: string;
  toastDescription?: string;
  toastVariant?: DesignerToastVariant;
  /** Duration in milliseconds; compiled to HeroUI `timeout`. */
  toastDuration?: number;
  /**
   * Call Mutation action — resolves `dataSourceRef`'s operation endpoint.
   * Known values: `create` | `update` | `delete`. Any other string looks up
   * `operations.custom[mutationOperation]` (Phase 24 named REST ops).
   */
  mutationOperation?: string;
  /** Dot path within designerStore holding the record id substituted into the operation's URL template. */
  mutationRecordIdStorePath?: string;
  /** Static JSON fields sent for create/update mutations (for confirmed status transitions, etc.). */
  mutationBody?: Record<string, unknown>;
  /**
   * Navigate action — path template supporting `{selection.id}` / `{store.selection.id}`
   * placeholders resolved against designerStore at runtime (Preview + Export).
   */
  navigateTarget?: string;
  /** When true, uses history.replace instead of push (default false). */
  navigateReplace?: boolean;
  /**
   * Update Filter From Click — writes a chart data-point click payload into designerStore
   * (cross-filtering dashboards). Requires `onDataPointClick` event binding.
   */
  filterStorePath?: string;
  filterValueSource?: 'clickCategory' | 'clickSeriesKey' | 'expression';
  filterValueExpression?: string;
  /** Phase 48 — `exportData` file format (csv client-side; xlsx/pdf via server). */
  exportFormat?: DesignerExportFormat;
  /** Phase 48 — which registered live widget supplies the filtered/sorted rows. */
  exportSource?: DesignerExportDataSource;
  /** Optional download basename (extension added from `exportFormat`). */
  exportFilename?: string;
  /**
   * Trigger Workflow action — starts a published Workflow Engine definition via
   * `POST /api/workflow-runtime/definitions/:definitionId/start`.
   * Must be a positive integer string (Workflow definition id).
   */
  workflowDefinitionId?: string;
  /**
   * Maps workflow `input` fields → designerStore paths (e.g. `{ orderId: 'selection.id' }`).
   * Resolved at Preview/Export runtime into the request body `{ input: … }`.
   */
  payloadMapping?: Record<string, string>;
};

export type DesignerBindingDefinition = {
  sourceType: DesignerSourceType;
  bindingRole?: DesignerBindingRole;
  targetProp?: string;
  targetEvent?: string;
  dataPath?: string;
  valueMode?: DesignerBindingValueMode;
  fetchEndpoint?: string;
  actionType?: DesignerBindingActionType;
  endpoint?: string;
  payloadMapping?: Record<string, string>;
  /** Coerce assembled payload fields before mutation (keyed by API field name). */
  payloadFieldTransforms?: Record<string, PayloadFieldTransform>;
  /** Maps URL/header template params (e.g. userId) to bindingContext data paths. */
  urlParams?: Record<string, string>;
  /** Maps list query params (e.g. search, sortBy) to designer store paths. */
  queryParams?: Record<string, string>;
  /** Dashboard filter store paths merged into list query params (Global Filter Bar / cross-filter). */
  filterBindings?: string[];
  sourcePath?: string;
  fallbackValue?: unknown;
  transformRef?: string;
  endpointRef?: string;
  /** Shared LOV registry key — resolves fetch endpoint and column mapping at codegen/runtime. */
  lovRef?: string;
  /** Shared Data Source registry key — used by Data Region containers. */
  dataSourceRef?: string;
  /** Column name within a parent Data Region's fetched record (sourceType: regionColumn). */
  column?: string;
  /** Current-session field (sourceType: session) — resolves via ambient designerStore.user.*. */
  sessionField?: DesignerSessionField;
  /**
   * Formula expression text (sourceType: formula) — evaluated via the shared expression engine
   * (`compileDesignerConditionExpression`). Prefer `sourcePath`/`dataPath`; this mirrors them
   * when present. Persist extracted `store.*` / `data.*` deps in `formulaDependencies`.
   */
  formulaExpression?: string;
  /** Store/data paths referenced by a formula binding — change triggers for re-evaluation. */
  formulaDependencies?: string[];
  /** When true, event action submits the nearest ancestor Data Region with automatic payload mapping. */
  regionSubmit?: boolean;
  /** Region/grid load operation override — uses resource `operations` when set. */
  loadOperation?: 'list' | 'detail';
  requestConfig?: {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    headers?: Record<string, string>;
    query?: Record<string, string>;
    body?: unknown;
  };
  retryPolicy?: {
    maxAttempts?: number;
    retryDelayMs?: number;
    retryOnStatuses?: number[];
  };
  responseMapping?: string;
  errorMapping?: string;
  cachePolicy?: 'none' | 'memory' | 'session';
  timeoutMs?: number;
  /** Dot path within the document store to patch when this event fires (e.g. selection.countryId). */
  storeWritePath?: string;
  /** Fetch config keys or endpoint templates to refresh after a successful mutation. */
  invalidateQueries?: string[];
  /** Dot path in designerStore that receives the successful mutation response JSON. */
  responseStorePath?: string;
  /** Debounce mutation dispatch for high-frequency events such as onChange. */
  debounceMs?: number;
  /** Declarative Event-Action steps (Oracle APEX-style Dynamic Actions). */
  trueActions?: DesignerDynamicAction[];
  /** Grid row action → detail modal flow (see bindingGridDetailEngine). */
  gridDetailFlow?: GridDetailFlowConfig;
};

export type GridDetailFlowConfig = {
  primaryKeyField: string;
  selectionStorePath: string;
  detailDataSourceRef: string;
  detailModalNodeId: string;
  detailRegionNodeId: string;
  rowActionId: string;
  rowActionLabel: string;
};

export type DesignerStoreSegment = {
  id: string;
  initialValue?: unknown;
  hydrateFrom?: string;
  persist?: 'none' | 'session' | 'local';
};

export type DesignerDataResourceKind = 'collection' | 'record' | 'lov' | 'custom';

export type DesignerApiOperationMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type DesignerApiOperation = {
  method: DesignerApiOperationMethod;
  endpoint: string;
  /** Optional display label — used for named custom operations in Inspector pickers. */
  label?: string;
};

/** Fixed CRUD operation slots on a Data Source (excludes open-ended `custom`). */
export type DesignerDataResourceCrudKey = 'list' | 'detail' | 'create' | 'update' | 'delete';

/**
 * Known mutating slots usable by `callMutation` without looking up `operations.custom`.
 * Custom named REST ops use any other string key resolved via `operations.custom[key]`.
 */
export type DesignerKnownMutationOperation = 'create' | 'update' | 'delete';

export type DesignerDataResourceOperations = {
  list?: DesignerApiOperation;
  detail?: DesignerApiOperation;
  create?: DesignerApiOperation;
  update?: DesignerApiOperation;
  delete?: DesignerApiOperation;
  /**
   * Named non-CRUD REST operations (e.g. resetPassword, changePassword, setLocked).
   * Keys are referenced by `callMutation.mutationOperation` when not create/update/delete.
   */
  custom?: Record<string, DesignerApiOperation>;
};

export type DesignerResponseMapping = {
  dataPath?: string;
  arrayPath?: string;
  totalPath?: string;
  errorPath?: string;
};

/**
 * Push (not poll) live updates for a data source — Phase 55 / gap #32.
 * Polling remains `pollingIntervalMs`; `type: 'none'` (or omitted) disables push.
 */
export type DesignerLiveModeType = 'none' | 'sse' | 'websocket';

export type DesignerLiveMode = {
  type: DesignerLiveModeType;
  /** Optional topic filter appended as `?channel=` on the stream URL. */
  channel?: string;
};

export type DataSourceDefinition = {
  id: string;
  name: string;
  endpoint: string;
  fields: string[];
  /** Column used to detect update vs insert for automatic region DML. */
  primaryKey?: string;
  /** UX metadata — runtime region engine still uses `endpoint` + `primaryKey`. */
  kind?: DesignerDataResourceKind;
  operations?: DesignerDataResourceOperations;
  responseMapping?: DesignerResponseMapping;
  pollingIntervalMs?: number;
  /**
   * Real-time push binding (SSE / WebSocket). Independent of `pollingIntervalMs`.
   * Stream URL convention: `{endpoint}/stream` (+ optional `channel` query).
   */
  liveMode?: DesignerLiveMode;
  /**
   * How rows are fetched. Missing ≡ `'internal-api'` (AppEndO REST).
   * External types resolve through `/api/component-designer/connectors/:id/query`.
   */
  connectorType?: DesignerConnectorType;
  /** Workspace connector id when `connectorType` is not `internal-api`. */
  connectorRef?: string;
  /** GraphQL document override (otherwise connector `graphqlQuery` is used). */
  graphql?: DataSourceGraphqlConfig;
  /** Static file override (otherwise connector `staticFilePath` is used). */
  staticFile?: DataSourceStaticFileConfig;
};

export type LovDefinition = {
  id: string;
  name: string;
  endpoint: string;
  displayValue: string;
  returnValue: string;
};

export type DesignerBindingDefinitions = {
  definitions: Record<string, DesignerBindingDefinition>;
  storeSegments: Record<string, DesignerStoreSegment>;
  dataSources: Record<string, DataSourceDefinition>;
  lovs: Record<string, LovDefinition>;
};

export type DesignerDiagnostic = {
  id: string;
  code:
    | 'root-missing'
    | 'invalid-parent-child'
    | 'html5-content-model'
    | 'orphan-node'
    | 'required-prop'
    | 'prop-type'
    | 'parse-json'
    | 'parse-tsx'
    | 'sync-error'
    | 'binding-invalid'
    | 'binding-dependency'
    | 'binding-runtime'
    | 'preview-timeout'
    | 'draft-runtime'
    | 'export-invalid'
    | 'slot-unknown'
    | 'document-large'
    | 'reusable-version-stale'
    | 'legacy-palette-item'
    | 'ambiguous-repeater-alias'
    | 'invalid-repeater-alias'
    | 'a11y-missing-alt'
    | 'a11y-low-contrast'
    | 'a11y-missing-aria-label'
    | 'a11y-heading-order';
  level: 'error' | 'warning' | 'info';
  message: string;
  nodeId?: string;
  field?: string;
};

export type ReusableComponentRef = {
  refType: 'system' | 'reusable';
  refId: string;
  version?: string;
  propsOverride?: Record<string, unknown>;
  slotProjection?: Record<string, string>;
};

export type DesignerNode = {
  id: string;
  type: string;
  parentId: string | null;
  order: number;
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  binding: Record<string, DesignerBindingDefinition>;
  componentRef?: ReusableComponentRef;
  children: string[];
};

export type TemplateNodeSeed = {
  type: DesignerNode['type'];
  paletteItemId?: string;
  props?: Record<string, unknown>;
  binding?: Record<string, DesignerBindingDefinition>;
  children?: TemplateNodeSeed[];
};

import type { DesignerNodeClass, DesignerPaletteCapability } from './paletteCapabilities';

export type { DesignerNodeClass, DesignerPaletteCapability } from './paletteCapabilities';

export type DesignerPaletteItem = {
  id: string;
  label: string;
  category: DesignerPaletteCategory;
  icon: string;
  defaultProps: Record<string, unknown>;
  allowedParentTypes: string[];
  canHaveChildren: boolean;
  sourceType: DesignerPaletteSourceType;
  sourceRef?: string;
  nodeType: string;
  /**
   * Multi-role tags that drive Inspector section visibility (T1-11e).
   * An item may hold several at once (e.g. logic.repeater → container + repeatable + bindable).
   */
  capabilities?: readonly DesignerPaletteCapability[];
  /**
   * Exclusive legacy class derived from capabilities (spec 03 §4).
   * Prefer capability checks; kept so existing callers do not break.
   */
  nodeClass?: DesignerNodeClass;
  /**
   * Hidden from the Toolbox (can no longer be newly dragged in), but the catalog entry itself is
   * kept intact — unlike a hard removal, `getPaletteItemForNode`/`getPaletteItemById` still
   * resolve it normally, so already-saved documents that reference this id keep rendering,
   * validating, and exposing Inspector fields exactly as before. Use this for consolidating two
   * previously-redundant palette items into one going forward (e.g. `heroui.table` retired in
   * favor of `heroui.data-grid`) without breaking existing drafts.
   */
  legacy?: boolean;
};

export type DesignerDocument = {
  schemaVersion: string;
  id: string;
  name: string;
  rootNodeId: string;
  nodes: Record<string, DesignerNode>;
  metadata: {
    createdAt: string;
    updatedAt: string;
    shellDesigner?: ShellDesignerMetadataV1;
    creativeLanding?: CreativeLandingMetadataV1;
    /** Other Designer-owned metadata remains supported for existing generic documents. */
    [key: string]: unknown;
  };
  diagnostics: DesignerDiagnostic[];
  /** @deprecated Use pageAccess — kept for legacy drafts */
  allowedRoles?: string[];
  /** CD-J01: page-level access (FunctionAccessControl) → manifest auth JSON */
  pageAccess?: FunctionAccessControl;
};

export type DesignerViewport = {
  preset: DesignerViewportPreset;
  width: number;
  height: number;
  fillMode: DesignerCanvasFillMode;
};

export type DesignerWorkspacePrefs = {
  viewport: DesignerViewport;
};

export type DesignerState = {
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  syncDiagnostics: DesignerDiagnostic[];
  selectedNodeId: string | null;
  selectedNodeIds: string[];
  hoveredNodeId: string | null;
  paletteSearch: string;
  viewMode: DesignerViewMode;
  viewport: DesignerViewport;
  /** Canvas collaboration comments (sidecar; not undoable with document history). */
  canvasComments: DesignerCanvasComment[];
  history: {
    past: Array<{
      document: DesignerDocument;
      bindingDefinitions: DesignerBindingDefinitions;
      selectedNodeId: string | null;
      selectedNodeIds: string[];
    }>;
    future: Array<{
      document: DesignerDocument;
      bindingDefinitions: DesignerBindingDefinitions;
      selectedNodeId: string | null;
      selectedNodeIds: string[];
    }>;
    limit: number;
  };
  isDirty: boolean;
};

export type DesignerDropPosition = 'inside' | 'before' | 'after';

export type DesignerAction =
  | {
      type: 'hydrate-document';
      document: DesignerDocument;
      bindingDefinitions: DesignerBindingDefinitions;
      preferredSelectedNodeId?: string | null;
      viewport?: DesignerViewport;
      resetViewport?: boolean;
    }
  | {
      type: 'restore-viewport';
      viewport: DesignerViewport;
    }
  | {
      type: 'replace-document-from-code';
      document: DesignerDocument;
      bindingDefinitions: DesignerBindingDefinitions;
      preferredSelectedNodeId?: string | null;
    }
  | {
      type: 'set-sync-diagnostics';
      diagnostics: DesignerDiagnostic[];
    }
  | {
      type: 'clear-sync-diagnostics';
    }
  | {
      type: 'select-node';
      nodeId: string | null;
      additive?: boolean;
    }
  | {
      type: 'select-nodes';
      nodeIds: string[];
    }
  | {
      type: 'hover-node';
      nodeId: string | null;
    }
  | {
      type: 'set-document-name';
      name: string;
    }
  | {
      type: 'set-palette-search';
      value: string;
    }
  | {
      type: 'set-view-mode';
      viewMode: DesignerViewMode;
    }
  | {
      type: 'set-viewport-preset';
      preset: DesignerViewportPreset;
      width?: number;
      height?: number;
    }
  | {
      type: 'resize-canvas';
      width: number;
      height: number;
    }
  | {
      type: 'set-fill-mode';
      fillMode: DesignerCanvasFillMode;
    }
  | {
      type: 'insert-palette-item';
      itemId: string;
      parentId: string;
      index?: number;
    }
  | {
      type: 'insert-built-in-template';
      templateRoots: TemplateNodeSeed[];
      parentId: string;
      index?: number;
    }
  | {
      type: 'move-node';
      nodeId: string;
      targetParentId: string;
      index?: number;
    }
  | {
      type: 'add-layout-track';
      nodeId: string;
      axis: 'row' | 'column';
      place?: 'before' | 'after';
    }
  | {
      /** Clone a non-root node as the next sibling under the same parent. */
      type: 'duplicate-node';
      nodeId: string;
    }
  | {
      type: 'remove-node';
      nodeId: string;
    }
  | {
      type: 'remove-nodes';
      nodeIds: string[];
    }
  | {
      /**
       * Insert a cloned copy of a portable subtree (clipboard paste).
       * Source ids are remapped; `sourceRootId` must exist in `sourceNodes`.
       */
      type: 'paste-node-subtree';
      sourceNodes: Record<string, DesignerNode>;
      sourceRootId: string;
      targetParentId: string;
      index?: number;
    }
  | {
      type: 'set-node-prop';
      nodeId: string;
      key: string;
      value: unknown;
    }
  | {
      type: 'set-grid-toolbar-config';
      nodeId: string;
      config: DesignerGridToolbarConfig;
    }
  | {
      type: 'set-node-layout';
      nodeId: string;
      key: string;
      value: unknown;
    }
  | {
      type: 'set-node-visibility';
      nodeId: string;
      visible: boolean;
    }
  | {
      type: 'set-node-source-settings';
      nodeId: string;
      refType: 'system' | 'reusable';
      refId: string;
      version?: string;
      propsOverride?: Record<string, unknown>;
    }
  | {
      type: 'set-node-binding';
      nodeId: string;
      bindingKey: string;
      definition: DesignerBindingDefinition;
    }
  | {
      type: 'remove-node-binding';
      nodeId: string;
      bindingKey: string;
    }
  | {
      type: 'set-binding-definition';
      bindingKey: string;
      definition: DesignerBindingDefinition;
    }
  | {
      type: 'remove-binding-definition';
      bindingKey: string;
    }
  | {
      type: 'set-store-segment';
      segmentId: string;
      segment: DesignerStoreSegment;
    }
  | {
      type: 'remove-store-segment';
      segmentId: string;
    }
  | {
      type: 'set-data-source';
      dataSourceId: string;
      dataSource: DataSourceDefinition;
    }
  | {
      type: 'rename-data-source';
      previousDataSourceId: string;
      dataSourceId: string;
      dataSource: DataSourceDefinition;
    }
  | {
      type: 'remove-data-source';
      dataSourceId: string;
    }
  | {
      type: 'set-lov';
      lovId: string;
      lov: LovDefinition;
    }
  | {
      type: 'remove-lov';
      lovId: string;
    }
  | {
      type: 'align-nodes-in-flex';
      nodeIds: string[];
      alignment: 'start' | 'center';
    }
  | {
      type: 'undo';
    }
  | {
      type: 'redo';
    }
  | {
      type: 'validate-document';
    }
  | {
      type: 'sync-list-item-texts';
      listNodeId: string;
      texts: string[];
    }
  | {
      /** @deprecated — use set-document-page-access */
      type: 'set-document-allowed-roles';
      allowedRoles: string[];
    }
  | {
      type: 'set-document-page-access';
      pageAccess: FunctionAccessControl;
    }
  | {
      type: 'set-shell-layout-width';
      layoutWidth: 'fluid' | 'bounded';
      boundedMaxWidth?: 'sm' | 'md' | 'lg';
      boundedEdge?: 'hairline' | 'shadow' | 'outset';
      layoutWidthUserControl?: boolean;
    }
  | {
      type: 'set-node-visibility-access';
      nodeId: string;
      visibilityAccess: FunctionAccessControl;
    }
  | {
      type: 'set-node-visible-condition';
      nodeId: string;
      visibleCondition: string | undefined;
    }
  | {
      /** Phase 54 — studio canvas annotation (sidecar; does not dirty the document). */
      type: 'add-canvas-comment';
      comment: DesignerCanvasComment;
    }
  | {
      type: 'hydrate-canvas-comments';
      comments: DesignerCanvasComment[];
    }
  | {
      type: 'resolve-canvas-comment';
      commentId: string;
      resolvedAt: string;
      resolvedBy: string;
    };