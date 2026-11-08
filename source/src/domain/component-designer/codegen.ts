import type {
  DesignerBindingDefinition,
  DesignerBindingDefinitions,
  DesignerDiagnostic,
  DesignerDocument,
  DesignerDynamicAction,
  DesignerNode,
  DesignerStoreSegment,
  PayloadFieldTransform,
} from './types';
import { getStoreSegments } from './bindingRegistry';
import { DESIGNER_DOCUMENT_SCHEMA_VERSION } from './documentSchema';
import { normalizeDesignerDocument } from './documentTree';
import { normalizeBindingDefinitions, createDefaultBindingDefinitions } from './bindingRegistry';
import { DESIGNER_GENERATED_ROOT_CLASS } from './designerGeneratedRoot';
import { extractJsxStructureFingerprintFromTsx, parseDesignerTsxJsxBody } from './jsxReverseParser';
import { buildTsxImportLines, collectTsxImportRequirements } from './tsxComponentRegistry';
import { renderDesignerDocumentTsxBody, renderModalDrawerOpenStatePreambleLines } from './tsxNodeRenderer';
import { createTsxBindingRenderContext, documentHasRegionFieldValidationConstraints, renderBindingComponentPreamble, renderBindingHookDefinitions } from './bindingCodegen';
import { renderTagsInputStatePreambleLines } from './tsxParityPalette';
import { documentUsesCallMutationAction, documentUsesExportDataAction, documentUsesNavigateAction, documentUsesShowToastAction, documentUsesTriggerWorkflowAction } from './bindingDynamicActionsEngine';
import { documentUsesGridCellNavigateBehavior } from './bindingCodegen';
import { documentUsesTranslationKeys } from './translatableTextContent';
import {
  documentUsesAppTableGridCultureKeys,
  documentUsesFormFieldCultureKeys,
} from './designerGridCultureKeys';
import { sanitizeDesignerHtml } from './sanitizeDesignerHtml';
import { documentUsesDateRangeParsedValue } from './tsxPhase2Palette';
import { CHART_TOOLBAR_IMPORT_SOURCE, documentUsesChartToolbar } from './tsxVizPalette';
import { documentUsesAppTableGrid } from './designerDataGridColumns';
import { documentUsesHwyFamilyHouseholdCellClick } from '../hwy/hwyFamilyHousehold';
import { collectHwyMemberListScopedEditChromeFromGridFetches } from '../hwy/hwyMemberListScopedEditPageChrome.ts';
import { documentUsesGridAggregation } from './designerGridAggregation';
import { getNodePaletteItemId } from './runtimeShared';
import {
  isDesignerGridToolbarEnabled,
  parseDesignerGridToolbarConfig,
} from './designerGridToolbarConfig';
import { promoteHeroUiChromeOverrideImportant } from './tailwindClasses';

const documentUsesGridToolbarExport = (document: DesignerDocument): boolean => {
  for (const node of Object.values(document.nodes)) {
    const config = parseDesignerGridToolbarConfig(node.props.toolbarConfig);
    if (!isDesignerGridToolbarEnabled(config)) {
      continue;
    }
    if (config?.export?.enabled === true || config?.showExportButton === true) {
      return true;
    }
  }
  return false;
};

export type DesignerCodeFormat = 'json' | 'tsx';

export type DesignerCodeSyncResult =
  | {
      ok: true;
      document: DesignerDocument;
      bindingDefinitions: DesignerBindingDefinitions;
      jsxStructureFingerprint?: string;
    }
  | {
      ok: false;
      diagnostics: DesignerDiagnostic[];
    };

export type DesignerExportJson = {
  schema: 'component-designer-export';
  version: '1.0.0';
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
};

export const generateDesignerTsxDisplay = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition>,
): string => generateDesignerTsx(document, bindingDefinitions);

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

const PAYLOAD_FIELD_TRANSFORMS: readonly PayloadFieldTransform[] = ['string', 'number', 'boolean', 'commaSeparatedArray'];

const sanitizePayloadFieldTransforms = (value: unknown): Record<string, PayloadFieldTransform> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const entries = Object.entries(value).filter(
    (entry): entry is [string, PayloadFieldTransform] =>
      typeof entry[1] === 'string' && (PAYLOAD_FIELD_TRANSFORMS as readonly string[]).includes(entry[1]),
  );
  return entries.length > 0 ? Object.fromEntries(entries) : undefined;
};

const sanitizeDynamicAction = (value: unknown): DesignerDynamicAction | null => {
  if (!isRecord(value)) {
    return null;
  }
  const type = value.type;
  if (
    type !== 'refreshDataSource'
    && type !== 'setValue'
    && type !== 'showHide'
    && type !== 'showToast'
    && type !== 'callMutation'
    && type !== 'resetForm'
    && type !== 'navigate'
    && type !== 'updateFilterFromClick'
    && type !== 'exportData'
    && type !== 'triggerWorkflow'
  ) {
    return null;
  }
  const toastVariant = value.toastVariant === 'default'
    || value.toastVariant === 'accent'
    || value.toastVariant === 'success'
    || value.toastVariant === 'warning'
    || value.toastVariant === 'danger'
    ? value.toastVariant
    : undefined;
  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : `da_${Math.random().toString(36).slice(2)}`,
    type,
    dataSourceRef: typeof value.dataSourceRef === 'string' ? value.dataSourceRef : undefined,
    targetNodeId: typeof value.targetNodeId === 'string' ? value.targetNodeId : undefined,
    storePath: typeof value.storePath === 'string' ? value.storePath : undefined,
    valueSource: value.valueSource === 'static' || value.valueSource === 'expression' ? value.valueSource : undefined,
    staticValue: typeof value.staticValue === 'string' ? value.staticValue : undefined,
    valueExpression: typeof value.valueExpression === 'string' ? value.valueExpression : undefined,
    showHideEffect:
      value.showHideEffect === 'show' || value.showHideEffect === 'hide' || value.showHideEffect === 'toggle'
        ? value.showHideEffect
        : undefined,
    toastTitle: typeof value.toastTitle === 'string' ? value.toastTitle : undefined,
    toastDescription: typeof value.toastDescription === 'string' ? value.toastDescription : undefined,
    toastVariant,
    toastDuration: typeof value.toastDuration === 'number' && Number.isFinite(value.toastDuration)
      ? value.toastDuration
      : undefined,
    mutationOperation:
      typeof value.mutationOperation === 'string' && value.mutationOperation.trim().length > 0
        ? value.mutationOperation.trim()
        : undefined,
    mutationRecordIdStorePath: typeof value.mutationRecordIdStorePath === 'string'
      ? value.mutationRecordIdStorePath
      : undefined,
    navigateTarget: typeof value.navigateTarget === 'string' ? value.navigateTarget : undefined,
    navigateReplace: typeof value.navigateReplace === 'boolean' ? value.navigateReplace : undefined,
    filterStorePath: typeof value.filterStorePath === 'string' ? value.filterStorePath : undefined,
    filterValueSource:
      value.filterValueSource === 'clickCategory'
      || value.filterValueSource === 'clickSeriesKey'
      || value.filterValueSource === 'expression'
        ? value.filterValueSource
        : undefined,
    filterValueExpression: typeof value.filterValueExpression === 'string' ? value.filterValueExpression : undefined,
    exportFormat:
      value.exportFormat === 'csv' || value.exportFormat === 'xlsx' || value.exportFormat === 'pdf'
        ? value.exportFormat
        : undefined,
    exportSource:
      value.exportSource === 'gridListResource' || value.exportSource === 'chartDataResource'
        ? value.exportSource
        : undefined,
    exportFilename: typeof value.exportFilename === 'string' ? value.exportFilename : undefined,
    workflowDefinitionId:
      typeof value.workflowDefinitionId === 'string' && value.workflowDefinitionId.trim().length > 0
        ? value.workflowDefinitionId.trim()
        : undefined,
    payloadMapping: isRecord(value.payloadMapping)
      ? Object.fromEntries(
        Object.entries(value.payloadMapping).filter(
          (entry): entry is [string, string] => typeof entry[0] === 'string' && typeof entry[1] === 'string',
        ),
      ) as Record<string, string>
      : undefined,
  };
};

const sanitizeDynamicActions = (value: unknown): DesignerDynamicAction[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const actions = value
    .map((item) => sanitizeDynamicAction(item))
    .filter((item): item is DesignerDynamicAction => item !== null);
  return actions.length > 0 ? actions : undefined;
};

const sanitizeBindingDefinition = (value: unknown): DesignerBindingDefinition => {
  if (!isRecord(value)) {
    return { sourceType: 'static' };
  }

  const sourceType = value.sourceType;
  const safeSourceType = sourceType === 'apiRef' || sourceType === 'expression' || sourceType === 'static' || sourceType === 'store' || sourceType === 'regionColumn' || sourceType === 'session' || sourceType === 'formula'
    ? sourceType
    : 'static';

  return {
    sourceType: safeSourceType,
    sourcePath: typeof value.sourcePath === 'string' ? value.sourcePath : undefined,
    fallbackValue: value.fallbackValue,
    transformRef: typeof value.transformRef === 'string' ? value.transformRef : undefined,
    endpointRef: typeof value.endpointRef === 'string' ? value.endpointRef : undefined,
    requestConfig: isRecord(value.requestConfig) ? {
      method:
        value.requestConfig.method === 'GET' ||
        value.requestConfig.method === 'POST' ||
        value.requestConfig.method === 'PUT' ||
        value.requestConfig.method === 'PATCH' ||
        value.requestConfig.method === 'DELETE'
          ? value.requestConfig.method
          : undefined,
      headers: isRecord(value.requestConfig.headers)
        ? Object.fromEntries(Object.entries(value.requestConfig.headers).filter(([, item]) => typeof item === 'string')) as Record<string, string>
        : undefined,
      query: isRecord(value.requestConfig.query)
        ? Object.fromEntries(Object.entries(value.requestConfig.query).filter(([, item]) => typeof item === 'string')) as Record<string, string>
        : undefined,
      body: value.requestConfig.body,
    } : undefined,
    retryPolicy: isRecord(value.retryPolicy) ? {
      maxAttempts: typeof value.retryPolicy.maxAttempts === 'number' && Number.isFinite(value.retryPolicy.maxAttempts)
        ? Math.trunc(value.retryPolicy.maxAttempts)
        : undefined,
      retryDelayMs: typeof value.retryPolicy.retryDelayMs === 'number' && Number.isFinite(value.retryPolicy.retryDelayMs)
        ? Math.trunc(value.retryPolicy.retryDelayMs)
        : undefined,
      retryOnStatuses: Array.isArray(value.retryPolicy.retryOnStatuses)
        ? value.retryPolicy.retryOnStatuses.filter((item): item is number => typeof item === 'number' && Number.isFinite(item)).map((item) => Math.trunc(item))
        : undefined,
    } : undefined,
    responseMapping: typeof value.responseMapping === 'string' ? value.responseMapping : undefined,
    errorMapping: typeof value.errorMapping === 'string' ? value.errorMapping : undefined,
    cachePolicy: value.cachePolicy === 'memory' || value.cachePolicy === 'session' || value.cachePolicy === 'none' ? value.cachePolicy : undefined,
    timeoutMs: typeof value.timeoutMs === 'number' && Number.isFinite(value.timeoutMs) ? value.timeoutMs : undefined,
    bindingRole: value.bindingRole === 'property' || value.bindingRole === 'event' || value.bindingRole === 'general' ? value.bindingRole : undefined,
    targetProp: typeof value.targetProp === 'string' ? value.targetProp : undefined,
    targetEvent: typeof value.targetEvent === 'string' ? value.targetEvent : undefined,
    dataPath: typeof value.dataPath === 'string' ? value.dataPath : undefined,
    valueMode: value.valueMode === 'value' || value.valueMode === 'defaultValue' ? value.valueMode : undefined,
    fetchEndpoint: typeof value.fetchEndpoint === 'string' ? value.fetchEndpoint : undefined,
    lovRef: typeof value.lovRef === 'string' ? value.lovRef : undefined,
    dataSourceRef: typeof value.dataSourceRef === 'string' ? value.dataSourceRef : undefined,
    column: typeof value.column === 'string' ? value.column : undefined,
    sessionField:
      value.sessionField === 'userId'
      || value.sessionField === 'email'
      || value.sessionField === 'role'
      || value.sessionField === 'displayName'
        ? value.sessionField
        : undefined,
    actionType:
      value.actionType === 'POST' ||
      value.actionType === 'PUT' ||
      value.actionType === 'PATCH' ||
      value.actionType === 'DELETE'
        ? value.actionType
        : undefined,
    endpoint: typeof value.endpoint === 'string' ? value.endpoint : undefined,
    payloadMapping: isRecord(value.payloadMapping)
      ? Object.fromEntries(Object.entries(value.payloadMapping).filter(([, item]) => typeof item === 'string')) as Record<string, string>
      : undefined,
    payloadFieldTransforms: sanitizePayloadFieldTransforms(value.payloadFieldTransforms),
    urlParams: isRecord(value.urlParams)
      ? Object.fromEntries(Object.entries(value.urlParams).filter(([, item]) => typeof item === 'string')) as Record<string, string>
      : undefined,
    regionSubmit: typeof value.regionSubmit === 'boolean' ? value.regionSubmit : undefined,
    loadOperation: value.loadOperation === 'list' || value.loadOperation === 'detail' ? value.loadOperation : undefined,
    storeWritePath: typeof value.storeWritePath === 'string' ? value.storeWritePath : undefined,
    invalidateQueries: Array.isArray(value.invalidateQueries)
      ? value.invalidateQueries.filter((item): item is string => typeof item === 'string')
      : undefined,
    responseStorePath: typeof value.responseStorePath === 'string'
      ? value.responseStorePath
      : undefined,
    debounceMs: typeof value.debounceMs === 'number' && Number.isFinite(value.debounceMs) ? value.debounceMs : undefined,
    trueActions: sanitizeDynamicActions(value.trueActions),
    formulaExpression: typeof value.formulaExpression === 'string' ? value.formulaExpression : undefined,
    formulaDependencies: Array.isArray(value.formulaDependencies)
      ? value.formulaDependencies.filter((item): item is string => typeof item === 'string' && item.trim().length > 0).map((item) => item.trim())
      : undefined,
  };
};

const sanitizeBindings = (value: unknown): Record<string, DesignerBindingDefinition> => {
  if (!isRecord(value)) {
    return {};
  }

  const next: Record<string, DesignerBindingDefinition> = {};
  for (const [key, item] of Object.entries(value)) {
    next[key] = sanitizeBindingDefinition(item);
  }

  return next;
};

const sanitizeNode = (nodeId: string, value: unknown): DesignerNode | null => {
  if (!isRecord(value)) {
    return null;
  }

  const children = Array.isArray(value.children) ? value.children.filter((item): item is string => typeof item === 'string') : [];

  const props = isRecord(value.props) ? { ...value.props } : {};
  const nodeType = typeof value.type === 'string' && value.type.length > 0 ? value.type : 'text';
  const paletteItemId = typeof props._designerPaletteItemId === 'string'
    ? props._designerPaletteItemId
    : null;
  if (paletteItemId === 'form.html-editor' && typeof props.value === 'string' && props.value.length > 0) {
    props.value = sanitizeDesignerHtml(props.value);
  }

  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : nodeId,
    type: nodeType,
    parentId: typeof value.parentId === 'string' ? value.parentId : null,
    order: typeof value.order === 'number' && Number.isFinite(value.order) ? value.order : 0,
    props,
    layout: isRecord(value.layout) ? value.layout : {},
    binding: sanitizeBindings(value.binding),
    componentRef: isRecord(value.componentRef)
      ? {
          refType: value.componentRef.refType === 'system' ? 'system' : 'reusable',
          refId: typeof value.componentRef.refId === 'string' ? value.componentRef.refId : '',
          version: typeof value.componentRef.version === 'string' ? value.componentRef.version : undefined,
          propsOverride: isRecord(value.componentRef.propsOverride) ? value.componentRef.propsOverride : undefined,
          slotProjection: isRecord(value.componentRef.slotProjection)
            ? Object.fromEntries(Object.entries(value.componentRef.slotProjection).filter(([, slot]) => typeof slot === 'string')) as Record<string, string>
            : undefined,
        }
      : undefined,
    children,
  };
};

const sanitizeDocument = (value: unknown): DesignerDocument => {
  if (!isRecord(value)) {
    throw new Error('Document payload must be an object.');
  }

  if (!isRecord(value.nodes)) {
    throw new Error('Document nodes must be an object map.');
  }

  const nodes: Record<string, DesignerNode> = {};
  for (const [nodeId, rawNode] of Object.entries(value.nodes)) {
    const safeNode = sanitizeNode(nodeId, rawNode);
    if (safeNode) {
      nodes[safeNode.id] = safeNode;
    }
  }

  const rootNodeId = typeof value.rootNodeId === 'string' && value.rootNodeId.length > 0 ? value.rootNodeId : 'root';
  if (!nodes[rootNodeId]) {
    nodes[rootNodeId] = {
      id: rootNodeId,
      type: 'root',
      parentId: null,
      order: 0,
      props: {},
      layout: {},
      binding: {},
      children: [],
    };
  }

  const schemaVersion = typeof value.schemaVersion === 'string' && value.schemaVersion.trim().length > 0
    ? value.schemaVersion
    : DESIGNER_DOCUMENT_SCHEMA_VERSION;

  return {
    schemaVersion,
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : `draft-${Date.now()}`,
    name: typeof value.name === 'string' && value.name.length > 0 ? value.name : 'Imported Component',
    rootNodeId,
    nodes,
    metadata: {
      createdAt: isRecord(value.metadata) && typeof value.metadata.createdAt === 'string' ? value.metadata.createdAt : new Date().toISOString(),
      updatedAt: isRecord(value.metadata) && typeof value.metadata.updatedAt === 'string' ? value.metadata.updatedAt : new Date().toISOString(),
    },
    diagnostics: [],
  };
};

const generateDesignerJson = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition>,
): DesignerExportJson => {
  const normalizedDocument = normalizeDesignerDocument(document);
  const registry = normalizeBindingDefinitions(bindingDefinitions);

  return {
    schema: 'component-designer-export',
    version: '1.0.0',
    document: {
      ...structuredClone(normalizedDocument),
      diagnostics: [],
    },
    bindingDefinitions: structuredClone(registry),
  };
};

export const generateDesignerJsonString = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition>,
): string => JSON.stringify(generateDesignerJson(document, bindingDefinitions), null, 2);

const prepareDocumentForTsxExport = (document: DesignerDocument): DesignerDocument => {
  const next = structuredClone(document);
  for (const node of Object.values(next.nodes)) {
    const baseClassName = typeof node.props.className === 'string' ? node.props.className : '';
    if (!baseClassName.trim()) {
      continue;
    }
    node.props.className = promoteHeroUiChromeOverrideImportant(baseClassName);
  }
  return next;
};

export const generateDesignerTsx = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition>,
): string => {
  const exportDocument = prepareDocumentForTsxExport(document);
  const registry = normalizeBindingDefinitions(bindingDefinitions);
  const bindingContext = createTsxBindingRenderContext(exportDocument, registry);
  const renderedBody = renderDesignerDocumentTsxBody(exportDocument, bindingContext);
  // callMutation / export / workflow / region-submit failures all report via `toast(...)`.
  // Also enable Toast.Provider whenever any mutating event binding exists (even without an
  // explicit Show Toast success action).
  const hasMutatingEventBinding = bindingContext.plan.eventBindings.some(
    (binding) => Boolean(binding.endpoint) || Boolean(binding.regionSubmitPlan),
  );
  const usesShowToast = documentUsesShowToastAction(exportDocument)
    || documentUsesCallMutationAction(exportDocument)
    || documentUsesExportDataAction(exportDocument)
    || documentUsesTriggerWorkflowAction(exportDocument)
    || hasMutatingEventBinding;
  const usesHwyFamilyHousehold = documentUsesHwyFamilyHouseholdCellClick(exportDocument);
  const hwyMemberListScopedEditChromes = collectHwyMemberListScopedEditChromeFromGridFetches(
    bindingContext.plan.gridPlan.gridListFetches,
  );
  const usesHwyMemberListScopedEdit = hwyMemberListScopedEditChromes.length > 0;
  const usesFragmentWrapper = usesShowToast || usesHwyFamilyHousehold || usesHwyMemberListScopedEdit;
  const usesNavigate = documentUsesNavigateAction(exportDocument)
    || documentUsesGridCellNavigateBehavior(exportDocument);
  const usesExportData = documentUsesExportDataAction(exportDocument) || documentUsesGridToolbarExport(exportDocument);
  const importRequirements = collectTsxImportRequirements(exportDocument);

  const lucideIconNames = new Set<string>();
  for (const node of Object.values(exportDocument.nodes)) {
    for (const propKey of ['startIcon', 'endIcon', 'iconName', 'icon']) {
      const val = node.props[propKey];
      if (typeof val === 'string' && val) {
        lucideIconNames.add(val);
      }
    }
  }
  // Shells own the close control — no export-side Lucide X required for Modal.Header.
  // Danger confirms render Trash2 in ConfirmDialogShell title via codegen.
  const hasDangerAlertDialog = Object.values(exportDocument.nodes).some((node) => {
    const paletteId = getNodePaletteItemId(node);
    return paletteId === 'heroui.alert-dialog'
      && (node.props.tone === 'danger' || node.props.tone == null);
  });
  if (hasDangerAlertDialog) {
    lucideIconNames.add('Trash2');
  }
  if (lucideIconNames.size > 0) {
    importRequirements.push({ source: 'lucide-react', symbols: lucideIconNames });
  }

  const usesWorkspaceBackIcon = Object.values(exportDocument.nodes).some((node) => {
    const paletteId = getNodePaletteItemId(node);
    return (
      (paletteId === 'heroui.button-solid' || paletteId === 'heroui.button-outline')
      && node.props.workspaceBack === true
    );
  });
  if (usesWorkspaceBackIcon) {
    importRequirements.push({ source: '@/shared/ui', symbols: new Set(['WorkspaceBackIcon']) });
  }

  if (usesShowToast) {
    const heroImport = importRequirements.find((entry) => entry.source === '@heroui/react');
    if (heroImport) {
      heroImport.symbols.add('toast');
      heroImport.symbols.add('Toast');
    } else {
      importRequirements.push({ source: '@heroui/react', symbols: new Set(['toast', 'Toast']) });
    }
  }

  const importLines = [
    "import React from 'react';",
    ...(usesNavigate
      ? [
        "import { useLocation, useNavigate } from 'react-router-dom';",
        "import { useOptionalPlatformMount } from '@/app/platform/PlatformMountContext';",
        "import { resolvePublishedDesignerNavigateTarget } from '@/domain/component-designer/resolvePublishedDesignerNavigateTarget';",
      ]
      : []),
    ...(documentUsesTranslationKeys(exportDocument)
      || documentUsesAppTableGridCultureKeys(exportDocument)
      || documentUsesFormFieldCultureKeys(exportDocument)
      ? ["import { useCulture } from '@/core/culture/CultureContext';"]
      : []),
    ...(usesHwyFamilyHousehold
      ? ["import { useHwyFamilyHouseholdDialog } from '@/domain/hwy/useHwyFamilyHouseholdDialog';"]
      : []),
    ...(usesHwyMemberListScopedEdit
      ? ["import { HwyMemberListScopedEditPageChrome } from '@/domain/hwy/HwyMemberListScopedEditPageChrome';"]
      : []),
    ...(documentUsesDateRangeParsedValue(exportDocument, bindingContext)
      ? ["import { parseDate } from '@internationalized/date';"]
      : []),
    ...(documentUsesChartToolbar(bindingContext)
      ? [`import { DesignerChartRuntimeToolbar } from '${CHART_TOOLBAR_IMPORT_SOURCE}';`]
      : []),
    ...(documentUsesAppTableGrid(exportDocument)
      ? [
        "import { buildAppTableGridColumns } from '@/domain/component-designer/DesignerRuntimeAppTableGrid';",
        "import { applyClientGridQuery, EMPTY_GRID_QUERY, type GridQueryState } from '@/shared/lib/appTableGridQuery';",
        "import { resolveDataGridTotalCount, sliceDataGridRowsForDisplay, buildDataGridPageNumbers, applyGridAggregation } from '@/domain/component-designer/designerDataGridRuntime';",
        "import { applyDesignerGridToolbarClientFilters } from '@/domain/component-designer/designerGridToolbarConfig';",
        "import { createDefaultColumnLayout } from '@/shared/lib/appTableGridColumnLayout';",
      ]
      : []),
    ...(usesExportData
      ? [
        "import { exportDesignerData, registerDesignerExportSource, resolveRegisteredDesignerExportPayload } from '@/domain/component-designer/designerDataExport';",
      ]
      : []),
    ...(documentUsesGridAggregation(exportDocument) && !documentUsesAppTableGrid(exportDocument)
      ? ["import { applyGridAggregation } from '@/domain/component-designer/designerDataGridRuntime';"]
      : []),
    ...(documentHasRegionFieldValidationConstraints(exportDocument, registry)
      ? ["import { validateDesignerFieldNode } from '@/domain/component-designer/previewFieldValidation';"]
      : []),
    ...buildTsxImportLines(importRequirements),
  ];

  const preambleLines = [
    ...renderBindingComponentPreamble(exportDocument, registry),
    ...renderTagsInputStatePreambleLines(exportDocument, bindingContext),
    ...renderModalDrawerOpenStatePreambleLines(exportDocument, bindingContext),
  ];
  const hookDefinitionLines = renderBindingHookDefinitions(exportDocument, registry);

  // Mutation / validation failures surface via HeroUI toast (see bindingCodegen catch +
  // validation lines) — never an inline rose banner on the page.
  const rootOpen = `<div className="${DESIGNER_GENERATED_ROOT_CLASS}">`;

  const returnBlock = usesFragmentWrapper
    ? [
        '  return (',
        '    <>',
        ...(usesShowToast ? ['      <Toast.Provider />'] : []),
        ...(hwyMemberListScopedEditChromes.map(
          (entry) => `      <HwyMemberListScopedEditPageChrome listScopeLegacy=${JSON.stringify(entry.listScopeLegacy)} onSaved={() => { void ${entry.refreshVar}(); }} />`,
        )),
        ...(usesHwyFamilyHousehold ? ['      {hwyFamilyHouseholdDialog}'] : []),
        `      ${rootOpen}`,
        ...renderedBody.split('\n').map((line) => (line.length > 0 ? `  ${line}` : line)),
        '      </div>',
        '    </>',
        '  );',
      ]
    : [
        '  return (',
        `    ${rootOpen}`,
        renderedBody,
        '    </div>',
        '  );',
      ];

  const componentBody = preambleLines.length > 0
    ? [
        'export const GeneratedComponent: React.FC = () => {',
        ...preambleLines,
        ...returnBlock,
        '};',
        '',
      ]
    : [
        'export const GeneratedComponent: React.FC = () => {',
        ...returnBlock,
        '};',
        '',
      ];

  return [
    ...importLines,
    '',
    ...hookDefinitionLines,
    ...(hookDefinitionLines.length > 0 ? [''] : []),
    ...componentBody,
  ].join('\n');
};

export const generateDesignerTsxMeta = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition>,
): string => generateDesignerJsonString(document, bindingDefinitions);

const inferStoreSegmentTsType = (segment: DesignerStoreSegment): string => {
  const value = segment.initialValue;
  if (value === undefined) {
    return 'unknown';
  }

  if (typeof value === 'string') {
    return 'string';
  }

  if (typeof value === 'number') {
    return 'number';
  }

  if (typeof value === 'boolean') {
    return 'boolean';
  }

  if (value === null) {
    return 'null';
  }

  return 'unknown';
};

/** Optional `.types.ts` sidecar for generated designer components. */
export const generateDesignerTypesTs = (
  _document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition>,
): string => {
  const registry = normalizeBindingDefinitions(bindingDefinitions);
  const storeSegments = getStoreSegments(registry);
  const storeFields = Object.values(storeSegments)
    .map((segment) => `  ${JSON.stringify(segment.id)}: ${inferStoreSegmentTsType(segment)};`)
    .join('\n');

  const lines = [
    '// Generated by AppEndO Component Designer',
    '',
    '/** Root generated component accepts no external props by default. */',
    'export type GeneratedComponentProps = Record<string, never>;',
    '',
  ];

  if (storeFields.length > 0) {
    lines.push(
      'export type GeneratedComponentStore = {',
      storeFields,
      '};',
      '',
    );
  }

  return lines.join('\n');
};

/** Ensures emitted TSX does not leak designer-internal `_designer*` prop names. */
export const assertNoDesignerInternalPropsInEmittedTsx = (tsx: string): void => {
  if (/_designer/i.test(tsx)) {
    throw new Error('Emitted TSX must not contain designer-internal `_designer` props.');
  }
};

const EXPORT_SCHEMA = 'component-designer-export';
const EXPORT_VERSION = '1.0.0';

const assertExportEnvelope = (payload: Record<string, unknown>): void => {
  if (!Object.prototype.hasOwnProperty.call(payload, 'schema') && !Object.prototype.hasOwnProperty.call(payload, 'version')) {
    return;
  }

  if (payload.schema !== EXPORT_SCHEMA) {
    throw new Error(`Unsupported designer export schema: ${String(payload.schema)}`);
  }

  if (payload.version !== EXPORT_VERSION) {
    throw new Error(`Unsupported designer export version: ${String(payload.version)}`);
  }
};

export const parseDesignerJson = (jsonCode: string): { document: DesignerDocument; bindingDefinitions: DesignerBindingDefinitions } => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonCode);
  } catch (error) {
    throw new Error(`Invalid JSON: ${(error as Error).message}`);
  }

  const payload = isRecord(parsed) ? parsed : {};
  if (Object.prototype.hasOwnProperty.call(payload, 'schema') || Object.prototype.hasOwnProperty.call(payload, 'version')) {
    assertExportEnvelope(payload);
  }

  const hasExportShape = isRecord(payload.document) || isRecord(payload.bindingDefinitions);

  const documentSource = hasExportShape ? payload.document : payload;
  const bindingSource = hasExportShape ? payload.bindingDefinitions : {};

  return {
    document: normalizeDesignerDocument(sanitizeDocument(documentSource)),
    bindingDefinitions: normalizeBindingDefinitions(bindingSource),
  };
};

export const parseDesignerTsxPair = (
  tsxCode: string,
  metaContent: string,
): { document: DesignerDocument; bindingDefinitions: DesignerBindingDefinitions } => {
  const metaParsed = parseDesignerJson(metaContent);
  const syncResult = syncCodeToCanvas({
    format: 'tsx',
    code: tsxCode,
    currentDocument: metaParsed.document,
    currentBindingDefinitions: metaParsed.bindingDefinitions,
  });

  if (syncResult.ok !== true) {
    const message = syncResult.diagnostics[0]?.message ?? 'Failed to parse designer TSX pair.';
    throw new Error(message);
  }

  return {
    document: syncResult.document,
    bindingDefinitions: syncResult.bindingDefinitions,
  };
};

export const syncCodeToCanvas = (params: {
  format: DesignerCodeFormat;
  code: string;
  currentDocument?: DesignerDocument;
  currentBindingDefinitions?: DesignerBindingDefinitions | Record<string, DesignerBindingDefinition>;
}): DesignerCodeSyncResult => {
  try {
    if (params.format === 'json') {
      const parsed = parseDesignerJson(params.code);
      let bindingDefinitions = parsed.bindingDefinitions;

      try {
        const rawPayload = JSON.parse(params.code) as unknown;
        if (
          isRecord(rawPayload)
          && (isRecord(rawPayload.document) || isRecord(rawPayload.bindingDefinitions))
          && !Object.prototype.hasOwnProperty.call(rawPayload, 'bindingDefinitions')
          && params.currentBindingDefinitions
        ) {
          bindingDefinitions = normalizeBindingDefinitions(params.currentBindingDefinitions);
        }
      } catch {
        // keep parsed binding definitions
      }

      return {
        ok: true,
        document: parsed.document,
        bindingDefinitions,
      };
    }

    const baseDocument = params.currentDocument;
    if (!baseDocument) {
      throw new Error('Cannot sync TSX without an active designer document.');
    }

    const bindingDefinitions = normalizeBindingDefinitions(
      params.currentBindingDefinitions ?? createDefaultBindingDefinitions(),
    );
    const jsxParsed = parseDesignerTsxJsxBody(params.code, baseDocument, bindingDefinitions);

    const mergedDocument: DesignerDocument = normalizeDesignerDocument({
      ...jsxParsed.document,
      id: baseDocument.id,
      name: baseDocument.name,
      metadata: baseDocument.metadata,
    });

    return {
      ok: true,
      document: mergedDocument,
      bindingDefinitions,
      jsxStructureFingerprint: jsxParsed.structureFingerprint,
    };
  } catch (error) {
    const code: DesignerDiagnostic['code'] = params.format === 'json' ? 'parse-json' : 'parse-tsx';
    return {
      ok: false,
      diagnostics: [
        {
          id: `${code}:${Date.now()}`,
          code,
          level: 'error',
          message: (error as Error).message || 'Failed to parse editor code.',
        },
      ],
    };
  }
};

/**
 * Detects when a reverse-parsed document (e.g. from a hand-edited or stale companion
 * TSX file) dropped nodes compared to the document it was parsed against. A codegen/
 * reverse-parser mismatch on an unrecognized node shape can otherwise produce a
 * "successful" parse that silently strips content — this guards against trusting
 * that result as a legitimate edit (see draftTsxHydration.ts and useDesignerVersions.ts).
 */
export const documentLostContentComparedTo = (
  original: DesignerDocument,
  candidate: DesignerDocument,
): boolean => {
  const originalCount = Object.keys(original.nodes).length;
  if (originalCount <= 1) {
    return false;
  }
  const candidateCount = Object.keys(candidate.nodes).length;
  return candidateCount < originalCount;
};
