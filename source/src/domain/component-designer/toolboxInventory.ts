/**
 * CD-P01 — Toolbox inventory matrix: catalog vs runtime vs codegen vs inspector coverage.
 * CD-P35 — Preset→widget parity checklist (presets are NOT removed).
 * T1-7 — Runtime detector covers structural/primitive paths; eventComplete maturity field.
 */
import {
  DESIGNER_FORM_INPUT_PALETTE_ITEM_IDS,
  DESIGNER_PALETTE,
  getPaletteItemById,
} from './catalog';
import { compileInspectorForPaletteItem } from './compileInspectorFromCatalog';
import { DESIGNER_CATALOG_ADDITION_ITEM_IDS } from './designerCatalogAdditions';
import {
  HEROUI_PALETTE_PROP_FIELD_MAP,
  PALETTE_CONTENT_FIELDS,
  PALETTE_TAG_EXTENSION_FIELDS,
  PALETTE_TAILWIND_FIELD_KEY_MAP,
} from './inspectorPaletteFields';
import { resolveTailwindInspectorFields } from './inspectorRegistry';
import { isUniversalPaletteItemId, UNIVERSAL_PALETTE_ITEM_IDS } from './designerUniversalPalette';
import { isVizPaletteItemId, VIZ_PALETTE_ITEM_IDS } from './designerVizPalette';
import { isBuiltInStructuralPaletteItemId } from './builtInPaletteStandards';
import { HEROUI_RENDERED_IDS } from './runtimeShared';
import { resolveTsxComponentSpec } from './tsxComponentRegistry';
import { createInitialDesignerState, designerReducer } from './state';
import {
  buildBindingCapabilityMatrix,
  getBindingCapabilityRow,
  isBindingStatusIncomplete,
  resolveBindingCapabilityWarning,
  summarizeBindingCapabilityMatrix,
  type BindingCapabilityMatrixRow,
  type PaletteBindingStatus,
} from './bindingCapabilityMatrix';
import type { BindingParityCapability } from './bindingParity/types';

export type ToolboxCoverageStatus = 'have' | 'partial' | 'missing';

export type ToolboxInventoryRow = {
  paletteItemId: string;
  catalog: boolean;
  runtime: boolean;
  codegen: boolean;
  inspector: boolean;
  eventComplete: boolean;
  status: ToolboxCoverageStatus;
  /** T1-19 — aggregate binding parity from Phase T1-18 fixtures. */
  bindingStatus: PaletteBindingStatus;
  supportedBindingCapabilities: BindingCapabilityMatrixRow['supportedCapabilities'];
  bindingParityTested: boolean;
};

export const PHASE_P_WAVE2_PARITY_IDS = [
  'heroui.breadcrumbs',
  'heroui.pagination',
  'heroui.checkbox-group',
  'heroui.radio-group',
  'heroui.tags-input',
  'heroui.tooltip-trigger',
  'heroui.toolbar',
] as const;

/** CD-P35 — top layout presets mapped to reusable palette widgets (presets remain). */
export const PRESET_WIDGET_PARITY_CHECKLIST: ReadonlyArray<{ presetId: string; widgetId: string }> = [
  { presetId: 'hero-cta', widgetId: 'marketing.hero-cta' },
  { presetId: 'feature-grid', widgetId: 'content.feature-grid' },
  { presetId: 'split-media', widgetId: 'content.split-media' },
  { presetId: 'dashboard-kpi', widgetId: 'content.stat-trend' },
  { presetId: 'pricing-cards', widgetId: 'marketing.pricing-table' },
  { presetId: 'faq-accordion', widgetId: 'marketing.faq-accordion' },
  { presetId: 'contact-form', widgetId: 'html.form' },
  { presetId: 'timeline', widgetId: 'viz.timeline' },
  { presetId: 'blog-list', widgetId: 'content.blog-card' },
  { presetId: 'testimonial-wall', widgetId: 'marketing.testimonial-carousel' },
  { presetId: 'stats-strip', widgetId: 'content.stat-trend' },
  { presetId: 'team-grid', widgetId: 'content.team-member' },
  { presetId: 'gallery-grid', widgetId: 'content.carousel' },
  { presetId: 'changelog', widgetId: 'content.description-list' },
  { presetId: 'cta-banner', widgetId: 'content.cta-banner' },
  { presetId: 'comparison-table', widgetId: 'marketing.pricing-table' },
  { presetId: 'newsletter-signup', widgetId: 'marketing.newsletter-signup' },
  { presetId: 'empty-state', widgetId: 'feedback.empty-state' },
  { presetId: 'onboarding-steps', widgetId: 'content.stepper' },
  { presetId: 'kanban-board', widgetId: 'viz.kanban' },
  { presetId: 'feature-tabs', widgetId: 'content.segmented-control' },
  { presetId: 'dashboard-viz-kit', widgetId: 'viz.chart-bar' },
  { presetId: 'pricing-tier-featured', widgetId: 'marketing.pricing-table' },
  { presetId: 'social-proof-strip', widgetId: 'marketing.testimonial-carousel' },
  { presetId: 'support-center', widgetId: 'marketing.faq-accordion' },
  { presetId: 'analytics-detail', widgetId: 'viz.chart-line' },
  { presetId: 'metrics-sidebar', widgetId: 'viz.chart-bar' },
  { presetId: 'crud-collection-page', widgetId: 'heroui.app-table-grid' },
  { presetId: 'not-found-error-pages', widgetId: 'heroui.button-solid' },
  { presetId: 'advanced-search-results', widgetId: 'heroui.data-grid' },
  { presetId: 'master-detail-header', widgetId: 'heroui.data-grid' },
  { presetId: 'profile-overview', widgetId: 'heroui.tabs' },
  { presetId: 'user-account-settings', widgetId: 'heroui.tabs' },
];

/**
 * Built-in structural / leaf render paths that are not tracked in HEROUI_RENDERED_IDS.
 * html.* / layout.* / tailwind.* → designerRuntimePreview node-type switch.
 * heroui.date-picker → runtimeRenderer renderDatePickerLeafNode.
 * logic.repeater → designerRuntimePreview isLogicRepeaterNode path.
 */
const EXTRA_RUNTIME_COVERED_IDS: ReadonlySet<string> = new Set([
  'heroui.date-picker',
  'logic.repeater',
  ...DESIGNER_CATALOG_ADDITION_ITEM_IDS,
]);

/**
 * Form Input Set + form-like value widgets (doc 04 / T1-1 / T1-2) that must expose
 * onChange (or an equivalent value-change event) in runtime + codegen.
 */
const VALUE_CHANGE_EVENT_REQUIRED_IDS: ReadonlySet<string> = new Set([
  ...DESIGNER_FORM_INPUT_PALETTE_ITEM_IDS,
  'heroui.switch',
  'heroui.slider',
  'heroui.checkbox-group',
  'heroui.radio-group',
]);

/**
 * Interactive / clickable / navigation widgets that need at least one wired event handler.
 */
const INTERACTIVE_EVENT_REQUIRED_IDS: ReadonlySet<string> = new Set([
  'heroui.button-solid',
  'heroui.button-outline',
  'heroui.link',
  'html.link',
  'heroui.chip',
  'heroui.tooltip-trigger',
  'heroui.pagination',
  'heroui.listbox',
  'heroui.dropdown',
  'heroui.tabs',
  'heroui.data-grid',
  'heroui.table',
  'heroui.app-table-grid',
  'html.form',
  'html.file-upload',
]);

/**
 * Palette ids with confirmed event wiring in preview + export (T1-1..T1-6 and prior).
 * Required ids missing from this set → eventComplete: false.
 */
const EVENT_WIRING_COMPLETE_IDS: ReadonlySet<string> = new Set([
  // Form field runtime (onChange via resolveDesignerFormFieldBaseProps / input adapters)
  'heroui.input-text',
  'heroui.textarea',
  'heroui.number-input',
  'heroui.autocomplete',
  'heroui.entity-picker',
  'heroui.date-picker',
  'form.date-range',
  'form.code-editor',
  'form.html-editor',
  'form.markdown-editor',
  'form.mask-input',
  'form.calculator',
  'form.relation-tags-list',
  'form.related-contents-list',
  'form.base-info-record',
  'form.cms-content-assets',
  'heroui.color-control',
  // T1-1 / T1-2 value widgets
  'heroui.switch',
  'heroui.slider',
  'heroui.checkbox-group',
  'heroui.radio-group',
  // T1-3 / T1-6 interaction widgets
  'heroui.pagination',
  'heroui.listbox',
  'heroui.dropdown',
  'heroui.tabs',
  // Click / submit / grid
  'heroui.button-solid',
  'heroui.button-outline',
  'heroui.link',
  'html.link',
  'heroui.tooltip-trigger',
  'html.form',
  'heroui.data-grid',
  'heroui.table',
  'heroui.app-table-grid',
  // heroui.chip's only declared event target is onHover (see DESIGNER_HOVER_EVENT_PALETTE_ID_SET —
  // it has no dismiss/click affordance in the catalog or Inspector), and that's wired in both
  // runtimeRenderer.tsx (onMouseEnter) and codegen (generic renderAttrs). Verified 2026-07.
  'heroui.chip',
  // heroui.select's onChange is wired via DesignerRuntimeSelect.tsx (fixed 2026-07 — was
  // previously local-state-only with no dispatch to the designer event system).
  'heroui.select',
  // html.file-upload's onChange is now declared (resolveNodeEventBindingTargets) and wired
  // onto the real <input type="file"> in both preview and codegen (fixed 2026-07 — was
  // previously undeclared as a bindable target, and codegen bound it to the non-firing
  // wrapping <label> instead of the <input>).
  'html.file-upload',
  // heroui.tags-input close-out (cluster G, 2026-07): preview (DesignerRuntimeTagsInput in
  // DesignerRuntimeParityPalette.tsx) already had real add/remove interaction wired to
  // onChange. Codegen (tsxParityPalette.ts renderTagsInputParityJsx) previously rendered
  // static read-only <Tag> chips with no input field at all — a genuine architecture gap,
  // not a wiring oversight: the codegen pipeline had no established pattern for a leaf
  // widget's own local interactive array state. Fixed by extending codegen.ts's
  // hookDefinitionLines/preamble mechanism (`renderTagsInputStatePreambleLines`) to declare a
  // per-node useState<string[]> (+ draft input state + add/remove callbacks), which
  // renderTagsInputParityJsx now wires into a real <input type="text"> (Enter/blur to add,
  // Backspace to pop) and a remove button per tag — matching the preview UX, and notifying
  // any bound onChange Interaction on every add/remove. See
  // src/domain/component-designer/__tests__/tagsInputInteraction.test.tsx.
  'heroui.tags-input',
]);

/**
 * T1-7 close-out (cluster G) — the generic Tailwind className system
 * (`resolveTailwindInspectorFields` in inspectorRegistry.ts) is a real, working Inspector
 * surface for every palette item, not just the ones with a dedicated field-map entry:
 * `resolveInspectorFieldSections` unconditionally calls it for any node carrying a
 * `_designerPaletteItemId`, and when the item has no entry in
 * `PALETTE_TAILWIND_FIELD_KEY_MAP` it falls back to the FULL `TAILWIND_INSPECTOR_FIELDS`
 * list (spacing, colors, typography, shadow, rounded, opacity, …) rather than an empty
 * list — see inspectorRegistry.ts `resolveTailwindInspectorFields` fallback branch.
 * Cluster A (html/layout primitives) and Cluster D (tailwind.* blocks) both confirmed via
 * real DOM-level tests that className edits through this generic path apply live in the
 * canvas preview and flow through unchanged into exported TSX for exactly the items that
 * were previously flagged `inspector:false` here (html.container, html.text, html.heading,
 * html.link, html.list-item, html.section, html.article, html.figure, html.table-wrap,
 * html.form, layout.stack-compact, layout.stack-relaxed, tailwind.card, tailwind.card-glass,
 * tailwind.hero, tailwind.alert, tailwind.stat-block, tailwind.pricing,
 * tailwind.image-overlay) — see
 * docs/refactor-spec/CLAUDE-FULL-AUDIT-LOG-cluster-A-html-layout.md and
 * docs/refactor-spec/CLAUDE-FULL-AUDIT-LOG-cluster-D-heroui-data-display-tailwind.md.
 * The prior detector only recognized membership in the dedicated field-map dictionaries,
 * so it reported false negatives for every item relying solely on this generic mechanism.
 */
const hasInspectorFields = (paletteItemId: string): boolean =>
  paletteItemId in HEROUI_PALETTE_PROP_FIELD_MAP
  || paletteItemId in PALETTE_CONTENT_FIELDS
  || paletteItemId in PALETTE_TAG_EXTENSION_FIELDS
  || paletteItemId in PALETTE_TAILWIND_FIELD_KEY_MAP
  || resolveTailwindInspectorFields(paletteItemId).length > 0
  || (compileInspectorForPaletteItem(paletteItemId)?.length ?? 0) > 0;

const hasRuntimeCoverage = (paletteItemId: string): boolean => {
  if (isUniversalPaletteItemId(paletteItemId) || isVizPaletteItemId(paletteItemId)) {
    return true;
  }
  if (HEROUI_RENDERED_IDS.has(paletteItemId)) {
    return true;
  }
  if (isBuiltInStructuralPaletteItemId(paletteItemId)) {
    return true;
  }
  return EXTRA_RUNTIME_COVERED_IDS.has(paletteItemId);
};

const resolveEventComplete = (paletteItemId: string): boolean => {
  if (VALUE_CHANGE_EVENT_REQUIRED_IDS.has(paletteItemId) || INTERACTIVE_EVENT_REQUIRED_IDS.has(paletteItemId)) {
    return EVENT_WIRING_COMPLETE_IDS.has(paletteItemId);
  }
  // Outside Form Input Set / interactive set — event maturity N/A.
  return true;
};

const resolveCodegenReady = (paletteItemId: string): boolean => {
  let state = createInitialDesignerState();
  state = designerReducer(state, {
    type: 'insert-palette-item',
    itemId: paletteItemId,
    parentId: state.document.rootNodeId,
  });
  const nodeId = state.document.nodes[state.document.rootNodeId].children[0];
  if (!nodeId) {
    return false;
  }
  const node = state.document.nodes[nodeId];
  const spec = resolveTsxComponentSpec(node);
  return spec.kind === 'library-custom' || spec.reactTag.length > 0;
};

const resolveStatus = (row: Omit<ToolboxInventoryRow, 'status'>): ToolboxCoverageStatus => {
  const layers = [row.catalog, row.runtime, row.codegen, row.inspector].filter(Boolean).length;
  if (layers === 4) {
    return 'have';
  }
  if (layers >= 2) {
    return 'partial';
  }
  return 'missing';
};

export const buildToolboxInventoryMatrix = (): ToolboxInventoryRow[] => {
  const bindingById = new Map(
    buildBindingCapabilityMatrix().map((row) => [row.paletteItemId, row]),
  );

  return DESIGNER_PALETTE.map((item) => {
    const bindingRow = bindingById.get(item.id);
    const row = {
      paletteItemId: item.id,
      catalog: Boolean(getPaletteItemById(item.id)),
      runtime: hasRuntimeCoverage(item.id),
      codegen: resolveCodegenReady(item.id),
      inspector: hasInspectorFields(item.id),
      eventComplete: resolveEventComplete(item.id),
      bindingStatus: bindingRow?.bindingStatus ?? 'none',
      supportedBindingCapabilities: bindingRow?.supportedCapabilities ?? [],
      bindingParityTested: bindingRow?.parityTested ?? false,
    };
    return { ...row, status: resolveStatus(row) };
  });
};

export const summarizeToolboxInventory = (rows: ToolboxInventoryRow[] = buildToolboxInventoryMatrix()) => ({
  total: rows.length,
  have: rows.filter((row) => row.status === 'have').length,
  partial: rows.filter((row) => row.status === 'partial').length,
  missing: rows.filter((row) => row.status === 'missing').length,
  eventComplete: rows.filter((row) => row.eventComplete).length,
  eventIncomplete: rows.filter((row) => !row.eventComplete).length,
  haveAndEventComplete: rows.filter((row) => row.status === 'have' && row.eventComplete).length,
  binding: summarizeBindingCapabilityMatrix(),
});

export type ToolboxMaturityGap = {
  paletteItemId: string;
  status: ToolboxCoverageStatus;
  eventComplete: boolean;
  runtime: boolean;
  codegen: boolean;
  inspector: boolean;
  bindingStatus: PaletteBindingStatus;
  reasons: string[];
};

export const collectToolboxMaturityGaps = (
  rows: ToolboxInventoryRow[] = buildToolboxInventoryMatrix(),
): ToolboxMaturityGap[] =>
  rows
    .filter((row) => row.status !== 'have' || !row.eventComplete)
    .map((row) => {
      const reasons: string[] = [];
      if (row.status !== 'have') {
        reasons.push(`status=${row.status}`);
        if (!row.runtime) reasons.push('runtime:false');
        if (!row.codegen) reasons.push('codegen:false');
        if (!row.inspector) reasons.push('inspector:false');
      }
      if (!row.eventComplete) {
        reasons.push('eventComplete:false');
      }
      return {
        paletteItemId: row.paletteItemId,
        status: row.status,
        eventComplete: row.eventComplete,
        runtime: row.runtime,
        codegen: row.codegen,
        inspector: row.inspector,
        bindingStatus: row.bindingStatus,
        reasons,
      };
    });

export type BindingCapabilityGap = {
  paletteItemId: string;
  bindingStatus: PaletteBindingStatus;
  supportedBindingCapabilities: BindingCapabilityMatrixRow['supportedCapabilities'];
  incompleteCapabilities: BindingParityCapability[];
};

export const collectBindingCapabilityGaps = (
  rows: ToolboxInventoryRow[] = buildToolboxInventoryMatrix(),
): BindingCapabilityGap[] =>
  rows
    .filter((row) => isBindingStatusIncomplete(row.bindingStatus))
    .map((row) => ({
      paletteItemId: row.paletteItemId,
      bindingStatus: row.bindingStatus,
      supportedBindingCapabilities: row.supportedBindingCapabilities,
      incompleteCapabilities: getBindingCapabilityRow(row.paletteItemId)?.incompleteCapabilities ?? [],
    }));

/** Cached lookup for Toolbox UI (T1-12). Matrix is static for a given catalog build. */
let inventoryByIdCache: ReadonlyMap<string, ToolboxInventoryRow> | null = null;

export const getToolboxInventoryRow = (paletteItemId: string): ToolboxInventoryRow | undefined => {
  if (!inventoryByIdCache) {
    inventoryByIdCache = new Map(
      buildToolboxInventoryMatrix().map((row) => [row.paletteItemId, row]),
    );
  }
  return inventoryByIdCache.get(paletteItemId);
};

/**
 * Human-readable limitation for Toolbox maturity badge (null when fully mature).
 * Shown when status !== 'have' or eventComplete === false.
 */
const resolveToolboxCoverageWarning = (paletteItemId: string): string | null => {
  const row = getToolboxInventoryRow(paletteItemId);
  if (!row) {
    return null;
  }
  if (row.status === 'have' && row.eventComplete) {
    return null;
  }

  const parts: string[] = [];
  if (!row.eventComplete) {
    parts.push(
      VALUE_CHANGE_EVENT_REQUIRED_IDS.has(paletteItemId)
        ? 'value-change events are not fully wired yet'
        : 'interaction events are not fully wired yet',
    );
  }
  if (row.status !== 'have') {
    if (!row.runtime) parts.push('canvas preview coverage is incomplete');
    if (!row.codegen) parts.push('export coverage is incomplete');
    if (!row.inspector) parts.push('inspector fields are incomplete');
    if (parts.length === 0) {
      parts.push('coverage is only partial');
    }
  }

  return `Limited maturity: ${parts.join('; ')}.`;
};

/** Combined coverage + binding warning for Toolbox maturity badge (T1-12 + T1-19). */
export const resolveToolboxMaturityWarning = (paletteItemId: string): string | null => {
  const coverageWarning = resolveToolboxCoverageWarning(paletteItemId);
  const bindingWarning = resolveBindingCapabilityWarning(paletteItemId);

  if (coverageWarning && bindingWarning) {
    return `${coverageWarning} ${bindingWarning}`;
  }
  return coverageWarning ?? bindingWarning;
};

export type PaletteMaturityBadgeTone = 'amber' | 'rose';

/** Badge tone: rose when binding parity is broken; amber for other limitations. */
export const resolvePaletteMaturityBadgeTone = (
  paletteItemId: string,
): PaletteMaturityBadgeTone | null => {
  const row = getBindingCapabilityRow(paletteItemId);
  if (row?.bindingStatus === 'broken') {
    return 'rose';
  }
  if (resolveToolboxMaturityWarning(paletteItemId)) {
    return 'amber';
  }
  return null;
};

export type CatalogMaturityReport = {
  generatedAt: string;
  summary: ReturnType<typeof summarizeToolboxInventory>;
  rows: ToolboxInventoryRow[];
  remainingGaps: ToolboxMaturityGap[];
  bindingGaps: BindingCapabilityGap[];
};

export const buildCatalogMaturityReport = (
  rows: ToolboxInventoryRow[] = buildToolboxInventoryMatrix(),
): CatalogMaturityReport => ({
  generatedAt: new Date().toISOString(),
  summary: summarizeToolboxInventory(rows),
  rows,
  remainingGaps: collectToolboxMaturityGaps(rows),
  bindingGaps: collectBindingCapabilityGaps(rows),
});

export const assertPhasePInventoryCoverage = (): void => {
  const rows = buildToolboxInventoryMatrix();
  const failures: string[] = [];

  for (const row of rows) {
    if (row.status !== 'have') {
      failures.push(
        `${row.paletteItemId} expected status have, got ${row.status}`
        + ` (catalog=${row.catalog}, runtime=${row.runtime}, codegen=${row.codegen}, inspector=${row.inspector})`,
      );
    }
    if (!row.eventComplete) {
      failures.push(`${row.paletteItemId} expected eventComplete true`);
    }
  }

  for (const { presetId, widgetId } of PRESET_WIDGET_PARITY_CHECKLIST) {
    if (!getPaletteItemById(widgetId)) {
      failures.push(`preset ${presetId} → widget ${widgetId} missing from catalog`);
    }
  }

  // Keep explicit Wave2 / Universal / Viz surface named in error context for CI triage.
  const spotlightIds = [
    ...UNIVERSAL_PALETTE_ITEM_IDS,
    ...VIZ_PALETTE_ITEM_IDS,
    ...PHASE_P_WAVE2_PARITY_IDS,
  ];
  const byId = new Map(rows.map((row) => [row.paletteItemId, row]));
  for (const paletteItemId of spotlightIds) {
    const row = byId.get(paletteItemId);
    if (!row) {
      failures.push(`${paletteItemId} missing from inventory matrix`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`Toolbox inventory failed:\n${failures.join('\n')}`);
  }
};
