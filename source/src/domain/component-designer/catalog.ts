import type { DesignerNode, DesignerPaletteItem } from './types';

import {
  DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON,
  DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS_JSON,
  DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS_JSON,
} from './designerDataGridDefaults';
import {
  LAYOUT_COLUMN_SLOT_CLASSNAME,
  LAYOUT_COLUMNS_DEFAULT_CHILD_COUNT,
  LAYOUT_COLUMNS_PALETTE_ITEM_ID,
} from './layoutPaletteConstants';
import {
  satisfiesHtml5ContentModel,
  satisfiesHtml5ContentModelForPaletteItem,
} from './html5ContentModel';
import { getCatalogBindableOptions } from '../base-components/catalogAccess';
import { DESIGNER_CATALOG_ADDITION_ITEMS } from './designerCatalogAdditions';
import { DESIGNER_CATALOG_IDENTITY } from './designerCatalogIdentity';
import { applyCatalogIdentityToPalette } from './publicToolboxPalette';
import { DESIGNER_VIZ_PALETTE_ITEMS } from './designerVizPalette';
import { DESIGNER_UNIVERSAL_PALETTE_ITEMS } from './designerUniversalPalette';
import { DESIGNER_PLATFORM_CHROME_PALETTE_ITEMS } from './platformChromePalette';
import {
  finalizePaletteCapabilities,
  hasPaletteCapability,
  type DesignerPaletteCapability,
} from './paletteCapabilities';

export {
  deriveDefaultCapabilities,
  deriveNodeClass,
  finalizePaletteCapabilities,
  hasPaletteCapability,
  INSPECTOR_CONTAINER_LAYOUT_FIELD_KEYS,
  type DesignerNodeClass,
  type DesignerPaletteCapability,
} from './paletteCapabilities';

export {
  LAYOUT_COLUMN_SLOT_CLASSNAME,
  LAYOUT_COLUMNS_DEFAULT_CHILD_COUNT,
  LAYOUT_COLUMNS_PALETTE_ITEM_ID,
};

const COMPOUND_PALETTE_ITEM_IDS = new Set<string>([
  LAYOUT_COLUMNS_PALETTE_ITEM_ID,
  'layout.grid-2',
  'layout.grid-3',
  'layout.split-pane',
]);

export const isCompoundPaletteItemId = (itemId: string): boolean => COMPOUND_PALETTE_ITEM_IDS.has(itemId);

export const getCompoundPaletteDefaultChildCount = (itemId: string): number => {
  if (itemId === LAYOUT_COLUMNS_PALETTE_ITEM_ID) {
    return LAYOUT_COLUMNS_DEFAULT_CHILD_COUNT;
  }

  if (itemId === 'layout.grid-2') {
    return 2;
  }

  if (itemId === 'layout.grid-3') {
    return 3;
  }

  if (itemId === 'layout.split-pane') {
    return 2;
  }

  return 0;
};

const DESIGNER_PALETTE_RAW: DesignerPaletteItem[] = [
  {
    id: 'html.container',
    label: 'Container',
    category: 'html-primitives',
    icon: 'LayoutTemplate',
    defaultProps: { className: 'min-h-6' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'html.text',
    label: 'Text',
    category: 'html-primitives',
    icon: 'Type',
    defaultProps: { text: 'Sample text', className: 'text-sm text-default-700' },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'text',
  },
  {
    id: 'html.heading',
    label: 'Heading',
    category: 'html-primitives',
    icon: 'Heading2',
    defaultProps: { text: 'Section title', level: 'h2', className: 'text-2xl font-semibold tracking-tight text-foreground' },
    allowedParentTypes: ['root', 'container', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'heading',
  },
  {
    id: 'html.link',
    label: 'Link',
    category: 'html-primitives',
    icon: 'Link2',
    defaultProps: { text: 'Learn more', href: '#', target: '_self', rel: '', className: 'text-primary underline underline-offset-2 hover:opacity-80' },
    allowedParentTypes: ['root', 'container', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'link',
  },
  {
    id: 'html.image',
    label: 'Image',
    category: 'html-primitives',
    icon: 'Image',
    defaultProps: { src: '/assets/designer-default-image.svg', alt: '', className: 'h-auto max-w-full rounded-md' },
    allowedParentTypes: ['root', 'container', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'image',
  },
  {
    id: 'html.iframe',
    label: 'Embed / Iframe',
    category: 'html-primitives',
    icon: 'MonitorPlay',
    defaultProps: {
      src: 'https://www.openstreetmap.org/export/embed.html',
      title: 'Embedded content',
      width: '100%',
      height: '360',
      allowFullScreen: true,
      sandbox: 'allow-scripts allow-same-origin',
      loading: 'lazy',
      className: 'w-full rounded-md border border-default-200 bg-default-50',
    },
    allowedParentTypes: ['root', 'container', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'iframe',
  },
  {
    id: 'html.file-upload',
    label: 'File Upload',
    category: 'html-primitives',
    icon: 'Upload',
    defaultProps: {
      accept: 'image/*,.pdf',
      multiple: false,
      showPreview: true,
      dragDropZone: true,
      uploadDestination: '/api/packages/builder/workspace-assets/upload',
      invalidTypeMessage: 'Selected file type is not allowed for this upload destination.',
      invalidSizeMessage: 'Selected file exceeds the allowed size limit.',
      invalidCountMessage: 'Too many files were selected.',
      className: 'flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-default-300 bg-default-50 p-6 text-center',
    },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'file-upload',
  },
  {
    id: 'html.list',
    label: 'List',
    category: 'html-primitives',
    icon: 'List',
    defaultProps: { className: 'list-disc ps-5 space-y-1' },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'list',
  },
  {
    id: 'html.list-item',
    label: 'List Item',
    category: 'html-primitives',
    icon: 'Rows4',
    defaultProps: { text: 'List item' },
    allowedParentTypes: ['list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'list-item',
  },
  {
    id: 'html.section',
    label: 'Section',
    category: 'html-primitives',
    icon: 'PanelTop',
    defaultProps: { className: 'w-full rounded-lg border border-default-200 bg-content1 p-4 shadow-sm' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'html.article',
    label: 'Article',
    category: 'html-primitives',
    icon: 'Newspaper',
    defaultProps: { className: 'w-full rounded-lg border border-default-200 bg-content1 p-5' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'html.figure',
    label: 'Figure',
    category: 'html-primitives',
    icon: 'Frame',
    defaultProps: { className: 'space-y-2 rounded-md border border-default-200 bg-default-50 p-3' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'html.table-wrap',
    label: 'Table Wrapper',
    category: 'html-primitives',
    icon: 'TableProperties',
    defaultProps: { className: 'w-full overflow-x-auto rounded-md border border-default-200 bg-content1 p-3' },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'html.form',
    label: 'Form',
    category: 'html-primitives',
    icon: 'FileEdit',
    defaultProps: { className: 'space-y-3 rounded-lg border border-default-200 bg-content1 p-4' },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'layout.flex-row',
    label: 'Flex Row',
    category: 'layout',
    icon: 'Rows3',
    defaultProps: { className: 'flex flex-row items-start gap-3' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'layout.flex-column',
    label: 'Flex Column',
    category: 'layout',
    icon: 'Columns3',
    defaultProps: { className: 'flex flex-col gap-3' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'layout.grid-2',
    label: 'Grid 2 Columns',
    category: 'layout',
    icon: 'Grid2x2',
    defaultProps: { className: 'grid w-full grid-cols-2 gap-4' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'layout.grid-3',
    label: 'Grid 3 Columns',
    category: 'layout',
    icon: 'LayoutGrid',
    defaultProps: { className: 'grid w-full grid-cols-3 gap-4' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'layout.columns',
    label: 'Columns / Row',
    category: 'layout',
    icon: 'Columns3',
    defaultProps: { className: 'grid w-full grid-cols-2 gap-4' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'layout.stack-compact',
    label: 'Stack Compact',
    category: 'layout',
    icon: 'GalleryVerticalEnd',
    defaultProps: { className: 'space-y-2' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'layout.stack-relaxed',
    label: 'Stack Relaxed',
    category: 'layout',
    icon: 'GalleryVertical',
    defaultProps: { className: 'space-y-5' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'layout.center',
    label: 'Center',
    category: 'layout',
    icon: 'Crosshair',
    defaultProps: { className: 'flex min-h-24 items-center justify-center rounded-md border border-dashed border-default-300' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'layout.wrapper',
    label: 'Wrapper',
    category: 'layout',
    icon: 'StretchHorizontal',
    defaultProps: { className: 'mx-auto w-full max-w-5xl px-4' },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'layout.scroll',
    label: 'Scroll Region',
    category: 'layout',
    icon: 'ScrollText',
    defaultProps: { className: 'max-h-64 overflow-auto rounded-md border border-default-200 bg-content1 p-3' },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'layout.sticky-bar',
    label: 'Sticky Bar',
    category: 'layout',
    icon: 'PanelTopDashed',
    defaultProps: { className: 'sticky top-0 z-10 border-b border-default-200 bg-content1/90 px-3 py-2 backdrop-blur' },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'layout.dock-pane',
    label: 'Dock Pane',
    category: 'layout',
    icon: 'PanelLeft',
    defaultProps: {
      dock: 'left',
      className: 'gap-3 bg-default-50 p-3',
    },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'layout.split-pane',
    label: 'Split Pane',
    category: 'layout',
    icon: 'Columns2',
    defaultProps: {
      direction: 'horizontal',
      defaultSplit: 50,
      className: 'min-h-[240px] w-full overflow-hidden rounded-lg border border-default-200 bg-content1',
    },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'tailwind.card',
    label: 'Card',
    category: 'tailwind-ui-blocks',
    icon: 'RectangleHorizontal',
    defaultProps: {
      title: 'Card title',
      description: 'A short description for this card block.',
      className: 'rounded-xl border border-default-200 bg-content1 p-4 shadow-sm',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'tailwind.card-glass',
    label: 'Glass Card',
    category: 'tailwind-ui-blocks',
    icon: 'Scan',
    defaultProps: {
      title: 'Glass card',
      description: 'Frosted surface with optional hero image.',
      imageSrc: '/assets/designer-default-image.svg',
      className: 'rounded-xl border border-white/50 bg-white/70 p-4 shadow-lg backdrop-blur',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'tailwind.hero',
    label: 'Hero Block',
    category: 'tailwind-ui-blocks',
    icon: 'Sparkles',
    defaultProps: {
      heading: 'Build faster with confidence',
      subheading: 'Compose production-ready UI blocks without rebuilding layout from scratch.',
      primaryCta: 'Get started',
      secondaryCta: 'View docs',
      backgroundImage: '',
      className: 'rounded-2xl bg-gradient-to-r from-cyan-600 to-blue-600 p-6 text-white shadow-lg',
    },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'tailwind.badge-pill',
    label: 'Badge Pill',
    category: 'tailwind-ui-blocks',
    icon: 'Badge',
    defaultProps: { text: 'New', className: 'inline-flex rounded-full bg-cyan-100 px-2.5 py-1 text-xs font-semibold text-cyan-700' },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'text',
  },
  {
    id: 'tailwind.alert',
    label: 'Alert Block',
    category: 'tailwind-ui-blocks',
    icon: 'TriangleAlert',
    defaultProps: {
      title: 'Heads up',
      message: 'You can adjust this alert in the Inspector.',
      variant: 'warning',
      dismissible: true,
      className: 'w-full',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'tailwind.stat-block',
    label: 'Stat Block',
    category: 'tailwind-ui-blocks',
    icon: 'ChartColumn',
    defaultProps: {
      label: 'Revenue',
      value: '$48.2k',
      trend: '+12%',
      trendDirection: 'up',
      className: 'rounded-xl border border-default-200 bg-content1 p-4 shadow-sm',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'tailwind.pricing',
    label: 'Pricing Block',
    category: 'tailwind-ui-blocks',
    icon: 'Coins',
    defaultProps: {
      planName: 'Pro Plan',
      price: '$49',
      billingPeriod: '/ seat',
      features: 'Unlimited projects,Role-based access,Priority support,API access',
      isHighlighted: true,
      ctaLabel: 'Upgrade to Pro',
      className: 'rounded-xl border border-default-200 bg-content1 p-5 shadow-sm',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'tailwind.image-overlay',
    label: 'Image Overlay',
    category: 'tailwind-ui-blocks',
    icon: 'ImagePlus',
    defaultProps: {
      imageSrc: '/assets/designer-default-image.svg',
      overlayText: 'Featured story',
      overlayOpacity: 0.55,
      className: 'relative overflow-hidden rounded-xl border border-default-200 p-0 text-white shadow-sm',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
    // Visual block — not layout.overlay / modal overlay (id substring would mis-tag overlay-nav).
    capabilities: ['container'],
  },
  {
    id: 'heroui.button-solid',
    label: 'Button Solid',
    category: 'heroui-general',
    icon: 'MousePointerClick',
    defaultProps: { text: 'Action', href: '#', target: '_self', rel: '', className: 'inline-flex rounded-lg bg-cyan-600 px-3 py-2 text-sm font-medium text-white no-underline hover:bg-cyan-700' },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'link',
  },
  {
    id: 'heroui.button-outline',
    label: 'Button Outline',
    category: 'heroui-general',
    icon: 'SquareDashedMousePointer',
    defaultProps: { text: 'Secondary', href: '#', target: '_self', rel: '', className: 'inline-flex rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 no-underline hover:bg-slate-100' },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'link',
  },
  {
    id: 'heroui.link',
    label: 'Link',
    category: 'heroui-general',
    icon: 'Link',
    defaultProps: { text: 'Read more', href: '#', target: '_self', rel: '', className: 'text-cyan-700 no-underline hover:underline' },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'link',
  },
  {
    id: 'heroui.chip',
    label: 'Chip',
    category: 'heroui-general',
    icon: 'Tag',
    defaultProps: { text: 'Chip', className: 'inline-flex rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700' },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'text',
  },
  {
    id: 'heroui.avatar',
    label: 'Avatar',
    category: 'heroui-general',
    icon: 'CircleUserRound',
    defaultProps: { className: 'inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-700' },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.spinner',
    label: 'Spinner',
    category: 'heroui-general',
    icon: 'LoaderCircle',
    defaultProps: { className: 'inline-flex h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-cyan-600' },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.skeleton',
    label: 'Skeleton',
    category: 'heroui-general',
    icon: 'PanelBottomDashed',
    defaultProps: { className: 'h-4 w-full animate-pulse rounded bg-slate-200' },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.tooltip-trigger',
    label: 'Tooltip Trigger',
    category: 'heroui-general',
    icon: 'MessageSquareMore',
    defaultProps: { text: 'Hover target', tooltipText: 'Additional info shown on hover', href: '#', target: '_self', rel: '', className: 'inline-flex rounded-md border border-dashed border-slate-300 px-2 py-1 text-xs text-slate-700 no-underline' },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'link',
  },
  {
    id: 'heroui.card',
    label: 'Card',
    category: 'heroui-data-display',
    icon: 'ContactRound',
    defaultProps: { className: 'rounded-xl border border-default-200 bg-content1 p-4 shadow-sm' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.accordion-item',
    label: 'Accordion Item',
    category: 'heroui-data-display',
    icon: 'ListCollapse',
    defaultProps: { className: 'rounded-lg border border-slate-200 bg-white p-3' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    // Retired from the Toolbox — functionally 100% identical to 'heroui.data-grid' (same
    // defaultProps shape, same renderer, same Inspector fields, same data-binding capability),
    // making the two redundant. 'heroui.data-grid' is the one surviving entry going forward.
    // Kept here (not deleted) purely so already-saved drafts referencing 'heroui.table' keep
    // rendering/validating/exposing fields exactly as before — see `legacy` on DesignerPaletteItem.
    id: 'heroui.table',
    label: 'Table',
    category: 'heroui-data-display',
    icon: 'Table2',
    defaultProps: {
      className: 'w-full min-h-0 rounded-lg border border-slate-200 bg-white p-3',
      columns: DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON,
      gridQueryMode: 'client',
      pageSize: 15,
      page: 1,
      total: 0,
    },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
    legacy: true,
  },
  {
    id: 'heroui.data-grid',
    label: 'Data Grid',
    category: 'heroui-data-display',
    icon: 'TableProperties',
    defaultProps: {
      className: 'w-full min-h-0 rounded-lg border border-slate-200 bg-white p-3',
      columns: DEFAULT_DESIGNER_DATA_GRID_COLUMNS_JSON,
      gridQueryMode: 'client',
      pageSize: 15,
      page: 1,
      total: 0,
    },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.app-table-grid',
    label: 'App Table Grid',
    category: 'heroui-data-display',
    icon: 'Table2',
    defaultProps: {
      className: 'flex h-full min-h-0 w-full flex-1 flex-col',
      columns: DEFAULT_DESIGNER_APP_TABLE_GRID_COLUMNS_JSON,
      gridQueryMode: 'server',
      pageSize: 50,
      page: 1,
      total: 0,
      presentation: 'auto',
      cardBelow: 'tablet',
      enableColumnLayout: true,
      showSortControls: true,
      showListModeControls: true,
      listMode: 'paging',
      rowKeyField: 'id',
      defaultSortBy: 'created_at',
      sortOptions: DEFAULT_DESIGNER_APP_TABLE_GRID_SORT_OPTIONS_JSON,
      loadingMessage: 'Loading records…',
      emptyContent: 'No records found.',
      errorContent: 'Could not load records.',
    },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.crud-set',
    label: 'CRUD Set',
    category: 'heroui-data-display',
    icon: 'Layers',
    defaultProps: {
      className: 'flex h-full min-h-0 w-full flex-1 flex-col',
      spec: '{"name":"CRUD Set","listApi":{"endpointId":""},"listBody":"grid","pagination":true,"columns":[{"field":"id","label":"Id"}],"createApis":[],"patches":[],"export":{"enabled":true,"formats":["xlsx","csv"],"defaultFormat":"xlsx","defaultIncludeHeader":true}}',
    },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.record-form',
    label: 'Edit / View',
    category: 'heroui-data-display',
    icon: 'FileEdit',
    defaultProps: {
      className: 'w-full',
      mode: 'edit',
      sidePanelTitle: 'Flags',
      sidePanelPlacement: 'end',
      sidePanelPinnable: false,
      sidePanelSplitter: true,
      sidePanelShowTitle: true,
      sidePanelTitleInHeader: false,
      sidePanelBackground: 'theme',
      sidePanelBackgroundColor: '#F1F5F9',
      spec: '{"columns":[{"field":"title","label":"Title","formPlacement":"main"},{"field":"active","label":"Active","cellKind":"boolean-icon","formPlacement":"side"}]}',
    },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.listbox',
    label: 'Listbox',
    category: 'heroui-data-display',
    icon: 'ListTree',
    defaultProps: {
      items: '[{"id":"option-1","textValue":"Option 1"},{"id":"option-2","textValue":"Option 2"},{"id":"option-3","textValue":"Option 3"}]',
      className: 'space-y-1 rounded-md border border-slate-200 bg-white p-2',
    },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'list',
  },
  {
    id: 'heroui.progress',
    label: 'Progress',
    category: 'heroui-data-display',
    icon: 'Gauge',
    defaultProps: { className: 'h-2 w-full overflow-hidden rounded-full bg-slate-200' },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.pagination',
    label: 'Pagination',
    category: 'heroui-data-display',
    icon: 'BetweenHorizontalStart',
    defaultProps: {
      page: 1,
      total: 10,
      className: 'inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-1',
    },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.typography-lead',
    label: 'Lead Text',
    category: 'heroui-data-display',
    icon: 'Pilcrow',
    defaultProps: { text: 'Lead text for sections and summaries.', className: 'text-base leading-7 text-slate-700' },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'text',
  },
  {
    id: 'heroui.field-container',
    label: 'Field Container',
    category: 'heroui-forms-inputs',
    icon: 'SquareStack',
    defaultProps: { className: 'flex flex-col gap-[2px] rounded-md border border-slate-200 bg-white p-3' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.input-text',
    label: 'Text Input',
    category: 'heroui-forms-inputs',
    icon: 'RectangleEllipsis',
    defaultProps: { size: 'sm', className: 'rounded-md border border-slate-300 bg-white px-2.5 py-px text-xs text-slate-700' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.textarea',
    label: 'Textarea',
    category: 'heroui-forms-inputs',
    icon: 'TextCursorInput',
    defaultProps: { size: 'sm', className: 'min-h-24 rounded-md border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-700' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.number-input',
    label: 'Number Input',
    category: 'heroui-forms-inputs',
    icon: 'Hash',
    defaultProps: { size: 'sm', className: 'rounded-md border border-slate-300 bg-white px-2.5 py-px text-xs text-slate-700' },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.select',
    label: 'Select',
    category: 'heroui-forms-inputs',
    icon: 'ListFilter',
    defaultProps: {
      placeholder: 'Select…',
      size: 'sm',
      items: '[{"id":"option-1","textValue":"Option 1"},{"id":"option-2","textValue":"Option 2"},{"id":"option-3","textValue":"Option 3"}]',
      className: 'rounded-md border border-slate-300 bg-white px-2.5 py-px text-xs text-slate-700',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.autocomplete',
    label: 'Autocomplete',
    category: 'heroui-forms-inputs',
    icon: 'TextSearch',
    defaultProps: {
      label: 'Autocomplete',
      placeholder: 'Select…',
      size: 'sm',
      items: '[{"id":"option-1","textValue":"Option 1"},{"id":"option-2","textValue":"Option 2"},{"id":"option-3","textValue":"Option 3"}]',
      className: 'w-full',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.entity-picker',
    label: 'Entity Picker',
    category: 'heroui-forms-inputs',
    icon: 'DatabaseZap',
    defaultProps: {
      label: 'Entity',
      placeholder: 'Select entity…',
      entityRef: '/api/entities',
      searchParam: 'search',
      returnField: 'id',
      displayField: 'label',
      className: 'w-full',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'form.date-range',
    label: 'Date Range',
    category: 'heroui-forms-inputs',
    icon: 'CalendarRange',
    defaultProps: {
      label: 'Date range',
      className: 'w-full',
      presets: JSON.stringify([
        { id: 'preset-today', label: 'Today', rangeFn: 'today' },
        { id: 'preset-last7', label: 'Last 7 days', rangeFn: 'last7Days' },
        { id: 'preset-this-month', label: 'This month', rangeFn: 'thisMonth' },
        { id: 'preset-last-month', label: 'Last month', rangeFn: 'lastMonth' },
      ]),
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'form.code-editor',
    label: 'Code Editor',
    category: 'heroui-forms-inputs',
    icon: 'Code2',
    defaultProps: {
      label: 'Code',
      language: 'typescript',
      theme: 'vs',
      value: '',
      placeholder: '// Enter code…',
      wordWrap: true,
      tabSize: 2,
      fontSize: 13,
      className: 'w-full',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'form.html-editor',
    label: 'Rich Text Editor',
    category: 'heroui-forms-inputs',
    icon: 'Type',
    defaultProps: {
      label: 'Rich Text',
      value: '<p>Hello world</p>',
      placeholder: 'Start writing…',
      editorHeight: 160,
      fontSize: 14,
      showToolbar: true,
      enableBold: true,
      enableItalic: true,
      enableUnderline: true,
      enableStrike: true,
      enableInlineCode: true,
      enableSubscript: true,
      enableSuperscript: true,
      enableTextColor: true,
      enableHeading: true,
      enableBulletList: true,
      enableOrderedList: true,
      enableTaskList: true,
      enableIndent: true,
      enableBlockquote: true,
      enableCodeBlock: false,
      enableHorizontalRule: true,
      enableLink: true,
      enableHighlight: true,
      enableTextAlign: true,
      enableImage: true,
      enableTable: true,
      enableClearFormatting: true,
      enableUndoRedo: true,
      className: 'w-full',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'form.markdown-editor',
    label: 'Markdown Editor',
    category: 'heroui-forms-inputs',
    icon: 'FileText',
    defaultProps: {
      label: 'Markdown',
      value: '## Heading\n\nWrite in **Markdown**.',
      placeholder: 'Write in Markdown…',
      editorHeight: 160,
      fontSize: 14,
      showToolbar: true,
      enableBold: true,
      enableItalic: true,
      enableUnderline: true,
      enableStrike: true,
      enableInlineCode: true,
      enableHeading: true,
      enableBulletList: true,
      enableOrderedList: true,
      enableTaskList: true,
      enableBlockquote: true,
      enableCodeBlock: true,
      enableHorizontalRule: true,
      enableLink: true,
      enableTextDirection: true,
      enableImage: false,
      enableTable: false,
      enableClearFormatting: true,
      enableUndoRedo: true,
      className: 'w-full',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'form.mask-input',
    label: 'Mask Input',
    category: 'heroui-forms-inputs',
    icon: 'RectangleEllipsis',
    defaultProps: {
      label: 'Masked Input',
      placeholder: '',
      value: '',
      maskKind: 'pattern',
      maskPreset: 'phone-ir-mobile',
      maskPattern: '',
      maskPlaceholderChar: '_',
      maskLazy: true,
      maskEager: false,
      maskOverwrite: true,
      maskAutofix: true,
      maskDefinitions: '',
      maskBlocks: '',
      maskEnum: '',
      maskRegExp: '',
      maskNumberScale: '0',
      maskNumberRadix: '.',
      maskNumberThousandsSeparator: ',',
      maskNumberPadFractionalZeros: false,
      maskNumberNormalizeZeros: true,
      maskNumberMin: '',
      maskNumberMax: '',
      maskDatePattern: 'Y-m-d',
      maskOptionsJson: '',
      unmask: false,
      showMaskFormatHint: false,
      className: 'w-full',
    },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'form.base-info-record',
    label: 'Base Info record form',
    category: 'heroui-forms-inputs',
    icon: 'ListTree',
    defaultProps: {
      baseInfoRecordDataSourceRef: 'vocabItems',
      baseInfoRecordFixedParentId: '',
      baseInfoRecordParentLabel: '',
      className: 'w-full min-w-0',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'form.cms-content-assets',
    label: 'CMS content assets',
    category: 'heroui-forms-inputs',
    icon: 'Paperclip',
    defaultProps: {
      cmsContentAssetsDataSourceRef: 'cmsContentAssets',
      cmsContentAssetsContentIdPath: 'routeParams.id',
      cmsContentAssetsMode: 'all',
      className: 'w-full min-w-0',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'form.related-contents-list',
    label: 'Related contents list',
    category: 'heroui-forms-inputs',
    icon: 'GitBranch',
    defaultProps: {
      relatedContentsContentIdPath: 'routeParams.id',
      relatedContentsOptionsDataSourceRef: 'cmsContents',
      relatedContentsExcludeContentTypeCode: '',
      className: 'w-full min-w-0',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'form.relation-tags-list',
    label: 'Relation tags list',
    category: 'heroui-forms-inputs',
    icon: 'Tags',
    defaultProps: {
      relationTagsPlaceholder: 'Add tag…',
      relationTagsSelectPlacement: 'inline',
      relationTagsValueField: 'tagCode',
      relationTagsContentIdPath: 'routeParams.id',
      className: 'w-full min-w-0',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'form.calculator',
    label: 'Calculator',
    category: 'heroui-forms-inputs',
    icon: 'Calculator',
    defaultProps: {
      label: 'Amount',
      placeholder: '0',
      value: '',
      decimalPlaces: 2,
      showKeypad: true,
      keypadMode: 'basic',
      allowManualInput: true,
      className: 'w-full',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.checkbox-group',
    label: 'Checkbox Group',
    category: 'heroui-forms-inputs',
    icon: 'CheckSquare',
    defaultProps: {
      items: '[{"id":"option-1","textValue":"Option 1"},{"id":"option-2","textValue":"Option 2"},{"id":"option-3","textValue":"Option 3"}]',
      className: 'space-y-2 rounded-md border border-slate-200 bg-white p-3',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'list',
  },
  {
    id: 'heroui.radio-group',
    label: 'Radio Group',
    category: 'heroui-forms-inputs',
    icon: 'CircleDot',
    defaultProps: {
      items: '[{"id":"option-1","textValue":"Option 1"},{"id":"option-2","textValue":"Option 2"},{"id":"option-3","textValue":"Option 3"}]',
      className: 'space-y-2 rounded-md border border-slate-200 bg-white p-3',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'list',
  },
  {
    id: 'heroui.switch',
    label: 'Switch',
    category: 'heroui-forms-inputs',
    icon: 'ToggleLeft',
    defaultProps: { className: 'inline-flex items-center gap-2' },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.slider',
    label: 'Slider',
    category: 'heroui-forms-inputs',
    icon: 'SlidersHorizontal',
    defaultProps: { className: 'h-2 w-full rounded-full bg-slate-200' },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.date-picker',
    label: 'Date Picker',
    category: 'heroui-forms-inputs',
    icon: 'CalendarDays',
    defaultProps: {
      label: 'Date',
      placeholder: 'Select date',
      value: '',
      calendarSystem: 'gregorian',
      locale: '',
      granularity: 'day',
      hourCycle: 'auto',
      hideTimeZone: false,
      shouldForceLeadingZeros: true,
      minValue: '',
      maxValue: '',
      placeholderValue: '',
      firstDayOfWeek: '',
      timeZone: '',
      visibleMonths: '1',
      pageBehavior: 'visible',
      isReadOnly: false,
      autoFocus: false,
      className: 'w-full',
    },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.tags-input',
    label: 'Tags Input',
    category: 'heroui-forms-inputs',
    icon: 'Tags',
    defaultProps: {
      value: 'sample,preview',
      placeholder: 'Add tags…',
      className: 'flex flex-wrap items-center gap-2 rounded-md border border-slate-300 bg-white p-2 text-xs text-slate-700',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.tabs',
    label: 'Tabs',
    category: 'heroui-navigation-overlays',
    icon: 'PanelTopOpen',
    defaultProps: {
      items: [
        { key: 'tab-0', label: 'Tab 1' },
        { key: 'tab-1', label: 'Tab 2' },
      ],
      placement: 'top',
      alignment: 'start',
      width: 'fit',
      variant: 'line',
      panelAttachment: 'integrated',
      overflow: 'scroll',
      defaultSelectedKey: 'tab-0',
      ariaLabel: 'Tabs',
      className: 'min-w-0 w-full',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.breadcrumbs',
    label: 'Breadcrumbs',
    category: 'heroui-navigation-overlays',
    icon: 'PanelLeftOpen',
    defaultProps: { items: [], className: 'flex list-none items-center gap-2 text-sm text-slate-600' },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'list',
  },
  {
    id: 'heroui.dropdown',
    label: 'Dropdown',
    category: 'heroui-navigation-overlays',
    icon: 'ChevronDownSquare',
    defaultProps: {
      label: 'Actions',
      items: '[{"id":"option-1","textValue":"Option 1"},{"id":"option-2","textValue":"Option 2"},{"id":"option-3","textValue":"Option 3"}]',
    },
    allowedParentTypes: ['root', 'container', 'list', 'list-item'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.modal',
    label: 'Modal',
    category: 'heroui-navigation-overlays',
    icon: 'SquareStack',
    defaultProps: {
      title: 'Modal',
      size: 'md',
      backdrop: 'blur',
      className: 'w-full max-w-lg',
    },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.alert-dialog',
    label: 'Alert Dialog',
    category: 'heroui-navigation-overlays',
    icon: 'ShieldAlert',
    defaultProps: {
      title: 'Confirm',
      size: 'md',
      backdrop: 'blur',
      tone: 'danger',
      className: 'w-full max-w-md',
    },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.drawer',
    label: 'Drawer',
    category: 'heroui-navigation-overlays',
    icon: 'PanelRightOpen',
    defaultProps: { className: 'h-full w-80 border-l border-slate-200 bg-white p-4 shadow-xl' },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.toolbar',
    label: 'Toolbar',
    category: 'heroui-navigation-overlays',
    icon: 'BetweenHorizontalEnd',
    defaultProps: { className: 'flex h-8 items-center justify-between gap-2 rounded-md border border-slate-200 bg-white px-2' },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'heroui.color-control',
    label: 'Color Editor',
    category: 'heroui-forms-inputs',
    icon: 'Palette',
    defaultProps: {
      label: 'Color',
      value: '#3B82F6',
      placeholder: '#RRGGBB',
      className: 'w-full',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
  {
    id: 'logic.repeater',
    label: 'Repeater',
    category: 'logic',
    icon: 'Repeat',
    defaultProps: {
      className: 'flex flex-col gap-3 rounded-md border border-dashed border-default-200 bg-content1 p-3',
      dataPath: 'products',
      itemAlias: 'item',
      indexAlias: 'index',
    },
    allowedParentTypes: ['root', 'container'],
    canHaveChildren: true,
    sourceType: 'local',
    nodeType: 'container',
    // Multi-role: flex layout container + iteration binding surface.
    capabilities: ['container', 'repeatable', 'bindable'],
  },
  ...DESIGNER_VIZ_PALETTE_ITEMS,
  ...DESIGNER_UNIVERSAL_PALETTE_ITEMS,
  ...DESIGNER_PLATFORM_CHROME_PALETTE_ITEMS,
  ...DESIGNER_CATALOG_ADDITION_ITEMS,
  {
    id: 'heroui.chat-widget',
    label: 'Chat Widget',
    category: 'heroui-navigation-overlays',
    icon: 'MessagesSquare',
    defaultProps: {
      channelRef: 'support',
      messagesDataSource: '',
      showTypingIndicator: false,
      className: 'w-full',
    },
    allowedParentTypes: ['root', 'container', 'list'],
    canHaveChildren: false,
    sourceType: 'local',
    nodeType: 'container',
  },
];

/** Canonical palette with capabilities + derived nodeClass filled in (T1-11e). */
export const DESIGNER_PALETTE: DesignerPaletteItem[] = finalizePaletteCapabilities(
  applyCatalogIdentityToPalette(DESIGNER_PALETTE_RAW),
);

/** Form input palette items that expose validation inspector fields. */
export const DESIGNER_FORM_INPUT_PALETTE_ITEM_IDS = [
  'heroui.input-text',
  'heroui.textarea',
  'heroui.number-input',
  'heroui.select',
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
  'heroui.tags-input',
] as const;

export type DesignerFormInputPaletteItemId = typeof DESIGNER_FORM_INPUT_PALETTE_ITEM_IDS[number];

export const DESIGNER_FORM_INPUT_PALETTE_ITEM_ID_SET = new Set<string>(DESIGNER_FORM_INPUT_PALETTE_ITEM_IDS);

/** Palette items that support hover (mouse enter) event bindings. */
export const DESIGNER_HOVER_EVENT_PALETTE_ITEM_IDS = [
  ...DESIGNER_FORM_INPUT_PALETTE_ITEM_IDS,
  'heroui.button-solid',
  'heroui.button-outline',
  'heroui.link',
  'heroui.chip',
  'heroui.avatar',
  'heroui.tooltip-trigger',
] as const;

export const DESIGNER_HOVER_EVENT_PALETTE_ITEM_ID_SET = new Set<string>(DESIGNER_HOVER_EVENT_PALETTE_ITEM_IDS);

const ENGINE_LIST_ROW_KEYS: Record<string, readonly string[]> = {
  'heroui.table': ['rows'],
  'heroui.data-grid': ['rows'],
  'heroui.app-table-grid': ['rows'],
  'heroui.crud-set': ['rows'],
};

const derivePaletteBindablePropKeys = (): Record<string, readonly string[]> => {
  const derived: Record<string, string[]> = {};
  for (const row of DESIGNER_CATALOG_IDENTITY) {
    if (!row.paletteItemId || !row.componentId) continue;
    const keys = getCatalogBindableOptions(row.componentId).map((option) => {
      const path = option.propPath ?? option.id;
      return path.includes('.') ? path.split('.').pop()! : path;
    });
    if (keys.length === 0) continue;
    derived[row.paletteItemId] = [...new Set([...(derived[row.paletteItemId] ?? []), ...keys])];
  }
  for (const [itemId, keys] of Object.entries(ENGINE_LIST_ROW_KEYS)) {
    derived[itemId] = [...new Set([...(derived[itemId] ?? []), ...keys])];
  }
  return derived;
};

/** Bindable keys = catalog `axis: 'data'` (or data-editor) plus the list-row engine key. */
export const PALETTE_BINDABLE_PROP_KEYS: Record<string, readonly string[]> = derivePaletteBindablePropKeys();

let activeDesignerPalette: DesignerPaletteItem[] = [...DESIGNER_PALETTE];

export const getDesignerPaletteCatalog = (): DesignerPaletteItem[] => activeDesignerPalette;

export const setDesignerPaletteCatalog = (items: DesignerPaletteItem[]): void => {
  if (!Array.isArray(items) || items.length === 0) {
    activeDesignerPalette = [...DESIGNER_PALETTE];
    return;
  }

  const deduped = new Map<string, DesignerPaletteItem>();
  for (const item of items) {
    deduped.set(item.id, item);
  }
  activeDesignerPalette = finalizePaletteCapabilities(
    applyCatalogIdentityToPalette(Array.from(deduped.values())),
  );
};

export const resetDesignerPaletteCatalog = (): void => {
  activeDesignerPalette = [...DESIGNER_PALETTE];
};

export const DESIGNER_CONTAINER_TYPES = new Set<string>(['root', 'container', 'list']);

const DESIGNER_ALLOWED_PARENT_TYPES_BY_NODE_TYPE: Record<string, ReadonlySet<string>> = {
  container: new Set<string>(['root', 'container']),
  text: new Set<string>(['root', 'container', 'list-item']),
  heading: new Set<string>(['root', 'container', 'list-item']),
  link: new Set<string>(['root', 'container', 'list-item']),
  image: new Set<string>(['root', 'container', 'list-item']),
  list: new Set<string>(['root', 'container']),
  'list-item': new Set<string>(['list']),
  'system-slot': new Set<string>(['root', 'container', 'list']),
  'platform-nav': new Set<string>(['root', 'container', 'list']),
  'reusable-slot': new Set<string>(['root', 'container', 'list']),
};

export const isContainerNode = (node: DesignerNode): boolean => {
  const paletteItem = getPaletteItemForNode(node);
  if (paletteItem) {
    return paletteItem.canHaveChildren === true;
  }

  return DESIGNER_CONTAINER_TYPES.has(node.type);
};

export const getPaletteItemById = (itemId: string): DesignerPaletteItem | undefined => getDesignerPaletteCatalog().find((item) => item.id === itemId);

const getAllowedParentTypesForNodeType = (nodeType: string): ReadonlySet<string> => {
  const paletteAllowedParentTypes = new Set<string>();

  for (const item of getDesignerPaletteCatalog()) {
    if (item.nodeType !== nodeType) {
      continue;
    }

    for (const parentType of item.allowedParentTypes) {
      paletteAllowedParentTypes.add(parentType);
    }
  }

  const policyAllowedParentTypes = DESIGNER_ALLOWED_PARENT_TYPES_BY_NODE_TYPE[nodeType];
  if (!policyAllowedParentTypes) {
    return paletteAllowedParentTypes;
  }

  if (paletteAllowedParentTypes.size === 0) {
    return policyAllowedParentTypes;
  }

  const intersection = new Set<string>();
  for (const parentType of paletteAllowedParentTypes) {
    if (policyAllowedParentTypes.has(parentType)) {
      intersection.add(parentType);
    }
  }

  return intersection;
};

export const canInsertPaletteItem = (item: DesignerPaletteItem, parentNode: DesignerNode): boolean => {
  if (!isContainerNode(parentNode)) {
    return false;
  }

  if (!item.allowedParentTypes.includes(parentNode.type)) {
    return false;
  }

  const allowedParentTypes = getAllowedParentTypesForNodeType(item.nodeType);
  if (allowedParentTypes.size === 0) {
    return false;
  }

  return allowedParentTypes.has(parentNode.type)
    && satisfiesHtml5ContentModelForPaletteItem(item, parentNode, getPaletteItemForNode(parentNode));
};

/** List items may auto-wrap in a new List when dropped on root/container. */
export const canInsertPaletteItemWithAutoWrap = (item: DesignerPaletteItem, parentNode: DesignerNode): boolean => {
  if (canInsertPaletteItem(item, parentNode)) {
    return true;
  }

  if (item.id !== 'html.list-item') {
    return false;
  }

  const listPaletteItem = getPaletteItemById('html.list');
  return listPaletteItem ? canInsertPaletteItem(listPaletteItem, parentNode) : false;
};

export const getPaletteItemForNode = (node: DesignerNode): DesignerPaletteItem | undefined => {
  const palette = getDesignerPaletteCatalog();
  const storedPaletteItemId = node.props._designerPaletteItemId;

  if (typeof storedPaletteItemId === 'string' && storedPaletteItemId.length > 0) {
    const storedItem = getPaletteItemById(storedPaletteItemId);
    if (storedItem) {
      return storedItem;
    }
  }

  if (node.componentRef?.refType === 'system') {
    return palette.find((item) => item.sourceType === 'system' && item.sourceRef === node.componentRef?.refId);
  }

  if (node.componentRef?.refType === 'reusable') {
    return palette.find((item) => item.sourceType === 'reusable' && item.sourceRef === node.componentRef?.refId);
  }

  return palette.find((item) => item.nodeType === node.type && item.sourceType === 'local');
};

export const resolvePaletteItemCapabilities = (
  item: DesignerPaletteItem | undefined,
): readonly DesignerPaletteCapability[] => item?.capabilities ?? [];

export const paletteItemHasCapability = (
  item: DesignerPaletteItem | undefined,
  capability: DesignerPaletteCapability,
): boolean => hasPaletteCapability(item?.capabilities, capability);

export const resolveNodeCapabilities = (node: DesignerNode): readonly DesignerPaletteCapability[] =>
  resolvePaletteItemCapabilities(getPaletteItemForNode(node));

export const nodeHasCapability = (
  node: DesignerNode,
  capability: DesignerPaletteCapability,
): boolean => hasPaletteCapability(resolveNodeCapabilities(node), capability);

export const resolveNodeClass = (node: DesignerNode): DesignerPaletteItem['nodeClass'] =>
  getPaletteItemForNode(node)?.nodeClass;

export const canMoveNodeToParent = (node: DesignerNode, parentNode: DesignerNode): boolean => {
  if (node.type === 'root') {
    return false;
  }

  if (!isContainerNode(parentNode)) {
    return false;
  }

  const paletteItem = getPaletteItemForNode(node);
  if (!paletteItem) {
    const allowedParentTypes = getAllowedParentTypesForNodeType(node.type);
    if (allowedParentTypes.size === 0) {
      return false;
    }
    return allowedParentTypes.has(parentNode.type)
      && satisfiesHtml5ContentModel(node, parentNode, undefined, getPaletteItemForNode(parentNode));
  }

  return canInsertPaletteItem(paletteItem, parentNode)
    && satisfiesHtml5ContentModel(node, parentNode, paletteItem, getPaletteItemForNode(parentNode));
};

