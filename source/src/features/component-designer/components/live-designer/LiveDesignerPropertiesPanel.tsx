import * as React from 'react';
import { Plus, SlidersHorizontal } from 'lucide-react';
import {
  isChartNode,
  isNodeChartDataBound,
} from '../../../../domain/component-designer/bindingChartEngine';
import { isDualModeContentNode } from '../../../../domain/component-designer/bindingContentEngine';
import { resolveNodeEventBindingTargets } from '../../../../domain/component-designer/bindingEngine';
import { isDataGridNode } from '../../../../domain/component-designer/bindingGridEngine';
import { getBindingDefinitionEntries } from '../../../../domain/component-designer/bindingRegistry';
import { isDataRegionEligibleContainer } from '../../../../domain/component-designer/bindingRegionEngine';
import { isLogicRepeaterPaletteNode } from '../../../../domain/component-designer/bindingRepeaterEngine';
import {
  getNodeVizDataResourceRef,
  isNonChartVizNode,
} from '../../../../domain/component-designer/bindingVizEngine';
import { nodeHasCapability } from '../../../../domain/component-designer/catalog';
import {
  resolveInspectorFieldSections,
  type InspectorFieldSchema,
} from '../../../../domain/component-designer/inspectorRegistry';
import { resolveLayoutStructureHint } from '../../../../domain/component-designer/layoutStructure';
import type {
  DesignerAction,
  DesignerBindingDefinition,
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
  DesignerViewportPreset,
} from '../../../../domain/component-designer/types';
import {
  AppButton,
  AppSearchBox,
  ToolboxPanelSection,
} from '../../../../shared/ui';
import { PAGE_GUIDE_EN } from '../../../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from '../../../../shared/ui/shell/pageGuide/pageGuideChrome';
import { TOOLBOX_PANEL_SEARCH_HOST_CLASS, UI_CHROME_NO_SELECT_CLASS } from '../../../../shared/ui/surfaceClasses';
import { cn } from '../../../../lib/utils';
import { getNodePaletteItemId } from '../../../../domain/component-designer/runtimeShared';
import { resolveInspectorSectionHelp } from '../../lib/designerInspectorHelp';
import { BindingDefinitionEditor } from '../BindingDefinitionEditor';
import { DesignerInspectorRouteGuardPanel } from '../DesignerInspectorRouteGuardPanel';
import {
  INSPECTOR_TEXT_2XS,
  INSPECTOR_TEXT_SM,
  INSPECTOR_TEXT_XS,
} from '../inspectorDesignTokens';
import { InspectorBindingEmptyState } from '../InspectorBindingSectionShell';
import { isManagedNodeBindingKey } from '../inspectorBindingUi';
import { InspectorChartBindingPanel } from '../InspectorChartBindingPanel';
import { InspectorConditionalsPanel } from '../InspectorConditionalsPanel';
import { InspectorDataRegionPanel } from '../InspectorDataRegionPanel';
import { InspectorDualModeDataPanel } from '../InspectorDualModeDataPanel';
import { InspectorFieldHelpLink } from '../InspectorFieldHelpLink';
import { InspectorGridBindingPanel } from '../InspectorGridBindingPanel';
import { InspectorInteractionsSection } from '../InspectorInteractionsSection';
import { InspectorLayoutStructurePanel } from '../InspectorLayoutStructurePanel';
import { buildInspectorCrudSetLivingSections } from '../InspectorCrudSetLivingFields';
import { InspectorPropFields } from '../InspectorPropFields';
import { InspectorRepeaterBindingPanel } from '../InspectorRepeaterBindingPanel';
import { InspectorSharedComponentsPanel } from '../InspectorSharedComponentsPanel';
import { InspectorStorePanel } from '../InspectorStorePanel';
import { InspectorVizBindingPanel } from '../InspectorVizBindingPanel';
import { InspectorDashboardDomainPanel, InspectorDashboardWidgetPanel, isDashboardCanvasWidgetNode } from '../InspectorDashboardDomainPanel';
import {
  readLiveDesignerPropertiesAccordionPrefs,
  rememberLiveDesignerPropertiesSection,
  type LiveDesignerPropertiesSectionId,
} from './liveDesignerPropertiesPrefs';
import { LiveDesignerDockPanelHeader } from './LiveDesignerDockPanelHeader';
import { LiveDesignerShellLayoutPropertiesSection } from './LiveDesignerShellLayoutPropertiesSection';

const SECTION_BODY_PAD_CLASS = 'space-y-2 px-2 py-2';

export type LiveDesignerPropertiesPanelProps = {
  node: DesignerNode | null;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  dispatch: React.Dispatch<DesignerAction>;
  onClose: () => void;
  onSelectNode?: (nodeId: string) => void;
  width: number;
  /** Aligns Style breakpoint tabs + Live paint collapse with the canvas viewport preset. */
  viewportPreset?: DesignerViewportPreset;
  showShellLayout?: boolean;
};

type AccordionSectionId = string;

export const LiveDesignerPropertiesPanel: React.FC<LiveDesignerPropertiesPanelProps> = ({
  node,
  document,
  bindingDefinitions,
  dispatch,
  onClose,
  onSelectNode,
  width,
  viewportPreset = 'desktop',
  showShellLayout = false,
}) => {
  const [fieldSearchQuery, setFieldSearchQuery] = React.useState('');
  const [expandedSectionId, setExpandedSectionId] = React.useState<AccordionSectionId | null>(() => {
    const prefs = readLiveDesignerPropertiesAccordionPrefs();
    return node ? prefs.nodeSection : prefs.documentSection;
  });

  React.useEffect(() => {
    setFieldSearchQuery('');
  }, [node?.id]);

  const pinnedDispatch = React.useCallback((action: DesignerAction) => {
    if (!node) {
      dispatch(action);
      return;
    }

    if (action.type === 'set-node-prop'
      || action.type === 'set-node-layout'
      || action.type === 'set-node-visibility'
      || action.type === 'set-grid-toolbar-config'
      || action.type === 'set-node-binding'
      || action.type === 'remove-node-binding'
      || action.type === 'set-node-source-settings'
      || action.type === 'set-node-visibility-access'
      || action.type === 'set-node-visible-condition') {
      dispatch({ ...action, nodeId: node.id } as DesignerAction);
      return;
    }

    dispatch(action);
  }, [dispatch, node]);

  const setNodeBindingField = React.useCallback((
    nodeId: string,
    bindingKey: string,
    updater: (definition: DesignerBindingDefinition) => DesignerBindingDefinition,
  ) => {
    const target = document.nodes[nodeId];
    if (!target) {
      return;
    }
    const currentDefinition: DesignerBindingDefinition = target.binding[bindingKey] ?? {
      sourceType: 'static',
    };
    dispatch({
      type: 'set-node-binding',
      nodeId,
      bindingKey,
      definition: updater(currentDefinition),
    });
  }, [dispatch, document.nodes]);

  const setGlobalBindingField = React.useCallback((
    bindingKey: string,
    updater: (definition: DesignerBindingDefinition) => DesignerBindingDefinition,
  ) => {
    const currentDefinition: DesignerBindingDefinition = bindingDefinitions.definitions[bindingKey] ?? {
      sourceType: 'static',
    };
    dispatch({
      type: 'set-binding-definition',
      bindingKey,
      definition: updater(currentDefinition),
    });
  }, [bindingDefinitions.definitions, dispatch]);

  const sections = React.useMemo(() => {
    if (!node) {
      return [];
    }

    const resolved = resolveInspectorFieldSections(node);
    const chartBound = isChartNode(node) && isNodeChartDataBound(node);
    const vizBound = isNonChartVizNode(node) && Boolean(getNodeVizDataResourceRef(node));
    if (!chartBound && !vizBound) {
      return resolved;
    }

    const hiddenWhenBound = new Set(['data', 'seriesKeys', 'xAxisKey']);
    return resolved
      .map((section) => ({
        ...section,
        fields: section.fields.filter((field) => !hiddenWhenBound.has(field.key)),
      }))
      .filter((section) => section.fields.length > 0);
  }, [node]);

  const contentSection = sections.find((section) => section.id === 'content');
  const styleSection = sections.find((section) => section.id === 'style');
  const advancedSection = sections.find((section) => section.id === 'advanced');

  const hasBehaviorTargets = Boolean(node && resolveNodeEventBindingTargets(node).length > 0);

  const hasDataRegion = Boolean(node && nodeHasCapability(node, 'bindable') && isDataRegionEligibleContainer(node));
  const hasDataGrid = Boolean(node && nodeHasCapability(node, 'bindable') && isDataGridNode(node));
  const hasDataRepeater = Boolean(node && nodeHasCapability(node, 'bindable') && isLogicRepeaterPaletteNode(node));
  const hasDataChart = Boolean(node && nodeHasCapability(node, 'bindable') && isChartNode(node));
  const hasDataViz = Boolean(node && nodeHasCapability(node, 'bindable') && isNonChartVizNode(node));
  const hasDataDualMode = Boolean(node && nodeHasCapability(node, 'bindable') && isDualModeContentNode(node));

  const documentBindingDefinitions = React.useMemo(
    () => getBindingDefinitionEntries(bindingDefinitions),
    [bindingDefinitions],
  );

  const nodeBindingEntries = React.useMemo(() => {
    if (!node) {
      return [] as Array<[string, DesignerBindingDefinition]>;
    }
    return (Object.entries(node.binding) as Array<[string, DesignerBindingDefinition]>)
      .filter(([bindingKey]) => !isManagedNodeBindingKey(bindingKey));
  }, [node]);

  const searchNeedle = fieldSearchQuery.trim().toLowerCase();
  const sectionMatchesSearch = React.useCallback((section: { title: string; fields: InspectorFieldSchema[] }) => {
    if (!searchNeedle) {
      return true;
    }
    if (section.title.toLowerCase().includes(searchNeedle)) {
      return true;
    }
    return section.fields.some((field) => {
      const label = typeof field.label === 'string' ? field.label : '';
      return label.toLowerCase().includes(searchNeedle) || field.key.toLowerCase().includes(searchNeedle);
    });
  }, [searchNeedle]);

  const layoutStructureHint = node
    ? resolveLayoutStructureHint(document.nodes, node.id)
    : null;
  const showLayoutStructure = Boolean(layoutStructureHint) && (
    !searchNeedle
    || 'structure'.includes(searchNeedle)
    || 'layout'.includes(searchNeedle)
    || 'column'.includes(searchNeedle)
    || 'row'.includes(searchNeedle)
    || (layoutStructureHint?.addColumnLabel.toLowerCase().includes(searchNeedle) ?? false)
    || (layoutStructureHint?.addRowLabel.toLowerCase().includes(searchNeedle) ?? false)
  );

  const paletteItemId = node ? getNodePaletteItemId(node) : null;
  const livingSections = React.useMemo(() => {
    if (!node || paletteItemId !== 'heroui.crud-set') {
      return [];
    }
    return buildInspectorCrudSetLivingSections(node, pinnedDispatch);
  }, [node, paletteItemId, pinnedDispatch]);

  const catalogContentGroups = React.useMemo(() => {
    if (livingSections.length > 0 || !contentSection) {
      return [];
    }
    const groups: Array<{ id: AccordionSectionId; title: string; fields: InspectorFieldSchema[] }> = [];
    const byTitle = new Map<string, InspectorFieldSchema[]>();
    const leftovers: InspectorFieldSchema[] = [];
    for (const field of contentSection.fields) {
      if (field.catalogGroup) {
        const list = byTitle.get(field.catalogGroup) ?? [];
        list.push(field);
        byTitle.set(field.catalogGroup, list);
      } else {
        leftovers.push(field);
      }
    }
    for (const [title, fields] of byTitle) {
      const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group';
      groups.push({ id: `catalog-${slug}` as AccordionSectionId, title, fields });
    }
    if (leftovers.length > 0) {
      groups.push({ id: 'content', title: contentSection.title, fields: leftovers });
    }
    return groups;
  }, [contentSection, livingSections.length]);

  const livingVisible = React.useMemo(() => (
    livingSections.filter((section) => (
      !searchNeedle || section.title.toLowerCase().includes(searchNeedle)
    ))
  ), [livingSections, searchNeedle]);
  const catalogVisible = React.useMemo(() => (
    catalogContentGroups.filter((section) => (
      sectionMatchesSearch({ title: section.title, fields: section.fields })
    ))
  ), [catalogContentGroups, sectionMatchesSearch]);
  const replaceContentAccordion = livingVisible.length > 0 || catalogVisible.some((section) => section.id !== 'content');

  const showContent = Boolean(
    !replaceContentAccordion
    && contentSection
    && contentSection.fields.length > 0
    && sectionMatchesSearch(contentSection),
  );
  const showStyle = Boolean(styleSection && styleSection.fields.length > 0 && sectionMatchesSearch(styleSection));
  const showAdvanced = Boolean(
    !livingVisible.length
    && advancedSection
    && advancedSection.fields.length > 0
    && sectionMatchesSearch(advancedSection),
  );
  const showBehavior = hasBehaviorTargets && (
    !searchNeedle || 'behavior'.includes(searchNeedle) || 'event'.includes(searchNeedle) || 'interaction'.includes(searchNeedle)
  );
  const showData = !searchNeedle || 'data'.includes(searchNeedle) || 'binding'.includes(searchNeedle) || 'connection'.includes(searchNeedle);
  const showConditionals = Boolean(node) && (
    !searchNeedle || 'condition'.includes(searchNeedle) || 'visibility'.includes(searchNeedle)
  );
  // Document-scoped panels only when nothing is selected — they are not element properties.
  const showDocumentPanels = !node && (
    !searchNeedle
    || 'store'.includes(searchNeedle)
    || 'resource'.includes(searchNeedle)
    || 'access'.includes(searchNeedle)
    || 'definition'.includes(searchNeedle)
    || 'shell'.includes(searchNeedle)
    || 'width'.includes(searchNeedle)
    || 'layout'.includes(searchNeedle)
  );
  // Raw node-binding AST only when the selected node already has custom (non-managed) bindings.
  const showNodeBinding = Boolean(node) && nodeBindingEntries.length > 0 && (
    !searchNeedle || 'binding'.includes(searchNeedle) || 'definition'.includes(searchNeedle) || 'node'.includes(searchNeedle)
  );
  const showDashboardWidget = Boolean(node && isDashboardCanvasWidgetNode(document, node.id));

  const visibleSectionIds = React.useMemo(() => {
    const ids: AccordionSectionId[] = [];
    if (node) {
      if (livingVisible.length > 0) {
        ids.push(...livingVisible.map((section) => section.id as AccordionSectionId));
      } else if (replaceContentAccordion) {
        ids.push(...catalogVisible.map((section) => section.id));
      } else if (showContent) {
        ids.push('content');
      }
      if (showStyle) ids.push('style');
      if (showBehavior) ids.push('behavior');
      if (showConditionals) ids.push('visibility');
      if (showData && hasDataRegion) ids.push('data-region');
      if (showData && hasDataGrid) ids.push('data-grid');
      if (showData && hasDataRepeater) ids.push('data-repeater');
      if (showData && hasDataChart) ids.push('data-chart');
      if (showData && hasDataViz) ids.push('data-viz');
      if (showData && hasDataDualMode) ids.push('data-dual-mode');
      if (showAdvanced) ids.push('advanced');
      if (showNodeBinding) ids.push('node-binding');
      if (showDashboardWidget) ids.push('dashboard-widget');
    } else if (showDocumentPanels) {
      if (showShellLayout) {
        ids.push('shell-layout');
      }
      ids.push('access-control', 'data-resources', 'global-store', 'binding-definitions', 'dashboard-domain');
    }
    return ids;
  }, [
    node,
    livingVisible,
    catalogVisible,
    replaceContentAccordion,
    showContent,
    showStyle,
    showBehavior,
    showConditionals,
    showData,
    hasDataRegion,
    hasDataGrid,
    hasDataRepeater,
    hasDataChart,
    hasDataViz,
    hasDataDualMode,
    showAdvanced,
    showNodeBinding,
    showDashboardWidget,
    showDocumentPanels,
    showShellLayout,
  ]);

  React.useEffect(() => {
    if (visibleSectionIds.length === 0) {
      setExpandedSectionId(null);
      return;
    }
    const prefs = readLiveDesignerPropertiesAccordionPrefs();
    const remembered = node ? prefs.nodeSection : prefs.documentSection;
    const preferredLiving = livingVisible[0]?.id as AccordionSectionId | undefined;
    const preferredCatalog = catalogVisible[0]?.id;
    setExpandedSectionId((current) => {
      if (preferredLiving && visibleSectionIds.includes(preferredLiving)) {
        if (current === 'advanced' || current === 'visibility' || current === 'content' || !current) {
          return preferredLiving;
        }
      }
      if (preferredCatalog && visibleSectionIds.includes(preferredCatalog) && (
        current === 'advanced' || current === 'visibility' || !current
      )) {
        return preferredCatalog;
      }
      if (current && visibleSectionIds.includes(current)) {
        return current;
      }
      if (remembered && visibleSectionIds.includes(remembered)) {
        return remembered;
      }
      if (preferredLiving && visibleSectionIds.includes(preferredLiving)) {
        return preferredLiving;
      }
      if (node && visibleSectionIds.includes('content')) {
        return 'content';
      }
      if (!node && visibleSectionIds.includes('data-resources')) {
        return 'data-resources';
      }
      return visibleSectionIds[0] ?? null;
    });
  }, [node?.id, visibleSectionIds, node, livingVisible, catalogVisible]);

  const toggleSection = React.useCallback((sectionId: string) => {
    setExpandedSectionId((current) => {
      // Keep at least one section open — closing the active one is a no-op.
      if (current === sectionId) {
        return current;
      }
      const next = sectionId as AccordionSectionId;
      rememberLiveDesignerPropertiesSection(node ? 'node' : 'document', next);
      return next;
    });
  }, [node]);

  const renderAccordionSection = (
    id: AccordionSectionId,
    label: string,
    children: React.ReactNode,
    tier?: string,
  ) => {
    if (!visibleSectionIds.includes(id)) {
      return null;
    }
    const expanded = expandedSectionId === id;
    return (
      <div key={id} data-inspector-tier={tier} className={expanded ? 'flex min-h-0 flex-1 flex-col' : 'shrink-0'}>
        <ToolboxPanelSection
          id={id}
          label={label}
          expanded={expanded}
          onToggle={toggleSection}
          className={expanded ? 'min-h-0 flex-1' : undefined}
        >
          <div className={SECTION_BODY_PAD_CLASS}>
            {children}
          </div>
        </ToolboxPanelSection>
      </div>
    );
  };

  return (
    <aside
      className={cn('flex h-full min-h-0 shrink-0 flex-col border-l border-slate-200 bg-white', UI_CHROME_NO_SELECT_CLASS)}
      style={{ width }}
      data-testid="live-designer-properties-panel"
    >
      <LiveDesignerDockPanelHeader
        title="Properties"
        titleIcon={<SlidersHorizontal className="h-3.5 w-3.5" />}
        closeAriaLabel="Close properties"
        onClose={onClose}
        {...pageGuideLocalProps(
          PAGE_GUIDE_EN['pageGuide.page.properties.title'],
          PAGE_GUIDE_EN['pageGuide.page.properties.hint'],
          16,
        )}
      />

      <div className={TOOLBOX_PANEL_SEARCH_HOST_CLASS}>
        <AppSearchBox
          value={fieldSearchQuery}
          onChange={setFieldSearchQuery}
          placeholder="fields…"
          ariaLabel="Search inspector fields"
          className="!min-h-0 w-full gap-1.5 px-2 py-1 [&>svg:first-child]:h-3 [&>svg:first-child]:w-3"
        />
      </div>

      <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${INSPECTOR_TEXT_SM} text-slate-600`}>
        {node && showLayoutStructure ? (
          <div className="shrink-0 border-b border-slate-100 px-2 py-2">
            <InspectorLayoutStructurePanel
              node={node}
              document={document}
              dispatch={pinnedDispatch}
            />
          </div>
        ) : null}
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {node ? (
            <>
              {livingVisible.length > 0
                ? livingVisible.map((section) => renderAccordionSection(
                  section.id as AccordionSectionId,
                  section.title,
                  section.panel,
                  'content',
                ))
                : null}

              {livingVisible.length === 0 && replaceContentAccordion
                ? catalogVisible.map((section) => renderAccordionSection(
                  section.id,
                  section.title,
                  (
                    <InspectorPropFields
                      key={`${section.id}:${node.id}`}
                      node={node}
                      document={document}
                      bindingDefinitions={bindingDefinitions}
                      selectedNodeId={node.id}
                      fields={section.fields}
                      dispatch={pinnedDispatch}
                    />
                  ),
                  'content',
                ))
                : null}

              {showContent && contentSection
                ? renderAccordionSection(
                  'content',
                  contentSection.title,
                  (
                    <InspectorPropFields
                      key={`content:${node.id}`}
                      node={node}
                      document={document}
                      bindingDefinitions={bindingDefinitions}
                      selectedNodeId={node.id}
                      fields={contentSection.fields}
                      dispatch={pinnedDispatch}
                    />
                  ),
                  'content',
                )
                : null}

              {showStyle && styleSection
                ? renderAccordionSection(
                  'style',
                  styleSection.title,
                  (
                    <InspectorPropFields
                      key={`style:${node.id}`}
                      node={node}
                      document={document}
                      bindingDefinitions={bindingDefinitions}
                      selectedNodeId={node.id}
                      fields={styleSection.fields}
                      dispatch={pinnedDispatch}
                      viewportPreset={viewportPreset}
                    />
                  ),
                  'style',
                )
                : null}

              {showBehavior
                ? renderAccordionSection(
                  'behavior',
                  'Behavior',
                  (
                    <InspectorInteractionsSection
                      key={`interactions:${node.id}`}
                      node={node}
                      document={document}
                      bindingDefinitions={bindingDefinitions}
                      dispatch={pinnedDispatch}
                      embedded
                    />
                  ),
                  'behavior',
                )
                : null}

              {showConditionals
                ? renderAccordionSection(
                  'visibility',
                  'Visibility',
                  (
                    <InspectorConditionalsPanel
                      key={`conditionals:${node.id}`}
                      node={node}
                      dispatch={pinnedDispatch}
                    />
                  ),
                  'visibility',
                )
                : null}

              {showData && hasDataRegion
                ? renderAccordionSection(
                  'data-region',
                  'Form Data Connection',
                  (
                    <>
                      {resolveInspectorSectionHelp('data-region') ? (
                        <div className="flex justify-end">
                          <InspectorFieldHelpLink help={resolveInspectorSectionHelp('data-region')!} />
                        </div>
                      ) : null}
                      <InspectorDataRegionPanel
                        key={`data-region:${node.id}`}
                        node={node}
                        document={document}
                        bindingDefinitions={bindingDefinitions}
                        dispatch={pinnedDispatch}
                      />
                    </>
                  ),
                  'data',
                )
                : null}

              {showData && hasDataGrid
                ? renderAccordionSection(
                  'data-grid',
                  'Grid Data Connection',
                  (
                    <InspectorGridBindingPanel
                      key={`grid-binding:${node.id}`}
                      node={node}
                      document={document}
                      bindingDefinitions={bindingDefinitions}
                      dispatch={pinnedDispatch}
                    />
                  ),
                  'data',
                )
                : null}

              {showData && hasDataRepeater
                ? renderAccordionSection(
                  'data-repeater',
                  'Repeater Data Connection',
                  (
                    <InspectorRepeaterBindingPanel
                      key={`repeater-binding:${node.id}`}
                      node={node}
                      document={document}
                      bindingDefinitions={bindingDefinitions}
                      dispatch={pinnedDispatch}
                    />
                  ),
                  'data',
                )
                : null}

              {showData && hasDataChart
                ? renderAccordionSection(
                  'data-chart',
                  'Chart Data Connection',
                  (
                    <InspectorChartBindingPanel
                      key={`chart-binding:${node.id}`}
                      node={node}
                      document={document}
                      bindingDefinitions={bindingDefinitions}
                      dispatch={pinnedDispatch}
                    />
                  ),
                  'data',
                )
                : null}

              {showData && hasDataViz
                ? renderAccordionSection(
                  'data-viz',
                  'Widget Data Connection',
                  (
                    <InspectorVizBindingPanel
                      key={`viz-binding:${node.id}`}
                      node={node}
                      document={document}
                      bindingDefinitions={bindingDefinitions}
                      dispatch={pinnedDispatch}
                    />
                  ),
                  'data',
                )
                : null}

              {showData && hasDataDualMode
                ? renderAccordionSection(
                  'data-dual-mode',
                  'Content Data Mode',
                  (
                    <InspectorDualModeDataPanel
                      key={`dual-mode:${node.id}`}
                      node={node}
                      document={document}
                      bindingDefinitions={bindingDefinitions}
                      dispatch={pinnedDispatch}
                    />
                  ),
                  'data',
                )
                : null}

              {showAdvanced && advancedSection
                ? renderAccordionSection(
                  'advanced',
                  advancedSection.title,
                  (
                    <InspectorPropFields
                      key={`advanced:${node.id}`}
                      node={node}
                      document={document}
                      bindingDefinitions={bindingDefinitions}
                      selectedNodeId={node.id}
                      fields={advancedSection.fields}
                      dispatch={pinnedDispatch}
                    />
                  ),
                  'advanced',
                )
                : null}

              {showNodeBinding
                ? renderAccordionSection(
                  'node-binding',
                  `Node Binding (${nodeBindingEntries.length})`,
                  (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className={`${INSPECTOR_TEXT_XS} leading-relaxed text-slate-500`}>
                          Raw per-node binding AST. Prefer fx toggles on fields and the Interactions panel for declarative setup.
                        </p>
                        {resolveInspectorSectionHelp('node-binding') ? (
                          <InspectorFieldHelpLink help={resolveInspectorSectionHelp('node-binding')!} />
                        ) : null}
                      </div>
                      <div className="flex justify-end">
                        <AppButton
                          type="button"
                          intent="secondary"
                          size="sm"
                          className={`h-5 shrink-0 px-1.5 ${INSPECTOR_TEXT_2XS}`}
                          onClick={() =>
                            dispatch({
                              type: 'set-node-binding',
                              nodeId: node.id,
                              bindingKey: `binding_${Date.now().toString(36)}`,
                              definition: { sourceType: 'static' },
                            })
                          }
                        >
                          <Plus className="mr-0.5 h-3 w-3" strokeWidth={2} />
                          Add
                        </AppButton>
                      </div>
                      {nodeBindingEntries.map(([bindingKey, definition]) => (
                        <BindingDefinitionEditor
                          key={`node-binding:${bindingKey}`}
                          bindingKey={bindingKey}
                          definition={definition}
                          defaultExpanded={false}
                          onChange={(nextDefinition) => setNodeBindingField(node.id, bindingKey, () => nextDefinition)}
                          onRemove={() => dispatch({ type: 'remove-node-binding', nodeId: node.id, bindingKey })}
                        />
                      ))}
                    </>
                  ),
                )
                : null}

              {showDashboardWidget
                ? renderAccordionSection(
                  'dashboard-widget',
                  'Dashboard widget',
                  (
                    <InspectorDashboardWidgetPanel
                      document={document}
                      node={node}
                      dispatch={pinnedDispatch}
                    />
                  ),
                )
                : null}
            </>
          ) : null}

          {showDocumentPanels ? (
            <>
              {showShellLayout
                ? renderAccordionSection(
                  'shell-layout',
                  'Shell layout',
                  (
                    <LiveDesignerShellLayoutPropertiesSection
                      document={document}
                      dispatch={dispatch}
                    />
                  ),
                )
                : null}

              {renderAccordionSection(
                'access-control',
                'Access Control',
                (
                  <DesignerInspectorRouteGuardPanel
                    document={document}
                    dispatch={dispatch}
                  />
                ),
              )}

              {renderAccordionSection(
                'data-resources',
                'Data Resources',
                (
                  <InspectorSharedComponentsPanel
                    bindingDefinitions={bindingDefinitions}
                    dispatch={dispatch}
                  />
                ),
              )}

              {renderAccordionSection(
                'global-store',
                'Global State Store',
                (
                  <InspectorStorePanel
                    bindingDefinitions={bindingDefinitions}
                    document={document}
                    dispatch={dispatch}
                  />
                ),
              )}

              {renderAccordionSection(
                'binding-definitions',
                'Binding Definitions',
                (
                  <>
                    <div className="flex items-center justify-between gap-2">
                      {resolveInspectorSectionHelp('binding-definitions') ? (
                        <InspectorFieldHelpLink help={resolveInspectorSectionHelp('binding-definitions')!} />
                      ) : <span />}
                      <AppButton
                        size="sm"
                        intent="secondary"
                        className={`h-7 px-2 ${INSPECTOR_TEXT_XS}`}
                        onClick={() =>
                          dispatch({
                            type: 'set-binding-definition',
                            bindingKey: `definition_${Date.now().toString(36)}`,
                            definition: { sourceType: 'static' },
                          })
                        }
                      >
                        Add Definition
                      </AppButton>
                    </div>
                    {Object.keys(documentBindingDefinitions).length === 0 ? (
                      <InspectorBindingEmptyState
                        title="No document bindings yet"
                        description="Add shared data sources such as API refs or expressions used by multiple nodes."
                      />
                    ) : (
                      (Object.entries(documentBindingDefinitions) as Array<[string, DesignerBindingDefinition]>).map(([bindingKey, definition]) => (
                        <BindingDefinitionEditor
                          key={`global-binding:${bindingKey}`}
                          bindingKey={bindingKey}
                          definition={definition}
                          defaultExpanded={false}
                          onChange={(nextDefinition) => setGlobalBindingField(bindingKey, () => nextDefinition)}
                          onRemove={() => dispatch({ type: 'remove-binding-definition', bindingKey })}
                        />
                      ))
                    )}
                  </>
                ),
              )}

              {renderAccordionSection(
                'dashboard-domain',
                'Dashboard Domain',
                (
                  <InspectorDashboardDomainPanel
                    document={document}
                    dispatch={dispatch}
                  />
                ),
              )}
            </>
          ) : null}

          {visibleSectionIds.length === 0 ? (
            <p className={`px-3 py-4 ${INSPECTOR_TEXT_XS} text-slate-400`}>
              No properties match “{fieldSearchQuery.trim()}”.
            </p>
          ) : null}
        </div>
      </div>
    </aside>
  );
};
