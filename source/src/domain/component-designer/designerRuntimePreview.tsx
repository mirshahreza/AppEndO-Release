import { showAppFeedbackToast } from '../../shared/ui/appFeedbackToast';
import { adminShellChromeLayersForClassName } from '../../shared/ui/AdminShellChromeLayers';
import { SiteShellHeaderWidthControl } from '../../shared/ui/shell-foundation/SiteShellHeaderWidthControl';
import {
  adminShellChromeDataAttributesForClassName,
  isPublishedAdminShellHeaderClassName,
  normalizePublishedAdminShellClassName,
} from '../../shared/ui/normalizePublishedAdminShellChrome';
import * as React from 'react';
import { UNSAFE_NavigationContext, useLocation, useNavigate } from 'react-router-dom';
import { UiClientComponent } from '../../shared/ui/UiClientComponent';
import { resolveClientComponentViewportPolicy } from '../../shared/lib/clientComponentViewport';
import { useDesignerPublishedShellMobileMenuOpen } from '../../app/platform/DesignerPublishedShellChrome';
import { useOptionalCulture } from '../../core/culture/CultureContext';
import { useOptionalPlatformMount } from '../../app/platform/PlatformMountContext';
import { AiPublishedFormAssistToolbar } from '../../shared/ui/ai-field-assist/AiPublishedFormAssistToolbar';
import { buildEuaFieldMapFromDocument, isPublishedFormAssistEnabled } from '../../shared/ui/ai-field-assist/buildEuaFieldMapFromDocument';
import { applyEuaUpdatesToDesignerStore } from '../../shared/ui/ai-field-assist/applyEuaPublishedFieldUpdates';
import { getPaletteItemForNode, isContainerNode } from './catalog';
import { resolvePublishedDesignerNavigateTarget } from './resolvePublishedDesignerNavigateTarget';
import {
  collectDocumentGridDetailFlows,
  collectGridDetailModalNodeIds,
} from './bindingGridDetailEngine';
import { createDesignerGridCellClickHandler, createDesignerGridRowActionHandler } from './bindingGridRowActionRuntime';
import { findRegionDataVarInSubtree, getNodeRegionDataSourceRef, isDataRegionEligibleContainer } from './bindingRegionEngine';
import { mapGridRowToRegionSeedRecord } from '../../shared/lib/regionSeedFromGridRow';
import { normalizeBindingDefinitions } from './bindingRegistry';
import { resolveCustomSizeDomStyle } from './customSizeStyle';
import { DESIGNER_PREVIEW_DOCUMENT_CLASS } from './designerGeneratedRoot';
import { mergeCssProperties, resolveDesignerDomProps, resolveDesignerHtmlTag, spreadDesignerDomProps } from './domProps';
import type { PreviewCultureFormatOptions } from './previewCultureFormatting';
import {
  buildPreviewDataContext,
  buildPreviewDesignerStore,
  buildPreviewDesignerStoreWithAuthUser,
  buildPreviewDesignerStoreWithRole,
  createDesignerPreviewBindingBridge,
  resolveRepeaterPreviewItems,
  type DesignerAuthUserSnapshot,
} from './designerPreviewResolvers';
import {
  persistDesignerStoreSegments,
  resolveDesignerStoreDocumentKey,
} from './bindingStorePersistence';
import {
  collectDocumentItemsFetchSources,
  fetchDesignerDocumentOptionItems,
} from './designerDocumentOptionSources';
import { renderHeroUiGenericLeafNode, renderHeroUiGenericStructuralNode } from './runtimeHeroUiGeneric';
import { isLogicRepeaterNode, resolveRepeaterNodeConfig } from './repeaterEngine';
import { renderDockPaneContainerNode, renderSplitPaneContainerNode } from './runtimePhase2Palette';
import {
  DesignerRuntimeContentStatusPicker,
  isDesignerContentStatusPickerNode,
} from './DesignerRuntimeContentStatusPicker';
import {
  isDesignerRenderableLeafNode,
  isHeroUiRealLeafNode,
  renderHeroUiRealNode,
  renderHeroUiStructuralNode,
} from './runtimeRenderer';
import { renderUniversalPaletteNode } from './designerUniversalRuntime';
import { UNIVERSAL_PALETTE_STRUCTURAL_IDS } from './runtimeShared';
import { DesignerRuntimeDashboardCanvas } from './DesignerRuntimeDashboardCanvas';
import { HwyFamilyHouseholdDialogHost } from '../hwy/HwyFamilyHouseholdDialogHost';
import { HwyImageFixPageDialogHost } from '../hwy/HwyImageFixPageDialogHost';
import { promoteHeroUiChromeOverrideImportant } from './tailwindClasses';
import { resolveImageObjectFitStyle, readNodePropForReactDomAttribute, resolveMediaFallbackSrc } from './runtimeNodeProps';
import { resolveCanvasMockEventProps, resolveCanvasTextContent } from './bindingCanvasResolver';
import {
  buildPreviewBindingContext,
  patchDesignerStorePath,
  resolveCanvasPreviewEventProps,
  type PreviewEventHandlerContext,
} from './bindingPreviewHandlers';
import { DesignerRuntimeFileUpload, resolveRuntimeFileUploadProps } from './DesignerRuntimeFileUpload';
import {
  collectDynamicActionSetValueStorePaths,
  collectDynamicActionShowHideTargetNodeIds,
  collectPreviewDataSourceHydrationTargets,
  resolveBindingOnlyVisibilityCondition,
} from './bindingDynamicActionsCodegen';
import {
  fetchDesignerHydrationData,
  fetchDesignerHydrationTargetResult,
  hydrationResultsHaveRetryableListErrors,
  hydrationResultsMissingExpectedListData,
  hydrationTotalCountKeyForDataVar,
  SHELL_HYDRATION_LIST_MAX_ATTEMPTS,
  HYDRATION_REFETCH_IN_FLIGHT_KEY,
  isDesignerHydrationRefetchInFlight,
  isHydrationFetchAbortError,
  pruneHydrationGridErrorsWhenRowsPresent,
  SHELL_HYDRATION_LIST_RETRY_DELAY_MS,
} from './designerPreviewHydration';
import {
  buildHydrationPlanKey,
  invalidateHydrationCacheForTarget,
  invalidateHydrationCache,
} from './designerPreviewHydrationCache';
import { normalizeHydrationResolvedValue, readNestedContextValue } from './bindingResourceModel';
import { readResponseTotalCount } from './designerDataGridRuntime';
import {
  applyLiveAppend,
  buildLiveStreamUrl,
  isActiveLiveMode,
  subscribeLiveDataSource,
} from './liveDataSource';
import {
  getNodeGridListResourceRef,
  resolveGridListDataVarName,
} from './bindingGridEngine';
import {
  countNodeChartDataSources,
  isNodeChartDataBound,
  resolveChartListDataVarName,
  resolveNodeChartDataSourceEntries,
  resolveChartMappingTypeFromNode,
} from './bindingChartEngine';
import {
  getNodeVizDataResourceRef,
  resolveVizListDataVarName,
} from './bindingVizEngine';
import {
  isContentDataBoundNode,
  resolveContentListDataVarName,
} from './bindingContentEngine';
import { SHELL_ROUTE_OUTLET_SLOT_ID } from '../../shared/lib/shellRouteOutlet';
import { isShellNavRegionSlotId } from '../../shared/lib/shellNavRegions';
import { isShellChromeSlotId } from '../../shared/lib/shellChromeSlots';
import { DesignerRuntimeRegisteredSlotFill } from './DesignerRuntimeRegisteredSlotFill';
import { SHELL_NAV_SLOT_NAVIGATION_REF_PROP } from '../../shared/lib/shellNavSlotProps';
import {
  getPlatformNavComponentMeta,
  isPlatformNavComponentId,
} from '../../shared/api/contracts/platform/platformNavigationComponents';
import {
  PlatformNavigationHost,
  SHELL_NAVIGATION_COMPONENT_KEY_PROP,
  SHELL_NAVIGATION_REF_PROP,
} from '../../layouts/adminShell/nav/PlatformNavigationHost';
import {
  getNodePaletteItemId,
  isHeroUiRenderedNode,
  LAYOUT_PALETTE_STRUCTURAL_IDS,
  mergeClassNames,
  mergePreviewContainerClassName,
  PER_CHILD_STRUCTURAL_IDS,
  withDesignerPageGuideHost,
} from './runtimeShared';
import { renderTailwindUiBlockContent } from './tailwindUiBlocksRuntime';
import type { DesignerBindingDefinitions, DesignerDocument, DesignerNode } from './types';
import type { DesignerPreviewBindingBridge } from './runtimeTypes';
import {
  authPrincipalFromAuthUser,
  evaluateDesignerCondition,
  isNodeVisibleForRuntime,
} from './visibilityConditionEngine';
import type { ManagedFunctionAccessPrincipal } from '../../shared/api/contracts/server-functions/accessControl';

const DEFAULT_DESIGNER_IMAGE_SRC = '/assets/designer-default-image.svg';

const resolveDesignerImageSrc = (value: unknown): string => {
  if (typeof value !== 'string') {
    return DEFAULT_DESIGNER_IMAGE_SRC;
  }
  const normalizedValue = value.trim();
  if (normalizedValue.length === 0 || normalizedValue === '/placeholder.svg') {
    return DEFAULT_DESIGNER_IMAGE_SRC;
  }
  return normalizedValue;
};

const resolvePreviewNodeLabel = (node: DesignerNode): string => {
  const paletteItem = getPaletteItemForNode(node);
  if (paletteItem) {
    return paletteItem.label;
  }

  const text = node.props.text;
  if (typeof text === 'string' && text.trim().length > 0) {
    return text.trim();
  }

  const label = node.props.label;
  if (typeof label === 'string' && label.trim().length > 0) {
    return label.trim();
  }

  return node.type;
};

const resolveNodeLayoutStyle = (node: DesignerNode): React.CSSProperties => {
  const style: React.CSSProperties = {};
  const width = node.layout.width;
  const height = node.layout.height;
  const align = node.layout.align;

  if (typeof width === 'number' && Number.isFinite(width) && width > 0) {
    style.width = width;
  }
  if (typeof height === 'number' && Number.isFinite(height) && height > 0) {
    style.minHeight = height;
  }
  if (align === 'center') {
    style.marginInline = 'auto';
  } else if (align === 'end') {
    style.marginInlineStart = 'auto';
  } else if (align === 'stretch') {
    style.width = '100%';
  }

  return style;
};

const isUnimplementedHeroUiNode = (node: DesignerNode): boolean => {
  const paletteItemId = getNodePaletteItemId(node);
  return paletteItemId !== null && paletteItemId.startsWith('heroui.') && !isHeroUiRenderedNode(node);
};

const renderPreviewPlaceholder = (
  node: DesignerNode,
  label: string,
  detail: string | null,
  style: React.CSSProperties,
  className: string | undefined,
  children: React.ReactNode | null,
): React.ReactNode => {
  const containerLike = isContainerNode(node);

  return (
    <div
      className={mergeClassNames(
        'box-border rounded-md border-2 border-dashed border-amber-300/90 bg-amber-50/60',
        containerLike ? 'w-full' : 'inline-flex min-w-[96px] max-w-full',
        !style.minHeight && !style.width ? 'min-h-[40px]' : null,
        className,
      )}
      style={style}
      data-designer-preview-placeholder="true"
      data-designer-node-type={node.type}
    >
      <div className="flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-center">
        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600/90">Preview</span>
        <span className="text-[11px] font-semibold text-amber-900">{label}</span>
        {detail ? <span className="text-[10px] font-medium text-amber-700/90">{detail}</span> : null}
      </div>
      {children}
    </div>
  );
};

type PreviewRenderScope = {
  item?: unknown;
  index?: number;
};

export type DesignerSystemComponentRenderInput = {
  node: DesignerNode;
  children: React.ReactNode;
  childElements: React.ReactNode[];
  childNodes: DesignerNode[];
  className?: string;
  style: React.CSSProperties;
};

export type DesignerRuntimeSlots = {
  routeOutlet?: React.ReactNode;
  navRegions?: Partial<Record<string, React.ReactNode>>;
  chromeSlots?: Partial<Record<string, React.ReactNode>>;
  /**
   * Resolves trusted, declarative system component references. Returning `undefined`
   * preserves the ordinary Designer renderer for documents that do not own the ID.
   */
  renderSystemComponent?: (input: DesignerSystemComponentRenderInput) => React.ReactNode | undefined;
};

type PreviewRenderContext = {
  document: DesignerDocument;
  designerStore: Record<string, unknown>;
  dataContext: Record<string, unknown>;
  previewBindings: DesignerPreviewBindingBridge;
  previewCultureFormat?: PreviewCultureFormatOptions;
  previewEvents?: PreviewEventHandlerContext;
  isSubmitting?: boolean;
  bindingDefinitions?: DesignerBindingDefinitions;
  previewFieldErrors?: Record<string, string>;
  onPreviewFieldValidation?: (nodeId: string, message: string | null) => void;
  runtimeSlots?: DesignerRuntimeSlots;
  layoutMode?: 'default' | 'shell';
  isMobileMenuOpen?: boolean;
  accessPrincipal?: ManagedFunctionAccessPrincipal | null;
  enforceAccessWhenPrincipalMissing?: boolean;
  /**
   * Live/classic designer frames are not iframes — browser media queries still see the
   * full desktop window. Collapse `md:`/`lg:` utilities to the effective unprefixed set
   * for the simulated paint tier (same idea as canvas `useCanvasPaintClassName`).
   */
  collapsePaintClassName?: (className: string) => string;
  translate?: (key: string) => string;
};

type PreviewNodeRenderBoundaryProps = {
  nodeId: string;
  nodeType: string;
  label: string;
  children: React.ReactNode;
};

type PreviewNodeRenderBoundaryState = {
  hasError: boolean;
  errorMessage: string | null;
};

class PreviewNodeRenderBoundary extends React.Component<
  PreviewNodeRenderBoundaryProps,
  PreviewNodeRenderBoundaryState
> {
  state: PreviewNodeRenderBoundaryState = { hasError: false, errorMessage: null };

  static getDerivedStateFromError(error: unknown): PreviewNodeRenderBoundaryState {
    return {
      hasError: true,
      errorMessage: error instanceof Error ? error.message : 'Render failed',
    };
  }

  componentDidUpdate(previousProps: PreviewNodeRenderBoundaryProps): void {
    if (previousProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false, errorMessage: null });
    }
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div
          className="rounded-md border-2 border-dashed border-amber-300/90 bg-amber-50/70 px-2 py-1.5"
          data-designer-preview-error="true"
          data-designer-node-id={this.props.nodeId}
          data-designer-node-type={this.props.nodeType}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Preview</p>
          <p className="text-[11px] font-semibold text-amber-900">{this.props.label}</p>
          <p className="text-[10px] text-amber-700">{this.props.nodeType}</p>
          {this.state.errorMessage ? (
            <p className="mt-1 text-[10px] text-amber-800/90">{this.state.errorMessage}</p>
          ) : null}
        </div>
      );
    }

    // display:contents keeps WYSIWYG layout intact while exposing a stable DOM hook for
    // Live Designer hit-testing (element.closest still walks display:contents ancestors).
    return (
      <span
        data-designer-node-id={this.props.nodeId}
        data-designer-node-type={this.props.nodeType}
        style={{ display: 'contents' }}
      >
        {this.props.children}
      </span>
    );
  }
}

const renderPreviewNodeBody = (
  node: DesignerNode,
  context: PreviewRenderContext,
  scope: PreviewRenderScope,
): React.ReactNode => {
  const { document, designerStore, dataContext, previewBindings } = context;
  const showHideTargetNodeIds = collectDynamicActionShowHideTargetNodeIds(document);
  const gridDetailModalNodeIds = collectGridDetailModalNodeIds(document);

  if (!isNodeVisibleForRuntime(
    node,
    designerStore,
    dataContext,
    scope,
    context.accessPrincipal ?? null,
    { enforceAccessWhenPrincipalMissing: context.enforceAccessWhenPrincipalMissing },
  )) {
    return null;
  }

  const bindingVisibilityCondition = resolveBindingOnlyVisibilityCondition(
    node,
    showHideTargetNodeIds,
    gridDetailModalNodeIds,
  );
  if (
    bindingVisibilityCondition.length > 0
    && !evaluateDesignerCondition(designerStore, dataContext, scope, bindingVisibilityCondition)
  ) {
    return null;
  }

  const domProps = resolveDesignerDomProps(node);
  const sharedDomSpread = spreadDesignerDomProps(domProps);
  let nodeClassName = promoteHeroUiChromeOverrideImportant(String(node.props.className ?? ''));
  if (context.collapsePaintClassName) {
    nodeClassName = context.collapsePaintClassName(nodeClassName);
  }
  const surfaceToken = node.props.surfaceToken;
  let tokenClass = '';
  if (typeof surfaceToken === 'string' && surfaceToken.trim().length > 0) {
    const tokenClassMap: Record<string, string> = {
      workspace: 'bg-surface-workspace',
      elevated: 'bg-surface-elevated',
      shell: 'bg-surface-shell',
      transparent: 'bg-transparent',
      menu: 'bg-nav-active',
      header: 'bg-surface-panel-muted',
    };
    tokenClass = tokenClassMap[surfaceToken.trim()] ?? '';
  }
  let resolvedDomClassName = mergeClassNames(nodeClassName, tokenClass);
  resolvedDomClassName = normalizePublishedAdminShellClassName(resolvedDomClassName);
  const adminShellChromeDataAttributes = adminShellChromeDataAttributesForClassName(resolvedDomClassName);

  const isMobileMenuOpen = context.isMobileMenuOpen ?? false;
  if (resolvedDomClassName.includes('designer-shell-sidebar')) {
    if (isMobileMenuOpen) {
      resolvedDomClassName = resolvedDomClassName
        .replace('max-md:-translate-x-full', '')
        .replace('max-md:rtl:translate-x-full', '')
        .trim();
      resolvedDomClassName = mergeClassNames(resolvedDomClassName, 'translate-x-0');
    }
  }
  // Re-read custom size from the paint-collapsed className so `lg:w-[320px]` (etc.) becomes
  // an inline width/height once the responsive prefix is stripped for the simulated tier.
  const paintCustomSizeStyle = resolveCustomSizeDomStyle({
    ...node,
    props: { ...node.props, className: nodeClassName },
  });
  const sharedNodeStyle = mergeCssProperties(
    resolveNodeLayoutStyle(node),
    domProps.style,
    paintCustomSizeStyle,
    resolveImageObjectFitStyle(node),
  );
  const paletteItemId = getNodePaletteItemId(node);
  const tailwindBlockContent = paletteItemId?.startsWith('tailwind.')
    ? renderTailwindUiBlockContent(paletteItemId, { node, previewBindings })
    : null;
  const gridListBound = Boolean(getNodeGridListResourceRef(node));
  const chartListBound = isNodeChartDataBound(node);
  const vizListBound = Boolean(getNodeVizDataResourceRef(node));
  const contentListBound = isContentDataBoundNode(node);
  const gridRows = (() => {
    if (!gridListBound) {
      return undefined;
    }

    const gridVar = resolveGridListDataVarName(node.id);
    const hydrated = dataContext[gridVar];
    if (!Array.isArray(hydrated)) {
      return undefined;
    }

    return hydrated.filter((row): row is Record<string, unknown> =>
      typeof row === 'object' && row !== null && !Array.isArray(row),
    );
  })();
  const gridListLoading = (() => {
    if (!gridListBound) {
      return false;
    }

    if (isDesignerHydrationRefetchInFlight(dataContext)) {
      return true;
    }

    const gridVar = resolveGridListDataVarName(node.id);
    if (Boolean(dataContext[`error_${gridVar}`])) {
      return false;
    }

    if (Array.isArray(dataContext[gridVar])) {
      return false;
    }

    // Published shell pages must stay in loading until list hydration settles — never
    // flash the error panel just because rows are still undefined.
    if (context.layoutMode === 'shell') {
      return true;
    }

    return Boolean(context.previewEvents?.refreshDataSource);
  })();
  const gridListError = (() => {
    if (!gridListBound) {
      return false;
    }

    if (isDesignerHydrationRefetchInFlight(dataContext)) {
      return false;
    }

    const gridVar = resolveGridListDataVarName(node.id);
    return Boolean(dataContext[`error_${gridVar}`]);
  })();
  const gridListTotalCount = (() => {
    if (!gridListBound) {
      return undefined;
    }
    const gridVar = resolveGridListDataVarName(node.id);
    const total = dataContext[`${gridVar}__total`];
    return typeof total === 'number' && Number.isFinite(total) && total >= 0 ? total : undefined;
  })();
  const chartSourceCount = chartListBound ? countNodeChartDataSources(node) : 0;
  const chartEntries = chartListBound
    ? resolveNodeChartDataSourceEntries(node, { chartTypeHint: resolveChartMappingTypeFromNode(node) })
    : [];
  const chartRows = (() => {
    if (!chartListBound || chartSourceCount !== 1) {
      return undefined;
    }

    const chartVar = resolveChartListDataVarName(node.id, 0);
    const hydrated = dataContext[chartVar];
    if (!Array.isArray(hydrated)) {
      return undefined;
    }

    return hydrated.filter((row): row is Record<string, unknown> =>
      typeof row === 'object' && row !== null && !Array.isArray(row),
    );
  })();
  const chartSourceDatasets = (() => {
    if (!chartListBound || chartSourceCount <= 1) {
      return undefined;
    }

    const datasets = chartEntries.map((entry, sourceIndex) => {
      const chartVar = resolveChartListDataVarName(node.id, sourceIndex);
      const hydrated = dataContext[chartVar];
      const rows = Array.isArray(hydrated)
        ? hydrated.filter((row): row is Record<string, unknown> =>
          typeof row === 'object' && row !== null && !Array.isArray(row),
        )
        : [];
      return { rows, fieldMapping: entry.fieldMapping };
    });
    return datasets;
  })();
  const chartListLoading = chartListBound && (
    chartSourceCount <= 1
      ? !Array.isArray(dataContext[resolveChartListDataVarName(node.id, 0)])
      : chartEntries.some((_, sourceIndex) => !Array.isArray(dataContext[resolveChartListDataVarName(node.id, sourceIndex)]))
  );
  const chartListError = chartListBound && (
    chartSourceCount <= 1
      ? Boolean(dataContext[`error_${resolveChartListDataVarName(node.id, 0)}`])
      : chartEntries.some((_, sourceIndex) => Boolean(dataContext[`error_${resolveChartListDataVarName(node.id, sourceIndex)}`]))
  );
  const vizRows = (() => {
    if (!vizListBound) {
      return undefined;
    }

    const vizVar = resolveVizListDataVarName(node.id);
    const hydrated = dataContext[vizVar];
    if (!Array.isArray(hydrated)) {
      return undefined;
    }

    return hydrated.filter((row): row is Record<string, unknown> =>
      typeof row === 'object' && row !== null && !Array.isArray(row),
    );
  })();
  const contentRows = (() => {
    if (!contentListBound) {
      return undefined;
    }

    const contentVar = resolveContentListDataVarName(node.id);
    const hydrated = dataContext[contentVar];
    if (!Array.isArray(hydrated)) {
      return undefined;
    }

    return hydrated.filter((row): row is Record<string, unknown> =>
      typeof row === 'object' && row !== null && !Array.isArray(row),
    );
  })();
  const runtimeOptions = {
    mode: 'runtime' as const,
    style: sharedNodeStyle,
    previewBindings,
    previewCultureFormat: context.previewCultureFormat,
    previewEvents: context.previewEvents,
    isSubmitting: context.isSubmitting,
    bindingDefinitions: context.bindingDefinitions,
    previewFieldErrors: context.previewFieldErrors,
    onPreviewFieldValidation: context.onPreviewFieldValidation,
    designerStore,
    dataContext,
    gridRows,
    gridListTotalCount,
    gridListBound,
    gridListLoading,
    gridListError,
    chartRows,
    chartSourceDatasets,
    chartListBound,
    chartListLoading,
    chartListError,
    onGridRowAction: context.previewEvents?.resolveGridRowAction?.(node.id),
    onGridCellClick: context.previewEvents?.resolveGridCellClick?.(node.id),
    onGridRefresh: context.previewEvents?.resolveGridRefresh?.(node.id),
    onChartRefresh: context.previewEvents?.resolveChartRefresh?.(node.id),
    vizRows,
    vizListBound,
    vizListLoading: vizListBound
      && !Array.isArray(dataContext[resolveVizListDataVarName(node.id)])
      && !Boolean(dataContext[`error_${resolveVizListDataVarName(node.id)}`]),
    vizListError: vizListBound && Boolean(dataContext[`error_${resolveVizListDataVarName(node.id)}`]),
    onVizRefresh: context.previewEvents?.resolveVizRefresh?.(node.id),
    contentRows,
    contentListBound,
    designerDocument: context.document,
    // Bug found (parity audit item 18): `logic.visibility-container`'s own `visibleCondition`
    // (evaluated inside DesignerUniversalVisibilityContainer) never received the enclosing
    // `logic.repeater`'s item/index scope — unlike the *generic* show/hide condition wrapper a
    // few lines above (line ~307), which already threads `scope` through. A nested
    // visibility-container's `item.<field>`-scoped condition always saw `item` as undefined.
    repeaterScope: scope,
    translate: context.translate,
  };
  const isContainer = isContainerNode(node);

  const renderChildNodes = (childIds: string[], childScope: PreviewRenderScope = scope): React.ReactNode[] =>
    childIds.map((childId) => (
      <React.Fragment key={childId}>{renderPreviewNode(childId, context, childScope)}</React.Fragment>
    ));

  if (node.componentRef?.refType === 'system' && context.runtimeSlots?.renderSystemComponent) {
    const childElements = node.children.map((childId) => renderPreviewNode(childId, context, scope));
    const rendered = context.runtimeSlots.renderSystemComponent({
      node,
      children: childElements,
      childElements,
      childNodes: node.children
        .map((childId) => document.nodes[childId])
        .filter((child): child is DesignerNode => Boolean(child)),
      className: resolvedDomClassName || undefined,
      style: sharedNodeStyle,
    });
    if (rendered !== undefined) {
      return rendered;
    }
  }

  if (paletteItemId && LAYOUT_PALETTE_STRUCTURAL_IDS.has(paletteItemId)) {
    if (paletteItemId === 'layout.split-pane') {
      return renderSplitPaneContainerNode(node, {
        mode: 'runtime',
        style: sharedNodeStyle,
        className: resolvedDomClassName,
        previewBindings,
        children: renderChildNodes(node.children),
      });
    }
    if (paletteItemId === 'layout.dock-pane') {
      return renderDockPaneContainerNode(node, {
        mode: 'runtime',
        style: sharedNodeStyle,
        className: resolvedDomClassName,
        previewBindings,
        children: renderChildNodes(node.children),
      });
    }
  }

  if (isDesignerContentStatusPickerNode(node)) {
    return (
      <DesignerRuntimeContentStatusPicker
        node={node}
        options={runtimeOptions}
      />
    );
  }

  if (isLogicRepeaterNode(node)) {
    const repeaterConfig = resolveRepeaterNodeConfig(node);
    const items = resolveRepeaterPreviewItems(repeaterConfig.dataPath, designerStore, dataContext, scope.item);

    return (
      <div
        {...sharedDomSpread}
        className={mergeClassNames('space-y-2', resolvedDomClassName)}
        style={sharedNodeStyle}
        data-designer-repeater-preview="true"
      >
        {items.map((item, index) => (
          <div
            key={`${node.id}-repeater-${index}`}
            className="rounded-md border border-indigo-100 bg-indigo-50/20 p-2"
            data-designer-repeater-index={index}
          >
            {renderChildNodes(node.children, { item, index })}
          </div>
        ))}
      </div>
    );
  }

  if (isUnimplementedHeroUiNode(node)) {
    return renderPreviewPlaceholder(
      node,
      resolvePreviewNodeLabel(node),
      paletteItemId,
      sharedNodeStyle,
      resolvedDomClassName,
      isContainer ? renderChildNodes(node.children) : null,
    );
  }

  if (isDesignerRenderableLeafNode(node)) {
    const realLeaf = renderHeroUiRealNode(node, runtimeOptions);
    if (realLeaf !== null) {
      return realLeaf;
    }
  }

  const childNodes = node.children.map((childId) => document.nodes[childId]).filter(Boolean);
  const childElements = renderChildNodes(node.children);

  if (paletteItemId === 'viz.dashboard-canvas') {
    return (
      <DesignerRuntimeDashboardCanvas node={node} options={runtimeOptions}>
        {childElements}
      </DesignerRuntimeDashboardCanvas>
    );
  }

  if (paletteItemId && PER_CHILD_STRUCTURAL_IDS.has(paletteItemId)) {
    const structural = renderHeroUiStructuralNode(node, {
      ...runtimeOptions,
      className: resolvedDomClassName,
      childElements,
      childNodes,
    });
    if (structural !== null) {
      return structural;
    }
  }

  const structural = renderHeroUiStructuralNode(node, {
    ...runtimeOptions,
    className: resolvedDomClassName,
    // Modal/alert-dialog partition peels footer from `childElements` (not `children`).
    // Omitting childElements left overlays with an empty body and no footer (header-only).
    children: childElements,
    childElements,
    childNodes,
  });
  if (structural !== null) {
    return structural;
  }

  if (paletteItemId && UNIVERSAL_PALETTE_STRUCTURAL_IDS.has(paletteItemId)) {
    const universalStructural = renderUniversalPaletteNode(node, runtimeOptions, childElements);
    if (universalStructural !== null) {
      return universalStructural;
    }
  }

  if (paletteItemId?.startsWith('heroui.')) {
    if (isContainer) {
      const genericStructural = renderHeroUiGenericStructuralNode(node, paletteItemId, {
        mode: 'runtime',
        style: sharedNodeStyle,
        className: resolvedDomClassName,
        children: childElements,
      });
      if (genericStructural !== null) {
        return genericStructural;
      }
    }

    const genericLeaf = renderHeroUiGenericLeafNode(node, paletteItemId, runtimeOptions);
    if (genericLeaf !== null) {
      return genericLeaf;
    }
  }

  switch (node.type) {
    case 'container':
    case 'section': {
      let htmlTag = resolveDesignerHtmlTag(node, 'div');
      if (resolvedDomClassName.includes('admin-shell-header-band') || isPublishedAdminShellHeaderClassName(resolvedDomClassName)) {
        htmlTag = 'header';
      }
      const containerClassName = mergePreviewContainerClassName(resolvedDomClassName);
      const adminShellChromeLayers = adminShellChromeLayersForClassName(resolvedDomClassName);

      if (htmlTag === 'form') {
        const formEvents = context.previewEvents
          ? resolveCanvasPreviewEventProps(node, context.previewEvents)
          : resolveCanvasMockEventProps(node);
        // Bug found (parity audit item 37): tag fields were read only from static `node.props`,
        // so Property Bindings worked in Export but were dead in interactive Preview — same gap
        // already fixed for `html.file-upload` accept/multiple via `resolveTextProp`.
        const resolveFormTextProp = (prop: string, staticFallback = ''): string => {
          const resolved = previewBindings.resolveTextProp?.(node, prop, staticFallback) ?? staticFallback;
          return resolved.trim();
        };
        const staticAction = typeof node.props.action === 'string' ? node.props.action : '';
        const staticMethod = typeof node.props.method === 'string' ? node.props.method : '';
        const staticTarget = typeof node.props.target === 'string' ? node.props.target : '';
        const staticName = typeof node.props.name === 'string' ? node.props.name : '';
        const staticId = typeof node.props.id === 'string' ? node.props.id : '';
        const staticEncType = readNodePropForReactDomAttribute(node.props, 'encType') ?? '';
        const staticAutoComplete = readNodePropForReactDomAttribute(node.props, 'autoComplete') ?? '';
        const action = resolveFormTextProp('action', staticAction);
        const method = resolveFormTextProp('method', staticMethod);
        const target = resolveFormTextProp('target', staticTarget);
        const name = resolveFormTextProp('name', staticName);
        const formId = resolveFormTextProp('id', staticId);
        const encType = resolveFormTextProp('encType', staticEncType) || resolveFormTextProp('enctype', staticEncType);
        const autoComplete = resolveFormTextProp('autoComplete', staticAutoComplete)
          || resolveFormTextProp('autocomplete', staticAutoComplete);
        const noValidateResolved = previewBindings.resolveTextProp?.(
          node,
          'noValidate',
          String(node.props.noValidate === true),
        ) ?? String(node.props.noValidate === true);
        const regionDataSourceRef = getNodeRegionDataSourceRef(node);
        const regionSubmitRootId = isDataRegionEligibleContainer(node) && regionDataSourceRef
          ? node.id
          : undefined;
        return (
          <form
            {...sharedDomSpread}
            action={action.length > 0 ? action : undefined}
            method={method.length > 0 ? method : undefined}
            encType={encType.length > 0 ? encType : undefined}
            target={target.length > 0 ? target : undefined}
            autoComplete={autoComplete.length > 0 ? autoComplete : undefined}
            noValidate={noValidateResolved === 'true' ? true : undefined}
            name={name.length > 0 ? name : undefined}
            id={formId.length > 0 ? formId : undefined}
            data-designer-node-id={regionSubmitRootId}
            className={containerClassName}
            style={sharedNodeStyle}
            onSubmit={formEvents.onSubmit as React.FormEventHandler<HTMLFormElement> | undefined}
          >
            {tailwindBlockContent}
            {childElements}
          </form>
        );
      }

      if (htmlTag === 'section') {
        return (
          <section {...sharedDomSpread} {...adminShellChromeDataAttributes} className={containerClassName} style={sharedNodeStyle}>
            {adminShellChromeLayers}
            {tailwindBlockContent}
            {childElements}
          </section>
        );
      }

      if (htmlTag === 'article') {
        return (
          <article {...sharedDomSpread} {...adminShellChromeDataAttributes} className={containerClassName} style={sharedNodeStyle}>
            {adminShellChromeLayers}
            {tailwindBlockContent}
            {childElements}
          </article>
        );
      }

      if (htmlTag === 'figure') {
        return (
          <figure {...sharedDomSpread} {...adminShellChromeDataAttributes} className={containerClassName} style={sharedNodeStyle}>
            {adminShellChromeLayers}
            {tailwindBlockContent}
            {childElements}
          </figure>
        );
      }

      if (htmlTag === 'header') {
        return (
          <header {...sharedDomSpread} {...adminShellChromeDataAttributes} className={containerClassName} style={sharedNodeStyle}>
            {adminShellChromeLayers}
            {tailwindBlockContent}
            {childElements}
          </header>
        );
      }

      const siteShellHeaderControls = containerClassName.split(/\s+/).includes('site-shell-header-controls');

      return (
        <div {...sharedDomSpread} {...adminShellChromeDataAttributes} className={containerClassName} style={sharedNodeStyle}>
          {adminShellChromeLayers}
          {tailwindBlockContent}
          {childElements}
          {siteShellHeaderControls ? <SiteShellHeaderWidthControl /> : null}
        </div>
      );
    }

    case 'list':
      return (
        <ul {...sharedDomSpread} className={resolvedDomClassName} style={sharedNodeStyle}>
          {childElements}
        </ul>
      );

    case 'text': {
      const textTag = resolveDesignerHtmlTag(node, 'p');
      return React.createElement(
        textTag,
        { ...sharedDomSpread, className: resolvedDomClassName, style: sharedNodeStyle },
        previewBindings.resolveTextContent(node, 'Text'),
      );
    }

    case 'heading': {
      const HeadingTag = (typeof node.props.level === 'string' && /^h[1-6]$/.test(node.props.level) ? node.props.level : 'h2') as 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
      return (
        <HeadingTag {...sharedDomSpread} className={resolvedDomClassName} style={sharedNodeStyle}>
          {previewBindings.resolveTextContent(node, 'Section title')}
        </HeadingTag>
      );
    }

    case 'link': {
      const linkEvents = context.previewEvents
        ? resolveCanvasPreviewEventProps(node, context.previewEvents)
        : resolveCanvasMockEventProps(node);
      // Bug found (parity audit item 37): tag fields ignored Property Bindings in Preview.
      const resolveLinkTextProp = (prop: string, staticFallback = ''): string => {
        const resolved = previewBindings.resolveTextProp?.(node, prop, staticFallback) ?? staticFallback;
        return resolved.trim();
      };
      const href = resolveLinkTextProp('href', typeof node.props.href === 'string' ? node.props.href : '');
      const target = resolveLinkTextProp('target', typeof node.props.target === 'string' ? node.props.target : '');
      const relRaw = resolveLinkTextProp('rel', typeof node.props.rel === 'string' ? node.props.rel : '');
      const rel = relRaw.length > 0 ? relRaw : (target === '_blank' ? 'noopener noreferrer' : '');
      const download = resolveLinkTextProp('download', typeof node.props.download === 'string' ? node.props.download : '');
      const referrerPolicy = resolveLinkTextProp(
        'referrerPolicy',
        typeof node.props.referrerPolicy === 'string' ? node.props.referrerPolicy : '',
      );
      return (
        <a
          {...sharedDomSpread}
          href={href.length > 0 ? href : '#'}
          target={target.length > 0 ? target : undefined}
          rel={rel.length > 0 ? rel : undefined}
          download={download.length > 0 ? download : undefined}
          referrerPolicy={referrerPolicy.length > 0 ? referrerPolicy as React.HTMLAttributeReferrerPolicy : undefined}
          className={resolvedDomClassName}
          style={sharedNodeStyle}
          onClick={linkEvents.onClick as React.MouseEventHandler<HTMLAnchorElement> | undefined}
        >
          {previewBindings.resolveTextContent(node, 'Learn more')}
        </a>
      );
    }

    case 'image': {
      const fallbackSrc = resolveMediaFallbackSrc(node);
      // Bug found (parity audit item 37): width/height/loading/decoding/srcSet/sizes were static-only
      // in Preview while Export already resolved bindings via `buildNodeJsxAttributesWithBindings`.
      const resolveImageTextProp = (prop: string, staticFallback = ''): string => {
        const resolved = previewBindings.resolveTextProp?.(node, prop, staticFallback) ?? staticFallback;
        return resolved.trim();
      };
      const staticWidth = typeof node.props.width === 'number' || typeof node.props.width === 'string'
        ? String(node.props.width)
        : '';
      const staticHeight = typeof node.props.height === 'number' || typeof node.props.height === 'string'
        ? String(node.props.height)
        : '';
      const width = resolveImageTextProp('width', staticWidth);
      const height = resolveImageTextProp('height', staticHeight);
      const loadingRaw = resolveImageTextProp(
        'loading',
        node.props.loading === 'lazy' || node.props.loading === 'eager' ? node.props.loading : '',
      );
      const decodingRaw = resolveImageTextProp(
        'decoding',
        node.props.decoding === 'async' || node.props.decoding === 'sync' || node.props.decoding === 'auto'
          ? node.props.decoding
          : '',
      );
      const srcSet = resolveImageTextProp('srcSet', typeof node.props.srcSet === 'string' ? node.props.srcSet : '');
      const sizes = resolveImageTextProp('sizes', typeof node.props.sizes === 'string' ? node.props.sizes : '');
      return (
        <img
          {...sharedDomSpread}
          src={resolveDesignerImageSrc(previewBindings.resolveImageSrc(node, typeof node.props.src === 'string' ? node.props.src : ''))}
          alt={previewBindings.resolveImageAlt(node, typeof node.props.alt === 'string' ? node.props.alt : 'Image')}
          width={width.length > 0 ? width : undefined}
          height={height.length > 0 ? height : undefined}
          loading={loadingRaw === 'lazy' || loadingRaw === 'eager' ? loadingRaw : undefined}
          decoding={decodingRaw === 'async' || decodingRaw === 'sync' || decodingRaw === 'auto' ? decodingRaw : undefined}
          srcSet={srcSet.length > 0 ? srcSet : undefined}
          sizes={sizes.length > 0 ? sizes : undefined}
          className={resolvedDomClassName}
          style={sharedNodeStyle}
          onError={fallbackSrc
            ? (event) => {
              event.currentTarget.onerror = null;
              event.currentTarget.src = fallbackSrc;
            }
            : undefined}
        />
      );
    }

    case 'iframe': {
      // Bug found (parity audit item 37): iframe tag fields ignored Property Bindings in Preview.
      const resolveIframeTextProp = (prop: string, staticFallback = ''): string => {
        const resolved = previewBindings.resolveTextProp?.(node, prop, staticFallback) ?? staticFallback;
        return resolved.trim();
      };
      const src = resolveIframeTextProp('src', typeof node.props.src === 'string' ? node.props.src : '');
      const title = resolveIframeTextProp('title', typeof node.props.title === 'string' ? node.props.title : '');
      const staticWidth = typeof node.props.width === 'string' || typeof node.props.width === 'number'
        ? String(node.props.width)
        : '';
      const staticHeight = typeof node.props.height === 'string' || typeof node.props.height === 'number'
        ? String(node.props.height)
        : '';
      const width = resolveIframeTextProp('width', staticWidth);
      const height = resolveIframeTextProp('height', staticHeight);
      const allowFullScreenResolved = previewBindings.resolveTextProp?.(
        node,
        'allowFullScreen',
        String(node.props.allowFullScreen === true),
      ) ?? String(node.props.allowFullScreen === true);
      const sandboxRaw = resolveIframeTextProp('sandbox', typeof node.props.sandbox === 'string' ? node.props.sandbox : 'allow-scripts allow-same-origin');
      const loadingRaw = resolveIframeTextProp('loading', typeof node.props.loading === 'string' ? node.props.loading : 'lazy');
      return (
        <iframe
          {...sharedDomSpread}
          src={src.length > 0 ? src : 'about:blank'}
          title={title.length > 0 ? title : 'Embedded content'}
          width={width.length > 0 ? width : undefined}
          height={height.length > 0 ? height : undefined}
          allowFullScreen={allowFullScreenResolved === 'true'}
          sandbox={sandboxRaw.length > 0 ? sandboxRaw : undefined}
          loading={loadingRaw === 'lazy' || loadingRaw === 'eager' ? loadingRaw : undefined}
          className={resolvedDomClassName}
          style={sharedNodeStyle}
        />
      );
    }

    case 'file-upload': {
      const fileUploadEvents = context.previewEvents
        ? resolveCanvasPreviewEventProps(node, context.previewEvents)
        : resolveCanvasMockEventProps(node);
      const staticProps = resolveRuntimeFileUploadProps(node.props);
      const resolvedAccept = (() => {
        const fallback = staticProps.accept ?? '';
        const resolved = previewBindings.resolveTextProp?.(node, 'accept', fallback) ?? fallback;
        return resolved.length > 0 ? resolved : undefined;
      })();
      const resolvedMultiple = (() => {
        const fallback = String(staticProps.multiple === true);
        const resolved = previewBindings.resolveTextProp?.(node, 'multiple', fallback) ?? fallback;
        return resolved === 'true';
      })();
      const resolvedUploadDestination = (() => {
        const fallback = staticProps.uploadDestination ?? '';
        const resolved = previewBindings.resolveTextProp?.(node, 'uploadDestination', fallback) ?? fallback;
        return resolved.length > 0 ? resolved : undefined;
      })();
      return (
        <DesignerRuntimeFileUpload
          {...sharedDomSpread}
          {...staticProps}
          accept={resolvedAccept}
          multiple={resolvedMultiple}
          maxFileSizeMb={previewBindings.resolveNumberProp?.(node, 'maxFileSizeMb', staticProps.maxFileSizeMb ?? 0) ?? staticProps.maxFileSizeMb}
          maxFiles={previewBindings.resolveNumberProp?.(node, 'maxFiles', staticProps.maxFiles ?? 0) ?? staticProps.maxFiles}
          uploadDestination={resolvedUploadDestination}
          className={resolvedDomClassName}
          style={sharedNodeStyle}
          onChange={fileUploadEvents.onChange as React.ChangeEventHandler<HTMLInputElement> | undefined}
        />
      );
    }

    case 'list-item':
      return (
        <li {...sharedDomSpread} className={resolvedDomClassName} style={sharedNodeStyle}>
          {typeof node.props.text === 'string' && node.props.text.trim().length > 0
            ? previewBindings.resolveTextContent(node, node.props.text)
            : resolveCanvasTextContent(node, 'List item')}
        </li>
      );

    case 'platform-nav': {
      const componentKey = typeof node.props[SHELL_NAVIGATION_COMPONENT_KEY_PROP] === 'string'
        ? node.props[SHELL_NAVIGATION_COMPONENT_KEY_PROP].trim()
        : '';
      const navigationRef = typeof node.props[SHELL_NAVIGATION_REF_PROP] === 'string'
        ? node.props[SHELL_NAVIGATION_REF_PROP].trim()
        : '';
      const meta = componentKey ? getPlatformNavComponentMeta(componentKey) : undefined;

      if (componentKey && isPlatformNavComponentId(componentKey)) {
        return (
          <div
            className={mergeClassNames('flex min-h-0 flex-1 flex-col', resolvedDomClassName)}
            style={sharedNodeStyle}
            data-platform-nav-component={componentKey}
            data-navigation-ref={navigationRef || undefined}
          >
            <PlatformNavigationHost
              navigationRef={navigationRef || null}
              componentKey={componentKey}
              className="min-h-0 flex-1"
            />
          </div>
        );
      }

      const label = meta?.label ?? (componentKey || 'Navigation component');
      return renderPreviewPlaceholder(
        node,
        label,
        navigationRef ? `navigationRef: ${navigationRef}` : 'Set navigationRef to a navigation JSON id',
        sharedNodeStyle,
        resolvedDomClassName,
        null,
      );
    }

    case 'system-slot': {
      const slotId = typeof node.props.slotId === 'string' ? node.props.slotId.trim() : '';
      const slotLabel = slotId || 'System slot';
      if (slotId === SHELL_ROUTE_OUTLET_SLOT_ID && context.runtimeSlots?.routeOutlet) {
        return (
          <div
            className={mergeClassNames('min-h-0 flex-1', resolvedDomClassName)}
            style={sharedNodeStyle}
            data-platform-slot={slotId}
          >
            {context.runtimeSlots.routeOutlet}
          </div>
        );
      }

      if (slotId === SHELL_ROUTE_OUTLET_SLOT_ID) {
        return renderPreviewPlaceholder(
          node,
          'Route Outlet',
          'Page content loads here based on the active URL',
          sharedNodeStyle,
          resolvedDomClassName,
          null,
        );
      }

      if (isShellNavRegionSlotId(slotId)) {
        const navigationRef = typeof node.props[SHELL_NAV_SLOT_NAVIGATION_REF_PROP] === 'string'
          ? node.props[SHELL_NAV_SLOT_NAVIGATION_REF_PROP].trim()
          : '';
        if (context.runtimeSlots?.navRegions?.[slotId]) {
          return (
            <div
              className={mergeClassNames('min-h-0', resolvedDomClassName)}
              style={sharedNodeStyle}
              data-platform-slot={slotId}
            >
              {context.runtimeSlots.navRegions[slotId]}
            </div>
          );
        }

        return renderPreviewPlaceholder(
          node,
          slotLabel,
          navigationRef
            ? `navigationRef: ${navigationRef}`
            : 'Set navigationRef to a navigation JSON id',
          sharedNodeStyle,
          resolvedDomClassName,
          null,
        );
      }

      if (context.runtimeSlots?.chromeSlots?.[slotId]) {
        return (
          <div
            className={mergeClassNames('min-h-0', resolvedDomClassName)}
            style={sharedNodeStyle}
            data-platform-slot={slotId}
          >
            {context.runtimeSlots.chromeSlots[slotId]}
          </div>
        );
      }

      // Bug found (parity audit item 3): the design canvas and exported code both correctly
      // resolve generic plugin-contributed slots (core.sidebar.navigation, core.dashboard.widgets,
      // core.settings.sections, core.toolbar.actions, ...) via the real `DesignerSlotPreview`
      // component, which reads the live `slotRegistry`. This render path (used for the
      // interactive preview and the published page) never consulted it at all — those slots
      // always fell straight to the static placeholder below, so real registered widgets never
      // appeared on a published page. Shell-chrome slots are untouched (still driven by
      // `runtimeSlots.chromeSlots` above, unchanged) since they need the caller-supplied real
      // provider context (`DesignerPublishedShellChromeProvider`) that only that path sets up.
      if (slotId && !isShellChromeSlotId(slotId)) {
        return (
          <div
            className={mergeClassNames('min-h-0', resolvedDomClassName)}
            style={sharedNodeStyle}
            data-platform-slot={slotId}
          >
            <DesignerRuntimeRegisteredSlotFill
              slotId={slotId}
              label={slotLabel}
              surface={typeof node.props.surface === 'string' && node.props.surface.trim().length > 0 ? node.props.surface : 'admin-shell'}
            />
          </div>
        );
      }

      return renderPreviewPlaceholder(
        node,
        slotLabel,
        slotId ? 'Available at application runtime' : null,
        sharedNodeStyle,
        resolvedDomClassName,
        null,
      );
    }

    case 'reusable-slot': {
      const componentId = typeof node.componentRef?.refId === 'string' && node.componentRef.refId.trim().length > 0
        ? node.componentRef.refId.trim()
        : (typeof node.props.componentId === 'string' ? node.props.componentId.trim() : '');
      const label = typeof node.props.label === 'string' && node.props.label.trim().length > 0
        ? node.props.label.trim()
        : (componentId || 'Reusable Component');
      const version = typeof node.componentRef?.version === 'string' ? node.componentRef.version.trim() : '';

      return (
        <div
          className={mergeClassNames('w-full', resolvedDomClassName)}
          style={sharedNodeStyle}
          data-designer-reusable-preview={componentId || undefined}
        >
          <div className="flex min-h-[72px] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-indigo-300 bg-indigo-50/80 px-4 py-3 text-center">
            <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600">Reusable Component</span>
            <span className="text-sm font-semibold text-indigo-900">{label}</span>
            {componentId ? (
              <span className="font-mono text-[10px] text-indigo-700/80">{componentId}</span>
            ) : (
              <span className="text-[10px] text-rose-600">Select a saved component in Properties.</span>
            )}
            {version ? (
              <span className="text-[10px] text-indigo-600/70">{`version ${version}`}</span>
            ) : null}
          </div>
        </div>
      );
    }

    default:
      // An unrecognized node.type must not silently discard real, valid descendant content.
      // Passing null here dropped an entire drafted subtree (e.g. a form's fields, buttons, and
      // result table) behind a single placeholder box with no error surfaced — the document's own
      // `children` array is ground truth regardless of whether this specific node.type is
      // classified as a container; a model-authored (or otherwise malformed) node.type not
      // matching the switch above generally also fails `isContainerNode`'s own checks (it has no
      // matching palette item and isn't one of the raw container types), so gating on `isContainer`
      // here would still drop content in the exact case this guards against — render whenever
      // there's real nested content instead.
      return renderPreviewPlaceholder(
        node,
        resolvePreviewNodeLabel(node),
        node.type,
        sharedNodeStyle,
        resolvedDomClassName,
        node.children.length > 0 ? childElements : null,
      );
  }
};

const renderPreviewNode = (
  nodeId: string,
  context: PreviewRenderContext,
  scope: PreviewRenderScope = {},
): React.ReactNode => {
  const node = context.document.nodes[nodeId];
  if (!node || node.layout.visible === false) {
    return null;
  }

  const label = resolvePreviewNodeLabel(node);
  const viewportPolicy = resolveClientComponentViewportPolicy({
    minViewport: node.props.minViewport,
    belowMin: node.props.belowMin,
  });
  const previewBody = withDesignerPageGuideHost(node, renderPreviewNodeBody(node, context, scope));

  return (
    <PreviewNodeRenderBoundary nodeId={node.id} nodeType={node.type} label={label}>
      {viewportPolicy.minViewport ? (
        <UiClientComponent minViewport={viewportPolicy.minViewport} belowMin={viewportPolicy.belowMin}>
          {previewBody}
        </UiClientComponent>
      ) : previewBody}
    </PreviewNodeRenderBoundary>
  );
};

export const renderDesignerDocumentPreview = (
  document: DesignerDocument,
  options?: {
    bindingDefinitions?: DesignerBindingDefinitions | Record<string, unknown>;
    previewResults?: Record<string, unknown>;
    designerStore?: Record<string, unknown>;
    /** Live store reader for Dynamic Actions (avoids stale selection after open-modal). */
    getDesignerStore?: () => Record<string, unknown>;
    onStoreChange?: (next: Record<string, unknown>) => void;
    interactive?: boolean;
  mutationError?: string | null;
  isSubmitting?: boolean;
  /** Called with null to clear, or a message — hosts should toast danger (no inline banner). */
  onMutationError?: (message: string | null) => void;
    onSubmittingChange?: (value: boolean) => void;
    onMutationLog?: PreviewEventHandlerContext['mutationCallbacks']['onLog'];
    onFieldValidationErrors?: (errors: Record<string, string>) => void;
    hydrationData?: Record<string, unknown>;
    seedRegionFromRow?: (modalNodeId: string, row: Record<string, unknown>) => void;
    refreshDataSource?: (
      dataSourceRef: string,
      dataVar?: string,
      options?: { notifyOnError?: boolean; bypassServerCache?: boolean },
    ) => Promise<void>;
    /** Injected from React (`useNavigate`) for Dynamic Action `navigate` steps. */
    navigate?: PreviewEventHandlerContext['navigate'];
    previewFieldErrors?: Record<string, string>;
    onPreviewFieldValidation?: (nodeId: string, message: string | null) => void;
    runtimeSlots?: PreviewRenderContext['runtimeSlots'];
    layoutMode?: 'default' | 'shell';
    isMobileMenuOpen?: boolean;
    accessPrincipal?: ManagedFunctionAccessPrincipal | null;
    enforceAccessWhenPrincipalMissing?: boolean;
    cultureFormat?: PreviewCultureFormatOptions;
    translate?: (key: string) => string;
    collapsePaintClassName?: PreviewRenderContext['collapsePaintClassName'];
  },
): React.ReactNode => {
  if (!document?.nodes) {
    return (
      <div className="rounded-md border-2 border-dashed border-amber-300/90 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
        Preview unavailable: layout document is missing.
      </div>
    );
  }

  const root = document.nodes[document.rootNodeId];
  if (!root) {
    return (
      <div className="rounded-md border-2 border-dashed border-amber-300/90 bg-amber-50/60 px-3 py-2 text-xs text-amber-800">
        Preview unavailable: document root is missing.
      </div>
    );
  }

  const previewResults = options?.previewResults ?? {};
  const designerStore = options?.designerStore ?? buildPreviewDesignerStore(options?.bindingDefinitions ?? {});
  const hydrationData = options?.hydrationData ?? {};
  const primaryRegionData = Object.entries(hydrationData).find(
    ([key, value]) => key.startsWith('regionData_')
      && typeof value === 'object'
      && value !== null
      && !Array.isArray(value),
  )?.[1] as Record<string, unknown> | undefined;
  const dataContext = {
    ...buildPreviewDataContext(previewResults),
    ...(primaryRegionData ?? {}),
    ...hydrationData,
  };
  const previewBindings = createDesignerPreviewBindingBridge({
    previewResults,
    designerStore,
    dataContext,
    document,
    setValueStorePathsByNodeId: collectDynamicActionSetValueStorePaths(document),
    cultureFormat: options?.cultureFormat,
    translate: options?.translate,
  });

  const bindingContext = buildPreviewBindingContext(designerStore, dataContext);
  // This is a pure render helper, not a React component. Calling a Hook here
  // attached it to DesignerDocumentPreviewInner only when that component's
  // previewContent memo recomputed. A later render that reused the memo then
  // skipped this Hook and crashed with "Rendered fewer hooks than expected".
  const bindingRegistry = normalizeBindingDefinitions(options?.bindingDefinitions ?? {});
  const gridDetailFlows = collectDocumentGridDetailFlows(document, bindingRegistry);
  const previewEvents: PreviewEventHandlerContext | undefined = options?.interactive
    ? {
      bindingContext,
      designerStore,
      getDesignerStore: options?.getDesignerStore,
      document,
      bindingDefinitions: bindingRegistry,
      patchStore: (path, value) => {
        options?.onStoreChange?.((current) => patchDesignerStorePath(current, path, value));
      },
      patchStoreState: (updater) => {
        options?.onStoreChange?.(updater);
      },
      refreshDataSource: options?.refreshDataSource,
      navigate: options?.navigate,
      seedRegionFromRow: options?.seedRegionFromRow,
      resolveGridRowAction: (gridNodeId) => {
        const gridNode = document.nodes[gridNodeId];
        const listDataSourceRef = gridNode ? getNodeGridListResourceRef(gridNode) : undefined;
        const gridActionContext = {
          patchStore: (path: string, value: unknown) => {
            options?.onStoreChange?.((current) => patchDesignerStorePath(current, path, value));
          },
          patchStoreState: (updater: (store: Record<string, unknown>) => Record<string, unknown>) => {
            options?.onStoreChange?.(updater);
          },
          navigate: options?.navigate,
          designerStore,
          document,
          bindingDefinitions: bindingRegistry,
          seedRegionFromRow: options?.seedRegionFromRow,
          refreshDataSource: listDataSourceRef && options?.refreshDataSource
            ? (dataSourceRef: string) => options.refreshDataSource!(
              dataSourceRef,
              resolveGridListDataVarName(gridNodeId),
            )
            : undefined,
          refreshDetail: (() => {
            const flow = gridDetailFlows.find((entry) => entry.gridNodeId === gridNodeId);
            if (!flow || !options?.refreshDataSource) {
              return undefined;
            }
            return () => options.refreshDataSource!(flow.config.detailDataSourceRef, flow.detailDataVar);
          })(),
        };

        return createDesignerGridRowActionHandler(
          gridNodeId,
          document,
          bindingRegistry,
          gridActionContext,
        );
      },
      resolveGridCellClick: (gridNodeId) => {
        const gridNode = document.nodes[gridNodeId];
        const listDataSourceRef = gridNode ? getNodeGridListResourceRef(gridNode) : undefined;
        const gridActionContext = {
          patchStore: (path: string, value: unknown) => {
            options?.onStoreChange?.((current) => patchDesignerStorePath(current, path, value));
          },
          patchStoreState: (updater: (store: Record<string, unknown>) => Record<string, unknown>) => {
            options?.onStoreChange?.(updater);
          },
          navigate: options?.navigate,
          designerStore,
          document,
          bindingDefinitions: bindingRegistry,
          seedRegionFromRow: options?.seedRegionFromRow,
          refreshDataSource: listDataSourceRef && options?.refreshDataSource
            ? (dataSourceRef: string) => options.refreshDataSource!(
              dataSourceRef,
              resolveGridListDataVarName(gridNodeId),
            )
            : undefined,
          refreshDetail: (() => {
            const flow = gridDetailFlows.find((entry) => entry.gridNodeId === gridNodeId);
            if (!flow || !options?.refreshDataSource) {
              return undefined;
            }
            return () => options.refreshDataSource!(flow.config.detailDataSourceRef, flow.detailDataVar);
          })(),
        };

        return createDesignerGridCellClickHandler(
          gridNodeId,
          document,
          bindingRegistry,
          gridActionContext,
        );
      },
      resolveGridRefresh: (gridNodeId) => {
        const gridNode = document.nodes[gridNodeId];
        const dataSourceRef = gridNode ? getNodeGridListResourceRef(gridNode) : undefined;
        if (!dataSourceRef || !options?.refreshDataSource) {
          return undefined;
        }

        const dataVar = resolveGridListDataVarName(gridNodeId);
        return () => {
          void options.refreshDataSource!(dataSourceRef, dataVar, {
            notifyOnError: true,
            bypassServerCache: true,
          });
        };
      },
      resolveChartRefresh: (chartNodeId) => {
        const chartNode = document.nodes[chartNodeId];
        if (!chartNode || !isNodeChartDataBound(chartNode) || !options?.refreshDataSource) {
          return undefined;
        }

        const entries = resolveNodeChartDataSourceEntries(chartNode);
        return () => {
          void Promise.all(entries.map((entry, sourceIndex) =>
            options.refreshDataSource!(
              entry.dataSourceRef,
              resolveChartListDataVarName(chartNodeId, sourceIndex),
            ),
          ));
        };
      },
      resolveVizRefresh: (vizNodeId) => {
        const vizNode = document.nodes[vizNodeId];
        const dataSourceRef = vizNode ? getNodeVizDataResourceRef(vizNode) : undefined;
        if (!dataSourceRef || !options?.refreshDataSource) {
          return undefined;
        }

        const dataVar = resolveVizListDataVarName(vizNodeId);
        return () => {
          void options.refreshDataSource!(dataSourceRef, dataVar);
        };
      },
      isSubmitting: options.isSubmitting ?? false,
      mutationCallbacks: {
        onSubmittingChange: options.onSubmittingChange,
        onError: options.onMutationError,
        onLog: options.onMutationLog,
        onFieldValidationErrors: options.onFieldValidationErrors,
      },
    }
    : undefined;

  const context: PreviewRenderContext = {
    document,
    designerStore,
    dataContext,
    previewBindings,
    previewCultureFormat: options?.cultureFormat,
    previewEvents,
    isSubmitting: options?.isSubmitting,
    bindingDefinitions: options?.bindingDefinitions,
    previewFieldErrors: options?.previewFieldErrors,
    onPreviewFieldValidation: options?.onPreviewFieldValidation,
    runtimeSlots: options?.runtimeSlots,
    layoutMode: options?.layoutMode,
    isMobileMenuOpen: options?.isMobileMenuOpen,
    accessPrincipal: options?.accessPrincipal,
    enforceAccessWhenPrincipalMissing: options?.enforceAccessWhenPrincipalMissing,
    collapsePaintClassName: options?.collapsePaintClassName,
    translate: options?.translate,
  };

  if (root.children.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-slate-200 bg-slate-50/60 px-3 py-4 text-center text-xs text-slate-500">
        Empty layout — add components to the canvas to preview them here.
      </div>
    );
  }

  return (
    <div className={options?.layoutMode === 'shell' ? 'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col' : DESIGNER_PREVIEW_DOCUMENT_CLASS}>
      {root.children.map((childId) => (
        <React.Fragment key={childId}>{renderPreviewNode(childId, context)}</React.Fragment>
      ))}
    </div>
  );
};

export type DesignerDocumentPreviewProps = {
  document: DesignerDocument;
  bindingDefinitions?: DesignerBindingDefinitions | Record<string, unknown>;
  previewResults?: Record<string, unknown>;
  interactive?: boolean;
  onMutationLog?: PreviewEventHandlerContext['mutationCallbacks']['onLog'];
  runtimeSlots?: PreviewRenderContext['runtimeSlots'];
  layoutMode?: 'default' | 'shell';
  /** CD-J02 — simulate preview visibility for a specific role */
  simulatedRole?: string;
  /** Published runtime — enforce element access for the signed-in user */
  authUser?: DesignerAuthUserSnapshot | null;
  /** Deep-link path params (e.g. edit splat → id) merged into store.routeParams / urlParams */
  routeParams?: Record<string, string>;
  /** Collapse responsive utilities for a simulated designer paint tier (Live/classic frames). */
  collapsePaintClassName?: PreviewRenderContext['collapsePaintClassName'];
};

/**
 * When mounted inside a react-router tree, captures `useNavigate` and forwards it into the
 * non-React Dynamic Actions runtime. Outside a Router (e.g. many unit tests), navigate actions
 * are simply no-ops — same fail-soft pattern as a missing `refreshDataSource` callback.
 */
const DesignerDocumentPreviewNavigateBridge: React.FC<{
  children: (navigate: PreviewEventHandlerContext['navigate']) => React.ReactNode;
}> = ({ children }) => {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const mount = useOptionalPlatformMount();
  const navigateFn = React.useCallback<NonNullable<PreviewEventHandlerContext['navigate']>>(
    (to, options) => {
      const resolved = resolvePublishedDesignerNavigateTarget(
        to,
        pathname,
        mount?.pathPrefix,
      );
      navigate(resolved, { replace: options?.replace === true });
    },
    [mount?.pathPrefix, navigate, pathname],
  );
  return <>{children(navigateFn)}</>;
};

const DesignerDocumentPreviewInner: React.FC<DesignerDocumentPreviewProps & {
  navigate?: PreviewEventHandlerContext['navigate'];
}> = ({
  document,
  bindingDefinitions = {},
  previewResults = {},
  interactive = true,
  onMutationLog,
  runtimeSlots,
  layoutMode = 'default',
  simulatedRole = '',
  authUser = null,
  routeParams,
  collapsePaintClassName,
  navigate,
}) => {
  const culture = useOptionalCulture();
  const isMobileMenuOpen = useDesignerPublishedShellMobileMenuOpen();
  const storeDocumentKey = React.useMemo(
    () => resolveDesignerStoreDocumentKey(document),
    [document.id, document.name],
  );
  const buildDesignerStore = React.useCallback(() => {
    if (simulatedRole.trim().length > 0) {
      return buildPreviewDesignerStoreWithRole(
        bindingDefinitions,
        simulatedRole,
        routeParams,
        storeDocumentKey,
        document,
      );
    }
    if (authUser) {
      return buildPreviewDesignerStoreWithAuthUser(
        bindingDefinitions,
        authUser,
        routeParams,
        storeDocumentKey,
        document,
      );
    }
    return buildPreviewDesignerStore(bindingDefinitions, routeParams, storeDocumentKey, document);
  }, [authUser, bindingDefinitions, document, routeParams, simulatedRole, storeDocumentKey]);

  const [designerStore, setDesignerStore] = React.useState<Record<string, unknown>>(buildDesignerStore);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [previewFieldErrors, setPreviewFieldErrors] = React.useState<Record<string, string>>({});
  const [optionPreviewResults, setOptionPreviewResults] = React.useState<Record<string, unknown>>({});
  const [hydrationData, setHydrationData] = React.useState<Record<string, unknown>>({});
  const hydrationFetchOptions = React.useMemo(
    () => ({ allowFixtureFallback: layoutMode !== 'shell' }),
    [layoutMode],
  );
  /** Bumps when a refresh/effect starts so an in-flight hydrate cannot overwrite fresher rows. */
  const hydrationEpochRef = React.useRef(0);
  const hydrationPlanKeyRef = React.useRef<string | null>(null);
  const hydrationDynamicStoreKeyRef = React.useRef<string | null>(null);

  const reportMutationError = React.useCallback((message: string | null) => {
    if (message && message.trim().length > 0) {
      showAppFeedbackToast(message.trim(), { variant: 'danger' });
    }
  }, []);

  const designerStoreRef = React.useRef(designerStore);
  designerStoreRef.current = designerStore;

  const commitDesignerStore = React.useCallback((
    next: Record<string, unknown> | ((current: Record<string, unknown>) => Record<string, unknown>),
  ) => {
    setDesignerStore((current) => {
      const resolved = typeof next === 'function' ? next(current) : next;
      designerStoreRef.current = resolved;
      persistDesignerStoreSegments(resolved, bindingDefinitions, storeDocumentKey);
      return resolved;
    });
  }, [bindingDefinitions, storeDocumentKey]);

  React.useLayoutEffect(() => {
    setDesignerStore(buildDesignerStore());
  }, [buildDesignerStore, document.id]);

  const accessPrincipal = React.useMemo(() => {
    if (simulatedRole.trim().length > 0) {
      const role = simulatedRole.trim().toUpperCase();
      return authPrincipalFromAuthUser({ id: 0, email: '', role, roles: [role] });
    }
    return authPrincipalFromAuthUser(authUser);
  }, [authUser, simulatedRole]);

  const hydrationTargets = React.useMemo(
    () => collectPreviewDataSourceHydrationTargets(document, bindingDefinitions),
    [bindingDefinitions, document],
  );

  const hydrationPlanKey = React.useMemo(
    () => buildHydrationPlanKey(hydrationTargets),
    [hydrationTargets],
  );

  const routeParamsSignature = React.useMemo(
    () => JSON.stringify(routeParams ?? {}),
    [routeParams],
  );

  /** Published shell: re-hydrate when auth snapshot becomes available (grid query keys may be unchanged). */
  const shellAuthHydrationKey = React.useMemo(() => {
    if (layoutMode !== 'shell') {
      return '';
    }
    if (authUser?.id != null && Number.isFinite(Number(authUser.id))) {
      return String(authUser.id);
    }
    return 'anonymous';
  }, [authUser?.id, layoutMode]);

  const dynamicHydrationStoreKey = React.useMemo(() => {
    const paramTargets = hydrationTargets.filter((target) => (
      Object.keys(target.urlParams ?? {}).length > 0
      || Object.keys(target.queryParams ?? {}).length > 0
    ));
    if (paramTargets.length === 0) {
      return '';
    }

    return paramTargets
      .map((target) => [
        ...Object.values(target.urlParams ?? {}),
        ...Object.values(target.queryParams ?? {}),
      ]
        .map((dataPath) => {
          const value = readNestedContextValue(designerStore, dataPath);
          return value === undefined || value === null ? '' : String(value);
        })
        .join(':'))
      .join('|');
  }, [designerStore, hydrationTargets]);

  const seedRegionFromRow = React.useCallback((modalNodeId: string, row: Record<string, unknown>) => {
    const regionTarget = findRegionDataVarInSubtree(document, modalNodeId);
    if (!regionTarget || regionTarget.loadOperation !== 'detail') {
      return;
    }

    setHydrationData((current) => ({
      ...current,
      [regionTarget.dataVar]: mapGridRowToRegionSeedRecord(row),
    }));
  }, [document]);

  React.useEffect(() => {
    let cancelled = false;
    const epoch = ++hydrationEpochRef.current;

    if (hydrationPlanKeyRef.current !== hydrationPlanKey) {
      invalidateHydrationCache();
      hydrationPlanKeyRef.current = hydrationPlanKey;
      hydrationDynamicStoreKeyRef.current = dynamicHydrationStoreKey;
      if (!cancelled && epoch === hydrationEpochRef.current) {
        setHydrationData({});
      }
    } else if (hydrationDynamicStoreKeyRef.current !== dynamicHydrationStoreKey) {
      invalidateHydrationCache();
      hydrationDynamicStoreKeyRef.current = dynamicHydrationStoreKey;
    }

    const markRefetchInFlight = dynamicHydrationStoreKey.trim().length > 0;
    if (markRefetchInFlight && !cancelled) {
      setHydrationData((current) => {
        const next: Record<string, unknown> = {
          ...current,
          [HYDRATION_REFETCH_IN_FLIGHT_KEY]: true,
        };
        for (const target of hydrationTargets) {
          delete next[`error_${target.dataVar}`];
        }
        return next;
      });
    }

    const applyHydrationResults = (results: Record<string, unknown>) => {
      setHydrationData((current) => {
        const next: Record<string, unknown> = { ...current, ...results };
        delete next[HYDRATION_REFETCH_IN_FLIGHT_KEY];
        for (const target of hydrationTargets) {
          if (results[target.dataVar] !== undefined) {
            delete next[`error_${target.dataVar}`];
          }
          const totalKey = hydrationTotalCountKeyForDataVar(target.dataVar);
          if (results[totalKey] !== undefined) {
            delete next[`error_${totalKey}`];
          }
        }
        pruneHydrationGridErrorsWhenRowsPresent(next, hydrationTargets);
        return next;
      });
    };

    const run = async (attempt = 0) => {
      if (hydrationTargets.length === 0) {
        if (!cancelled && epoch === hydrationEpochRef.current) {
          setHydrationData({});
        }
        return;
      }

      try {
        const results = await fetchDesignerHydrationData(
          hydrationTargets,
          designerStoreRef.current,
          {
            ...hydrationFetchOptions,
            bypassCache: attempt > 0,
          },
        );
        if (cancelled || epoch !== hydrationEpochRef.current) {
          return;
        }

        const shouldRetryShellList = layoutMode === 'shell'
          && attempt < SHELL_HYDRATION_LIST_MAX_ATTEMPTS - 1
          && (
            hydrationResultsHaveRetryableListErrors(results, hydrationTargets)
            || hydrationResultsMissingExpectedListData(results, hydrationTargets)
          );

        if (shouldRetryShellList) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, SHELL_HYDRATION_LIST_RETRY_DELAY_MS);
          });
          if (cancelled || epoch !== hydrationEpochRef.current) {
            return;
          }
          invalidateHydrationCache();
          return run(attempt + 1);
        }

        applyHydrationResults(results);
      } catch (error) {
        if (isHydrationFetchAbortError(error) || cancelled || epoch !== hydrationEpochRef.current) {
          return;
        }
        if (layoutMode === 'shell' && attempt < SHELL_HYDRATION_LIST_MAX_ATTEMPTS - 1) {
          await new Promise((resolve) => {
            window.setTimeout(resolve, SHELL_HYDRATION_LIST_RETRY_DELAY_MS);
          });
          if (cancelled || epoch !== hydrationEpochRef.current) {
            return;
          }
          invalidateHydrationCache();
          return run(attempt + 1);
        }
        applyHydrationResults(
          Object.fromEntries(
            hydrationTargets
              .filter((target) => target.resultShape !== 'record')
              .map((target) => [`error_${target.dataVar}`, true]),
          ),
        );
      }
    };

    void run();

    return () => {
      cancelled = true;
      if (markRefetchInFlight) {
        setHydrationData((current) => {
          if (current[HYDRATION_REFETCH_IN_FLIGHT_KEY] !== true) {
            return current;
          }
          const next = { ...current };
          delete next[HYDRATION_REFETCH_IN_FLIGHT_KEY];
          return next;
        });
      }
    };
  }, [
    hydrationPlanKey,
    dynamicHydrationStoreKey,
    hydrationTargets,
    hydrationFetchOptions,
    routeParamsSignature,
    shellAuthHydrationKey,
    layoutMode,
  ]);

  const refreshDataSource = React.useCallback(async (
    dataSourceRef: string,
    dataVar?: string,
    refreshOptions?: { notifyOnError?: boolean; bypassServerCache?: boolean },
  ) => {
    const matchingTargets = hydrationTargets.filter((entry) => {
      if (dataVar?.trim()) {
        return entry.dataVar === dataVar.trim();
      }

      return entry.dataSourceId === dataSourceRef;
    });
    if (matchingTargets.length === 0) {
      return;
    }

    // Claim the epoch so a slower initial/effect hydrate cannot re-apply stale list rows
    // after a successful delete/update refresh.
    const epoch = ++hydrationEpochRef.current;

    setHydrationData((current) => ({
      ...current,
      [HYDRATION_REFETCH_IN_FLIGHT_KEY]: true,
    }));

    // When a dataSource is shared by a Region form and a list widget (grid/chart/viz), prefer
    // refreshing every matching target so "refresh after save" updates the visible list — not
    // only the first (often regionData_*) entry in hydrationTargets.
    const store = designerStoreRef.current;

    try {
      await Promise.all(matchingTargets.map(async (target) => {
        try {
          invalidateHydrationCacheForTarget(target, store);
          const { resolved, rawPayload } = await fetchDesignerHydrationTargetResult(target, store, {
            bypassCache: true,
            bypassServerCache: refreshOptions?.bypassServerCache === true,
          });
          const normalized = normalizeHydrationResolvedValue(
            resolved,
            target.resultShape ?? (Object.keys(target.urlParams ?? {}).length > 0 ? 'record' : 'rows'),
          );
          if (normalized !== undefined && normalized !== null && epoch === hydrationEpochRef.current) {
            setHydrationData((current) => {
              const next: Record<string, unknown> = {
                ...current,
                [target.dataVar]: normalized,
              };
              delete next[`error_${target.dataVar}`];
              const totalPath = target.responseMapping?.totalPath?.trim();
              if (totalPath && (target.resultShape === 'rows' || (target.resultShape ?? 'rows') === 'rows')) {
                const total = readResponseTotalCount(rawPayload, totalPath);
                if (Number.isFinite(total) && total >= 0) {
                  next[hydrationTotalCountKeyForDataVar(target.dataVar)] = total;
                }
              }
              return next;
            });
          }
        } catch (error) {
          if (refreshOptions?.notifyOnError === true) {
            const message = error instanceof Error ? error.message : 'Could not refresh list.';
            showAppFeedbackToast(message, { variant: 'danger' });
          }
          if (epoch !== hydrationEpochRef.current) {
            return;
          }
          setHydrationData((current) => {
            const next: Record<string, unknown> = {
              ...current,
              [`error_${target.dataVar}`]: true,
            };
            pruneHydrationGridErrorsWhenRowsPresent(next, [target]);
            return next;
          });
        }
      }));
    } finally {
      if (epoch === hydrationEpochRef.current) {
        setHydrationData((current) => {
          if (current[HYDRATION_REFETCH_IN_FLIGHT_KEY] !== true) {
            return current;
          }
          const next = { ...current };
          delete next[HYDRATION_REFETCH_IN_FLIGHT_KEY];
          return next;
        });
      }
    }
  }, [hydrationTargets]);

  React.useEffect(() => {
    const activeIntervals: number[] = [];

    for (const target of hydrationTargets) {
      const intervalMs = target.pollingIntervalMs;
      if (intervalMs && intervalMs > 0) {
        const timerId = window.setInterval(async () => {
          if (typeof window !== 'undefined' && window.document && window.document.hidden) {
            return;
          }

          try {
            await refreshDataSource(target.dataSourceId, target.dataVar);
          } catch {
            // Ignore polling errors in preview
          }
        }, intervalMs);

        activeIntervals.push(timerId);
      }
    }

    return () => {
      for (const timerId of activeIntervals) {
        window.clearInterval(timerId);
      }
    };
  }, [hydrationTargets, refreshDataSource]);

  // Phase 55 — real-time push (SSE / WebSocket). Browser connects directly to the data
  // source stream URL; AppEndO Node does not multiplex these sockets (Live Runtime safe).
  React.useEffect(() => {
    const subscriptions: Array<{ close: () => void }> = [];

    for (const target of hydrationTargets) {
      const liveMode = target.liveMode;
      if (!isActiveLiveMode(liveMode)) {
        continue;
      }
      const streamUrl = buildLiveStreamUrl(target.endpoint, liveMode);
      if (!streamUrl) {
        continue;
      }

      const writeSnapshot = (payload: unknown) => {
        const normalized = normalizeHydrationResolvedValue(
          payload,
          target.resultShape ?? (Object.keys(target.urlParams ?? {}).length > 0 ? 'record' : 'rows'),
        );
        if (normalized === undefined || normalized === null) {
          return;
        }
        setHydrationData((current) => ({
          ...current,
          [target.dataVar]: normalized,
        }));
      };

      subscriptions.push(subscribeLiveDataSource(streamUrl, liveMode.type, {
        onSnapshot: writeSnapshot,
        onAppend: (payload) => {
          setHydrationData((current) => {
            const previous = current[target.dataVar];
            const merged = applyLiveAppend(previous, payload);
            const normalized = normalizeHydrationResolvedValue(
              merged,
              target.resultShape ?? 'rows',
            );
            if (normalized === undefined || normalized === null) {
              return current;
            }
            return { ...current, [target.dataVar]: normalized };
          });
        },
        onRefresh: () => {
          void refreshDataSource(target.dataSourceId, target.dataVar);
        },
      }));
    }

    return () => {
      for (const subscription of subscriptions) {
        subscription.close();
      }
    };
  }, [hydrationTargets, refreshDataSource]);

  const optionSources = React.useMemo(
    () => collectDocumentItemsFetchSources(document, bindingDefinitions),
    [bindingDefinitions, document],
  );

  const optionSourcesKey = React.useMemo(
    () => optionSources.map((source) => `${source.nodeId}:${source.endpoint}`).join('\n'),
    [optionSources],
  );

  React.useEffect(() => {
    if (optionSources.length === 0) {
      setOptionPreviewResults({});
      return undefined;
    }

    let cancelled = false;

    const load = async () => {
      const results: Record<string, unknown> = {};

      await Promise.all(optionSources.map(async (source) => {
        const items = await fetchDesignerDocumentOptionItems(source.endpoint, source.lovMapping);
        if (!cancelled) {
          results[`node:${source.nodeId}:prop:items`] = items;
        }
      }));

      if (!cancelled) {
        setOptionPreviewResults((current) => {
          const nextKeys = Object.keys(results).sort().join('\n');
          const currentKeys = Object.keys(current).sort().join('\n');
          if (nextKeys === currentKeys) {
            const unchanged = Object.entries(results).every(([key, value]) => {
              const existing = current[key];
              return JSON.stringify(existing) === JSON.stringify(value);
            });
            if (unchanged) {
              return current;
            }
          }
          return results;
        });
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [optionSources, optionSourcesKey]);

  const mergedPreviewResults = React.useMemo(
    () => ({
      ...optionPreviewResults,
      ...previewResults,
    }),
    [optionPreviewResults, previewResults],
  );

  const handleFieldValidationErrors = React.useCallback((errors: Record<string, string>) => {
    setPreviewFieldErrors(errors);
    const messages = Object.values(errors).map((message) => message.trim()).filter(Boolean);
    if (messages.length > 0) {
      showAppFeedbackToast(messages.join(' '), { variant: 'danger' });
    }
  }, []);

  const handlePreviewFieldValidation = React.useCallback((nodeId: string, message: string | null) => {
    setPreviewFieldErrors((current) => {
      if (!message) {
        if (!(nodeId in current)) {
          return current;
        }
        const next = { ...current };
        delete next[nodeId];
        return next;
      }

      if (current[nodeId] === message) {
        return current;
      }

      return {
        ...current,
        [nodeId]: message,
      };
    });
  }, []);

  const previewContent = React.useMemo(
    () => renderDesignerDocumentPreview(document, {
      bindingDefinitions,
      previewResults: mergedPreviewResults,
      designerStore,
      onStoreChange: commitDesignerStore,
      getDesignerStore: () => designerStoreRef.current,
      interactive,
      isSubmitting,
      onMutationError: reportMutationError,
      onSubmittingChange: setIsSubmitting,
      onMutationLog,
      onFieldValidationErrors: handleFieldValidationErrors,
      previewFieldErrors,
      onPreviewFieldValidation: handlePreviewFieldValidation,
      hydrationData,
      seedRegionFromRow,
      refreshDataSource,
      navigate,
      runtimeSlots,
      layoutMode,
      isMobileMenuOpen,
      accessPrincipal,
      enforceAccessWhenPrincipalMissing: Boolean(authUser) && simulatedRole.trim().length === 0,
      cultureFormat: culture ? { locale: culture.locale, calendar: culture.calendar } : undefined,
      translate: culture?.t,
      collapsePaintClassName,
    }),
    [
      accessPrincipal,
      authUser,
      bindingDefinitions,
      collapsePaintClassName,
      culture,
      designerStore,
      document,
      handleFieldValidationErrors,
      handlePreviewFieldValidation,
      hydrationData,
      interactive,
      isMobileMenuOpen,
      isSubmitting,
      layoutMode,
      mergedPreviewResults,
      onMutationLog,
      previewFieldErrors,
      refreshDataSource,
      seedRegionFromRow,
      reportMutationError,
      commitDesignerStore,
      navigate,
      runtimeSlots,
      simulatedRole,
    ],
  );

  const publishedFormAssistEnabled = React.useMemo(
    () => isPublishedFormAssistEnabled(document),
    [document],
  );

  const publishedFieldMap = React.useMemo(() => (
    authUser && publishedFormAssistEnabled
      ? buildEuaFieldMapFromDocument(document, bindingDefinitions)
      : []
  ), [authUser, bindingDefinitions, document, publishedFormAssistEnabled]);

  const handlePublishedAssistApply = React.useCallback((updates: import('../../shared/api/contracts/ai/euaFieldAssist').EuaExtractedFieldValue[]) => {
    setDesignerStore((current) => applyEuaUpdatesToDesignerStore(
      document,
      bindingDefinitions,
      current,
      updates,
    ));
  }, [bindingDefinitions, document]);

  return (
    <>
      <HwyFamilyHouseholdDialogHost document={document} />
      <HwyImageFixPageDialogHost document={document} />
      {authUser && publishedFieldMap.length > 0 ? (
        <div className="px-3 pt-2">
          <AiPublishedFormAssistToolbar
            fields={publishedFieldMap}
            formId={document.id}
            surface="published"
            onApply={handlePublishedAssistApply}
          />
        </div>
      ) : null}
      {previewContent}
    </>
  );
};

export const DesignerDocumentPreview: React.FC<DesignerDocumentPreviewProps> = (props) => {
  const navigationContext = React.useContext(UNSAFE_NavigationContext);
  if (!navigationContext) {
    return <DesignerDocumentPreviewInner {...props} />;
  }

  return (
    <DesignerDocumentPreviewNavigateBridge>
      {(navigate) => <DesignerDocumentPreviewInner {...props} navigate={navigate} />}
    </DesignerDocumentPreviewNavigateBridge>
  );
};
