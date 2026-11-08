import { getPaletteItemById, getPaletteItemForNode } from './catalog';
import { nodeHasSemanticValidation } from './designerSemanticValidation';
import { isVizPaletteItemId } from './designerVizPalette';
import { isUniversalPaletteItemId } from './designerUniversalPalette';
import { resolveVizImportSource, resolveVizImportSymbol } from './tsxVizPalette';
import { resolveUniversalImportSource, resolveUniversalImportSymbol } from './tsxUniversalPalette';
import { isPlatformPaletteItemId, resolvePlatformImportSource, resolvePlatformImportSymbol } from './tsxPlatformPalette';
import { PALETTE_HTML_TAG_BY_ID } from './domProps';
import { getNodePaletteItemId, LEGACY_REMOVED_PALETTE_IDS } from './runtimeShared';
import { TAILWIND_UI_BLOCK_STRUCTURAL_PROP_KEYS } from './tailwindUiBlocksExport';
import type { DesignerDocument, DesignerNode, DesignerPaletteItem } from './types';
import {
  clientComponentViewportRequiresWrap,
  resolveClientComponentViewportPolicy,
} from '../../shared/lib/clientComponentViewport';

export type TsxRenderKind =
  | 'html-container'
  | 'html-text'
  | 'html-heading'
  | 'html-link'
  | 'html-image'
  | 'html-iframe'
  | 'html-file-upload'
  | 'html-list'
  | 'html-list-item'
  | 'library-custom'
  | 'library-generic';

export type TsxComponentSpec = {
  paletteItemId: string | null;
  kind: TsxRenderKind;
  reactTag: string;
  htmlTag?: string;
  importFrom?: string;
  importSymbols: string[];
  selfClosing?: boolean;
  textProp?: string;
  childrenPropKeys: ReadonlySet<string>;
  structuralPropKeys: ReadonlySet<string>;
};

const HEROUI_IMPORT_SOURCE = '@heroui/react';

const VIZ_CUSTOM_PALETTE_IDS = new Set<string>([
  'viz.chart-bar',
  'viz.chart-line',
  'viz.chart-pie',
  'viz.chart-sparkline',
  'viz.chart',
  'viz.map-pin',
  'viz.map-choropleth',
  'viz.tree-view',
  'viz.tree-select',
  'viz.cascader',
  'viz.tree-combobox',
  'viz.timeline',
  'viz.gantt',
  'viz.sheet',
  'viz.kanban',
]);

const LIBRARY_CUSTOM_PALETTE_IDS = new Set<string>([
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
  'heroui.data-grid',
  'heroui.app-table-grid',
  'heroui.crud-set',
  'heroui.record-form',
  'heroui.entity-picker',
  'heroui.date-picker',
  'heroui.field-container',
  'heroui.breadcrumbs',
  'heroui.pagination',
  'heroui.checkbox-group',
  'heroui.radio-group',
  'heroui.tags-input',
  'heroui.tooltip-trigger',
  'heroui.toast',
  'heroui.toolbar',
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
  'heroui.card',
  'heroui.tabs',
  'heroui.accordion-item',
  'heroui.modal',
  'heroui.alert-dialog',
  'heroui.drawer',
  'heroui.table',
  ...VIZ_CUSTOM_PALETTE_IDS,
]);

const UNIVERSAL_CUSTOM_PALETTE_IDS = new Set<string>([
  'layout.separator',
  'layout.spacer',
  'feedback.alert',
  'feedback.banner',
  'feedback.empty-state',
  'feedback.result',
  'content.stepper',
  'content.carousel',
  'content.icon',
  'form.rating',
  'form.otp-input',
  'form.time-input',
  'form.datetime-input',
  'content.description-list',
  'content.stat-trend',
  'layout.aspect-ratio',
  'layout.sticky',
  'layout.overlay',
  'content.segmented-control',
  'marketing.faq-accordion',
  'marketing.testimonial-carousel',
  'marketing.pricing-table',
  'logic.visibility-container',
  'marketing.hero-cta',
  'content.feature-grid',
  'content.blog-card',
  'content.team-member',
  'content.contact-form-block',
  'content.split-media',
  'content.video-player',
  'content.audio-player',
  'content.qr-code',
  'content.barcode',
  'marketing.newsletter-signup',
  'content.cta-banner',
]);

const LIBRARY_TAG_OVERRIDES: Record<string, { reactTag: string; importSymbols: string[]; importFrom?: string }> = {
  'heroui.button-solid': { reactTag: 'Button', importSymbols: ['Button'] },
  'heroui.button-outline': { reactTag: 'Button', importSymbols: ['Button'] },
  'heroui.input-text': { reactTag: 'UiInput', importSymbols: ['UiInput'], importFrom: '@/shared/ui/HeroFieldControls' },
  'heroui.number-input': { reactTag: 'UiInput', importSymbols: ['UiInput'], importFrom: '@/shared/ui/HeroFieldControls' },
  'heroui.textarea': { reactTag: 'UiTextarea', importSymbols: ['UiTextarea'], importFrom: '@/shared/ui/HeroFieldControls' },
  'heroui.select': { reactTag: 'UiSelect', importSymbols: ['UiSelect'], importFrom: '@/shared/ui/HeroFieldControls' },
  'heroui.autocomplete': { reactTag: 'UiAutocomplete', importSymbols: ['UiAutocomplete'], importFrom: '@/shared/ui/HeroFieldControls' },
  'heroui.data-grid': { reactTag: 'Table', importSymbols: ['Table', 'Pagination'] },
  'heroui.table': { reactTag: 'Table', importSymbols: ['Table', 'Pagination'] },
  'heroui.app-table-grid': {
    reactTag: 'AppTableGrid',
    importSymbols: [
      'AppTableGrid',
      'GridPagingFooter',
      'ToolbarFilterSelect',
      'UiCheckbox',
      'ListPageShell',
      'ListPageToolbarFrame',
      'PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS',
      'PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS',
    ],
    importFrom: '@/shared/ui',
  },
  'heroui.crud-set': { reactTag: 'CrudSet', importSymbols: ['CrudSet'], importFrom: '@/shared/ui' },
  'heroui.record-form': { reactTag: 'RecordForm', importSymbols: ['RecordForm'], importFrom: '@/shared/ui' },
  'heroui.entity-picker': { reactTag: 'Autocomplete', importSymbols: ['Autocomplete', 'ListBox'] },
  'heroui.date-picker': { reactTag: 'DesignerDatePickerField', importSymbols: ['DesignerDatePickerField'], importFrom: '@/shared/ui/DesignerFormFields' },
  'form.date-range': { reactTag: 'DesignerDateRangeField', importSymbols: ['DesignerDateRangeField'], importFrom: '@/domain/component-designer/DesignerDateRangeField' },
  'form.code-editor': { reactTag: 'DesignerCodeEditorField', importSymbols: ['DesignerCodeEditorField'], importFrom: '@/shared/ui/DesignerFormFields' },
  'form.html-editor': { reactTag: 'DesignerHtmlEditorField', importSymbols: ['DesignerHtmlEditorField'], importFrom: '@/shared/ui/DesignerFormFields' },
  'form.markdown-editor': { reactTag: 'DesignerMarkdownEditorField', importSymbols: ['DesignerMarkdownEditorField'], importFrom: '@/shared/ui/DesignerFormFields' },
  'form.mask-input': { reactTag: 'DesignerMaskInputField', importSymbols: ['DesignerMaskInputField'], importFrom: '@/shared/ui/DesignerMaskInputField' },
  'form.calculator': { reactTag: 'DesignerCalculatorField', importSymbols: ['DesignerCalculatorField'], importFrom: '@/shared/ui/DesignerFormFields' },
  'form.relation-tags-list': {
    reactTag: 'DesignerRelationTagsListField',
    importSymbols: ['DesignerRelationTagsListField'],
    importFrom: '@/domain/component-designer/DesignerRelationTagsListField',
  },
  'form.related-contents-list': {
    reactTag: 'DesignerRelatedContentsListField',
    importSymbols: ['DesignerRelatedContentsListField'],
    importFrom: '@/domain/component-designer/DesignerRelatedContentsListField',
  },
  'form.cms-content-assets': {
    reactTag: 'DesignerCmsContentAssetsField',
    importSymbols: ['DesignerCmsContentAssetsField'],
    importFrom: '@/domain/component-designer/DesignerCmsContentAssetsField',
  },
  'form.base-info-record': {
    reactTag: 'DesignerBaseInfoRecordFormField',
    importSymbols: ['DesignerBaseInfoRecordFormField'],
    importFrom: '@/domain/component-designer/DesignerBaseInfoRecordFormField',
  },
  'hwy.institute-logo-upload': {
    reactTag: 'HwyInstituteLogoUploadField',
    importSymbols: ['HwyInstituteLogoUploadField'],
    importFrom: '@/domain/hwy/HwyInstituteLogoUploadField',
  },
  'heroui.color-control': { reactTag: 'DesignerColorEditorField', importSymbols: ['DesignerColorEditorField'], importFrom: '@/shared/ui/DesignerFormFields' },
  'heroui.progress': { reactTag: 'ProgressBar', importSymbols: ['ProgressBar'] },
  'heroui.alert-dialog': { reactTag: 'ConfirmDialogShell', importSymbols: ['ConfirmDialogShell'], importFrom: '@/shared/ui' },
  'heroui.modal': { reactTag: 'CreateEditModalShell', importSymbols: ['CreateEditModalShell'], importFrom: '@/shared/ui' },
  'heroui.listbox': { reactTag: 'ListBox', importSymbols: ['ListBox'] },
  'heroui.typography-lead': { reactTag: 'p', importSymbols: [] },
  'heroui.field-container': { reactTag: 'fieldset', importSymbols: [] },
  'heroui.breadcrumbs': { reactTag: 'Breadcrumbs', importSymbols: ['Breadcrumbs'] },
  'heroui.pagination': { reactTag: 'Pagination', importSymbols: ['Pagination'] },
  'heroui.checkbox-group': { reactTag: 'CheckboxGroup', importSymbols: ['CheckboxGroup', 'Checkbox'] },
  'heroui.radio-group': { reactTag: 'RadioGroup', importSymbols: ['RadioGroup', 'Radio'] },
  'heroui.tags-input': { reactTag: 'TagGroup', importSymbols: ['TagGroup', 'Tag'] },
  // Bug found (parity audit item 8): 'Button' was missing from importSymbols — the no-href
  // trigger case only ever emitted a static, non-interactive <span> (see
  // renderTooltipTriggerParityJsx in tsxParityPalette.ts) instead of the real interactive
  // <Button> the live canvas/Preview renders (DesignerRuntimeParityPalette.tsx's HButton).
  'heroui.tooltip-trigger': { reactTag: 'Tooltip', importSymbols: ['Tooltip', 'Link', 'Button'] },
  // Legacy removed palette item — no import; codegen emits a null/children stub.
  'heroui.toast': { reactTag: 'Fragment', importSymbols: [] },
  'heroui.toolbar': { reactTag: 'Toolbar', importSymbols: ['Toolbar'] },
  'heroui.tabs': { reactTag: 'UiTabs', importSymbols: ['UiTabs'], importFrom: '@/shared/ui' },
};

const PALETTE_STRUCTURAL_PROP_KEYS: Record<string, ReadonlySet<string>> = {
  'heroui.card': new Set(['title', 'description']),
  'heroui.modal': new Set(['title']),
  'heroui.alert-dialog': new Set(['title']),
  'heroui.drawer': new Set(['title']),
  'heroui.accordion-item': new Set(['title', 'text']),
  'heroui.field-container': new Set(['title', 'label']),
  'heroui.breadcrumbs': new Set(['text', 'label', 'items']),
  'heroui.tabs': new Set([
    'items',
    'placement',
    'alignment',
    'width',
    'variant',
    'visualMode',
    'panelAttachment',
    'overflow',
    'activationMode',
    'panelLifecycle',
    'defaultSelectedKey',
    'selectedKey',
    'ariaLabel',
  ]),
  'heroui.slider': new Set(['sliderMode', 'minValue', 'maxValue', 'showTooltip']),
  'heroui.pagination': new Set(['page', 'total']),
  'heroui.checkbox-group': new Set(['items', 'isSelected', 'optionsSource']),
  'heroui.radio-group': new Set(['items', 'isSelected']),
  'heroui.tags-input': new Set(['value', 'label', 'placeholder']),
  'heroui.tooltip-trigger': new Set(['text', 'href']),
  // Bug found (parity audit item 66): leftover `color` from older documents must not leak onto
  // the exported raw `<p>` once the dead Inspector Color field is removed.
  'heroui.typography-lead': new Set(['color']),
};

const resolveStructuralPropKeys = (paletteItemId: string): ReadonlySet<string> =>
  PALETTE_STRUCTURAL_PROP_KEYS[paletteItemId]
  ?? TAILWIND_UI_BLOCK_STRUCTURAL_PROP_KEYS[paletteItemId]
  ?? new Set<string>();

const paletteSuffixToReactTag = (paletteItemId: string): string => {
  const suffix = paletteItemId.replace(/^heroui\./, '');
  return suffix
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join('');
};

const resolveLibrarySpec = (
  paletteItemId: string,
): Pick<TsxComponentSpec, 'kind' | 'reactTag' | 'importFrom' | 'importSymbols' | 'selfClosing' | 'textProp' | 'childrenPropKeys' | 'structuralPropKeys'> => {
  if (isVizPaletteItemId(paletteItemId)) {
    const reactTag = resolveVizImportSymbol(paletteItemId) ?? 'DesignerVizChart';
    const importFrom = resolveVizImportSource(paletteItemId) ?? '@/domain/component-designer/DesignerRuntimeCharts';
    const isCanvas = paletteItemId === 'viz.dashboard-canvas';
    return {
      kind: 'library-custom',
      reactTag,
      importFrom,
      importSymbols: [reactTag],
      selfClosing: !isCanvas,
      textProp: undefined,
      childrenPropKeys: new Set<string>(),
      structuralPropKeys: new Set(['title', 'data', 'label', 'placeholder']),
    };
  }

  if (isUniversalPaletteItemId(paletteItemId)) {
    const reactTag = resolveUniversalImportSymbol(paletteItemId) ?? 'DesignerUniversalWidget';
    const importFrom = resolveUniversalImportSource(paletteItemId);
    const structural = new Set([
      'layout.aspect-ratio',
      'layout.sticky',
      'layout.overlay',
      'logic.visibility-container',
      'content.split-media',
    ]);
    return {
      kind: 'library-custom',
      reactTag,
      importFrom,
      importSymbols: [reactTag],
      selfClosing: !structural.has(paletteItemId),
      textProp: undefined,
      childrenPropKeys: new Set<string>(),
      structuralPropKeys: new Set(['title', 'data', 'label', 'visibleCondition']),
    };
  }

  if (isPlatformPaletteItemId(paletteItemId)) {
    // Bug found (cluster F): platform.nav.* / platform.slot.* previously had no entry
    // here at all, so resolveTsxComponentSpec's generic-container fallback kicked in and
    // these nodes exported as plain `<div componentKey="..." slotId="..." ...>` — inert
    // markup, not the real PlatformNavigationHost / DesignerSlotPreview runtime components
    // that the live designer preview (designerRuntimePreview.tsx) already uses. See
    // tsxPlatformPalette.ts for the render logic.
    const reactTag = resolvePlatformImportSymbol(paletteItemId) ?? 'DesignerSlotPreview';
    const importFrom = resolvePlatformImportSource(paletteItemId) ?? '@/features/component-designer/components/DesignerSlotPreview';
    return {
      kind: 'library-custom',
      reactTag,
      importFrom,
      importSymbols: [reactTag],
      selfClosing: true,
      textProp: undefined,
      childrenPropKeys: new Set<string>(),
      structuralPropKeys: new Set(['componentKey', 'navigationRef', 'slotId', 'label', 'surface']),
    };
  }

  if (paletteItemId === 'heroui.chat-widget') {
    return {
      kind: 'library-custom',
      reactTag: 'DesignerChatWidget',
      importFrom: '@/domain/component-designer/DesignerRuntimePlatformChrome',
      importSymbols: ['DesignerChatWidget'],
      selfClosing: true,
      textProp: undefined,
      childrenPropKeys: new Set<string>(),
      structuralPropKeys: new Set(['channelRef', 'messagesDataSource']),
    };
  }

  const override = LIBRARY_TAG_OVERRIDES[paletteItemId];
  const reactTag = override?.reactTag ?? paletteSuffixToReactTag(paletteItemId);
  const importSymbols = override?.importSymbols ?? [reactTag];

  if (LIBRARY_CUSTOM_PALETTE_IDS.has(paletteItemId)) {
    return {
      kind: 'library-custom',
      reactTag,
      importFrom: override?.importFrom ?? HEROUI_IMPORT_SOURCE,
      importSymbols,
      textProp: 'text',
      childrenPropKeys: new Set(['text']),
      structuralPropKeys: resolveStructuralPropKeys(paletteItemId),
    };
  }

  return {
    kind: 'library-generic',
    reactTag,
    importFrom: HEROUI_IMPORT_SOURCE,
    importSymbols,
    textProp: 'text',
    childrenPropKeys: new Set(['text', 'label']),
    structuralPropKeys: resolveStructuralPropKeys(paletteItemId),
  };
};

const resolveHtmlKind = (nodeType: string, paletteItemId?: string | null): TsxRenderKind => {
  if (paletteItemId === 'html.iframe') {
    return 'html-iframe';
  }

  if (paletteItemId === 'html.file-upload') {
    return 'html-file-upload';
  }

  switch (nodeType) {
    case 'text':
      return 'html-text';
    case 'heading':
      return 'html-heading';
    case 'link':
      return 'html-link';
    case 'image':
      return 'html-image';
    case 'iframe':
      return 'html-iframe';
    case 'file-upload':
      return 'html-file-upload';
    case 'list':
      return 'html-list';
    case 'list-item':
      return 'html-list-item';
    default:
      return 'html-container';
  }
};

const resolveHtmlTag = (paletteItem: DesignerPaletteItem | undefined, nodeType: string, node?: DesignerNode, fallback = 'div'): string => {
  if (paletteItem && PALETTE_HTML_TAG_BY_ID[paletteItem.id]) {
    return PALETTE_HTML_TAG_BY_ID[paletteItem.id];
  }

  switch (nodeType) {
    case 'text':
      return 'p';
    case 'heading': {
      const level = node?.props.level;
      return typeof level === 'string' && /^h[1-6]$/.test(level) ? level : 'h2';
    }
    case 'link':
      return 'a';
    case 'image':
      return 'img';
    case 'iframe':
      return 'iframe';
    case 'list':
      return 'ul';
    case 'list-item':
      return 'li';
    default:
      return fallback;
  }
};

export const resolveTsxComponentSpec = (node: DesignerNode): TsxComponentSpec => {
  const paletteItemId = getNodePaletteItemId(node);
  const paletteItem = paletteItemId ? getPaletteItemById(paletteItemId) : getPaletteItemForNode(node);

  if (paletteItemId === 'heroui.textarea' && nodeHasSemanticValidation(node)) {
    return {
      paletteItemId,
      kind: 'library-custom',
      reactTag: 'SemanticAssistTextarea',
      importFrom: '@/shared/ui/ai-field-assist/SemanticAssistTextarea',
      importSymbols: ['SemanticAssistTextarea'],
      textProp: undefined,
      childrenPropKeys: new Set<string>(),
      structuralPropKeys: resolveStructuralPropKeys('heroui.textarea'),
    };
  }

  if (
    paletteItemId === 'form.date-range'
    || paletteItemId?.startsWith('form.')
    || paletteItemId?.startsWith('heroui.')
    || paletteItemId?.startsWith('hwy.')
    || isVizPaletteItemId(paletteItemId)
    || isUniversalPaletteItemId(paletteItemId)
    || isPlatformPaletteItemId(paletteItemId)
  ) {
    const librarySpec = resolveLibrarySpec(paletteItemId);
    return {
      paletteItemId,
      ...librarySpec,
    };
  }

  const nodeType = paletteItem?.nodeType ?? node.type;
  const htmlKind = resolveHtmlKind(nodeType, paletteItemId ?? paletteItem?.id);
  const htmlTag = resolveHtmlTag(paletteItem, nodeType, node);

  if (paletteItemId === 'html.file-upload') {
    return {
      paletteItemId,
      kind: htmlKind,
      reactTag: 'DesignerRuntimeFileUpload',
      importFrom: '@/domain/component-designer/DesignerRuntimeFileUpload',
      importSymbols: ['DesignerRuntimeFileUpload'],
      childrenPropKeys: new Set<string>(),
      structuralPropKeys: new Set<string>(),
    };
  }

  return {
    paletteItemId: paletteItem?.id ?? paletteItemId,
    kind: htmlKind,
    reactTag: htmlTag,
    htmlTag,
    importSymbols: [],
    selfClosing: htmlKind === 'html-image' || htmlKind === 'html-iframe',
    textProp: htmlKind === 'html-text' || htmlKind === 'html-heading' || htmlKind === 'html-list-item' || htmlKind === 'html-link'
      ? 'text'
      : undefined,
    childrenPropKeys: htmlKind === 'html-text' || htmlKind === 'html-heading' || htmlKind === 'html-list-item' || htmlKind === 'html-link'
      ? new Set(['text'])
      : new Set<string>(),
    structuralPropKeys: htmlKind === 'html-heading' ? new Set(['level']) : new Set<string>(),
  };
};

export type TsxImportRequirement = {
  source: string;
  symbols: Set<string>;
};

export const collectTsxImportRequirements = (document: DesignerDocument): TsxImportRequirement[] => {
  const requirements = new Map<string, Set<string>>();

  for (const node of Object.values(document.nodes)) {
    if (node.layout.visible === false) {
      continue;
    }

    if (node.props.contentStatusPicker === true || node.props.contentStatusPicker === 'true') {
      const existing = requirements.get('@/domain/component-designer/DesignerRuntimeContentStatusPicker') ?? new Set<string>();
      existing.add('DesignerRuntimeContentStatusPicker');
      requirements.set('@/domain/component-designer/DesignerRuntimeContentStatusPicker', existing);
    }

    const paletteItemId = getNodePaletteItemId(node);
    if (paletteItemId === 'layout.split-pane') {
      const existing = requirements.get('@/shared/ui') ?? new Set<string>();
      existing.add('UiSplitPane');
      requirements.set('@/shared/ui', existing);
    }
    if (paletteItemId === 'layout.dock-pane') {
      const existing = requirements.get('@/shared/ui') ?? new Set<string>();
      existing.add('UiDockPane');
      requirements.set('@/shared/ui', existing);
    }
    if (paletteItemId && LEGACY_REMOVED_PALETTE_IDS.has(paletteItemId)) {
      continue;
    }

    const spec = resolveTsxComponentSpec(node);
    if (!spec.importFrom || spec.importSymbols.length === 0) {
      continue;
    }

    const existing = requirements.get(spec.importFrom) ?? new Set<string>();
    for (const symbol of spec.importSymbols) {
      existing.add(symbol);
    }
    requirements.set(spec.importFrom, existing);
  }

  const needsClientComponent = Object.values(document.nodes).some((node) => {
    if (node.layout.visible === false) {
      return false;
    }
    const policy = resolveClientComponentViewportPolicy({
      minViewport: node.props.minViewport,
      belowMin: node.props.belowMin,
    });
    return clientComponentViewportRequiresWrap(policy);
  });
  if (needsClientComponent) {
    const existing = requirements.get('@/shared/ui') ?? new Set<string>();
    existing.add('UiClientComponent');
    requirements.set('@/shared/ui', existing);
  }

  return Array.from(requirements.entries()).map(([source, symbols]) => ({ source, symbols }));
};

export const buildTsxImportLines = (requirements: TsxImportRequirement[]): string[] =>
  requirements
    .sort((left, right) => left.source.localeCompare(right.source))
    .map(({ source, symbols }) => `import { ${Array.from(symbols).sort().join(', ')} } from '${source}';`);

export const isLibraryPaletteItemId = (paletteItemId: string | null): boolean =>
  typeof paletteItemId === 'string' && paletteItemId.startsWith('heroui.');
