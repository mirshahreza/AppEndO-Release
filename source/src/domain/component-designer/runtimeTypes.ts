import type * as React from 'react';
import type { PreviewCultureFormatOptions } from './previewCultureFormatting';
import type { PreviewEventHandlerContext } from './bindingPreviewHandlers';
import type { DesignerBindingDefinitions, DesignerDocument, DesignerNode } from './types';
import type { DesignerDataGridColumn } from './designerDataGridColumns';

export type RuntimeRenderMode = 'design' | 'runtime';

export type DesignerPreviewBindingBridge = {
  resolveTextContent: (node: DesignerNode, fallback: string) => string;
  resolveInputPlaceholder: (node: DesignerNode, fallback: string) => string;
  resolveInputValue: (node: DesignerNode) => string | undefined;
  resolveSelectSelectedKeys?: (node: DesignerNode) => string | undefined;
  resolveSelectItems?: (node: DesignerNode) => Array<{ id: string; textValue: string }> | undefined;
  /** Checkbox/radio group selected values — preserves array region data (e.g. roles: string[]). */
  resolveChoiceGroupSelectedValues?: (node: DesignerNode) => string[] | undefined;
  /** Switch/checkbox `isSelected` bound to region or store data in interactive preview. */
  resolveSwitchIsSelected?: (node: DesignerNode, fallback: boolean) => boolean;
  resolveImageSrc: (node: DesignerNode, fallback: string) => string;
  resolveImageAlt: (node: DesignerNode, fallback: string) => string;
  /**
   * Generic bound-text resolver for arbitrary props (e.g. heroui.card's `title`/`description`,
   * heroui.accordion-item's `title`) — resolveTextContent above is hardcoded to the `text`
   * prop, so structural widgets whose bindable text lives under a different prop name had no
   * way to consult a Property Binding in the live/interactive preview at all. Optional so
   * every pre-existing bridge construction site remains a valid DesignerPreviewBindingBridge.
   */
  resolveTextProp?: (node: DesignerNode, targetProp: string, fallback: string) => string;
  /**
   * Generic bound-NUMBER resolver for arbitrary props (e.g. heroui.pagination's `page`/`total`)
   * — unlike `resolveTextProp`, this reads the raw bound value directly (never through
   * `formatPreviewCultureScalar`), since a culture-formatted display string (e.g. "1,234") is
   * not safely re-parseable back into a number with `Number(...)`. Optional for the same
   * backward-compatibility reason as `resolveTextProp`.
   */
  resolveNumberProp?: (node: DesignerNode, targetProp: string, fallback: number) => number;
};

export type RuntimeRenderOptions = {
  mode: RuntimeRenderMode;
  style?: React.CSSProperties;
  previewBindings?: DesignerPreviewBindingBridge;
  previewEvents?: PreviewEventHandlerContext;
  isSubmitting?: boolean;
  bindingDefinitions?: DesignerBindingDefinitions;
  designerDocument?: DesignerDocument;
  /** Inline preview validation errors keyed by designer node id. */
  previewFieldErrors?: Record<string, string>;
  /** Updates or clears a single preview validation error. */
  onPreviewFieldValidation?: (nodeId: string, message: string | null) => void;
  /** Hydrated list rows for data-grid preview when grid list binding is active. */
  gridRows?: Array<Record<string, unknown>>;
  /** Server-mode list total from API `count` / `totalPath` hydration metadata. */
  gridListTotalCount?: number;
  /** When true, preview must not fall back to mock rows. */
  gridListBound?: boolean;
  /** True while canvas hydration is fetching grid list rows. */
  gridListLoading?: boolean;
  /** True when the grid hydration request failed. */
  gridListError?: boolean;
  /** Row action handler for data-grid action columns. */
  onGridRowAction?: (row: Record<string, unknown>, actionId: string) => void;
  /** Cell click handler for rich grid cells (link, chips, lock-status). */
  onGridCellClick?: (row: Record<string, unknown>, column: DesignerDataGridColumn) => void;
  /** Refresh handler for grid list binding (toolbar refresh / retry). */
  onGridRefresh?: () => void;
  /** Hydrated chart rows when chart data binding is active (single-source). */
  chartRows?: Array<Record<string, unknown>>;
  /** Multi-source chart datasets (combo chart) — each entry is one API source + mapping. */
  chartSourceDatasets?: Array<{
    rows: Array<Record<string, unknown>>;
    fieldMapping: import('./bindingChartEngine').DesignerChartFieldMapping;
  }>;
  /** When true, preview must not fall back to mock chart data. */
  chartListBound?: boolean;
  /** True while canvas hydration is fetching chart rows. */
  chartListLoading?: boolean;
  /** True when the chart hydration request failed. */
  chartListError?: boolean;
  /** Refresh handler for chart data binding. */
  onChartRefresh?: () => void;
  /** Hydrated API rows for non-chart viz widgets when viz data binding is active. */
  vizRows?: Array<Record<string, unknown>>;
  /** When true, preview must not fall back to mock viz data. */
  vizListBound?: boolean;
  /** True while canvas hydration is fetching viz rows. */
  vizListLoading?: boolean;
  /** True when the viz hydration request failed. */
  vizListError?: boolean;
  /** Refresh handler for non-chart viz data binding. */
  onVizRefresh?: () => void;
  /** Hydrated API rows for Dual-Mode content/marketing widgets. */
  contentRows?: Array<Record<string, unknown>>;
  /** When true, Dual-Mode bound content must use contentRows (not static JSON). */
  contentListBound?: boolean;
  /** Live designer store for runtime overlay + grid detail flows. */
  designerStore?: Record<string, unknown>;
  /**
   * Resolved page-level fetch data (the same object the exported component's `dataContext`
   * variable represents) — used by `logic.visibility-container`'s `data.<field>`-scoped
   * conditions. Bug found (parity audit item P3.18): this was never threaded through
   * `RuntimeRenderOptions` at all, so a `data.`-scoped condition always evaluated against
   * `null` in the live/interactive preview, while export (which passes the real `dataContext`
   * variable directly) was always correct.
   */
  dataContext?: Record<string, unknown> | null;
  /** Locale/calendar formatting for bound preview values. */
  previewCultureFormat?: PreviewCultureFormatOptions;
  /** Culture catalog lookup for grid chrome / column labels in interactive preview. */
  translate?: (key: string) => string;
  /**
   * The enclosing `logic.repeater`'s current item/index, when this node is (possibly nested)
   * inside one — used by `logic.visibility-container`'s `item.<field>`-scoped conditions. Bug
   * found (parity audit item 18): this was never threaded through at all, so a nested
   * visibility-container's `item.`-scoped condition always evaluated `item` as undefined in the
   * live/interactive preview, always hiding its content.
   */
  repeaterScope?: { item?: unknown; index?: number };
};
