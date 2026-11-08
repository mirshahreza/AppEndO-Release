import { buildControlProps, humanizeFieldName, valuePropForControl } from './apiFieldToControl';
import type { ApiFormField } from './apiFieldSchema';
import { createDynamicAction, createDynamicActionsEventBindingDefinition } from './bindingDynamicActionsEngine';
import { propertyBindingKeyForProp, createPropertyBindingDefinition } from './bindingEngine';
import {
  buildBaseInfoOptionsEndpoint,
  lovIdForBaseInfoField,
  resolveBaseInfoRootForField,
} from './baseInfoFieldInference';
import {
  REGION_DATA_SOURCE_BINDING_KEY,
  createRegionColumnBindingDefinition,
  createRegionDataSourceBindingDefinition,
  createRegionSubmitEventBindingDefinition,
  isDataRegionEligibleContainer,
} from './bindingRegionEngine';
import {
  buildDefaultDetailUrlParams,
  buildFormSuccessTrueActions,
  findAncestorOverlayNodeId,
  normalizeFormBindingSuccessBehaviors,
  resolveNodePaletteItemId,
  type FormBindingScenario,
  type FormBindingSuccessBehavior,
} from './bindingResourceModel';
import { createStoreReadBindingDefinition } from './bindingStoreEngine';
import { cloneTemplateSeedsToNodes } from './builtInTemplateClone';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import { createInitialDesignerState } from './state';
import type {
  DataSourceDefinition,
  DesignerBindingDefinition,
  DesignerBindingDefinitions,
  DesignerDynamicAction,
  DesignerDocument,
  DesignerNode,
  DesignerStoreSegment,
  LovDefinition,
  TemplateNodeSeed,
} from './types';

export type AutoFormFieldConfig = {
  field: ApiFormField;
  /** When false the field is skipped entirely (no control, no binding). */
  enabled: boolean;
  /** User-editable display label. */
  label: string;
  /** Chosen control palette item id (may differ from the suggested default). */
  controlPaletteItemId: string;
  /** Runtime/export `culture.t(labelTranslationKey)` when set. */
  labelTranslationKey?: string;
  placeholderTranslationKey?: string;
  hintTranslationKey?: string;
  /** Optional instance-level visual props applied after the control defaults. */
  controlProps?: Record<string, unknown>;
};

export type AutoFormLayout = 'single' | 'two-column';

/** Where detail/edit forms read the primary-key value used in load URL params. */
export type AutoFormDetailIdSource = 'selection' | 'urlParam';

export type AutoFormWizardStep = {
  title: string;
  fields: AutoFormFieldConfig[];
};

export type AutoFormBuildConfig = {
  /** Optional heading rendered above the form fields. */
  title?: string;
  includeTitle: boolean;
  /**
   * API data source. Omit (or set `staticForm: true`) for a static form with no region
   * data-source binding — the user wires submit later.
   */
  dataSource?: DataSourceDefinition;
  /** When true, skip API wiring entirely (no data source, no region submit). */
  staticForm?: boolean;
  scenario: FormBindingScenario;
  fields: AutoFormFieldConfig[];
  submitLabel: string;
  /** @deprecated Prefer successBehaviors for combinable options. */
  successBehavior?: FormBindingSuccessBehavior;
  successBehaviors?: FormBindingSuccessBehavior[];
  layout: AutoFormLayout;
  /**
   * For edit/detail/createEdit: read the record id from `selection.<pk>` (grid detail flow)
   * or from URL/query params via `params.<pk>` (standalone page with `?id=`).
   * Default: `selection`.
   */
  detailIdSource?: AutoFormDetailIdSource;
  /**
   * For `scenario: 'wizard'`: split fields into sequential steps.
   * Each step gets its own visibility container gated on `store.wizardStep === N`.
   */
  wizardSteps?: AutoFormWizardStep[];
};

export type AutoFormBuildResult = {
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
  preferredSelectedNodeId: string | null;
};

export type AutoFormInsertTarget =
  | { mode: 'form-region'; formNodeId: string }
  | { mode: 'modal-insert'; modalNodeId: string };

const MODAL_PALETTE_ITEM_IDS = new Set(['heroui.modal', 'heroui.alert-dialog']);

const AUTO_FORM_LAYOUT_CONTAINER_IDS = new Set([
  'layout.flex-column',
  'html.container',
]);

const isStaticAutoForm = (config: AutoFormBuildConfig): boolean =>
  config.staticForm === true || !config.dataSource;

const resolveNodePaletteItemIdLocal = (node: DesignerNode): string | undefined => {
  const stored = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return typeof stored === 'string' && stored.trim().length > 0 ? stored.trim() : undefined;
};

const findFormRegionUnder = (document: DesignerDocument, parentId: string): DesignerNode | null => {
  for (const childId of document.nodes[parentId]?.children ?? []) {
    const child = document.nodes[childId];
    if (child && resolveNodePaletteItemIdLocal(child) === 'html.form' && isDataRegionEligibleContainer(child)) {
      return child;
    }
  }

  return null;
};

const collectSubtreeNodeIds = (document: DesignerDocument, rootId: string): string[] => {
  const ids: string[] = [];
  const queue = [rootId];

  while (queue.length > 0) {
    const id = queue.shift();
    if (!id) {
      continue;
    }

    const node = document.nodes[id];
    if (!node) {
      continue;
    }

    ids.push(id);
    queue.push(...node.children);
  }

  return ids;
};

const removeNodesFromDocument = (
  document: DesignerDocument,
  nodeIds: readonly string[],
): DesignerDocument['nodes'] => {
  const nextNodes = { ...document.nodes };
  for (const nodeId of nodeIds) {
    delete nextNodes[nodeId];
  }
  return nextNodes;
};

const mergeDataSourceIntoBindings = (
  bindingDefinitions: DesignerBindingDefinitions,
  dataSource: DataSourceDefinition,
): DesignerBindingDefinitions => ({
  ...bindingDefinitions,
  dataSources: {
    ...bindingDefinitions.dataSources,
    [dataSource.id]: dataSource,
  },
});

const buildBaseInfoLovsForFields = (fields: AutoFormFieldConfig[]): Record<string, LovDefinition> => {
  const lovs: Record<string, LovDefinition> = {};

  for (const entry of fields) {
    if (!entry.enabled) {
      continue;
    }

    const rootId = resolveBaseInfoRootForField(entry.field.name);
    if (!rootId) {
      continue;
    }

    const lovId = lovIdForBaseInfoField(entry.field.name);
    lovs[lovId] = {
      id: lovId,
      name: humanizeFieldName(entry.field.name),
      endpoint: buildBaseInfoOptionsEndpoint(rootId),
      displayValue: 'label',
      returnValue: 'id',
    };
  }

  return lovs;
};

const mergeAutoFormBindings = (
  bindingDefinitions: DesignerBindingDefinitions,
  config: AutoFormBuildConfig,
): DesignerBindingDefinitions => {
  const baseInfoLovs = buildBaseInfoLovsForFields(config.fields);
  let result: DesignerBindingDefinitions = {
    ...bindingDefinitions,
    lovs: {
      ...bindingDefinitions.lovs,
      ...baseInfoLovs,
    },
  };

  const isWizard = config.scenario === 'wizard' && config.wizardSteps && config.wizardSteps.length > 0;
  if (isWizard) {
    result = {
      ...result,
      storeSegments: {
        ...result.storeSegments,
        [WIZARD_STORE_SEGMENT_ID]: {
          id: WIZARD_STORE_SEGMENT_ID,
          initialValue: { current: 0 },
          persist: 'none',
        },
      },
    };
  }

  if (isStaticAutoForm(config) || !config.dataSource) {
    return result;
  }

  return mergeDataSourceIntoBindings(result, config.dataSource);
};

/** True when the canvas root already has designed content (not a blank starter). */
export const documentHasDesignedContent = (document: DesignerDocument): boolean => {
  const root = document.nodes[document.rootNodeId];
  return (root?.children?.length ?? 0) > 0;
};

/**
 * Resolves where an auto-generated form should be inserted based on the current selection.
 * Returns null when the selection does not point at a form region or modal shell.
 */
export const resolveAutoFormInsertTarget = (
  document: DesignerDocument,
  selectedNodeId: string | null,
): AutoFormInsertTarget | null => {
  if (!selectedNodeId) {
    return null;
  }

  const selected = document.nodes[selectedNodeId];
  if (!selected) {
    return null;
  }

  const paletteItemId = resolveNodePaletteItemIdLocal(selected);

  if (paletteItemId === 'html.form' && isDataRegionEligibleContainer(selected)) {
    return { mode: 'form-region', formNodeId: selected.id };
  }

  if (paletteItemId && MODAL_PALETTE_ITEM_IDS.has(paletteItemId)) {
    const existingForm = findFormRegionUnder(document, selected.id);
    if (existingForm) {
      return { mode: 'form-region', formNodeId: existingForm.id };
    }

    return { mode: 'modal-insert', modalNodeId: selected.id };
  }

  if (paletteItemId && AUTO_FORM_LAYOUT_CONTAINER_IDS.has(paletteItemId)) {
    const existingForm = findFormRegionUnder(document, selected.id);
    if (existingForm) {
      return { mode: 'form-region', formNodeId: existingForm.id };
    }
  }

  const parent = selected.parentId ? document.nodes[selected.parentId] : undefined;
  if (parent && resolveNodePaletteItemIdLocal(parent) === 'html.form' && isDataRegionEligibleContainer(parent)) {
    return { mode: 'form-region', formNodeId: parent.id };
  }

  if (parent && resolveNodePaletteItemIdLocal(parent) && MODAL_PALETTE_ITEM_IDS.has(resolveNodePaletteItemIdLocal(parent)!)) {
    const existingForm = findFormRegionUnder(document, parent.id);
    if (existingForm) {
      return { mode: 'form-region', formNodeId: existingForm.id };
    }
  }

  return null;
};

const populateExistingFormRegion = (
  document: DesignerDocument,
  formNodeId: string,
  formSeed: TemplateNodeSeed,
): { nodes: DesignerDocument['nodes']; formNodeId: string } => {
  const formNode = document.nodes[formNodeId];
  if (!formNode) {
    throw new Error(`Form node "${formNodeId}" was not found.`);
  }

  const childSeeds = formSeed.children ?? [];
  const { nodes: clonedNodes, rootNodeIds } = cloneTemplateSeedsToNodes(childSeeds, formNodeId, 0);
  const removedIds = formNode.children.flatMap((childId) => collectSubtreeNodeIds(document, childId));
  const nextNodes = removeNodesFromDocument(document, removedIds);

  const updatedFormNode: DesignerNode = {
    ...formNode,
    props: {
      ...formNode.props,
      ...(formSeed.props ?? {}),
    },
    binding: {
      ...formNode.binding,
      ...(formSeed.binding ?? {}),
    },
    children: rootNodeIds,
  };

  return {
    nodes: {
      ...nextNodes,
      ...clonedNodes,
      [formNodeId]: updatedFormNode,
    },
    formNodeId,
  };
};

const insertFormIntoModal = (
  document: DesignerDocument,
  modalNodeId: string,
  formSeeds: TemplateNodeSeed[],
): { nodes: DesignerDocument['nodes']; formNodeId: string | null } => {
  const modalNode = document.nodes[modalNodeId];
  if (!modalNode) {
    throw new Error(`Modal node "${modalNodeId}" was not found.`);
  }

  const { nodes: clonedNodes, rootNodeIds } = cloneTemplateSeedsToNodes(
    formSeeds,
    modalNodeId,
    modalNode.children.length,
  );

  const updatedModalNode: DesignerNode = {
    ...modalNode,
    children: [...modalNode.children, ...rootNodeIds],
  };

  return {
    nodes: {
      ...document.nodes,
      ...clonedNodes,
      [modalNodeId]: updatedModalNode,
    },
    formNodeId: rootNodeIds[0] ?? null,
  };
};

const FORM_CLASS = 'flex flex-col gap-3 rounded-lg border border-default-200 bg-content1 p-4';
const SUBMIT_BUTTON_CLASS = 'inline-flex w-full justify-center rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground no-underline hover:opacity-90';
const TWO_COLUMN_GRID_CLASS = 'grid grid-cols-1 gap-3 sm:grid-cols-2';
const SINGLE_COLUMN_CLASS = 'flex flex-col gap-3';

const WIZARD_STORE_SEGMENT_ID = 'wizardStep';
const WIZARD_STORE_PATH = 'wizardStep.current';
const WIZARD_NAV_BUTTON_CLASS = 'inline-flex justify-center rounded-md px-3 py-2 text-sm font-semibold no-underline hover:opacity-90';
const WIZARD_NAV_ROW_CLASS = 'flex items-center justify-between gap-3 pt-2';

const buildSubmitBinding = (
  config: AutoFormBuildConfig,
): DesignerBindingDefinition => {
  const behaviors = normalizeFormBindingSuccessBehaviors(config);
  const seedBehaviors = behaviors.filter(
    (behavior) => behavior === 'toast' || behavior === 'refresh',
  );
  const { trueActions, invalidateQueries } = buildFormSuccessTrueActions({
    behaviors: seedBehaviors,
    dataSourceId: isStaticAutoForm(config) ? undefined : config.dataSource?.id,
    warnOnMissingCloseTarget: false,
  });

  if (isStaticAutoForm(config)) {
    return createDynamicActionsEventBindingDefinition('onClick', trueActions);
  }

  if (trueActions.length === 0) {
    return createRegionSubmitEventBindingDefinition('onClick');
  }

  return createRegionSubmitEventBindingDefinition('onClick', {
    trueActions,
    invalidateQueries: invalidateQueries.length > 0 ? invalidateQueries : undefined,
  });
};

const buildWizardSetValueAction = (expression: string): DesignerDynamicAction => {
  const action = createDynamicAction('setValue');
  return {
    ...action,
    storePath: WIZARD_STORE_PATH,
    valueSource: 'expression',
    valueExpression: expression,
  };
};

const buildWizardStepSeeds = (
  config: AutoFormBuildConfig,
): { children: TemplateNodeSeed[]; stepperSeed: TemplateNodeSeed } => {
  const steps = config.wizardSteps ?? [];
  const lastIndex = steps.length - 1;
  const stepperLabels = steps.map((s) => s.title).join(',');

  const stepperActiveStepBinding = createStoreReadBindingDefinition('activeStep', WIZARD_STORE_PATH);

  const stepperSeed: TemplateNodeSeed = {
    type: 'leaf',
    paletteItemId: 'content.stepper',
    props: {
      steps: stepperLabels,
      activeStep: 0,
      className: 'w-full mb-2',
    },
    binding: {
      [stepperActiveStepBinding.bindingKey]: stepperActiveStepBinding.definition,
    },
  };

  const stepPanels: TemplateNodeSeed[] = steps.map((step, index) => {
    const enabledFields = step.fields.filter((f) => f.enabled);
    const fieldSeeds = enabledFields.map(buildFieldSeed);

    const fieldsContainer: TemplateNodeSeed = config.layout === 'two-column'
      ? {
        type: 'container',
        paletteItemId: 'html.container',
        props: { className: TWO_COLUMN_GRID_CLASS },
        children: fieldSeeds,
      }
      : {
        type: 'container',
        paletteItemId: 'layout.flex-column',
        props: { className: SINGLE_COLUMN_CLASS },
        children: fieldSeeds,
      };

    const navButtons: TemplateNodeSeed[] = [];

    if (index > 0) {
      navButtons.push({
        type: 'link',
        paletteItemId: 'heroui.button-outline',
        props: {
          text: 'Previous',
          className: WIZARD_NAV_BUTTON_CLASS,
        },
        binding: {
          'event:onClick': createDynamicActionsEventBindingDefinition('onClick', [
            buildWizardSetValueAction(`store.${WIZARD_STORE_PATH} - 1`),
          ]),
        },
      });
    }

    if (index < lastIndex) {
      navButtons.push({
        type: 'link',
        paletteItemId: 'heroui.button-solid',
        props: {
          text: 'Next',
          className: WIZARD_NAV_BUTTON_CLASS,
        },
        binding: {
          'event:onClick': createDynamicActionsEventBindingDefinition('onClick', [
            buildWizardSetValueAction(`store.${WIZARD_STORE_PATH} + 1`),
          ]),
        },
      });
    }

    if (index === lastIndex) {
      navButtons.push({
        type: 'link',
        paletteItemId: 'heroui.button-solid',
        props: {
          text: config.submitLabel.trim() || 'Submit',
          href: '#',
          target: '_self',
          rel: '',
          type: 'submit',
          className: SUBMIT_BUTTON_CLASS,
        },
        binding: {
          'event:onClick': buildSubmitBinding(config),
        },
      });
    }

    const navRow: TemplateNodeSeed = {
      type: 'container',
      paletteItemId: 'html.container',
      props: { className: WIZARD_NAV_ROW_CLASS },
      children: navButtons,
    };

    const panelChildren: TemplateNodeSeed[] = [fieldsContainer, navRow];

    return {
      type: 'container',
      paletteItemId: 'logic.visibility-container',
      props: {
        visibleCondition: `store.${WIZARD_STORE_PATH} === ${index}`,
        className: 'w-full',
      },
      children: panelChildren,
    };
  });

  return { children: stepPanels, stepperSeed };
};

const resolveDetailStorePathPrefix = (detailIdSource: AutoFormDetailIdSource | undefined): string =>
  detailIdSource === 'urlParam' ? 'params' : 'selection';

const resolveLoadConfig = (
  scenario: FormBindingScenario,
  dataSource: DataSourceDefinition,
  detailIdSource?: AutoFormDetailIdSource,
): { loadOperation?: DesignerBindingDefinition['loadOperation']; urlParams?: Record<string, string> } => {
  if (scenario === 'edit' || scenario === 'detail' || scenario === 'createEdit') {
    return {
      loadOperation: 'detail',
      urlParams: buildDefaultDetailUrlParams(dataSource, resolveDetailStorePathPrefix(detailIdSource)),
    };
  }
  if (scenario === 'search') {
    return { loadOperation: 'list' };
  }
  return {};
};

const buildFieldSeed = (config: AutoFormFieldConfig): TemplateNodeSeed => {
  const valueProp = valuePropForControl(config.controlPaletteItemId);
  const baseInfoRoot = resolveBaseInfoRootForField(config.field.name);
  const binding: Record<string, DesignerBindingDefinition> = {
    [propertyBindingKeyForProp(valueProp)]: createRegionColumnBindingDefinition(
      valueProp,
      config.field.name,
    ),
  };

  if (baseInfoRoot && config.controlPaletteItemId === 'heroui.select') {
    const lovId = lovIdForBaseInfoField(config.field.name);
    binding[propertyBindingKeyForProp('items')] = createPropertyBindingDefinition('items', 'items', {
      lovRef: lovId,
    });
  }

  return {
    type: 'container',
    paletteItemId: config.controlPaletteItemId,
    props: {
      ...buildControlProps(config.controlPaletteItemId, {
        field: config.field,
        label: config.label,
      }),
      ...config.controlProps,
      ...(config.labelTranslationKey ? { labelTranslationKey: config.labelTranslationKey } : {}),
      ...(config.placeholderTranslationKey ? { placeholderTranslationKey: config.placeholderTranslationKey } : {}),
      ...(config.hintTranslationKey ? { hintTranslationKey: config.hintTranslationKey } : {}),
    },
    binding,
  };
};

/**
 * Finds the Auto Form submit button under a form region (not the form itself).
 * `findDefaultSubmitNodeId` returns the form for html.form — Auto Form wires onClick on the button.
 */
export const findAutoFormSubmitButtonNodeId = (
  document: DesignerDocument,
  formNodeId: string,
): string | undefined => {
  const queue = [...(document.nodes[formNodeId]?.children ?? [])];
  let fallbackButtonId: string | undefined;
  let regionSubmitButtonId: string | undefined;

  while (queue.length > 0) {
    const nodeId = queue.shift();
    if (!nodeId) {
      continue;
    }

    const node = document.nodes[nodeId];
    if (!node) {
      continue;
    }

    const paletteItemId = resolveNodePaletteItemId(node);
    if (paletteItemId === 'heroui.button-solid' || paletteItemId === 'heroui.button-outline') {
      if (node.binding?.['event:onClick']?.regionSubmit) {
        regionSubmitButtonId ??= nodeId;
      } else if (node.binding?.['event:onClick']?.trueActions) {
        fallbackButtonId ??= nodeId;
      } else {
        fallbackButtonId ??= nodeId;
      }
    }

    queue.push(...node.children);
  }

  return regionSubmitButtonId ?? fallbackButtonId;
};

/**
 * After seeds are cloned into real node ids, rewrite the submit button's success actions
 * so reset/close target the concrete form / overlay — same source of truth as Binding Form wizard.
 */
const finalizeAutoFormSubmitSuccess = (
  document: DesignerDocument,
  formNodeId: string,
  config: AutoFormBuildConfig,
): DesignerDocument => {
  if (config.scenario === 'detail' || config.scenario === 'search') {
    return document;
  }

  const submitNodeId = findAutoFormSubmitButtonNodeId(document, formNodeId);
  if (!submitNodeId) {
    return document;
  }

  const behaviors = normalizeFormBindingSuccessBehaviors(config);
  const { trueActions, invalidateQueries } = buildFormSuccessTrueActions({
    behaviors,
    dataSourceId: isStaticAutoForm(config) ? undefined : config.dataSource?.id,
    regionNodeId: formNodeId,
    overlayNodeId: findAncestorOverlayNodeId(document, formNodeId),
  });

  const submitNode = document.nodes[submitNodeId];
  if (!submitNode) {
    return document;
  }

  const existing = submitNode.binding?.['event:onClick'];
  const nextDefinition: DesignerBindingDefinition = isStaticAutoForm(config)
    ? createDynamicActionsEventBindingDefinition('onClick', trueActions)
    : {
      ...(existing ?? createRegionSubmitEventBindingDefinition('onClick')),
      regionSubmit: true,
      trueActions: trueActions.length > 0 ? trueActions : undefined,
      invalidateQueries: invalidateQueries.length > 0 ? invalidateQueries : undefined,
    };

  return {
    ...document,
    nodes: {
      ...document.nodes,
      [submitNodeId]: {
        ...submitNode,
        binding: {
          ...submitNode.binding,
          'event:onClick': nextDefinition,
        },
      },
    },
  };
};

/** Builds the form's `TemplateNodeSeed` tree (a single `html.form` root) with baked bindings. */
export const buildAutoFormSeeds = (config: AutoFormBuildConfig): TemplateNodeSeed[] => {
  const isWizard = config.scenario === 'wizard' && config.wizardSteps && config.wizardSteps.length > 0;
  const enabledFields = config.fields.filter((entry) => entry.enabled);
  const attachSubmit = config.scenario !== 'detail' && config.scenario !== 'search' && !isWizard;
  const staticForm = isStaticAutoForm(config);
  const loadConfig = (!staticForm && config.dataSource)
    ? resolveLoadConfig(config.scenario, config.dataSource, config.detailIdSource)
    : {};

  const children: TemplateNodeSeed[] = [];

  if (config.includeTitle && config.title?.trim()) {
    children.push({
      type: 'heading',
      paletteItemId: 'html.heading',
      props: {
        text: config.title.trim(),
        className: 'text-lg font-semibold tracking-tight text-foreground',
      },
    });
  }

  if (isWizard) {
    const { children: stepPanels, stepperSeed } = buildWizardStepSeeds(config);
    children.push(stepperSeed);
    children.push(...stepPanels);
  } else {
    const fieldSeeds = enabledFields.map(buildFieldSeed);
    const fieldsContainer: TemplateNodeSeed = config.layout === 'two-column'
      ? {
        type: 'container',
        paletteItemId: 'html.container',
        props: { className: TWO_COLUMN_GRID_CLASS },
        children: fieldSeeds,
      }
      : {
        type: 'container',
        paletteItemId: 'layout.flex-column',
        props: { className: SINGLE_COLUMN_CLASS },
        children: fieldSeeds,
      };
    children.push(fieldsContainer);
  }

  if (attachSubmit) {
    children.push({
      type: 'link',
      paletteItemId: 'heroui.button-solid',
      props: {
        text: config.submitLabel.trim() || 'Submit',
        href: '#',
        target: '_self',
        rel: '',
        type: 'submit',
        className: SUBMIT_BUTTON_CLASS,
      },
      binding: {
        'event:onClick': buildSubmitBinding(config),
      },
    });
  }

  const formBinding: Record<string, DesignerBindingDefinition> = {};
  if (!staticForm && config.dataSource) {
    formBinding[REGION_DATA_SOURCE_BINDING_KEY] = createRegionDataSourceBindingDefinition(
      config.dataSource.id,
      loadConfig,
    );
  }

  return [{
    type: 'container',
    paletteItemId: 'html.form',
    props: { className: FORM_CLASS, method: 'post', action: '' },
    binding: formBinding,
    children,
  }];
};

/** Store segment for tracking the current wizard step index. */
export const WIZARD_STEP_STORE_SEGMENT: DesignerStoreSegment = {
  id: WIZARD_STORE_SEGMENT_ID,
  initialValue: { current: 0 },
  persist: 'none',
};

/**
 * Merges an auto-generated form into an existing document at the resolved target
 * instead of replacing the whole canvas.
 */
export const mergeAutoFormIntoDocument = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
  config: AutoFormBuildConfig,
  target: AutoFormInsertTarget,
): AutoFormBuildResult => {
  const formSeed = buildAutoFormSeeds(config)[0];
  if (!formSeed) {
    throw new Error('Auto-form builder produced no form seed.');
  }

  const now = new Date().toISOString();
  let nextNodes = document.nodes;
  let preferredSelectedNodeId: string | null = null;

  if (target.mode === 'form-region') {
    const populated = populateExistingFormRegion(document, target.formNodeId, formSeed);
    nextNodes = populated.nodes;
    preferredSelectedNodeId = populated.formNodeId;
  } else {
    const inserted = insertFormIntoModal(document, target.modalNodeId, [formSeed]);
    nextNodes = inserted.nodes;
    preferredSelectedNodeId = inserted.formNodeId;
  }

  let nextDocument: DesignerDocument = {
    ...document,
    nodes: nextNodes,
    metadata: { ...document.metadata, updatedAt: now },
  };

  if (preferredSelectedNodeId) {
    nextDocument = finalizeAutoFormSubmitSuccess(nextDocument, preferredSelectedNodeId, config);
  }

  return {
    document: nextDocument,
    bindingDefinitions: mergeAutoFormBindings(bindingDefinitions, config),
    preferredSelectedNodeId,
  };
};

/**
 * Builds a complete designer document + binding definitions for a fresh auto-generated form,
 * ready to feed into the `hydrate-document` action.
 */
export const buildAutoFormDocument = (config: AutoFormBuildConfig): AutoFormBuildResult => {
  const base = createInitialDesignerState();
  const rootId = base.document.rootNodeId;
  const seeds = buildAutoFormSeeds(config);
  const { nodes, rootNodeIds } = cloneTemplateSeedsToNodes(seeds, rootId, 0);

  const now = new Date().toISOString();
  let document: DesignerDocument = {
    ...base.document,
    nodes: {
      ...base.document.nodes,
      [rootId]: { ...base.document.nodes[rootId], children: rootNodeIds },
      ...nodes,
    },
    metadata: { ...base.document.metadata, updatedAt: now },
  };

  const formNodeId = rootNodeIds[0] ?? null;
  if (formNodeId) {
    document = finalizeAutoFormSubmitSuccess(document, formNodeId, config);
  }

  const bindingDefinitions: DesignerBindingDefinitions = mergeAutoFormBindings(
    base.bindingDefinitions,
    config,
  );

  return {
    document,
    bindingDefinitions,
    preferredSelectedNodeId: formNodeId,
  };
};
