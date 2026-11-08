import * as React from 'react';
import type { DesignerNode } from './types';
import type { RuntimeRenderMode } from './runtimeTypes';
import { pageGuideProps } from '../../shared/ui/shell/pageGuide/pageGuide.attrs';
import { promoteHeroUiChromeOverrideImportant } from './tailwindClasses';

/** Re-enable pointer hit-testing for designer children inside HeroUI shells that disable interaction in design mode. */
export const wrapDesignerChildSlot = (children: React.ReactNode, mode: RuntimeRenderMode): React.ReactNode => {
  if (mode !== 'design') {
    return children;
  }

  return React.createElement(
    'div',
    { className: 'pointer-events-auto relative min-h-[28px] w-full min-w-0' },
    children,
  );
};

export type HeroButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'outline' | 'ghost' | 'danger' | 'danger-soft';
export type HeroSize = 'sm' | 'md' | 'lg';
export type HeroChipColor = 'default' | 'accent' | 'success' | 'warning' | 'danger';
export type HeroChipVariant = 'primary' | 'secondary' | 'tertiary' | 'soft';

export const HEROUI_REAL_LEAF_IDS: ReadonlySet<string> = new Set<string>([
  'heroui.button-solid',
  'heroui.button-outline',
  'heroui.link',
  'heroui.chip',
  'heroui.spinner',
  'heroui.skeleton',
  'heroui.avatar',
  'heroui.switch',
  'heroui.progress',
  'heroui.slider',
  'heroui.input-text',
  'heroui.number-input',
  'heroui.textarea',
  'heroui.select',
  'heroui.autocomplete',
  'heroui.listbox',
  'heroui.dropdown',
  'heroui.entity-picker',
  'heroui.tooltip-trigger',
  'heroui.typography-lead',
  'heroui.search',
  'heroui.ai-field',
  'heroui.variable-color-picker',
  'heroui.gradient-picker',
  'heroui.border-shadow-picker',
]);

import { VIZ_PALETTE_ITEM_IDS } from './designerVizPalette';
import { UNIVERSAL_PALETTE_ITEM_IDS, LEGACY_UNIVERSAL_PALETTE_IDS, isUniversalStructuralPaletteItemId } from './designerUniversalPalette';
import { PLATFORM_CHROME_PALETTE_ITEM_IDS } from './platformChromePalette';

export const VIZ_PALETTE_LEAF_IDS: ReadonlySet<string> = new Set<string>(
  VIZ_PALETTE_ITEM_IDS.filter((id) => id !== 'viz.dashboard-canvas'),
);

export const UNIVERSAL_PALETTE_LEAF_IDS: ReadonlySet<string> = new Set<string>([
  ...UNIVERSAL_PALETTE_ITEM_IDS.filter((id) => !isUniversalStructuralPaletteItemId(id)),
  ...LEGACY_UNIVERSAL_PALETTE_IDS,
]);

export const PLATFORM_CHROME_PALETTE_LEAF_IDS: ReadonlySet<string> = new Set<string>(PLATFORM_CHROME_PALETTE_ITEM_IDS);

export const UNIVERSAL_PALETTE_STRUCTURAL_IDS: ReadonlySet<string> = new Set<string>(
  UNIVERSAL_PALETTE_ITEM_IDS.filter((id) => isUniversalStructuralPaletteItemId(id)),
);

/** CD-P02 — HeroUI parity wave 2 ids with runtime + codegen coverage. */
export const PHASE_P_WAVE2_RENDERED_IDS: ReadonlySet<string> = new Set<string>([
  'heroui.breadcrumbs',
  'heroui.pagination',
  'heroui.checkbox-group',
  'heroui.radio-group',
  'heroui.tags-input',
  'heroui.tooltip-trigger',
  'heroui.toolbar',
]);

/** Legacy palette ids removed from the toolbox but still loadable in saved drafts. */
export const LEGACY_REMOVED_PALETTE_IDS: ReadonlySet<string> = new Set<string>([
  'content.contact-form-block',
]);

export const DESIGNER_FORM_PALETTE_LEAF_IDS: ReadonlySet<string> = new Set<string>([
  'form.date-range',
  'form.code-editor',
  'form.html-editor',
  'form.markdown-editor',
  'form.mask-input',
  'form.calculator',
  'form.relation-tags-list',
  'form.related-contents-list',
  'form.cms-content-assets',
  'form.base-info-record',
  'heroui.color-control',
  'hwy.institute-logo-upload',
]);

export const HEROUI_STRUCTURAL_IDS: ReadonlySet<string> = new Set<string>([
  'heroui.card',
  'heroui.tabs',
  'heroui.accordion-item',
  'heroui.modal',
  'heroui.alert-dialog',
  'heroui.drawer',
  'heroui.table',
  'heroui.data-grid',
  'heroui.app-table-grid',
  'heroui.crud-set',
  'heroui.record-form',
  'heroui.field-container',
  'heroui.breadcrumbs',
  'heroui.pagination',
  'heroui.checkbox-group',
  'heroui.radio-group',
  'heroui.tags-input',
  'heroui.toolbar',
  'heroui.toast',
  'heroui.treegrid',
  'heroui.sidebar-menu',
  'heroui.wizard',
  'heroui.floating-panel',
  'heroui.transfer-list',
  'heroui.where-builder',
]);

export const LAYOUT_PALETTE_STRUCTURAL_IDS: ReadonlySet<string> = new Set<string>([
  'layout.split-pane',
  'layout.dock-pane',
]);

export const HEROUI_RENDERED_IDS: ReadonlySet<string> = new Set<string>([
  ...HEROUI_REAL_LEAF_IDS,
  ...HEROUI_STRUCTURAL_IDS,
  ...DESIGNER_FORM_PALETTE_LEAF_IDS,
  ...LAYOUT_PALETTE_STRUCTURAL_IDS,
  ...VIZ_PALETTE_LEAF_IDS,
  ...UNIVERSAL_PALETTE_LEAF_IDS,
  ...UNIVERSAL_PALETTE_STRUCTURAL_IDS,
  ...PLATFORM_CHROME_PALETTE_LEAF_IDS,
  ...PHASE_P_WAVE2_RENDERED_IDS,
  'heroui.chat-widget',
]);

export const PER_CHILD_STRUCTURAL_IDS: ReadonlySet<string> = new Set<string>(['heroui.tabs']);

export const getNodePaletteItemId = (node: DesignerNode): string | null => {
  const paletteItemId = node.props._designerPaletteItemId;
  return typeof paletteItemId === 'string' && paletteItemId.length > 0 ? paletteItemId : null;
};

export const resolveRuntimePaletteItemId = (node: DesignerNode): string | null => {
  const paletteItemId = getNodePaletteItemId(node);
  if (paletteItemId === 'html.container' && node.props._jsxSourceTag === 'UiSelect') {
    return 'heroui.select';
  }

  return paletteItemId;
};

export const isHeroUiRealLeafNode = (node: DesignerNode): boolean => {
  const paletteItemId = resolveRuntimePaletteItemId(node);
  return paletteItemId !== null && HEROUI_REAL_LEAF_IDS.has(paletteItemId);
};

export const isDesignerFormPaletteLeafNode = (node: DesignerNode): boolean => {
  const paletteItemId = resolveRuntimePaletteItemId(node);
  return paletteItemId !== null && DESIGNER_FORM_PALETTE_LEAF_IDS.has(paletteItemId);
};

export const isDesignerRenderableLeafNode = (node: DesignerNode): boolean => {
  const paletteItemId = resolveRuntimePaletteItemId(node);
  if (paletteItemId === 'heroui.date-picker') {
    return true;
  }
  if (paletteItemId === 'heroui.chat-widget') {
    return true;
  }
  if (paletteItemId !== null && VIZ_PALETTE_LEAF_IDS.has(paletteItemId)) {
    return true;
  }
  if (paletteItemId !== null && UNIVERSAL_PALETTE_LEAF_IDS.has(paletteItemId)) {
    return true;
  }
  if (paletteItemId !== null && PLATFORM_CHROME_PALETTE_LEAF_IDS.has(paletteItemId)) {
    return true;
  }
  return isHeroUiRealLeafNode(node) || isDesignerFormPaletteLeafNode(node);
};

export const isHeroUiStructuralNode = (node: DesignerNode): boolean => {
  const paletteItemId = resolveRuntimePaletteItemId(node);
  return paletteItemId !== null && HEROUI_STRUCTURAL_IDS.has(paletteItemId);
};

export const isHeroUiRenderedNode = (node: DesignerNode): boolean => {
  const paletteItemId = resolveRuntimePaletteItemId(node);
  return paletteItemId !== null && paletteItemId.startsWith('heroui.');
};

export const readString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim().length > 0 ? value : fallback;

export const designerNodePageGuideProps = (node: DesignerNode): Record<string, string> => {
  const title = readString(node.props.label, readString(node.props.title));
  const hint = readString(node.props.hint);
  return pageGuideProps({ title, hint, priority: 50, scope: 'local', surface: true });
};

export const withDesignerPageGuideHost = (
  node: DesignerNode,
  child: React.ReactNode,
): React.ReactNode => {
  const attrs = designerNodePageGuideProps(node);
  if (Object.keys(attrs).length === 0) {
    return child;
  }
  return React.createElement('div', { className: 'min-w-0 w-full', ...attrs }, child);
};

export const readBoolean = (value: unknown): boolean => value === true;

export const readNumber = (value: unknown, fallback: number): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
};

export const mergeClassNames = (...tokens: Array<string | undefined | null | false>): string =>
  tokens.filter(Boolean).join(' ');

const EXPLICIT_WIDTH_UTILITY = /(?:^|\s)(?:[a-z0-9-]+:)?!?w-/;

/** True when the node already sets a Tailwind width (`w-64`, `!w-full`, `md:w-80`, …). */
export const nodeClassNameHasWidthUtility = (className: string): boolean =>
  EXPLICIT_WIDTH_UTILITY.test(className.trim());

/**
 * Preview used to prefix every container with `w-full`. That stretched a left Dock Pane (`w-64`)
 * into a full-width top bar because both utilities were present.
 */
export const mergePreviewContainerClassName = (resolvedDomClassName: string): string => {
  if (nodeClassNameHasWidthUtility(resolvedDomClassName)) {
    return resolvedDomClassName;
  }
  return mergeClassNames('w-full', resolvedDomClassName);
};

export const readNodeClassName = (node: DesignerNode): string =>
  promoteHeroUiChromeOverrideImportant(String(node.props.className ?? '')).trim();

export const resolveRuntimeNodeClassName = (
  node: DesignerNode,
  ...extras: Array<string | undefined | null | false>
): string => {
  const base = mergeClassNames(readNodeClassName(node), ...extras);
  const surfaceToken = node.props.surfaceToken;
  if (typeof surfaceToken === 'string' && surfaceToken.trim().length > 0) {
    const tokenClassMap: Record<string, string> = {
      workspace: 'bg-surface-workspace',
      elevated: 'bg-surface-elevated',
      shell: 'bg-surface-shell',
      transparent: 'bg-transparent',
      menu: 'bg-nav-active',
      header: 'bg-surface-panel-muted',
    };
    const mappedClass = tokenClassMap[surfaceToken.trim()];
    if (mappedClass) {
      return mergeClassNames(base, mappedClass);
    }
  }
  return base;
};

const BLOCK_SHELL_CLASS_TOKENS = /^(?:[a-z0-9-]+:)?(?:(?:w|min-w|max-w)-|(?:flex|grid|block|contents)$|(?:basis-full|grow|self-stretch)$)/;

/** True when Tailwind width/layout utilities need a block-level canvas shell. */
export const nodeClassNameRequestsBlockShell = (className: string): boolean => {
  const tokens = className.trim().split(/\s+/).filter(Boolean);
  return tokens.some((token) => BLOCK_SHELL_CLASS_TOKENS.test(token));
};

export const resolveSize = (value: unknown): HeroSize =>
  value === 'sm' || value === 'md' || value === 'lg' ? value : 'md';

export const resolveFieldSize = (value: unknown): 'sm' | 'md' =>
  value === 'md' ? 'md' : 'sm';

const BUTTON_VARIANT_ALIASES: Record<string, HeroButtonVariant> = {
  primary: 'primary',
  secondary: 'secondary',
  tertiary: 'tertiary',
  outline: 'outline',
  ghost: 'ghost',
  danger: 'danger',
  'danger-soft': 'danger-soft',
  solid: 'primary',
  bordered: 'outline',
  light: 'ghost',
  flat: 'secondary',
  faded: 'secondary',
  shadow: 'primary',
};

const BUTTON_COLOR_TO_VARIANT: Record<string, HeroButtonVariant> = {
  default: 'secondary',
  primary: 'primary',
  secondary: 'secondary',
  success: 'primary',
  warning: 'secondary',
  danger: 'danger',
};

export const resolveButtonVariant = (node: DesignerNode, paletteItemId: string): HeroButtonVariant => {
  const rawVariant = typeof node.props.variant === 'string' ? node.props.variant : '';
  if (rawVariant && BUTTON_VARIANT_ALIASES[rawVariant]) {
    return BUTTON_VARIANT_ALIASES[rawVariant];
  }

  const rawColor = typeof node.props.color === 'string' ? node.props.color : '';
  if (rawColor && BUTTON_COLOR_TO_VARIANT[rawColor]) {
    return BUTTON_COLOR_TO_VARIANT[rawColor];
  }

  return paletteItemId === 'heroui.button-outline' ? 'outline' : 'primary';
};

export const resolveChipColor = (value: unknown): HeroChipColor | undefined => {
  if (value === 'default' || value === 'accent' || value === 'success' || value === 'warning' || value === 'danger') {
    return value;
  }
  if (value === 'primary') {
    return 'accent';
  }
  if (value === 'secondary') {
    return 'default';
  }
  return undefined;
};

export const resolveChipVariant = (value: unknown): HeroChipVariant | undefined => {
  if (value === 'primary' || value === 'secondary' || value === 'tertiary' || value === 'soft') {
    return value;
  }
  return undefined;
};

export const resolveInputType = (node: DesignerNode): string => {
  const candidate = node.props.inputType ?? node.props.type;
  return typeof candidate === 'string' && candidate.trim().length > 0 ? candidate : 'text';
};

export const resolveProgressValue = (node: DesignerNode): number => {
  const raw = node.props.value ?? node.props.progressValue;
  return Math.min(100, Math.max(0, readNumber(raw, 60)));
};

export const resolveSliderValue = (node: DesignerNode): number => readNumber(node.props.value ?? node.props.defaultValue, 40);

export const resolveSliderRangeValue = (node: DesignerNode): [number, number] => {
  const minVal = readNumber(node.props.minValue, 20);
  const maxVal = readNumber(node.props.maxValue, 80);
  return [minVal, maxVal];
};

export const isSliderRangeMode = (node: DesignerNode): boolean =>
  node.props.sliderMode === 'range';

export const resolveModalSize = (value: unknown): string | undefined => {
  const allowed = new Set(['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', 'full']);
  return typeof value === 'string' && allowed.has(value) ? value : undefined;
};

export const resolveTabLabel = (node: DesignerNode, index: number): string => {
  const text = readString(node.props.text);
  if (text) {
    return text;
  }
  const title = readString(node.props.title);
  if (title) {
    return title;
  }
  return `Tab ${index + 1}`;
};

export const resolveAccordionTitle = (node: DesignerNode): string =>
  readString(node.props.title, readString(node.props.text, 'Section'));
