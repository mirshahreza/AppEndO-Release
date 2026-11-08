import { createFetchConfigKey } from './bindingApiHelpers';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import { getDataSources } from './bindingRegistry';
import {
  dataSourceToResource,
  resolveDataSourceOperationEndpoint,
} from './bindingResourceModel';
import type { ResolvedFetchConfig } from './bindingEngine';
import type {
  DataSourceDefinition,
  DesignerBindingDefinition,
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
  DesignerResponseMapping,
} from './types';

/** Binding key parallel to vizDataResource / chartDataResource. */
export const CONTENT_DATA_RESOURCE_BINDING_KEY = 'contentDataResource';

/** Explicit Dual-Mode flag — never clears static JSON props when toggled. */
export const CONTENT_DATA_MODE_PROP = 'contentDataMode';

export type ContentDataMode = 'static' | 'bound';

/**
 * Content / Marketing palette ids that receive Dual-Mode (doc 04 §6 / T1-9).
 * `content.contact-form-block` is intentionally excluded (Preset path).
 */
export const DUAL_MODE_CONTENT_PALETTE_IDS = [
  'content.stepper',
  'content.carousel',
  'content.icon',
  'content.description-list',
  'content.stat-trend',
  'content.segmented-control',
  'content.feature-grid',
  'content.blog-card',
  'content.team-member',
  'content.split-media',
  'content.video-player',
  'content.audio-player',
  'content.qr-code',
  'content.barcode',
  'content.cta-banner',
  'marketing.hero-cta',
  'marketing.faq-accordion',
  'marketing.testimonial-carousel',
  'marketing.pricing-table',
  'marketing.newsletter-signup',
] as const;

export type DualModeContentPaletteId = (typeof DUAL_MODE_CONTENT_PALETTE_IDS)[number];

const DUAL_MODE_SET = new Set<string>(DUAL_MODE_CONTENT_PALETTE_IDS);

/** Widgets whose primary list payload lives in `data` (JSON string). */
const JSON_DATA_PROP_IDS = new Set<string>([
  'content.description-list',
  'content.feature-grid',
  'content.blog-card',
  'content.team-member',
  'marketing.faq-accordion',
  'marketing.testimonial-carousel',
  'marketing.pricing-table',
]);

/** Carousel uses `slides` (falls back to `data`). */
const SLIDES_PROP_IDS = new Set<string>(['content.carousel']);

/** CSV list widgets — join row labels into a comma-separated string. */
const CSV_LIST_PROP_IDS: Record<string, string> = {
  'content.stepper': 'steps',
  'content.segmented-control': 'options',
};

export type ResolvedContentListFetch = {
  nodeId: string;
  paletteItemId: string;
  dataSourceId: string;
  dataSource: DataSourceDefinition;
  dataVar: string;
  fetchConfig: ResolvedFetchConfig;
  responseMapping?: DesignerResponseMapping;
  /** Primary list prop driven by the fetch (`data` | `slides` | `steps` | `options`). */
  targetListProp: string | null;
};

export type DocumentContentPlan = {
  contentListFetches: ResolvedContentListFetch[];
};

export type ContentBindingDispatchAction =
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
    type: 'set-node-prop';
    nodeId: string;
    key: string;
    value: unknown;
  };

const resolveNodePaletteItemId = (node: DesignerNode): string | undefined => {
  const stored = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return typeof stored === 'string' && stored.trim().length > 0 ? stored.trim() : undefined;
};

export const isDualModeContentPaletteId = (paletteItemId: string | null | undefined): boolean =>
  typeof paletteItemId === 'string' && DUAL_MODE_SET.has(paletteItemId);

export const isDualModeContentNode = (node: DesignerNode): boolean =>
  isDualModeContentPaletteId(resolveNodePaletteItemId(node));

export const getContentDataMode = (node: DesignerNode): ContentDataMode => {
  const raw = node.props[CONTENT_DATA_MODE_PROP];
  if (raw === 'bound') {
    return 'bound';
  }
  // Backward-compat: presence of binding without explicit mode still counts as bound intent.
  if (getNodeContentDataResourceRef(node)) {
    return 'bound';
  }
  return 'static';
};

export const getNodeContentDataResourceRef = (node: DesignerNode): string | undefined => {
  const definition = node.binding[CONTENT_DATA_RESOURCE_BINDING_KEY];
  const ref = definition?.dataSourceRef ?? definition?.sourcePath;
  const trimmed = typeof ref === 'string' ? ref.trim() : '';
  return trimmed.length > 0 ? trimmed : undefined;
};

export const getNodeContentDataResourceBinding = (node: DesignerNode): DesignerBindingDefinition | undefined =>
  node.binding[CONTENT_DATA_RESOURCE_BINDING_KEY];

export const isContentDataBoundNode = (node: DesignerNode): boolean =>
  getContentDataMode(node) === 'bound' && Boolean(getNodeContentDataResourceRef(node));

export const createContentDataResourceBindingDefinition = (
  dataSourceRef: string,
): DesignerBindingDefinition => ({
  sourceType: 'static',
  dataSourceRef: dataSourceRef.trim(),
  sourcePath: dataSourceRef.trim(),
  loadOperation: 'list',
});

export const resolveContentListDataVarName = (nodeId: string): string => {
  const suffix = nodeId.replace(/[^a-zA-Z0-9_]/g, '_');
  return `contentData_${suffix}`;
};

export const resolveContentTargetListProp = (paletteItemId: string): string | null => {
  if (JSON_DATA_PROP_IDS.has(paletteItemId)) {
    return 'data';
  }
  if (SLIDES_PROP_IDS.has(paletteItemId)) {
    return 'slides';
  }
  return CSV_LIST_PROP_IDS[paletteItemId] ?? null;
};

/** Scalar / structure widgets map the first API row onto named props. */
export const CONTENT_SCALAR_FIELD_CANDIDATES: Record<string, readonly string[]> = {
  title: ['title', 'name', 'label', 'heading'],
  subtitle: ['subtitle', 'subTitle', 'tagline', 'description'],
  description: ['description', 'summary', 'body', 'message'],
  actionLabel: ['actionLabel', 'action', 'cta', 'buttonLabel', 'label'],
  primaryCta: ['primaryCta', 'primary', 'cta', 'actionLabel'],
  secondaryCta: ['secondaryCta', 'secondary'],
  placeholder: ['placeholder', 'hint', 'emailPlaceholder'],
  buttonLabel: ['buttonLabel', 'submitLabel', 'actionLabel', 'cta'],
  label: ['label', 'name', 'title'],
  value: ['value', 'amount', 'metric', 'stat'],
  trend: ['trend', 'delta', 'change'],
  trendDirection: ['trendDirection', 'direction'],
  iconName: ['iconName', 'icon', 'name'],
  mediaSrc: ['mediaSrc', 'src', 'image', 'url', 'mediaUrl'],
  mediaSide: ['mediaSide', 'side'],
  size: ['size'],
  submitLabel: ['submitLabel', 'buttonLabel'],
};

export const pickContentScalarField = (
  row: Record<string, unknown> | undefined,
  prop: string,
): string | undefined => {
  if (!row) {
    return undefined;
  }
  const candidates = CONTENT_SCALAR_FIELD_CANDIDATES[prop] ?? [prop];
  for (const key of candidates) {
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }
  return undefined;
};

/**
 * Canonical CSV-label field priority for Dual-Mode list widgets (stepper / segmented-control).
 * Preview (`resolveContentCsvLabelFromRow`) and Export (`resolveContentCsvExpression`) MUST stay
 * identical — Bug found (parity audit item 82): Export used `label→title→name→id` (no `heading`,
 * and `title` before `name`) while Preview effectively used `label→name→title→heading→id`.
 */
export const CONTENT_CSV_LABEL_FIELD_PRIORITY = ['label', 'name', 'title', 'heading', 'id'] as const;

/** Label for one CSV list row — kept in sync with `resolveContentCsvExpression` (T1-29 parity). */
export const resolveContentCsvLabelFromRow = (row: Record<string, unknown>): string | undefined => {
  for (const key of CONTENT_CSV_LABEL_FIELD_PRIORITY) {
    const value = row[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
  }
  return undefined;
};

export const resolveContentCsvFromRows = (rows: Record<string, unknown>[]): string =>
  rows
    .map((row) => resolveContentCsvLabelFromRow(row))
    .filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
    .join(',');

export const resolveContentListJsonExpression = (dataVar: string): string =>
  `JSON.stringify(Array.isArray(${dataVar}) ? ${dataVar} : [])`;

export const resolveContentCsvExpression = (dataVar: string): string =>
  `(Array.isArray(${dataVar}) ? ${dataVar} : []).map((row: Record<string, unknown>) => { const candidates = [row.label, row.name, row.title, row.heading, row.id]; for (const value of candidates) { if (typeof value === "string" && value.trim().length > 0) return value.trim(); if (typeof value === "number" || typeof value === "boolean") return String(value); } return ""; }).filter(Boolean).join(',')`;

export const resolveContentScalarPropExpression = (
  dataVar: string,
  prop: string,
  fallbackLiteral: string,
): string => {
  const candidates = CONTENT_SCALAR_FIELD_CANDIDATES[prop] ?? [prop];
  const chain = candidates
    .map((key) => `row?.${key}`)
    .join(' ?? ');
  return `(() => { const row = Array.isArray(${dataVar}) ? ${dataVar}[0] as Record<string, unknown> | undefined : undefined; const value = ${chain}; return value == null || value === '' ? ${JSON.stringify(fallbackLiteral)} : String(value); })()`;
};

export const collectDocumentContentPlan = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): DocumentContentPlan => {
  const dataSources = getDataSources(bindingDefinitions);
  const contentListFetches: ResolvedContentListFetch[] = [];

  for (const node of Object.values(document.nodes)) {
    if (!isDualModeContentNode(node) || !isContentDataBoundNode(node)) {
      continue;
    }

    const dataSourceRef = getNodeContentDataResourceRef(node);
    if (!dataSourceRef) {
      continue;
    }

    const dataSource = dataSources[dataSourceRef];
    if (!dataSource?.endpoint?.trim()) {
      continue;
    }

    const paletteItemId = resolveNodePaletteItemId(node) ?? '';
    const contentBinding = getNodeContentDataResourceBinding(node);
    const listEndpoint = resolveDataSourceOperationEndpoint(dataSource, 'list');
    const resource = dataSourceToResource(dataSource);

    contentListFetches.push({
      nodeId: node.id,
      paletteItemId,
      dataSourceId: dataSourceRef,
      dataSource,
      dataVar: resolveContentListDataVarName(node.id),
      fetchConfig: {
        configKey: createFetchConfigKey(listEndpoint, contentBinding?.urlParams ?? {}, {}),
        endpointTemplate: listEndpoint,
        urlParams: { ...(contentBinding?.urlParams ?? {}) },
        headers: {},
      },
      responseMapping: resource.response,
      targetListProp: resolveContentTargetListProp(paletteItemId),
    });
  }

  return { contentListFetches };
};

export const buildContentDualModeEnableActions = (nodeId: string): ContentBindingDispatchAction[] => [
  {
    type: 'set-node-prop',
    nodeId,
    key: CONTENT_DATA_MODE_PROP,
    value: 'bound',
  },
];

export const buildContentDualModeDisableActions = (nodeId: string): ContentBindingDispatchAction[] => [
  {
    type: 'set-node-prop',
    nodeId,
    key: CONTENT_DATA_MODE_PROP,
    value: 'static',
  },
  {
    type: 'remove-node-binding',
    nodeId,
    bindingKey: CONTENT_DATA_RESOURCE_BINDING_KEY,
  },
];

export const buildContentBindingConnectActions = (
  node: DesignerNode,
  dataSource: DataSourceDefinition,
): ContentBindingDispatchAction[] => [
  {
    type: 'set-node-prop',
    nodeId: node.id,
    key: CONTENT_DATA_MODE_PROP,
    value: 'bound',
  },
  {
    type: 'set-node-binding',
    nodeId: node.id,
    bindingKey: CONTENT_DATA_RESOURCE_BINDING_KEY,
    definition: createContentDataResourceBindingDefinition(dataSource.id),
  },
];
