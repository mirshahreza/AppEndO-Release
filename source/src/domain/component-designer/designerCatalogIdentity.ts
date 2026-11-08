/** Same 13 groups as Base Components — single Toolbox taxonomy (p-103 §3). */
export type DesignerCatalogToolboxGroup =
  | 'data'
  | 'actions'
  | 'form-fields'
  | 'editors'
  | 'pickers'
  | 'overlays'
  | 'navigation'
  | 'layout'
  | 'query'
  | 'feedback'
  | 'identity'
  | 'shell'
  | 'creative';

/**
 * p-103 identity table — one concept, one Base Components section, one Toolbox id.
 * Locked with the operator on 2026-09-03 (plan §4 + §9).
 */
export type DesignerCatalogIdentityKind =
  | 'compile'
  | 'legacy'
  | 'park'
  | 'add-to-toolbox'
  | 'add-to-catalog'
  | 'package-gated'
  | 'shell-only';

export type DesignerCatalogPackageGate = 'cms' | 'base-info' | 'calculator';

export type DesignerCatalogIdentityRow = {
  /** Base Components section id (`componentId`). Empty only for park / shell-only / package-gated leftovers. */
  componentId: string;
  paletteItemId: string;
  kind: DesignerCatalogIdentityKind;
  toolboxGroup: DesignerCatalogToolboxGroup;
  /** Visual Toolbox family only (D9 Dialog = modal + drawer). */
  toolboxFamily?: string;
  packageGate?: DesignerCatalogPackageGate;
  /** Merge loser that still resolves for old drafts. */
  legacyOf?: string;
};

export const DESIGNER_CATALOG_IDENTITY: readonly DesignerCatalogIdentityRow[] = [
  // —— 4.1 Data ——
  { componentId: 'crud-set', paletteItemId: 'heroui.crud-set', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'edit-view', paletteItemId: 'heroui.record-form', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'grid', paletteItemId: 'heroui.app-table-grid', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'grid', paletteItemId: 'heroui.data-grid', kind: 'legacy', toolboxGroup: 'data', legacyOf: 'heroui.app-table-grid' },
  { componentId: 'grid', paletteItemId: 'heroui.table', kind: 'legacy', toolboxGroup: 'data', legacyOf: 'heroui.app-table-grid' },
  { componentId: 'treegrid', paletteItemId: 'heroui.treegrid', kind: 'add-to-toolbox', toolboxGroup: 'data' },
  { componentId: 'chart', paletteItemId: 'viz.chart', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'chart', paletteItemId: 'viz.chart-bar', kind: 'legacy', toolboxGroup: 'data', legacyOf: 'viz.chart' },
  { componentId: 'chart', paletteItemId: 'viz.chart-line', kind: 'legacy', toolboxGroup: 'data', legacyOf: 'viz.chart' },
  { componentId: 'chart', paletteItemId: 'viz.chart-pie', kind: 'legacy', toolboxGroup: 'data', legacyOf: 'viz.chart' },
  { componentId: 'chart', paletteItemId: 'viz.chart-sparkline', kind: 'legacy', toolboxGroup: 'data', legacyOf: 'viz.chart' },
  { componentId: 'kanban', paletteItemId: 'viz.kanban', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'spreadsheet', paletteItemId: 'viz.sheet', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'map', paletteItemId: 'viz.map-pin', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'map', paletteItemId: 'viz.map-choropleth', kind: 'legacy', toolboxGroup: 'data', legacyOf: 'viz.map-pin' },
  { componentId: 'codes', paletteItemId: 'content.qr-code', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'codes', paletteItemId: 'content.barcode', kind: 'legacy', toolboxGroup: 'data', legacyOf: 'content.qr-code' },
  { componentId: 'media-players', paletteItemId: 'content.video-player', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'media-players', paletteItemId: 'content.audio-player', kind: 'legacy', toolboxGroup: 'data', legacyOf: 'content.video-player' },
  { componentId: 'plain-text', paletteItemId: 'html.text', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'heading', paletteItemId: 'html.heading', kind: 'compile', toolboxGroup: 'data' },

  // —— 4.2 Navigation / Overlays / Actions ——
  { componentId: 'tabs', paletteItemId: 'heroui.tabs', kind: 'compile', toolboxGroup: 'navigation' },
  { componentId: 'breadcrumbs', paletteItemId: 'heroui.breadcrumbs', kind: 'compile', toolboxGroup: 'navigation' },
  { componentId: 'accordion-disclosure', paletteItemId: 'heroui.accordion-item', kind: 'compile', toolboxGroup: 'navigation' },
  { componentId: 'sidebar-menu', paletteItemId: 'heroui.sidebar-menu', kind: 'add-to-toolbox', toolboxGroup: 'navigation' },
  { componentId: 'toolbar', paletteItemId: 'heroui.toolbar', kind: 'compile', toolboxGroup: 'actions' },
  { componentId: 'buttons', paletteItemId: 'heroui.button-solid', kind: 'compile', toolboxGroup: 'actions' },
  { componentId: 'buttons', paletteItemId: 'heroui.button-outline', kind: 'legacy', toolboxGroup: 'actions', legacyOf: 'heroui.button-solid' },
  { componentId: 'dialog', paletteItemId: 'heroui.modal', kind: 'compile', toolboxGroup: 'overlays', toolboxFamily: 'Dialog' },
  { componentId: 'drawer', paletteItemId: 'heroui.drawer', kind: 'compile', toolboxGroup: 'overlays', toolboxFamily: 'Dialog' },
  { componentId: 'create-edit', paletteItemId: '', kind: 'park', toolboxGroup: 'overlays' },
  { componentId: 'confirm', paletteItemId: 'heroui.alert-dialog', kind: 'compile', toolboxGroup: 'overlays' },
  { componentId: 'wizard', paletteItemId: 'heroui.wizard', kind: 'add-to-toolbox', toolboxGroup: 'overlays' },
  { componentId: 'floating-panel', paletteItemId: 'heroui.floating-panel', kind: 'add-to-toolbox', toolboxGroup: 'overlays' },
  { componentId: 'popover-tooltip', paletteItemId: 'heroui.tooltip-trigger', kind: 'compile', toolboxGroup: 'overlays' },
  { componentId: 'popover-tooltip', paletteItemId: 'heroui.dropdown', kind: 'compile', toolboxGroup: 'overlays' },

  // —— 4.3 Form / Editors / Pickers ——
  { componentId: 'text-fields', paletteItemId: 'heroui.input-text', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'text-fields', paletteItemId: 'heroui.textarea', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'text-fields', paletteItemId: 'heroui.number-input', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'choice-fields', paletteItemId: 'heroui.select', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'choice-fields', paletteItemId: 'heroui.autocomplete', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'choice-fields', paletteItemId: 'heroui.checkbox-group', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'choice-fields', paletteItemId: 'heroui.radio-group', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'selection-fields', paletteItemId: 'heroui.switch', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'selection-fields', paletteItemId: 'heroui.slider', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'selection-fields', paletteItemId: 'heroui.tags-input', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'selection-fields', paletteItemId: 'heroui.listbox', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'structured-fields', paletteItemId: 'heroui.entity-picker', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'structured-fields', paletteItemId: 'form.mask-input', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'otp-input', paletteItemId: 'form.otp-input', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'date-time', paletteItemId: 'heroui.date-picker', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'date-time', paletteItemId: 'form.date-range', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'date-time', paletteItemId: 'form.time-input', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'date-time', paletteItemId: 'form.datetime-input', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'file-media-input', paletteItemId: 'html.file-upload', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'search', paletteItemId: 'heroui.search', kind: 'add-to-toolbox', toolboxGroup: 'form-fields' },
  { componentId: 'ai-fields', paletteItemId: 'heroui.ai-field', kind: 'add-to-toolbox', toolboxGroup: 'form-fields' },
  { componentId: 'ai-chat-panel', paletteItemId: 'heroui.chat-widget', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'transfer-list', paletteItemId: 'heroui.transfer-list', kind: 'add-to-toolbox', toolboxGroup: 'form-fields' },
  { componentId: 'markdown-editor', paletteItemId: 'form.markdown-editor', kind: 'compile', toolboxGroup: 'editors' },
  { componentId: 'html-editor', paletteItemId: 'form.html-editor', kind: 'compile', toolboxGroup: 'editors' },
  { componentId: 'code-editor', paletteItemId: 'form.code-editor', kind: 'compile', toolboxGroup: 'editors' },
  { componentId: 'color-picker', paletteItemId: 'heroui.color-control', kind: 'compile', toolboxGroup: 'pickers' },
  { componentId: 'variable-color-picker', paletteItemId: 'heroui.variable-color-picker', kind: 'add-to-toolbox', toolboxGroup: 'pickers' },
  { componentId: 'gradient-picker', paletteItemId: 'heroui.gradient-picker', kind: 'add-to-toolbox', toolboxGroup: 'pickers' },
  { componentId: 'border-shadow-picker', paletteItemId: 'heroui.border-shadow-picker', kind: 'add-to-toolbox', toolboxGroup: 'pickers' },

  // —— 4.4 Layout ——
  { componentId: 'surface-box', paletteItemId: 'heroui.card', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'surface-box', paletteItemId: 'tailwind.card', kind: 'park', toolboxGroup: 'layout' },
  { componentId: 'surface-box', paletteItemId: 'tailwind.card-glass', kind: 'park', toolboxGroup: 'layout' },
  { componentId: 'scroll-area', paletteItemId: 'layout.scroll', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'dock-pane', paletteItemId: 'layout.dock-pane', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'canvas-toolbar', paletteItemId: '', kind: 'park', toolboxGroup: 'layout' },
  { componentId: 'toolbox-panel', paletteItemId: '', kind: 'park', toolboxGroup: 'layout' },
  { componentId: 'component-layout', paletteItemId: '', kind: 'park', toolboxGroup: 'layout' },
  { componentId: 'client-component', paletteItemId: '', kind: 'park', toolboxGroup: 'layout' },
  { componentId: 'flex-row', paletteItemId: 'layout.flex-row', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'flex-column', paletteItemId: 'layout.flex-column', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'grid-2', paletteItemId: 'layout.grid-2', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'grid-3', paletteItemId: 'layout.grid-3', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'columns', paletteItemId: 'layout.columns', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'stack-compact', paletteItemId: 'layout.stack-compact', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'stack-relaxed', paletteItemId: 'layout.stack-relaxed', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'center', paletteItemId: 'layout.center', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'wrapper', paletteItemId: 'layout.wrapper', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'sticky-bar', paletteItemId: 'layout.sticky-bar', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'split-pane', paletteItemId: 'layout.split-pane', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'separator', paletteItemId: 'layout.separator', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'spacer', paletteItemId: 'layout.spacer', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'aspect-ratio', paletteItemId: 'layout.aspect-ratio', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'sticky', paletteItemId: 'layout.sticky', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'overlay', paletteItemId: 'layout.overlay', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'html-container', paletteItemId: 'html.container', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'html-section', paletteItemId: 'html.section', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'html-article', paletteItemId: 'html.article', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'html-figure', paletteItemId: 'html.figure', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'html-table-wrap', paletteItemId: 'html.table-wrap', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'html-form', paletteItemId: 'html.form', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'html-list', paletteItemId: 'html.list', kind: 'compile', toolboxGroup: 'layout' },
  { componentId: 'html-list-item', paletteItemId: 'html.list-item', kind: 'compile', toolboxGroup: 'layout' },

  // —— 4.5 Query / Feedback / Identity ——
  { componentId: 'where-builder', paletteItemId: 'heroui.where-builder', kind: 'add-to-toolbox', toolboxGroup: 'query' },
  { componentId: 'relations', paletteItemId: 'form.relation-tags-list', kind: 'compile', toolboxGroup: 'query' },
  { componentId: 'relations', paletteItemId: 'form.related-contents-list', kind: 'legacy', toolboxGroup: 'query', legacyOf: 'form.relation-tags-list' },
  { componentId: 'repeater', paletteItemId: 'logic.repeater', kind: 'compile', toolboxGroup: 'query' },
  { componentId: 'visibility-container', paletteItemId: 'logic.visibility-container', kind: 'compile', toolboxGroup: 'query' },
  { componentId: 'toast', paletteItemId: 'heroui.toast', kind: 'add-to-toolbox', toolboxGroup: 'feedback' },
  { componentId: 'skeleton', paletteItemId: 'heroui.skeleton', kind: 'compile', toolboxGroup: 'feedback' },
  { componentId: 'progress', paletteItemId: 'heroui.progress', kind: 'compile', toolboxGroup: 'feedback' },
  { componentId: 'progress', paletteItemId: 'heroui.spinner', kind: 'compile', toolboxGroup: 'feedback' },
  { componentId: 'loading-error-empty', paletteItemId: 'feedback.empty-state', kind: 'compile', toolboxGroup: 'feedback' },
  { componentId: 'loading-error-empty', paletteItemId: 'feedback.result', kind: 'legacy', toolboxGroup: 'feedback', legacyOf: 'feedback.empty-state' },
  { componentId: 'loading-error-empty', paletteItemId: 'feedback.alert', kind: 'legacy', toolboxGroup: 'feedback', legacyOf: 'feedback.empty-state' },
  { componentId: 'loading-error-empty', paletteItemId: 'feedback.banner', kind: 'legacy', toolboxGroup: 'feedback', legacyOf: 'feedback.empty-state' },
  { componentId: 'loading-error-empty', paletteItemId: 'tailwind.alert', kind: 'legacy', toolboxGroup: 'feedback', legacyOf: 'feedback.empty-state' },
  { componentId: 'avatar', paletteItemId: 'heroui.avatar', kind: 'compile', toolboxGroup: 'identity' },
  { componentId: 'chip', paletteItemId: 'heroui.chip', kind: 'compile', toolboxGroup: 'identity' },
  { componentId: 'icon-sets', paletteItemId: 'content.icon', kind: 'compile', toolboxGroup: 'identity' },
  { componentId: 'appendoo-companion', paletteItemId: '', kind: 'park', toolboxGroup: 'identity' },
  { componentId: 'orbit-border', paletteItemId: '', kind: 'park', toolboxGroup: 'identity' },
  { componentId: 'orbit-bg', paletteItemId: '', kind: 'park', toolboxGroup: 'identity' },

  // —— 4.6 Shell / Creative / package-gated / leftovers ——
  { componentId: 'shell-foundation', paletteItemId: '', kind: 'shell-only', toolboxGroup: 'shell' },
  { componentId: 'shell-navigation', paletteItemId: '', kind: 'shell-only', toolboxGroup: 'shell' },
  { componentId: 'shell-effects', paletteItemId: '', kind: 'shell-only', toolboxGroup: 'shell' },
  { componentId: '', paletteItemId: 'form.calculator', kind: 'package-gated', toolboxGroup: 'form-fields', packageGate: 'calculator' },
  { componentId: '', paletteItemId: 'form.base-info-record', kind: 'package-gated', toolboxGroup: 'form-fields', packageGate: 'base-info' },
  { componentId: '', paletteItemId: 'form.cms-content-assets', kind: 'package-gated', toolboxGroup: 'form-fields', packageGate: 'cms' },
  { componentId: '', paletteItemId: 'marketing.faq-accordion', kind: 'park', toolboxGroup: 'creative' },
  { componentId: '', paletteItemId: 'marketing.testimonial-carousel', kind: 'park', toolboxGroup: 'creative' },
  { componentId: '', paletteItemId: 'marketing.pricing-table', kind: 'park', toolboxGroup: 'creative' },
  { componentId: '', paletteItemId: 'marketing.hero-cta', kind: 'park', toolboxGroup: 'creative' },
  { componentId: '', paletteItemId: 'marketing.newsletter-signup', kind: 'park', toolboxGroup: 'creative' },
  { componentId: '', paletteItemId: 'content.feature-grid', kind: 'park', toolboxGroup: 'creative' },
  { componentId: '', paletteItemId: 'content.blog-card', kind: 'park', toolboxGroup: 'creative' },
  { componentId: '', paletteItemId: 'content.team-member', kind: 'park', toolboxGroup: 'creative' },
  { componentId: '', paletteItemId: 'content.cta-banner', kind: 'park', toolboxGroup: 'creative' },
  { componentId: '', paletteItemId: 'tailwind.hero', kind: 'park', toolboxGroup: 'creative' },
  { componentId: '', paletteItemId: 'tailwind.pricing', kind: 'park', toolboxGroup: 'creative' },
  { componentId: '', paletteItemId: 'tailwind.badge-pill', kind: 'park', toolboxGroup: 'creative' },
  { componentId: '', paletteItemId: 'tailwind.stat-block', kind: 'park', toolboxGroup: 'creative' },
  { componentId: '', paletteItemId: 'tailwind.image-overlay', kind: 'park', toolboxGroup: 'creative' },
  { componentId: 'html-link', paletteItemId: 'html.link', kind: 'compile', toolboxGroup: 'navigation' },
  { componentId: 'html-image', paletteItemId: 'html.image', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'html-iframe', paletteItemId: 'html.iframe', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'pagination', paletteItemId: 'heroui.pagination', kind: 'compile', toolboxGroup: 'navigation' },
  { componentId: 'typography-lead', paletteItemId: 'heroui.typography-lead', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'field-container', paletteItemId: 'heroui.field-container', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'link-button', paletteItemId: 'heroui.link', kind: 'compile', toolboxGroup: 'navigation' },
  { componentId: 'filter-bar', paletteItemId: 'dashboard.filter-bar', kind: 'compile', toolboxGroup: 'query' },
  { componentId: 'dashboard-canvas', paletteItemId: 'viz.dashboard-canvas', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'tree-view', paletteItemId: 'viz.tree-view', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'tree-select', paletteItemId: 'viz.tree-select', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'cascader', paletteItemId: 'viz.cascader', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'tree-combobox', paletteItemId: 'viz.tree-combobox', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'timeline', paletteItemId: 'viz.timeline', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'gantt', paletteItemId: 'viz.gantt', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'stepper', paletteItemId: 'content.stepper', kind: 'compile', toolboxGroup: 'navigation' },
  { componentId: 'carousel', paletteItemId: 'content.carousel', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'segmented-control', paletteItemId: 'content.segmented-control', kind: 'compile', toolboxGroup: 'actions' },
  { componentId: 'description-list', paletteItemId: 'content.description-list', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'stat-trend', paletteItemId: 'content.stat-trend', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'split-media', paletteItemId: 'content.split-media', kind: 'compile', toolboxGroup: 'data' },
  { componentId: 'rating', paletteItemId: 'form.rating', kind: 'compile', toolboxGroup: 'form-fields' },
  { componentId: 'notification-badge', paletteItemId: 'heroui.badge', kind: 'add-to-toolbox', toolboxGroup: 'identity' },
  { componentId: 'calendar-grid', paletteItemId: 'heroui.calendar', kind: 'add-to-toolbox', toolboxGroup: 'pickers' },
  { componentId: 'range-calendar-grid', paletteItemId: 'heroui.range-calendar', kind: 'add-to-toolbox', toolboxGroup: 'pickers' },
  { componentId: 'kbd', paletteItemId: 'heroui.kbd', kind: 'add-to-toolbox', toolboxGroup: 'data' },
  { componentId: 'user-card', paletteItemId: 'heroui.user-card', kind: 'add-to-toolbox', toolboxGroup: 'identity' },
  { componentId: 'snippet', paletteItemId: 'heroui.snippet', kind: 'add-to-toolbox', toolboxGroup: 'data' },
  { componentId: 'hover-card', paletteItemId: 'heroui.hover-card', kind: 'add-to-toolbox', toolboxGroup: 'overlays' },
  { componentId: 'context-menu', paletteItemId: 'heroui.context-menu', kind: 'add-to-toolbox', toolboxGroup: 'overlays' },
  { componentId: 'command-palette', paletteItemId: 'heroui.command-palette', kind: 'add-to-toolbox', toolboxGroup: 'overlays' },
  { componentId: 'sortable-list', paletteItemId: 'heroui.sortable-list', kind: 'add-to-toolbox', toolboxGroup: 'data' },
  { componentId: 'comparison-slider', paletteItemId: 'heroui.comparison-slider', kind: 'add-to-toolbox', toolboxGroup: 'data' },
  { componentId: 'mermaid-diagram', paletteItemId: 'content.mermaid', kind: 'add-to-toolbox', toolboxGroup: 'data' },
  { componentId: 'virtualized-list', paletteItemId: 'content.virtualized-list', kind: 'add-to-toolbox', toolboxGroup: 'data' },
  { componentId: 'signature-pad', paletteItemId: 'form.signature-pad', kind: 'add-to-toolbox', toolboxGroup: 'form-fields' },
  { componentId: 'menubar', paletteItemId: 'content.menubar', kind: 'add-to-toolbox', toolboxGroup: 'navigation' },
  { componentId: 'code-scanner', paletteItemId: 'form.code-scanner', kind: 'add-to-toolbox', toolboxGroup: 'pickers' },
  { componentId: 'document-viewer', paletteItemId: 'content.document-viewer', kind: 'add-to-toolbox', toolboxGroup: 'data' },
];

const BY_PALETTE_ID = new Map(
  DESIGNER_CATALOG_IDENTITY
    .filter((row) => row.paletteItemId.length > 0)
    .map((row) => [row.paletteItemId, row]),
);

export const getDesignerCatalogIdentity = (
  paletteItemId: string,
): DesignerCatalogIdentityRow | undefined => BY_PALETTE_ID.get(paletteItemId);

export const getCompileComponentId = (paletteItemId: string): string | undefined => {
  const row = getDesignerCatalogIdentity(paletteItemId);
  if (!row || !row.componentId) return undefined;
  if (row.kind === 'compile' || row.kind === 'legacy' || row.kind === 'add-to-toolbox') {
    return row.componentId;
  }
  return undefined;
};

export const isLegacyPaletteItemId = (paletteItemId: string): boolean =>
  getDesignerCatalogIdentity(paletteItemId)?.kind === 'legacy';

export const isParkedPaletteItemId = (paletteItemId: string): boolean =>
  getDesignerCatalogIdentity(paletteItemId)?.kind === 'park';

export const isShellOnlyPaletteItemId = (itemId: string): boolean =>
  itemId.startsWith('shell.chrome.')
  || itemId.startsWith('platform.slot.')
  || itemId.startsWith('platform.nav.')
  || itemId.startsWith('platform-navigation.')
  || itemId.startsWith('reusable.component.')
  || getDesignerCatalogIdentity(itemId)?.kind === 'shell-only';

export const getPackageGate = (
  paletteItemId: string,
): DesignerCatalogPackageGate | undefined =>
  getDesignerCatalogIdentity(paletteItemId)?.packageGate;

export const isPublicToolboxIdentityKind = (kind: DesignerCatalogIdentityKind): boolean =>
  kind === 'compile' || kind === 'add-to-toolbox';

export const identityRowsRequiringSection = (): DesignerCatalogIdentityRow[] =>
  DESIGNER_CATALOG_IDENTITY.filter((row) =>
    row.componentId.length > 0
    && (row.kind === 'compile' || row.kind === 'add-to-toolbox' || row.kind === 'add-to-catalog'),
  );

export const listPublicToolboxIdentityRows = (): DesignerCatalogIdentityRow[] =>
  DESIGNER_CATALOG_IDENTITY.filter((row) =>
    row.paletteItemId.length > 0 && isPublicToolboxIdentityKind(row.kind),
  );
