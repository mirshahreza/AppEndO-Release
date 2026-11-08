/**
 * Build CMS Client Components (Component Designer documents) for Phase 3.
 *
 * Round 6: Designer + Data API. Records-style grids built with designer reducer
 * and Records page builder (grid + modals).
 */

import { createInitialDesignerState, designerReducer } from '../../src/domain/component-designer/state';
import type {
  DesignerBindingDefinitions,
  DesignerDocument,
  DesignerNode,
  DesignerState,
  DataSourceDefinition,
} from '../../src/domain/component-designer/types';
import type { ApiFormField } from '../../src/domain/component-designer/apiFieldSchema';
import {
  appendConfirmMutationOverlay,
  appendRecordsCrudOverlays,
  appendStandaloneEditOverlay,
  appendStatusPickerOverlay,
  createRecordsPageState,
} from './designerRecordsPageBuilder';
import {
  createActionGroupColumn,
  type DesignerGridRowAction,
  type DesignerGridRowActionBehavior,
} from '../../src/domain/component-designer/designerGridActionColumns';
import { DESIGNER_MODAL_FORM_BODY_CONTENT_CLASS } from '../../src/domain/component-designer/designerModalChrome';
import {
  parseDesignerAppTableGridColumns,
  serializeDesignerDataGridColumns,
  type DesignerDataGridColumn,
} from '../../src/domain/component-designer/designerDataGridColumns';
import {
  parseDesignerGridToolbarConfig,
  serializeDesignerGridToolbarConfig,
  type DesignerGridToolbarConfig,
} from '../../src/domain/component-designer/designerGridToolbarConfig';
import {
  buildGridListBindingWithToolbarQueryParams,
  GRID_LIST_RESOURCE_BINDING_KEY,
} from '../../src/domain/component-designer/bindingGridEngine';
import {
  buildServerQueryColumnFiltersFromGridColumns,
  DEFAULT_GRID_SERVER_QUERY_CONFIG,
  DEFAULT_GRID_TOOLBAR_REFRESH,
  DEFAULT_GRID_TOOLBAR_SEARCH,
} from '../../src/domain/component-designer/designerGridToolbarConfig';
import {
  REGION_DATA_SOURCE_BINDING_KEY,
  createRegionColumnBindingDefinition,
  createRegionDataSourceBindingDefinition,
  createRegionSubmitEventBindingDefinition,
} from '../../src/domain/component-designer/bindingRegionEngine';
import {
  createDynamicAction,
  createDynamicActionsEventBindingDefinition,
  visibilityStorePathForNode,
} from '../../src/domain/component-designer/bindingDynamicActionsEngine';
import { propertyBindingKeyForProp, createPropertyBindingDefinition, eventBindingKeyForEvent } from '../../src/domain/component-designer/bindingEngine';
import {
  CMS_BASE_INFO_LOV_IDS,
  CMS_SELECT_LOV_BY_COLUMN,
  mergeCmsBaseInfoLovsIntoState,
  type CmsBaseInfoCategoryIds,
} from './cmsBaseInfoLovs';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from '../../src/domain/component-designer/propRegistry';
import { serializeDesignerGridSortOptions } from '../../src/domain/component-designer/designerDataGridColumns';
import { markdownToolbarProps } from '../../src/shared/lib/markdownEditorToolbar';

export type CmsDesignerDraftBundle = {
  name: string;
  folder: string;
  document: DesignerDocument;
  bindingDefinitions: DesignerBindingDefinitions;
};

const FOLDER = 'cms';

const lastChildId = (state: DesignerState, parentId: string): string => {
  const children = state.document.nodes[parentId]?.children ?? [];
  const id = children[children.length - 1];
  if (!id) throw new Error(`Expected child under ${parentId}`);
  return id;
};

const insert = (state: DesignerState, itemId: string, parentId: string): { state: DesignerState; nodeId: string } => {
  const next = designerReducer(state, { type: 'insert-palette-item', itemId, parentId });
  return { state: next, nodeId: lastChildId(next, parentId) };
};

const setProp = (state: DesignerState, nodeId: string, key: string, value: unknown): DesignerState => (
  designerReducer(state, { type: 'set-node-prop', nodeId, key, value })
);

/** CMS pages opt out of the published page-level AI fill toolbar. */
const disablePublishedFormAssist = (state: DesignerState): DesignerState => (
  setProp(state, state.document.rootNodeId, 'publishedFormAssist', false)
);

const bindValue = (
  state: DesignerState,
  nodeId: string,
  field: string,
  options: { nullable?: boolean } = {},
): DesignerState => (
  designerReducer(state, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp('value'),
    definition: createRegionColumnBindingDefinition('value', field, {
      payloadTransform: options.nullable ? 'nullableString' : undefined,
    }),
  })
);

const heading = (state: DesignerState, parentId: string, text: string): DesignerState => {
  const { state: s1, nodeId } = insert(state, 'html.text', parentId);
  let s2 = setProp(s1, nodeId, 'text', text);
  s2 = setProp(s2, nodeId, 'className', 'text-lg font-semibold text-slate-900');
  return s2;
};

type CmsSectionTone = 'slate' | 'indigo' | 'cyan' | 'violet' | 'emerald' | 'amber';

const CMS_META_VALUE_TONE_CLASS: Record<CmsSectionTone, string> = {
  slate: 'text-slate-800',
  indigo: 'rounded-md border border-indigo-200 bg-indigo-50/70 px-2 py-1.5 text-indigo-900',
  cyan: 'rounded-md border border-cyan-200 bg-cyan-50/70 px-2 py-1.5 text-cyan-900',
  violet: 'rounded-md border border-violet-200 bg-violet-50/70 px-2 py-1.5 text-violet-900',
  emerald: 'rounded-md border border-emerald-300 bg-emerald-50/70 px-2 py-1.5 text-emerald-950',
  amber: 'rounded-md border border-amber-200 bg-amber-50/70 px-2 py-1.5 text-amber-900',
};

const boundText = (
  state: DesignerState,
  parentId: string,
  field: string,
  className: string,
): DesignerState => {
  const { state: inserted, nodeId } = insert(state, 'html.text', parentId);
  let next = setProp(inserted, nodeId, 'text', '—');
  next = setProp(next, nodeId, 'className', className);
  return designerReducer(next, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp('text'),
    definition: createRegionColumnBindingDefinition('text', field),
  });
};

const metaField = (
  state: DesignerState,
  parentId: string,
  label: string,
  field: string,
  options: { mono?: boolean; tone?: CmsSectionTone; inline?: boolean } = {},
): DesignerState => {
  const row = styledLayout(
    state,
    parentId,
    options.inline ? 'layout.flex-row' : 'layout.flex-column',
    options.inline
      ? 'flex min-w-0 items-center justify-between gap-3 overflow-hidden ps-[4px]'
      : 'flex min-w-0 flex-col gap-[2px] overflow-hidden ps-[4px]',
  );
  const labelNode = insert(row.state, 'html.text', row.nodeId);
  let next = setProp(labelNode.state, labelNode.nodeId, 'text', label);
  next = setProp(
    next,
    labelNode.nodeId,
    'className',
    'text-[11px] font-normal normal-case tracking-normal text-slate-500',
  );
  const toneClass = CMS_META_VALUE_TONE_CLASS[options.tone ?? 'slate'];
  return boundText(
    next,
    row.nodeId,
    field,
    `min-w-0 overflow-hidden break-words text-[11px] font-bold ${toneClass}${options.inline ? ' text-end' : ''}${options.mono ? ' font-mono' : ''}`,
  );
};

/** Section label — matches Records form section typography. */
const sectionHeading = (state: DesignerState, parentId: string, text: string): DesignerState => {
  const { state: s1, nodeId } = insert(state, 'html.text', parentId);
  let s2 = setProp(s1, nodeId, 'text', text);
  s2 = setProp(s2, nodeId, 'className', 'text-xs font-semibold uppercase tracking-wide text-slate-500');
  return s2;
};

const CMS_SECTION_TONE_CLASS: Record<CmsSectionTone, { bar: string; title: string }> = {
  slate: { bar: 'border-slate-400', title: 'text-slate-700' },
  indigo: { bar: 'border-indigo-400', title: 'text-indigo-700' },
  cyan: { bar: 'border-cyan-500', title: 'text-cyan-700' },
  violet: { bar: 'border-violet-400', title: 'text-violet-700' },
  emerald: { bar: 'border-emerald-600', title: 'text-emerald-800' },
  amber: { bar: 'border-amber-400', title: 'text-amber-700' },
};

const styledLayout = (
  state: DesignerState,
  parentId: string,
  itemId: 'layout.flex-column' | 'layout.flex-row' | 'layout.grid-2' | 'layout.grid-3',
  className: string,
): { state: DesignerState; nodeId: string } => {
  const inserted = insert(state, itemId, parentId);
  return { state: setProp(inserted.state, inserted.nodeId, 'className', className), nodeId: inserted.nodeId };
};

const prepareGridSlots = (
  state: DesignerState,
  gridNodeId: string,
): { state: DesignerState; slotIds: string[] } => {
  const slotIds = (state.document.nodes[gridNodeId]?.children ?? []).filter(
    (childId) => state.document.nodes[childId]?.props._designerLayoutSlot === true,
  );
  if (slotIds.length < 2) {
    throw new Error(`Expected two layout slots under ${gridNodeId}.`);
  }
  let next = state;
  for (const slotId of slotIds) {
    next = setProp(next, slotId, 'className', 'min-h-0 min-w-0 overflow-hidden');
  }
  return { state: next, slotIds };
};

/** Flat FormSection-compatible group for generated Designer documents. */
const formSection = (
  state: DesignerState,
  parentId: string,
  title: string,
  tone: CmsSectionTone,
  divided = false,
): { state: DesignerState; sectionId: string; headerId: string; bodyId: string } => {
  const section = styledLayout(
    state,
    parentId,
    'layout.flex-column',
    `flex flex-col space-y-2${divided ? ' pt-3' : ''}`,
  );
  const header = styledLayout(
    section.state,
    section.nodeId,
    'layout.flex-row',
    'flex min-h-4 items-center gap-0.5 ps-[4px]',
  );
  const titleNode = insert(header.state, 'html.text', header.nodeId);
  let next = titleNode.state;
  next = setProp(titleNode.state, titleNode.nodeId, 'text', title);
  next = setProp(
    next,
    titleNode.nodeId,
    'className',
    `border-s-2 ps-1.5 text-[11px] font-bold uppercase tracking-wider leading-none ${CMS_SECTION_TONE_CLASS[tone].title} ${CMS_SECTION_TONE_CLASS[tone].bar}`,
  );
  const body = styledLayout(next, section.nodeId, 'layout.flex-column', 'flex flex-col gap-2');
  return {
    state: body.state,
    sectionId: section.nodeId,
    headerId: header.nodeId,
    bodyId: body.nodeId,
  };
};

const fieldPair = (
  state: DesignerState,
  parentId: string,
): { state: DesignerState; nodeId: string; leftId: string; rightId: string } => {
  const grid = styledLayout(
    state,
    parentId,
    'layout.grid-2',
    'min-w-0 items-start gap-2',
  );
  const prepared = prepareGridSlots(grid.state, grid.nodeId);
  return {
    state: prepared.state,
    nodeId: grid.nodeId,
    leftId: prepared.slotIds[0]!,
    rightId: prepared.slotIds[1]!,
  };
};

const note = (state: DesignerState, parentId: string, text: string): DesignerState => {
  const { state: s1, nodeId } = insert(state, 'html.text', parentId);
  return setProp(s1, nodeId, 'text', text);
};

const link = (state: DesignerState, parentId: string, text: string, href: string): DesignerState => {
  const { state: s1, nodeId } = insert(state, 'html.link', parentId);
  let s2 = setProp(s1, nodeId, 'text', text);
  s2 = setProp(s2, nodeId, 'href', href);
  return s2;
};

/** Sections inside CMS Settings — same UX as platform Settings (left rail, not main menu). */
export type CmsSettingsSectionId = 'general' | 'content-types' | 'statuses' | 'languages' | 'content-tags';

type CmsSettingsNavTone = 'slate' | 'violet' | 'indigo' | 'emerald' | 'cyan' | 'amber';

const CMS_SETTINGS_NAV_ICON_CLASS: Record<CmsSettingsNavTone, string> = {
  slate: '[&_svg]:text-slate-600',
  violet: '[&_svg]:text-violet-600',
  indigo: '[&_svg]:text-indigo-600',
  emerald: '[&_svg]:text-emerald-700',
  cyan: '[&_svg]:text-cyan-600',
  amber: '[&_svg]:text-amber-600',
};

const CMS_SETTINGS_NAV_ACTIVE_CLASS: Record<CmsSettingsNavTone, string> = {
  slate: 'bg-white text-slate-900 border-slate-200 shadow-sm',
  violet: 'bg-violet-50/80 text-violet-950 border-violet-200 shadow-sm',
  indigo: 'bg-indigo-50/80 text-indigo-950 border-indigo-200 shadow-sm',
  emerald: 'bg-emerald-50/80 text-emerald-950 border-emerald-200 shadow-sm',
  cyan: 'bg-cyan-50/80 text-cyan-950 border-cyan-200 shadow-sm',
  amber: 'bg-amber-50/80 text-amber-950 border-amber-200 shadow-sm',
};

const CMS_SETTINGS_SECTION_NAV: Array<{
  id: CmsSettingsSectionId;
  label: string;
  href: string;
  icon: string;
  tone: CmsSettingsNavTone;
  separatorBefore?: boolean;
}> = [
  { id: 'general', label: 'General', href: '/studio/cms/settings', icon: 'Settings2', tone: 'slate' },
  {
    id: 'content-tags',
    label: 'Tags',
    href: '/studio/cms/settings/content-tags',
    icon: 'Tags',
    tone: 'emerald',
    separatorBefore: true,
  },
  {
    id: 'content-types',
    label: 'Types',
    href: '/studio/cms/settings/content-types',
    icon: 'Layers',
    tone: 'indigo',
  },
  {
    id: 'statuses',
    label: 'Statuses',
    href: '/studio/cms/settings/statuses',
    icon: 'CircleDot',
    tone: 'amber',
    separatorBefore: true,
  },
  {
    id: 'languages',
    label: 'Languages',
    href: '/studio/cms/settings/languages',
    icon: 'Languages',
    tone: 'cyan',
    separatorBefore: true,
  },
];

const CMS_SETTINGS_NAV_LINK_BASE =
  'workspace-section-nav-item relative inline-flex w-full items-center justify-start gap-3 rounded-lg border px-3 py-1.5 text-start text-sm font-medium no-underline outline-none transition-colors [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0';

/**
 * App Settings–style shell: left section nav + main pane.
 * Call on an empty page root; returns the main pane to host section content.
 */
const mountCmsSettingsShell = (
  state: DesignerState,
  activeSectionId: CmsSettingsSectionId,
): { state: DesignerState; mainId: string } => {
  let next = setProp(
    state,
    state.document.rootNodeId,
    'className',
    'flex h-full min-h-0 w-full flex-col bg-slate-50 font-sans',
  );

  const workspace = styledLayout(
    next,
    next.document.rootNodeId,
    'layout.flex-row',
    'flex min-h-0 flex-1 items-stretch overflow-hidden',
  );
  next = workspace.state;

  const nav = styledLayout(
    next,
    workspace.nodeId,
    'layout.flex-column',
    'flex h-full min-h-0 w-[238px] shrink-0 self-stretch flex-col overflow-y-auto border-e border-slate-200 bg-slate-50 p-4',
  );
  next = nav.state;

  const navStack = styledLayout(next, nav.nodeId, 'layout.flex-column', 'flex flex-col space-y-0.5');
  next = navStack.state;

  for (const section of CMS_SETTINGS_SECTION_NAV) {
    if (section.separatorBefore) {
      const sep = styledLayout(
        next,
        navStack.nodeId,
        'layout.flex-column',
        'my-0.5 border-t border-slate-200/90',
      );
      next = sep.state;
    }

    const isActive = section.id === activeSectionId;
    const iconTone = CMS_SETTINGS_NAV_ICON_CLASS[section.tone];
    // Button + navigate action (href alone does not SPA-route in Designer runtime).
    // justify-start: HeroUI Button defaults to centered content.
    const linkNode = insert(next, 'heroui.button-outline', navStack.nodeId);
    next = setProp(linkNode.state, linkNode.nodeId, 'text', section.label);
    next = setProp(next, linkNode.nodeId, 'icon', section.icon);
    next = setProp(next, linkNode.nodeId, 'size', 'sm');
    next = setProp(next, linkNode.nodeId, 'type', 'button');
    next = setProp(next, linkNode.nodeId, 'aria-label', section.label);
    next = setProp(
      next,
      linkNode.nodeId,
      'className',
      isActive
        ? `${CMS_SETTINGS_NAV_LINK_BASE} workspace-section-nav-item-active ${CMS_SETTINGS_NAV_ACTIVE_CLASS[section.tone]} ${iconTone}`
        : `${CMS_SETTINGS_NAV_LINK_BASE} border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${iconTone}`,
    );
    const go = createDynamicAction('navigate');
    go.navigateTarget = section.href;
    next = designerReducer(next, {
      type: 'set-node-binding',
      nodeId: linkNode.nodeId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [go]),
    });
  }

  const main = styledLayout(
    next,
    workspace.nodeId,
    'layout.flex-column',
    'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white',
  );
  return { state: main.state, mainId: main.nodeId };
};

/** Button-styled navigation link (Designer link node — no client JS, plain href). */
const buttonLink = (state: DesignerState, parentId: string, text: string, href: string): DesignerState => {
  const { state: s1, nodeId } = insert(state, 'heroui.button-solid', parentId);
  let s2 = setProp(s1, nodeId, 'text', text);
  s2 = setProp(s2, nodeId, 'href', href);
  s2 = setProp(s2, nodeId, 'className', 'inline-flex w-fit items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-sm font-medium text-white no-underline hover:bg-sky-700');
  return s2;
};

/**
 * Rail "clickable placeholder" note field (copies the Data Studio Story-section
 * pattern: `EdgeModelModelerSidePanel.tsx` / `MODELER_EMPTY_STATE_CLASS`). The
 * button's `text` prop is bound directly to the field, so once the field has a
 * value the button doubles as a compact preview of it — a single combined line
 * rather than a two-line "title + caption" card (Designer leaf-node limitation;
 * same simplification documented in the CMS plan's round 15 notes).
 */
const clickableNoteField = (
  state: DesignerState,
  parentId: string,
  field: string,
  emptyText: string,
): { state: DesignerState; triggerNodeId: string } => {
  const trigger = insert(state, 'heroui.button-outline', parentId);
  let next = setProp(trigger.state, trigger.nodeId, 'text', emptyText);
  next = setProp(next, trigger.nodeId, 'type', 'button');
  next = setProp(next, trigger.nodeId, 'directionalText', true);
  next = setProp(
    next,
    trigger.nodeId,
    'className',
    'flex min-h-11 h-auto w-full cursor-pointer items-start justify-start whitespace-pre-wrap rounded-md border border-dashed border-slate-200 bg-white px-3 py-2 text-start text-xs font-normal leading-relaxed text-slate-700 outline-none transition-colors hover:border-slate-300 hover:bg-slate-50',
  );
  next = stripOutlineButtonLinkChrome(next, trigger.nodeId);
  next = designerReducer(next, {
    type: 'set-node-binding',
    nodeId: trigger.nodeId,
    bindingKey: propertyBindingKeyForProp('text'),
    definition: createRegionColumnBindingDefinition('text', field),
  });
  return { state: next, triggerNodeId: trigger.nodeId };
};

/** Palette `heroui.button-outline` defaults to `href="#"` + `nodeType: link` — strip so onClick modals work inside forms. */
const stripOutlineButtonLinkChrome = (state: DesignerState, nodeId: string): DesignerState => {
  let next = setProp(state, nodeId, 'href', '');
  next = setProp(next, nodeId, 'target', '');
  next = setProp(next, nodeId, 'rel', '');
  return next;
};

const patchOverlayFixedField = (
  document: DesignerDocument,
  modalNodeId: string | null,
  fieldName: string,
  value: unknown,
): DesignerDocument => {
  if (!modalNodeId) {
    return document;
  }

  const nodes = { ...document.nodes };
  const visit = (nodeId: string): void => {
    const node = nodes[nodeId];
    if (!node) {
      return;
    }
    const field = Object.values(node.binding).find(
      (definition) => definition?.sourceType === 'regionColumn',
    )?.column;
    if (field === fieldName) {
      nodes[nodeId] = {
        ...node,
        props: {
          ...node.props,
          value,
          readOnly: true,
          className: 'hidden',
        },
      };
    }
    for (const childId of node.children) {
      visit(childId);
    }
  };
  visit(modalNodeId);
  return { ...document, nodes };
};

const patchOverlaySelectFieldOptions = (
  document: DesignerDocument,
  modalNodeId: string | null,
  fieldOptionsByColumn: Record<string, Array<{ value: string; label: string }>>,
  defaultSelectedByColumn: Record<string, string> = {},
): DesignerDocument => {
  if (!modalNodeId) {
    return document;
  }

  const nodes = { ...document.nodes };
  const visit = (nodeId: string): void => {
    const node = nodes[nodeId];
    if (!node) {
      return;
    }
    const column = Object.values(node.binding).find(
      (definition) => definition?.sourceType === 'regionColumn',
    )?.column;
    const options = typeof column === 'string' ? fieldOptionsByColumn[column] : undefined;
    if (options && node.props[DESIGNER_PALETTE_ITEM_ID_PROP] === 'heroui.select') {
      nodes[nodeId] = {
        ...node,
        props: {
          ...node.props,
          items: JSON.stringify(options.map((option) => ({
            id: option.value,
            textValue: option.label,
          }))),
          ...(defaultSelectedByColumn[column] ? { selectedKeys: defaultSelectedByColumn[column] } : {}),
          isRequired: true,
          className: 'w-full',
        },
      };
    }
    for (const childId of node.children) {
      visit(childId);
    }
  };
  visit(modalNodeId);
  return { ...document, nodes };
};

const wireDocumentSelectFieldLovs = (
  document: DesignerDocument,
  defaultSelectedByColumn: Record<string, string> = {},
  selectedKeyByLanguageByColumn: Record<string, Record<string, string>> = {},
): DesignerDocument => {
  const nodes = Object.fromEntries(Object.entries(document.nodes).map(([nodeId, node]) => {
    const paletteItemId = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
    if (paletteItemId !== 'heroui.select' && paletteItemId !== 'heroui.radio-group') {
      return [nodeId, node];
    }

    const column = Object.values(node.binding).find(
      (definition) => definition?.sourceType === 'regionColumn',
    )?.column;
    if (typeof column !== 'string') {
      return [nodeId, node];
    }

    const lovRef = CMS_SELECT_LOV_BY_COLUMN[column];
    if (!lovRef) {
      return [nodeId, node];
    }

    const { items: _items, ...restProps } = node.props;
    const defaultSelected = defaultSelectedByColumn[column];
    const defaultSelectionProps = defaultSelected
      ? (paletteItemId === 'heroui.select'
        ? { selectedKeys: defaultSelected }
        : { isSelected: defaultSelected })
      : {};
    return [nodeId, {
      ...node,
      props: {
        ...restProps,
        isRequired: node.props.isRequired ?? true,
        className: typeof node.props.className === 'string' ? node.props.className : 'w-full',
        ...defaultSelectionProps,
        ...(selectedKeyByLanguageByColumn[column]
          ? { selectedKeyByLanguage: JSON.stringify(selectedKeyByLanguageByColumn[column]) }
          : {}),
      },
      binding: {
        ...node.binding,
        [propertyBindingKeyForProp('items')]: createPropertyBindingDefinition('items', 'items', {
          lovRef,
        }),
      },
    }];
  }));

  return { ...document, nodes };
};

/**
 * Standard Studio list grid — mirrors `buildAutoTableSeeds` (autoTableTemplateBuilder.ts):
 * server query mode + toolbar (search / refresh / per-column server filters), paging,
 * sort options, responsive card fallback. Keep in sync with that canonical seed.
 */
const standardGrid = (
  state: DesignerState,
  parentId: string,
  dataSourceId: string,
  columns: DesignerDataGridColumn[],
  opts: {
    searchPlaceholder: string;
    resourceLabel: string;
    defaultSortBy?: string;
    defaultSortDirection?: 'asc' | 'desc';
    primaryKey?: string;
    toolbarConfig?: DesignerGridToolbarConfig;
    listQueryParams?: Record<string, string>;
    presentation?: 'auto' | 'cards' | 'table';
    /** When false, hides GridPagingFooter (compact galleries). Default true. */
    pagination?: boolean;
    pageSize?: number;
    /** Isolated server-query store prefix (default `gridQuery`). Use in nested modals. */
    gridQueryStorePrefix?: string;
    /** Edge-align paging footer to CreateEditModalShell (modal grids). */
    edgeAlignPagingFooter?: boolean;
  },
): { state: DesignerState; gridId: string } => {
  const { state: s1, nodeId: gridId } = insert(state, 'heroui.app-table-grid', parentId);
  let s = s1;
  const gridQueryStorePrefix = opts.gridQueryStorePrefix?.trim() || 'gridQuery';

  const toolbarConfig: DesignerGridToolbarConfig = opts.toolbarConfig ?? {
    enabled: true,
    search: { ...DEFAULT_GRID_TOOLBAR_SEARCH, placeholder: opts.searchPlaceholder },
    refresh: DEFAULT_GRID_TOOLBAR_REFRESH,
    serverQuery: {
      ...DEFAULT_GRID_SERVER_QUERY_CONFIG,
      enabled: true,
      columnFilters: buildServerQueryColumnFiltersFromGridColumns(columns),
    },
  };

  const listBinding = buildGridListBindingWithToolbarQueryParams(dataSourceId, toolbarConfig, {
    storeWritePath: `${gridQueryStorePrefix}.sort`,
    dataPath: `${gridQueryStorePrefix}.page`,
  });
  const serverQueryParams: Record<string, string> = {
    sortBy: `${gridQueryStorePrefix}.sortBy`,
    sortDir: `${gridQueryStorePrefix}.sortDir`,
    page: `${gridQueryStorePrefix}.page`,
    pageSize: `${gridQueryStorePrefix}.pageSize`,
  };
  s = designerReducer(s, {
    type: 'set-node-binding',
    nodeId: gridId,
    bindingKey: GRID_LIST_RESOURCE_BINDING_KEY,
    definition: {
      ...listBinding,
      queryParams: {
        ...(listBinding.queryParams ?? {}),
        ...serverQueryParams,
        ...(opts.listQueryParams ?? {}),
      },
    },
  });

  const sortableColumns = columns.filter((column) => column.sort);
  const defaultSortBy = opts.defaultSortBy ?? sortableColumns[0]?.key ?? '';
  const defaultSortDirection = opts.defaultSortDirection === 'desc' ? 'desc' : 'asc';
  const rowKeyField = opts.primaryKey?.trim() || 'id';
  const paginationEnabled = opts.pagination !== false;
  const pageSize = opts.pageSize ?? (paginationEnabled ? 50 : 100);

  s = setProp(s, gridId, 'className', 'flex h-full min-h-0 w-full flex-1 flex-col');
  s = setProp(s, gridId, 'columns', serializeDesignerDataGridColumns(columns));
  s = setProp(s, gridId, 'gridQueryMode', 'server');
  s = setProp(s, gridId, 'pageSize', pageSize);
  s = setProp(s, gridId, 'page', 1);
  s = setProp(s, gridId, 'total', 0);
  s = setProp(s, gridId, 'presentation', opts.presentation ?? 'auto');
  s = setProp(s, gridId, 'cardBelow', 'tablet');
  s = setProp(s, gridId, 'enableColumnLayout', false);
  // Footer sort field + direction (GridPagingFooter) — required whenever paging is on.
  s = setProp(s, gridId, 'showSortControls', paginationEnabled && sortableColumns.length > 0);
  s = setProp(s, gridId, 'showListModeControls', false);
  s = setProp(s, gridId, 'showPagingFooter', paginationEnabled);
  if (opts.edgeAlignPagingFooter === true) {
    s = setProp(s, gridId, 'edgeAlignPagingFooter', true);
  }
  s = setProp(s, gridId, 'listMode', 'paging');
  s = setProp(s, gridId, 'rowKeyField', rowKeyField);
  if (defaultSortBy) {
    s = setProp(s, gridId, 'defaultSortBy', defaultSortBy);
    s = setProp(s, gridId, 'defaultSortDirection', defaultSortDirection);
  }
  if (sortableColumns.length > 0) {
    s = setProp(s, gridId, 'sortOptions', serializeDesignerGridSortOptions(
      sortableColumns.map((column) => ({ value: column.key, label: column.label || column.key })),
    ));
  }
  s = setProp(s, gridId, 'toolbarConfig', serializeDesignerGridToolbarConfig(toolbarConfig));
  s = setProp(s, gridId, 'loadingMessage', `Loading ${opts.resourceLabel}…`);
  s = setProp(s, gridId, 'emptyContent', `No ${opts.resourceLabel} found.`);
  s = setProp(s, gridId, 'errorContent', `Could not load ${opts.resourceLabel}.`);

  return { state: s, gridId };
};

const appendRevisionHistoryModal = (
  state: DesignerState,
  dataSourceId: string,
  contentIdStorePath: string,
): { state: DesignerState; modalNodeId: string } => {
  const modal = insert(state, 'heroui.modal', state.document.rootNodeId);
  let next = setProp(modal.state, modal.nodeId, 'title', 'Revision history');
  next = setProp(next, modal.nodeId, 'size', 'maximized');
  next = designerReducer(next, {
    type: 'set-node-visible-condition',
    nodeId: modal.nodeId,
    visibleCondition: `store.${visibilityStorePathForNode(modal.nodeId)} === true`,
  });
  const host = styledLayout(
    next,
    modal.nodeId,
    'layout.flex-column',
    'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white',
  );
  const revisionQueryPrefix = 'revisionHistoryGridQuery';
  const historyGrid = standardGrid(host.state, host.nodeId, dataSourceId, [
    { key: 'revisionNo', label: '#', sort: true },
    { key: 'title', label: 'Title' },
    { key: 'summary', label: 'Summary' },
    { key: 'body', label: 'Body' },
  ], {
    searchPlaceholder: 'Search revisions…',
    resourceLabel: 'revisions',
    defaultSortBy: 'revisionNo',
    toolbarConfig: { enabled: false },
    gridQueryStorePrefix: revisionQueryPrefix,
    listQueryParams: { 'filter[contentId][eq]': contentIdStorePath },
    pageSize: 20,
    // Body is !p-0 (Designer modal fill) — do not edgeAlign (-mx-[15px]) or the footer skews.
  });
  return { state: historyGrid.state, modalNodeId: modal.nodeId };
};

/** Content-editor comments dialog — child comment rows (`content_type=comment`) for the open record. */
const appendContentCommentsModerationModal = (
  state: DesignerState,
  parentContentIdParam: string,
  commentTypeCode: string,
  statusIds: {
    approved: string | null;
    rejected: string | null;
  },
): { state: DesignerState; modalNodeId: string } => {
  const dataSourceId = 'cmsContentComments';
  // Poll so fire-and-forget auto-comment after create appears without a full page reload.
  const dataSource: DataSourceDefinition = {
    id: dataSourceId,
    name: 'content comment',
    endpoint: '/api/cms/contents',
    primaryKey: 'id',
    fields: [
      'id', 'parentContentId', 'body', 'authorDisplayName',
      'statusCode', 'statusCodeTitle', 'statusCodeUiHtml', 'statusCodeUiColor', 'createdAt',
    ],
    kind: 'collection',
    operations: {
      list: { method: 'GET', endpoint: '/api/cms/contents' },
      update: { method: 'PUT', endpoint: '/api/cms/contents/:id' },
      delete: { method: 'DELETE', endpoint: '/api/cms/contents/:id' },
    },
    responseMapping: {
      arrayPath: 'data',
      totalPath: 'count',
      dataPath: 'data',
    },
    pollingIntervalMs: 3000,
  };

  let next = designerReducer(state, { type: 'set-data-source', dataSourceId, dataSource });
  const modal = insert(next, 'heroui.modal', next.document.rootNodeId);
  next = setProp(modal.state, modal.nodeId, 'title', 'Comments');
  next = setProp(next, modal.nodeId, 'size', 'maximized');
  next = designerReducer(next, {
    type: 'set-node-visible-condition',
    nodeId: modal.nodeId,
    visibleCondition: `store.${visibilityStorePathForNode(modal.nodeId)} === true`,
  });
  const host = styledLayout(
    next,
    modal.nodeId,
    'layout.flex-column',
    'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white',
  );
  const commentsGrid = standardGrid(host.state, host.nodeId, dataSourceId, [
    { key: 'body', label: 'Comment', sort: true, filter: true, filterType: 'text', cardRole: 'title' },
    { key: 'authorDisplayName', label: 'Author', sort: true, cardRole: 'field' },
    {
      key: 'statusCode',
      label: 'Status',
      sort: true,
      cellKind: 'status-badge',
      cellFields: {
        labelField: 'statusCodeTitle',
        labelFallbackField: 'statusCode',
        htmlField: 'statusCodeUiHtml',
        colorField: 'statusCodeUiColor',
      },
      cardRole: 'meta',
    },
    { key: 'createdAt', label: 'Created', sort: true, cellKind: 'date', cardRole: 'meta' },
  ], {
    searchPlaceholder: 'Search comments…',
    resourceLabel: 'comments',
    defaultSortBy: 'createdAt',
    primaryKey: 'id',
    toolbarConfig: {
      enabled: true,
      search: { ...DEFAULT_GRID_TOOLBAR_SEARCH, placeholder: 'Search comments…' },
      refresh: { enabled: true },
      serverQuery: {
        ...DEFAULT_GRID_SERVER_QUERY_CONFIG,
        enabled: true,
        columnFilters: [{ columnId: 'body', apiParam: 'filter[body][like]', kind: 'text' }],
      },
    },
    presentation: 'cards',
    listQueryParams: {
      view: 'static:summary',
      'filter[parentContentId][eq]': parentContentIdParam,
      'filter[contentTypeCode][eq]': `static:${commentTypeCode}`,
    },
  });
  next = commentsGrid.state;

  const disableWhenStatus = (statusId: string | null) => (
    statusId
      ? {
        preset: 'expression' as const,
        expression: `row.statusCode === '${statusId}'`,
      }
      : undefined
  );

  const built = appendRecordsCrudOverlays({
    state: next,
    gridNodeId: commentsGrid.gridId,
    dataSource,
    formFields: [],
    actions: { create: false, edit: false, delete: true },
    resourceLabel: 'comment',
    rowActions: [
      {
        actionId: 'approve',
        icon: 'BadgeCheck',
        intent: 'utility',
        tooltip: 'Approve',
        behavior: openModalBehavior('', 'id'),
        disabledWhen: disableWhenStatus(statusIds.approved),
      },
      {
        actionId: 'reject',
        icon: 'XCircle',
        intent: 'delete',
        tooltip: 'Reject',
        behavior: openModalBehavior('', 'id'),
        disabledWhen: disableWhenStatus(statusIds.rejected),
      },
      {
        actionId: 'delete',
        icon: 'Trash2',
        intent: 'delete',
        tooltip: 'Delete',
        behavior: openModalBehavior('', 'id'),
      },
    ],
  });

  const approveOverlay = appendConfirmMutationOverlay({
    state: built.state,
    dataSourceId,
    title: 'Approve comment?',
    message: 'Approve this comment and make it available to public delivery?',
    confirmLabel: 'Approve',
    mutationOperation: 'update',
    mutationBody: { statusCode: statusIds.approved },
    successToast: 'Comment approved',
  });
  const rejectOverlay = appendConfirmMutationOverlay({
    state: approveOverlay.state,
    dataSourceId,
    title: 'Reject comment?',
    message: 'Reject this comment? It will remain hidden from public delivery.',
    confirmLabel: 'Reject',
    mutationOperation: 'update',
    mutationBody: { statusCode: statusIds.rejected },
    successToast: 'Comment rejected',
  });
  const statusOverlay = appendStatusPickerOverlay({
    state: rejectOverlay.state,
    dataSourceId,
    title: 'Change status',
    statusLovRef: CMS_BASE_INFO_LOV_IDS.statuses,
    mutationRecordIdStorePath: 'selection.id',
  });

  let document = statusOverlay.state.document;
  const deleteDialogId = built.deleteDialogNodeId;
  document = patchGridColumns(document, commentsGrid.gridId, (cols) => cols.map((column) => {
    if (column.key === 'statusCode') {
      return {
        ...column,
        cellClickBehavior: openModalBehavior(statusOverlay.modalNodeId, 'id'),
      };
    }
    if (column.kind !== 'action-group' || !column.actions) {
      return column;
    }
    return {
      ...column,
      actions: column.actions.map((action) => {
        const modalNodeId = action.actionId === 'approve'
          ? approveOverlay.dialogNodeId
          : action.actionId === 'reject'
            ? rejectOverlay.dialogNodeId
            : action.actionId === 'delete'
              ? deleteDialogId
              : null;
        return modalNodeId
          ? { ...action, behavior: openModalBehavior(modalNodeId, 'id') }
          : action;
      }),
    };
  }));

  return {
    state: { ...statusOverlay.state, document },
    modalNodeId: modal.nodeId,
  };
};

/** Text field bound into the enclosing region's field mapping. `hidden` styles it out of flow but keeps it a real rendered control (no dedicated hidden-input primitive exists). */
const textField = (
  state: DesignerState,
  parentId: string,
  field: string,
  label: string,
  opts: {
    multiline?: boolean;
    hidden?: boolean;
    fixedValue?: string;
    readOnly?: boolean;
    rows?: number;
  } = {},
): DesignerState => {
  const paletteId = opts.multiline ? 'heroui.textarea' : 'heroui.input-text';
  const { state: s1, nodeId } = insert(state, paletteId, parentId);
  // A `hidden` field's className only hides the input element itself (see UiInput/AiAssistInput's
  // always-visible wrapper div) — its label would otherwise render as an orphan text with no
  // control under it, so a hidden field never gets a visible label at all.
  let s2 = setProp(s1, nodeId, 'label', opts.hidden ? '' : label);
  if (opts.hidden) s2 = setProp(s2, nodeId, 'className', 'hidden');
  if (opts.readOnly) s2 = setProp(s2, nodeId, 'readOnly', true);
  if (opts.rows) s2 = setProp(s2, nodeId, 'rows', opts.rows);
  if (opts.fixedValue !== undefined) s2 = setProp(s2, nodeId, 'value', opts.fixedValue);
  s2 = bindValue(s2, nodeId, field);
  return s2;
};

const checkboxField = (state: DesignerState, parentId: string, field: string, label: string): DesignerState => {
  // Switch binds `isSelected` (not `value`) — see resolvePreferredValuePropForNode.
  // Label renders beside Control (runtime/export Switch.Content), start-aligned — not centered.
  const { state: s1, nodeId } = insert(state, 'heroui.switch', parentId);
  let s2 = setProp(s1, nodeId, 'label', label);
  s2 = setProp(s2, nodeId, 'size', 'sm');
  s2 = setProp(s2, nodeId, 'className', 'inline-flex w-fit self-start items-center gap-2');
  s2 = designerReducer(s2, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp('isSelected'),
    definition: createRegionColumnBindingDefinition('isSelected', field, {
      payloadTransform: 'boolean',
    }),
  });
  return s2;
};

const selectField = (
  state: DesignerState,
  parentId: string,
  field: string,
  label: string,
  options: Array<{ value: string; label: string }>,
  config: {
    nullable?: boolean;
    placeholder?: string;
    payloadTransform?: 'nullableString' | 'nullableBoolean';
  } = {},
): DesignerState => {
  const { state: inserted, nodeId } = insert(state, 'heroui.select', parentId);
  let next = setProp(inserted, nodeId, 'label', label);
  next = setProp(next, nodeId, 'placeholder', config.placeholder ?? 'Select…');
  next = setProp(next, nodeId, 'items', JSON.stringify(
    options.map((option) => ({ id: option.value, textValue: option.label })),
  ));
  next = setProp(next, nodeId, 'className', 'w-full');
  const payloadTransform = config.payloadTransform
    ?? (config.nullable ? 'nullableString' : undefined);
  next = designerReducer(next, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: propertyBindingKeyForProp('selectedKeys'),
    definition: createRegionColumnBindingDefinition('selectedKeys', field, {
      payloadTransform,
    }),
  });
  return next;
};

const buildSubmitSuccessActions = (
  successToast: string,
  refreshDataSourceId?: string,
): import('../../src/domain/component-designer/types').DesignerDynamicAction[] => {
  const trueActions: import('../../src/domain/component-designer/types').DesignerDynamicAction[] = [];
  const toast = createDynamicAction('showToast');
  toast.toastTitle = successToast;
  toast.toastVariant = 'success';
  trueActions.push(toast);
  if (refreshDataSourceId) {
    const refresh = createDynamicAction('refreshDataSource');
    refresh.dataSourceRef = refreshDataSourceId;
    trueActions.push(refresh);
  }
  return trueActions;
};

const submitButton = (
  state: DesignerState,
  parentId: string,
  text: string,
  className = 'bg-sky-600 text-white',
  options: { successToast?: string; refreshDataSourceId?: string } = {},
): DesignerState => {
  const trueActions = options.successToast
    ? buildSubmitSuccessActions(options.successToast, options.refreshDataSourceId)
    : [];

  const { state: s1, nodeId } = insert(state, 'heroui.button-solid', parentId);
  let s2 = setProp(s1, nodeId, 'text', text);
  s2 = setProp(s2, nodeId, 'className', className);
  s2 = designerReducer(s2, {
    type: 'set-node-binding',
    nodeId,
    bindingKey: eventBindingKeyForEvent('onClick'),
    definition: createRegionSubmitEventBindingDefinition('onClick', {
      trueActions: trueActions.length > 0 ? trueActions : undefined,
    }),
  });
  return s2;
};

/** Registers a REST data source (list/detail/create/update/delete endpoints). */
const setDataSource = (
  state: DesignerState,
  dataSourceId: string,
  name: string,
  config: {
    endpoint: string;
    primaryKey?: string;
    fields: string[];
    operations: {
      list?: { method: 'GET'; endpoint: string };
      detail?: { method: 'GET'; endpoint: string };
      create?: { method: 'POST'; endpoint: string };
      update?: { method: 'PUT' | 'PATCH'; endpoint: string };
      delete?: { method: 'DELETE'; endpoint: string };
    };
    arrayPath?: string;
  },
): DesignerState => designerReducer(state, {
  type: 'set-data-source',
  dataSourceId,
  dataSource: {
    id: dataSourceId,
    name,
    endpoint: config.endpoint,
    primaryKey: config.primaryKey,
    fields: config.fields,
    kind: 'collection',
    operations: config.operations,
    responseMapping: {
      arrayPath: config.arrayPath ?? 'data',
      totalPath: 'count',
      dataPath: config.arrayPath ?? 'data',
    },
  },
});

const finalizeDocument = (state: DesignerState, name: string, folder: string): CmsDesignerDraftBundle => ({
  name,
  folder,
  document: { ...state.document, id: name, name },
  bindingDefinitions: state.bindingDefinitions,
});

const finalizeBuiltDocument = (
  name: string,
  folder: string,
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): CmsDesignerDraftBundle => ({
  name,
  folder,
  document: { ...document, id: name, name },
  bindingDefinitions,
});

const resolveNodePaletteItemId = (node: DesignerNode): string | undefined => {
  const value = node.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
};

const findModalFormFieldsBodyId = (
  document: DesignerDocument,
  modalNodeId: string,
): string | null => {
  const modal = document.nodes[modalNodeId];
  if (!modal) {
    return null;
  }
  const formId = modal.children.find(
    (childId) => resolveNodePaletteItemId(document.nodes[childId]!) === 'html.form',
  );
  const form = formId ? document.nodes[formId] : undefined;
  return form?.children[0] ?? null;
};

const navigateBehavior = (target: string, replace = false): DesignerGridRowActionBehavior => ({
  kind: 'navigate',
  navigateTarget: target,
  navigateReplace: replace,
});

const openModalBehavior = (modalNodeId: string, primaryKey = 'id'): DesignerGridRowActionBehavior => ({
  kind: 'open-modal',
  modalNodeId,
  primaryKeyField: primaryKey,
  selectionStorePath: `selection.${primaryKey}`,
});

const patchGridNodeProps = (
  document: DesignerDocument,
  gridNodeId: string,
  patch: (props: Record<string, unknown>) => Record<string, unknown>,
): DesignerDocument => {
  const grid = document.nodes[gridNodeId];
  if (!grid) {
    return document;
  }
  return {
    ...document,
    nodes: {
      ...document.nodes,
      [gridNodeId]: {
        ...grid,
        props: patch({ ...grid.props }),
      },
    },
  };
};

const patchGridColumns = (
  document: DesignerDocument,
  gridNodeId: string,
  mutate: (columns: DesignerDataGridColumn[]) => DesignerDataGridColumn[],
): DesignerDocument => (
  patchGridNodeProps(document, gridNodeId, (props) => ({
    ...props,
    columns: serializeDesignerDataGridColumns(
      mutate(parseDesignerAppTableGridColumns(props.columns)),
    ),
  }))
);

const patchDocumentPageShell = (document: DesignerDocument): DesignerDocument => {
  const root = document.nodes[document.rootNodeId];
  if (!root) {
    return document;
  }
  return {
    ...document,
    nodes: {
      ...document.nodes,
      [document.rootNodeId]: {
        ...root,
        props: {
          ...root.props,
          className: 'flex h-full min-h-0 w-full flex-col bg-white font-sans',
        },
      },
    },
  };
};

const buildVocabDataSource = (
  title: string,
  categoryId: string,
  editable: boolean,
): DataSourceDefinition => ({
  id: 'vocabItems',
  name: title,
  endpoint: '/api/base-info',
  primaryKey: 'id',
  // NOTE: `/api/base-info` is asymmetric —
  // • list/children → snake_case (`short_name`, `view_order`, …) for grid columns
  // • GET /:id (detail) + POST/PUT bodies → camelCase (Base Info form fields)
  // Grid `fields` stay snake_case; create/edit modal fields stay camelCase.
  fields: ['id', 'title', 'short_name', 'view_order', 'is_active', 'parent_id', 'ui_color'],
  kind: 'collection',
  operations: editable
    ? {
      list: { method: 'GET', endpoint: `/api/base-info/children?parentId=${categoryId}&includeInactive=true` },
      detail: { method: 'GET', endpoint: '/api/base-info/:id' },
      create: { method: 'POST', endpoint: '/api/base-info' },
      update: { method: 'PUT', endpoint: '/api/base-info/:id' },
      delete: { method: 'DELETE', endpoint: '/api/base-info/:id' },
      custom: {
        move: { method: 'POST', endpoint: '/api/base-info/:id/move', label: 'Reorder sibling' },
      },
    }
    : {
      list: { method: 'GET', endpoint: `/api/base-info/children?parentId=${categoryId}&includeInactive=true` },
      detail: { method: 'GET', endpoint: '/api/base-info/:id' },
    },
  responseMapping: {
    arrayPath: 'items',
    totalPath: 'count',
    dataPath: 'items',
  },
});

const clearDesignerNodeChildren = (state: DesignerState, parentId: string): DesignerState => {
  const childIds = [...(state.document.nodes[parentId]?.children ?? [])];
  let next = state;
  for (const childId of childIds) {
    next = designerReducer(next, { type: 'remove-node', nodeId: childId });
  }
  return next;
};

const setModalSize = (
  document: DesignerDocument,
  modalNodeId: string | null,
  size: string,
): DesignerDocument => {
  if (!modalNodeId) {
    return document;
  }
  const modal = document.nodes[modalNodeId];
  if (!modal) {
    return document;
  }
  return {
    ...document,
    nodes: {
      ...document.nodes,
      [modalNodeId]: {
        ...modal,
        props: { ...modal.props, size },
      },
    },
  };
};

/**
 * Mount the shared Studio Base Info record form (`form.base-info-record`) in vocab modals.
 * API endpoints come from the vocab data source — not hardcoded in the form component.
 */
const mountVocabBaseInfoRecordForm = (
  state: DesignerState,
  modalNodeId: string | null,
  categoryLabel: string,
  categoryId: string,
  dataSourceRef: string,
): DesignerState => {
  if (!modalNodeId) {
    return state;
  }
  const bodyId = findModalFormFieldsBodyId(state.document, modalNodeId);
  if (!bodyId) {
    return state;
  }

  let next = clearDesignerNodeChildren(state, bodyId);
  next = setProp(next, bodyId, 'className', DESIGNER_MODAL_FORM_BODY_CONTENT_CLASS);

  const inserted = insert(next, 'form.base-info-record', bodyId);
  next = setProp(inserted.state, inserted.nodeId, 'baseInfoRecordFixedParentId', categoryId);
  next = setProp(next, inserted.nodeId, 'baseInfoRecordParentLabel', categoryLabel);
  next = setProp(next, inserted.nodeId, 'baseInfoRecordDataSourceRef', dataSourceRef);
  next = setProp(next, inserted.nodeId, 'className', 'w-full min-w-0');
  return next;
};

// ---------------------------------------------------------------------------
// Vocabulary pages (manageable Base Info categories) — Designer Records pattern.
// ---------------------------------------------------------------------------

export const buildCmsVocabularyPage = (input: {
  pageName: string;
  title: string;
  categoryId: string;
  /** Active left-nav section — must match a CMS Settings section id. */
  settingsSectionId: Exclude<CmsSettingsSectionId, 'general'>;
  editable?: boolean;
}): CmsDesignerDraftBundle => {
  const editable = input.editable ?? true;
  const dataSource = buildVocabDataSource(input.title, input.categoryId, editable);

  let state = createRecordsPageState(input.title);
  state = designerReducer(state, { type: 'set-data-source', dataSourceId: dataSource.id, dataSource });

  const shell = mountCmsSettingsShell(state, input.settingsSectionId);
  state = shell.state;

  // Plan (hard): vocabulary catalog cards are title + concept color from
  // `base_info.ui_color` (seeded per short_name). Short name / Order / Active
  // stay filterable but cardRole=hidden. Row actions reveal on card hover.
  const columns: DesignerDataGridColumn[] = [
    {
      key: 'ui_color',
      label: '',
      cellKind: 'color-swatch',
      cardRole: 'meta',
      cardPriority: -1,
    },
    { key: 'title', label: 'Title', sort: true, cardRole: 'title' },
    { key: 'short_name', label: 'Short name', sort: true, cardRole: 'hidden' },
    { key: 'view_order', label: 'Order', sort: true, cardRole: 'hidden' },
    { key: 'is_active', label: 'Active', sort: true, cellKind: 'boolean-icon', cardRole: 'hidden' },
  ];

  const toolbarConfig: DesignerGridToolbarConfig = {
    enabled: true,
    search: { ...DEFAULT_GRID_TOOLBAR_SEARCH, placeholder: `Search ${input.title.toLowerCase()}…` },
    refresh: DEFAULT_GRID_TOOLBAR_REFRESH,
    listWhereFilter: false,
    create: editable
      ? { enabled: true, label: `Create ${input.title.replace(/s$/, '').toLowerCase()}`, icon: 'Plus', behavior: { kind: 'none' } }
      : undefined,
    serverQuery: {
      ...DEFAULT_GRID_SERVER_QUERY_CONFIG,
      enabled: true,
      columnFilters: [],
    },
  };

  // Base Info vocabularies are small catalogs — no paging footer; show up to 1000.
  const gridResult = standardGrid(state, shell.mainId, dataSource.id, columns, {
    searchPlaceholder: `Search ${input.title.toLowerCase()}…`,
    resourceLabel: input.title.toLowerCase(),
    defaultSortBy: 'view_order',
    primaryKey: 'id',
    toolbarConfig,
    presentation: 'cards',
    pagination: false,
    pageSize: 1000,
  });
  state = gridResult.state;

  if (!editable) {
    const bundle = finalizeDocument(state, input.pageName, FOLDER);
    return { ...bundle, document: patchDocumentPageShell(bundle.document) };
  }

  // Empty auto-form shells (region + footer); body uses shared Base Info record form.
  const built = appendRecordsCrudOverlays({
    state,
    gridNodeId: gridResult.gridId,
    dataSource,
    formFields: [],
    editFormFields: [],
    actions: { create: true, edit: true, delete: true },
    resourceLabel: input.title.replace(/s$/, ''),
    toolbarConfig,
  });
  state = built.state;
  state = mountVocabBaseInfoRecordForm(
    state,
    built.createModalNodeId,
    input.title,
    input.categoryId,
    dataSource.id,
  );
  state = mountVocabBaseInfoRecordForm(
    state,
    built.editModalNodeId,
    input.title,
    input.categoryId,
    dataSource.id,
  );

  let document = setModalSize(state.document, built.createModalNodeId, '5xl');
  document = setModalSize(document, built.editModalNodeId, '5xl');
  document = patchDocumentPageShell(document);
  return finalizeBuiltDocument(input.pageName, FOLDER, document, state.bindingDefinitions);
};

// ---------------------------------------------------------------------------
// Contents — list
// ---------------------------------------------------------------------------

const CMS_CONTENTS_LIST_FIELDS: ApiFormField[] = [
  { name: 'id', type: 'string', location: 'body', required: true },
  { name: 'title', type: 'string', location: 'body', required: true },
  { name: 'slug', type: 'string', location: 'body', required: true },
  { name: 'contentTypeCode', type: 'string', location: 'body', required: false },
  { name: 'languageCode', type: 'string', location: 'body', required: false },
  { name: 'bodyFormatCode', type: 'string', location: 'body', required: false },
  { name: 'statusCode', type: 'string', location: 'body', required: false },
  { name: 'statusCodeTitle', type: 'string', location: 'body', required: false },
  { name: 'statusCodeUiHtml', type: 'string', location: 'body', required: false },
  { name: 'statusCodeUiColor', type: 'string', location: 'body', required: false },
  { name: 'statusCodeUpdatedAt', type: 'string', location: 'body', required: false, format: 'date-time' },
  { name: 'commentCount', type: 'number', location: 'body', required: false },
  { name: 'createdAt', type: 'string', location: 'body', required: false, format: 'date-time' },
  { name: 'updatedAt', type: 'string', location: 'body', required: false, format: 'date-time' },
];

const buildContentsListDataSource = (): DataSourceDefinition => ({
  id: 'cmsContents',
  name: 'content',
  endpoint: '/api/cms/contents',
  primaryKey: 'id',
  fields: CMS_CONTENTS_LIST_FIELDS.map((field) => field.name),
  kind: 'collection',
  operations: {
    list: { method: 'GET', endpoint: '/api/cms/contents' },
    detail: { method: 'GET', endpoint: '/api/cms/contents/:id' },
    create: { method: 'POST', endpoint: '/api/cms/contents' },
    update: { method: 'PUT', endpoint: '/api/cms/contents/:id' },
    delete: { method: 'DELETE', endpoint: '/api/cms/contents/:id' },
  },
  responseMapping: {
    arrayPath: 'data',
    totalPath: 'count',
    dataPath: 'data',
  },
});

export const buildCmsContentsListDraft = (input: {
  filterOptions: import('./cmsIds').CmsFilterOptions;
  statusIds: { archived: string | null; draft: string | null };
  baseInfoCategoryIds: CmsBaseInfoCategoryIds;
}): CmsDesignerDraftBundle => {
  const dataSource = buildContentsListDataSource();
  const contentTypeFilterOptions = input.filterOptions.contentTypes
    .map((option) => ({ value: option.value, label: option.label }));
  const createDataSource: DataSourceDefinition = {
    id: 'cmsContentsCreate',
    name: 'new content',
    endpoint: '/api/cms/contents',
    fields: ['title', 'contentTypeCode', 'languageCode', 'bodyFormatCode', 'statusCode'],
    kind: 'record',
    operations: {
      create: { method: 'POST', endpoint: '/api/cms/contents' },
    },
  };

  let state = mergeCmsBaseInfoLovsIntoState(createRecordsPageState('Contents'), input.baseInfoCategoryIds);
  state = designerReducer(state, { type: 'set-data-source', dataSourceId: dataSource.id, dataSource });
  state = designerReducer(state, {
    type: 'set-data-source',
    dataSourceId: createDataSource.id,
    dataSource: createDataSource,
  });
  state = setDataSource(state, 'cmsRevisions', 'CMS Content Revisions', {
    endpoint: '/api/cms/revisions',
    primaryKey: 'id',
    fields: ['id', 'contentId', 'revisionNo', 'title', 'summary', 'body'],
    operations: {
      list: { method: 'GET', endpoint: '/api/cms/revisions' },
    },
  });
  const revisionHistory = appendRevisionHistoryModal(state, 'cmsRevisions', 'selection.id');
  state = revisionHistory.state;

  const columns: DesignerDataGridColumn[] = [
    {
      key: 'title',
      label: 'Title',
      sort: true,
      filter: true,
      filterType: 'text',
      cellKind: 'link',
      cellFields: { labelField: 'title', hrefTemplate: '/studio/cms/contents/edit/{id}' },
      cardRole: 'title',
    },
    {
      key: 'contentTypeCode',
      label: 'Type',
      sort: true,
      width: '120px',
      cellKind: 'lookup',
      cellFields: { labelField: 'contentTypeCodeTitle', labelFallbackField: 'contentTypeCode' },
      cardRole: 'field',
    },
    {
      key: 'languageCode',
      label: 'Language',
      sort: true,
      width: '120px',
      cellKind: 'lookup',
      cellFields: { labelField: 'languageCodeTitle', labelFallbackField: 'languageCode' },
      cardRole: 'field',
    },
    {
      key: 'statusCode',
      label: 'Status',
      sort: true,
      width: '120px',
      cellKind: 'status-badge',
      cellFields: {
        labelField: 'statusCodeTitle',
        labelFallbackField: 'statusCode',
        htmlField: 'statusCodeUiHtml',
        colorField: 'statusCodeUiColor',
        dateField: 'statusCodeUpdatedAt',
      },
      cardRole: 'meta',
    },
    {
      key: 'updatedAt',
      label: 'Timeline',
      sort: true,
      filter: true,
      filterType: 'dateRange',
      width: '120px',
      cellKind: 'audit',
      cellFields: {
        dateField: 'createdAt',
        secondaryDateField: 'updatedAt',
      },
      hideBelow: 'lg',
      cardRole: 'meta',
    },
  ];

  /** Default multi-select toolbar host is 20rem; CMS contents trims 50px per filter. */
  const cmsContentsToolbarMultiSelectHostClass = 'w-[270px] min-w-[270px] max-w-[334px]';

  const toolbarConfig: DesignerGridToolbarConfig = {
    enabled: true,
    search: { ...DEFAULT_GRID_TOOLBAR_SEARCH, placeholder: 'Search contents…' },
    refresh: DEFAULT_GRID_TOOLBAR_REFRESH,
    queryPresetChips: false,
    create: {
      enabled: true,
      label: 'Create content',
      icon: 'Plus',
      behavior: navigateBehavior('/studio/cms/contents/edit/new'),
    },
    fieldFilters: [
      {
        id: 'contentTypeCode',
        field: 'contentTypeCode',
        label: 'Content type',
        controlType: 'select',
        optionsSource: 'static',
        options: contentTypeFilterOptions,
        multiple: true,
        selectHostClassName: cmsContentsToolbarMultiSelectHostClass,
        storePath: 'gridToolbar.filters.contentTypeCode',
        apiParam: 'filter[contentTypeCode][in]',
      },
      {
        id: 'statusCode',
        field: 'statusCode',
        label: 'Status',
        controlType: 'select',
        optionsSource: 'lov',
        lovRef: CMS_BASE_INFO_LOV_IDS.statuses,
        multiple: true,
        selectHostClassName: cmsContentsToolbarMultiSelectHostClass,
        storePath: 'gridToolbar.filters.statusCode',
        apiParam: 'filter[statusCode][in]',
      },
    ],
    serverQuery: {
      ...DEFAULT_GRID_SERVER_QUERY_CONFIG,
      enabled: true,
      columnFilters: buildServerQueryColumnFiltersFromGridColumns(columns),
    },
  };

  const gridResult = standardGrid(state, state.document.rootNodeId, dataSource.id, columns, {
    searchPlaceholder: 'Search contents…',
    resourceLabel: 'records',
    defaultSortBy: 'updatedAt',
    defaultSortDirection: 'desc',
    primaryKey: 'id',
    toolbarConfig,
    listQueryParams: {
      view: 'static:summary',
    },
  });
  state = gridResult.state;

  // Seed server-query store so the first fetch already sorts (avoids unsorted→sorted flash on refresh).
  // gridToolbar (search + multi-select filters) always persists to localStorage at runtime.
  state = {
    ...state,
    bindingDefinitions: {
      ...state.bindingDefinitions,
      storeSegments: {
        ...state.bindingDefinitions.storeSegments,
        gridToolbar: {
          id: 'gridToolbar',
          persist: 'local',
          initialValue: {
            search: '',
            filters: {
              contentTypeCode: '',
              statusCode: '',
            },
          },
        },
        gridQuery: {
          id: 'gridQuery',
          initialValue: {
            sortBy: 'updatedAt',
            sortDir: 'desc',
            page: 1,
            pageSize: 50,
            filters: {},
          },
        },
      },
    },
  };

  const createChoiceRowClass = 'designer-choice-button-group flex w-full flex-row flex-wrap items-center gap-2';
  const createChoiceRowProps = {
    className: createChoiceRowClass,
    orientation: 'horizontal' as const,
  };
  const built = appendRecordsCrudOverlays({
    state,
    gridNodeId: gridResult.gridId,
    dataSource,
    createDataSource,
    formFields: [
      {
        field: { name: 'title', type: 'string', location: 'body', required: true },
        enabled: true,
        label: 'Title',
        controlPaletteItemId: 'heroui.input-text',
        controlProps: { placeholder: 'Enter content title…' },
      },
      {
        field: { name: 'contentTypeCode', type: 'string', location: 'body', required: true },
        enabled: true,
        label: 'Content type',
        controlPaletteItemId: 'heroui.radio-group',
        controlProps: {
          ariaLabel: 'Content type',
          ...createChoiceRowProps,
          sectionTone: 'indigo',
          sectionDivided: true,
        },
      },
      {
        field: { name: 'languageCode', type: 'string', location: 'body', required: true },
        enabled: true,
        label: 'Language',
        controlPaletteItemId: 'heroui.radio-group',
        controlProps: {
          ariaLabel: 'Language',
          ...createChoiceRowProps,
          sectionTone: 'violet',
          sectionDivided: true,
        },
      },
      {
        field: { name: 'bodyFormatCode', type: 'string', location: 'body', required: true },
        enabled: true,
        label: 'Content Format',
        controlPaletteItemId: 'heroui.radio-group',
        controlProps: {
          ariaLabel: 'Content Format',
          ...createChoiceRowProps,
          sectionTone: 'cyan',
          sectionDivided: true,
        },
      },
      // Status is not operator-chosen on create — always seed as Draft (hidden field still posts).
      {
        field: { name: 'statusCode', type: 'string', location: 'body', required: true },
        enabled: true,
        label: '',
        controlPaletteItemId: 'heroui.radio-group',
        controlProps: {
          ariaLabel: 'Status',
          className: 'hidden',
        },
      },
    ],
    actions: { create: true, edit: false, delete: true },
    resourceLabel: 'content',
    toolbarConfig,
    createSuccessBehaviors: ['toast'],
    createResponseStorePath: 'response',
    createNavigateTarget: '/studio/cms/contents/edit/{response.data.id}',
    actionColumnWidth: '75px',
    rowActions: [
      {
        actionId: 'revisions',
        icon: 'History',
        intent: 'view',
        tooltip: 'Revision history',
        behavior: openModalBehavior(revisionHistory.modalNodeId, 'id'),
      },
      {
        actionId: 'delete',
        icon: 'Trash2',
        intent: 'delete',
        tooltip: 'Delete',
        behavior: openModalBehavior('', 'id'),
      },
    ],
  });

  const optionValueByLabel = (
    options: Array<{ value: string; label: string }>,
    label: string,
  ): string => (
    options.find((option) => option.label.trim().toLowerCase() === label.toLowerCase())?.value ?? ''
  );
  const languageDefaults = Object.fromEntries(
    [
      ['en', 'English'],
      ['fa', 'Persian'],
      ['ar', 'Arabic'],
    ].flatMap(([language, label]) => {
      const value = optionValueByLabel(input.filterOptions.languages, label);
      return value ? [[language, value]] : [];
    }),
  );
  const builtWithCreateFormOptions = {
    ...built,
    state: {
      ...built.state,
      document: wireDocumentSelectFieldLovs(
        built.state.document,
        {
          contentTypeCode: optionValueByLabel(input.filterOptions.contentTypes, 'Article'),
          bodyFormatCode: optionValueByLabel(input.filterOptions.bodyFormats, 'HTML'),
          ...(input.statusIds.draft ? { statusCode: input.statusIds.draft } : {}),
        },
        { languageCode: languageDefaults },
      ),
    },
  };

  const statusOverlay = appendStatusPickerOverlay({
    state: builtWithCreateFormOptions.state,
    dataSourceId: dataSource.id,
    title: 'Change status',
    statusLovRef: CMS_BASE_INFO_LOV_IDS.statuses,
    mutationRecordIdStorePath: 'selection.id',
  });

  const deleteDialogId = built.deleteDialogNodeId;
  let document = patchGridColumns(statusOverlay.state.document, gridResult.gridId, (cols) => {
    const withoutChangeStatus = cols.filter(
      (column) => !(column.kind === 'action' && column.actionId === 'change-status'),
    );
    const withStatusClick = withoutChangeStatus.map((column) => (
      column.key === 'statusCode'
        ? {
          ...column,
          cellClickBehavior: openModalBehavior(statusOverlay.modalNodeId, 'id'),
        }
        : column
    ));
    const actionGroup = withStatusClick.find((column) => column.kind === 'action-group');
    const patchedGroup = actionGroup && actionGroup.actions
      ? {
        ...actionGroup,
        width: '75px',
        actions: actionGroup.actions.map((action) => (
          action.actionId === 'delete' && deleteDialogId
            ? { ...action, behavior: openModalBehavior(deleteDialogId, 'id') }
            : action
        )),
      }
      : actionGroup;
    if (!patchedGroup) {
      return withStatusClick;
    }
    return withStatusClick.map((column) => (
      column.kind === 'action-group' ? patchedGroup : column
    ));
  });

  document = patchDocumentPageShell(document);
  return finalizeBuiltDocument('cms-contents-list', FOLDER, document, statusOverlay.state.bindingDefinitions);
};

// ---------------------------------------------------------------------------
// Contents — editor (route: contents/edit/*)
// ---------------------------------------------------------------------------

const CMS_CONTENTS_FIELDS = [
  'id', 'title', 'slug', 'summary', 'body', 'contentTypeCode', 'languageCode',
  'statusCode', 'statusCodeUpdatedAt', 'statusCodeUpdatedBy', 'statusCodeUpdatedByUsername', 'bodyFormatCode',
  'commentCount', 'revisionCount',
  'tagSummary',
  'contentTypeCodeTitle', 'languageCodeTitle', 'statusCodeTitle', 'statusCodeUiHtml', 'statusCodeUiColor',
  'bodyFormatCodeTitle', 'bodyFormatCodeShortName',
  'commentsPolicyCodeTitle',
  'seoTitle', 'seoNote', 'publishedAt', 'operatorNote',
  'commentsEnabled', 'commentsPolicyCode', 'commentsBodyFormatCode',
  'createdBy', 'createdByUsername', 'createdAt', 'updatedBy', 'updatedByUsername', 'updatedAt',
];

const CMS_BODY_FORMAT_TITLES = {
  plain: 'Plain',
  markdown: 'Markdown',
  html: 'HTML',
} as const;

/**
 * Summary/Body editors switch on body format. Baked Base Info ids go stale after
 * a CMS re-seed (101.003.x vs 102.003.x), which hid every editor. Match id,
 * English title, and shortName; plain is the fallback so fields never vanish.
 */
export const cmsBodyFormatVisibleCondition = (
  format: keyof typeof CMS_BODY_FORMAT_TITLES,
  ids: { plain: string; markdown: string; html: string },
): string => {
  const title = CMS_BODY_FORMAT_TITLES[format];
  const idMatch = `data.bodyFormatCode === '${ids[format]}'`;
  const titleMatch = `data.bodyFormatCodeTitle === '${title}'`;
  const shortMatch = `data.bodyFormatCodeShortName === '${format}'`;
  if (format === 'plain') {
    return [
      '!data.bodyFormatCode',
      idMatch,
      titleMatch,
      shortMatch,
      `(data.bodyFormatCode !== '${ids.markdown}' && data.bodyFormatCode !== '${ids.html}' && data.bodyFormatCodeTitle !== 'Markdown' && data.bodyFormatCodeTitle !== 'HTML' && data.bodyFormatCodeShortName !== 'markdown' && data.bodyFormatCodeShortName !== 'html')`,
    ].join(' || ');
  }
  return `(${idMatch} || ${titleMatch} || ${shortMatch})`;
};

const applyCmsMarkdownEditorProps = (
  state: DesignerState,
  nodeId: string,
  label: string,
): DesignerState => {
  const toolbar = markdownToolbarProps('standard');
  let next = setProp(state, nodeId, 'label', label);
  next = setProp(next, nodeId, 'editorHeight', 220);
  next = setProp(next, nodeId, 'className', 'w-full');
  next = setProp(next, nodeId, 'showToolbar', toolbar.showToolbar);
  next = setProp(next, nodeId, 'enableHeading', toolbar.enableHeading);
  next = setProp(next, nodeId, 'enableLink', toolbar.enableLink);
  next = setProp(next, nodeId, 'enableCodeBlock', toolbar.enableCodeBlock);
  next = setProp(next, nodeId, 'enableImage', toolbar.enableImage);
  next = setProp(next, nodeId, 'enableTable', toolbar.enableTable);
  next = setProp(next, nodeId, 'enableTextDirection', toolbar.enableTextDirection);
  return next;
};

const setContentsDataSource = (state: DesignerState, dataSourceId: string): DesignerState => (
  setDataSource(state, dataSourceId, 'CMS Contents', {
    endpoint: '/api/cms/contents',
    primaryKey: 'id',
    fields: CMS_CONTENTS_FIELDS,
    operations: {
      list: { method: 'GET', endpoint: '/api/cms/contents' },
      detail: { method: 'GET', endpoint: '/api/cms/contents/:id' },
      create: { method: 'POST', endpoint: '/api/cms/contents' },
      update: { method: 'PUT', endpoint: '/api/cms/contents/:id' },
      delete: { method: 'DELETE', endpoint: '/api/cms/contents/:id' },
    },
  })
);

export const buildCmsContentsEditorDraft = (input: {
  bodyFormatIds: { plain: string; markdown: string; html: string };
  statusIds: { published: string | null; archived: string | null; draft: string | null };
  commentStatusIds: {
    approved: string | null;
    rejected: string | null;
    /** @deprecated Alias of rejected — Spam status retired from Base Info. */
    spam: string | null;
    /** @deprecated Alias of in_review — Pending status retired from Base Info. */
    pending: string | null;
  };
  commentTypeCode: string;
  filterOptions: import('./cmsIds').CmsFilterOptions;
  contentOptions: Array<{ value: string; label: string }>;
  baseInfoCategoryIds: CmsBaseInfoCategoryIds;
}): CmsDesignerDraftBundle => {
  const dataSourceId = 'cmsContents';
  let state = mergeCmsBaseInfoLovsIntoState(
    disablePublishedFormAssist(createInitialDesignerState('Content Editor')),
    input.baseInfoCategoryIds,
  );
  state = setContentsDataSource(state, dataSourceId);
  state = setDataSource(state, 'cmsContentAssets', 'CMS Content Assets', {
    endpoint: '/api/cms/assets',
    primaryKey: 'id',
    fields: [
      'id', 'contentId', 'fileName', 'fileMime', 'fileSize', 'file', 'fileXs', 'sha256',
      'sortOrder', 'createdAt', 'updatedAt',
    ],
    operations: {
      list: { method: 'GET', endpoint: '/api/cms/assets' },
      create: { method: 'POST', endpoint: '/api/cms/assets' },
      update: { method: 'PUT', endpoint: '/api/cms/assets/:id' },
      delete: { method: 'DELETE', endpoint: '/api/cms/assets/:pk' },
    },
  });
  state = setDataSource(state, 'cmsContentRelations', 'CMS Content Relations', {
    endpoint: '/api/cms/relations',
    primaryKey: 'id',
    fields: [
      'id', 'contentIdA', 'contentIdATitle', 'contentIdASlug',
      'contentIdB', 'contentIdBTitle', 'contentIdBSlug', 'note',
    ],
    operations: {
      list: { method: 'GET', endpoint: '/api/cms/relations' },
      create: { method: 'POST', endpoint: '/api/cms/relations' },
      update: { method: 'PUT', endpoint: '/api/cms/relations/:id' },
      delete: { method: 'DELETE', endpoint: '/api/cms/relations/:id' },
    },
  });
  state = setDataSource(state, 'cmsContentTags', 'CMS Content Tags', {
    endpoint: '/api/cms/tags',
    primaryKey: 'id',
    fields: ['id', 'contentId', 'tagCode', 'tagCodeTitle'],
    operations: {
      list: { method: 'GET', endpoint: '/api/cms/tags' },
      create: { method: 'POST', endpoint: '/api/cms/tags' },
      update: { method: 'PUT', endpoint: '/api/cms/tags/:id' },
      delete: { method: 'DELETE', endpoint: '/api/cms/tags/:id' },
    },
  });

  const commentsOverlay = appendContentCommentsModerationModal(
    state,
    'routeParams.id',
    input.commentTypeCode,
    input.commentStatusIds,
  );
  state = commentsOverlay.state;
  const page = styledLayout(
    state,
    state.document.rootNodeId,
    'layout.flex-column',
    'flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-white',
  );
  state = page.state;
  const identityBar = styledLayout(
    state,
    page.nodeId,
    'layout.flex-row',
    'flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-3 py-2.5 sm:px-5',
  );
  state = identityBar.state;
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: identityBar.nodeId,
    bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
    definition: createRegionDataSourceBindingDefinition(dataSourceId, {
      loadOperation: 'detail',
      urlParams: { id: 'routeParams.id' },
    }),
  });
  // Exact Data Studio modeler control: runtime renders shared `WorkspaceBackIcon`
  // (ArrowLeft h-6 / hit target h-8) when `workspaceBack` is set — not a HeroUI Button.
  const backButton = insert(state, 'heroui.button-outline', identityBar.nodeId);
  state = setProp(backButton.state, backButton.nodeId, 'text', 'Back');
  state = setProp(state, backButton.nodeId, 'workspaceBack', true);
  state = setProp(state, backButton.nodeId, 'aria-label', 'Back to Contents');
  state = setProp(state, backButton.nodeId, 'title', 'Back to list');
  // Clear palette default Button chrome — WorkspaceBackIcon owns its own classes.
  state = setProp(state, backButton.nodeId, 'className', '');
  state = setProp(state, backButton.nodeId, 'twPadding', '');
  state = setProp(state, backButton.nodeId, 'twRounded', '');
  state = setProp(state, backButton.nodeId, 'twTextSize', '');
  state = setProp(state, backButton.nodeId, 'twFontWeight', '');
  const backNavigate = createDynamicAction('navigate');
  backNavigate.navigateTarget = '/studio/cms/contents';
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: backButton.nodeId,
    bindingKey: eventBindingKeyForEvent('onClick'),
    definition: createDynamicActionsEventBindingDefinition('onClick', [backNavigate]),
  });

  // Content-header item identity (deep-linking): truncated title + record id.
  // Shell stays `{group} / Contents`; identity lives here beside WorkspaceBackIcon.
  const identityCluster = styledLayout(
    state,
    identityBar.nodeId,
    'layout.flex-row',
    'flex min-w-0 flex-1 items-center gap-2 overflow-hidden',
  );
  state = identityCluster.state;
  state = boundText(
    state,
    identityCluster.nodeId,
    'title',
    'm-0 min-w-0 truncate text-sm font-semibold leading-none text-slate-800',
  );
  const identitySep = insert(state, 'html.text', identityCluster.nodeId);
  state = setProp(identitySep.state, identitySep.nodeId, 'text', '·');
  state = setProp(
    state,
    identitySep.nodeId,
    'className',
    'shrink-0 text-slate-300',
  );
  const identityIdPrefix = insert(state, 'html.text', identityCluster.nodeId);
  state = setProp(identityIdPrefix.state, identityIdPrefix.nodeId, 'text', '#');
  state = setProp(
    state,
    identityIdPrefix.nodeId,
    'className',
    'shrink-0 font-mono text-xs font-medium leading-none text-slate-500',
  );
  state = boundText(
    state,
    identityCluster.nodeId,
    'id',
    'm-0 shrink-0 font-mono text-xs font-medium leading-none text-slate-500',
  );

  const workspace = styledLayout(
    state,
    page.nodeId,
    'layout.grid-2',
    'grid min-h-0 flex-1 gap-0 overflow-hidden bg-white',
  );
  state = setProp(
    workspace.state,
    workspace.nodeId,
    'layoutGridColumnWidths',
    JSON.stringify([{ value: '1', unit: 'fr' }, { value: '320', unit: 'px' }]),
  );
  const workspaceSlots = prepareGridSlots(state, workspace.nodeId);
  state = workspaceSlots.state;

  // Rail is built before main — main-column controls reference rail modal node ids,
  // and the rail itself hosts every read-only /
  // referential section (Tags/Identity/Last State/Related contents/
  // Operator note/Audit trail) per the round 14 layout. Comments open from a top-of-rail
  // link into a dialog (not an inline rail section). Main is writable content only
  // (Title/Summary/Body, then Assets below body in the same scroll).
  const sidebar = styledLayout(
    state,
    workspaceSlots.slotIds[1]!,
    'layout.flex-column',
    'flex h-full min-h-0 min-w-0 flex-col gap-3 overflow-y-auto border-s border-slate-200 bg-slate-50 px-3 pb-4 pt-[10px]',
  );
  state = sidebar.state;

  // Top-of-rail Comments + Comments policy (icon-only) → dialogs.
  const commentsRailRow = styledLayout(
    state,
    sidebar.nodeId,
    'layout.flex-row',
    'flex w-full shrink-0 items-center gap-1.5',
  );
  state = commentsRailRow.state;

  const commentsRailLink = insert(state, 'heroui.button-outline', commentsRailRow.nodeId);
  state = setProp(commentsRailLink.state, commentsRailLink.nodeId, 'text', 'Comments');
  state = setProp(state, commentsRailLink.nodeId, 'icon', 'MessageSquare');
  state = setProp(state, commentsRailLink.nodeId, 'type', 'button');
  state = setProp(state, commentsRailLink.nodeId, 'aria-label', 'Open comments');
  state = setProp(state, commentsRailLink.nodeId, 'title', 'Open comments');
  state = setProp(
    state,
    commentsRailLink.nodeId,
    'className',
    'inline-flex h-8 min-w-0 flex-1 items-center justify-start gap-1.5 rounded-md border border-violet-200 bg-violet-50 px-2.5 text-xs font-semibold text-violet-700 outline-none transition-colors hover:bg-violet-100',
  );
  // Refresh before show — create after-hooks are fire-and-forget, so the first hydrate on
  // editor open often races the auto-comment insert and caches an empty list.
  const refreshCommentsList = createDynamicAction('refreshDataSource');
  refreshCommentsList.dataSourceRef = 'cmsContentComments';
  const openCommentsDialog = createDynamicAction('showHide');
  openCommentsDialog.targetNodeId = commentsOverlay.modalNodeId;
  openCommentsDialog.showHideEffect = 'show';
  state = stripOutlineButtonLinkChrome(state, commentsRailLink.nodeId);
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: commentsRailLink.nodeId,
    bindingKey: eventBindingKeyForEvent('onClick'),
    definition: createDynamicActionsEventBindingDefinition('onClick', [
      refreshCommentsList,
      openCommentsDialog,
    ]),
  });

  const preferencesRailButton = insert(state, 'heroui.button-outline', commentsRailRow.nodeId);
  state = setProp(preferencesRailButton.state, preferencesRailButton.nodeId, 'text', 'Comments policy');
  state = setProp(state, preferencesRailButton.nodeId, 'icon', 'SlidersHorizontal');
  state = setProp(state, preferencesRailButton.nodeId, 'isIconOnly', true);
  state = setProp(state, preferencesRailButton.nodeId, 'type', 'button');
  state = setProp(state, preferencesRailButton.nodeId, 'aria-label', 'Comments policy');
  state = setProp(state, preferencesRailButton.nodeId, 'title', 'Comments policy');
  state = setProp(
    state,
    preferencesRailButton.nodeId,
    'className',
    'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-violet-200 bg-violet-50 text-violet-700 outline-none transition-colors hover:bg-violet-100',
  );
  const preferencesRailTriggerId = preferencesRailButton.nodeId;

  const main = styledLayout(
    state,
    workspaceSlots.slotIds[0]!,
    'layout.flex-column',
    'flex min-w-0 flex-1 flex-col overflow-hidden bg-white',
  );
  state = main.state;

  const { state: s1, nodeId: formId } = insert(state, 'html.form', main.nodeId);
  state = setProp(s1, formId, 'className', 'flex h-full min-h-0 min-w-0 flex-col overflow-hidden');
  state = setProp(state, formId, 'id', 'cms-content-editor-form');
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: formId,
    bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
    definition: createRegionDataSourceBindingDefinition(dataSourceId, {
      loadOperation: 'detail',
      urlParams: { id: 'routeParams.id' },
    }),
  });
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: formId,
    bindingKey: eventBindingKeyForEvent('onSubmit'),
    definition: createRegionSubmitEventBindingDefinition('onSubmit', {
      trueActions: buildSubmitSuccessActions('Content saved.', dataSourceId),
    }),
  });

  const formScroll = styledLayout(
    state,
    formId,
    'layout.flex-column',
    // Match Data Studio modeler main inset, slightly tighter than px-6 / sm:px-8 (−5px).
    'flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto bg-white px-[19px] py-5 sm:px-[27px]',
  );
  state = formScroll.state;

  const contentStack = styledLayout(
    state,
    formScroll.nodeId,
    'layout.flex-column',
    'flex flex-col gap-2',
  );
  state = contentStack.state;
  const contentBodyId = contentStack.nodeId;
  state = textField(state, contentBodyId, 'title', 'Title');
  const { state: summaryPlainState, nodeId: summaryPlainId } = insert(
    state,
    'heroui.textarea',
    contentBodyId,
  );
  state = setProp(summaryPlainState, summaryPlainId, 'label', 'Summary');
  state = setProp(state, summaryPlainId, 'rows', 2);
  state = bindValue(state, summaryPlainId, 'summary');
  state = designerReducer(state, {
    type: 'set-node-visible-condition',
    nodeId: summaryPlainId,
    visibleCondition: cmsBodyFormatVisibleCondition('plain', input.bodyFormatIds),
  });

  const { state: summaryMarkdownState, nodeId: summaryMarkdownId } = insert(
    state,
    'form.markdown-editor',
    contentBodyId,
  );
  state = applyCmsMarkdownEditorProps(summaryMarkdownState, summaryMarkdownId, 'Summary (markdown)');
  state = bindValue(state, summaryMarkdownId, 'summary');
  state = designerReducer(state, {
    type: 'set-node-visible-condition',
    nodeId: summaryMarkdownId,
    visibleCondition: cmsBodyFormatVisibleCondition('markdown', input.bodyFormatIds),
  });

  const { state: summaryHtmlState, nodeId: summaryHtmlId } = insert(
    state,
    'form.html-editor',
    contentBodyId,
  );
  state = setProp(summaryHtmlState, summaryHtmlId, 'label', 'Summary (html)');
  state = setProp(state, summaryHtmlId, 'editorHeight', 220);
  state = setProp(state, summaryHtmlId, 'enableCodeBlock', true);
  state = setProp(state, summaryHtmlId, 'enableTextDirection', true);
  state = setProp(state, summaryHtmlId, 'className', 'w-full');
  state = bindValue(state, summaryHtmlId, 'summary');
  state = designerReducer(state, {
    type: 'set-node-visible-condition',
    nodeId: summaryHtmlId,
    visibleCondition: cmsBodyFormatVisibleCondition('html', input.bodyFormatIds),
  });

  const { state: sPlain, nodeId: plainId } = insert(state, 'heroui.textarea', contentBodyId);
  state = sPlain;
  state = setProp(state, plainId, 'label', 'Body (plain)');
  state = setProp(state, plainId, 'rows', 5);
  state = setProp(state, plainId, 'className', 'h-[7.5rem] min-h-[7.5rem] max-h-[7.5rem]');
  state = bindValue(state, plainId, 'body');
  state = designerReducer(state, {
    type: 'set-node-visible-condition',
    nodeId: plainId,
    visibleCondition: cmsBodyFormatVisibleCondition('plain', input.bodyFormatIds),
  });

  const { state: sMd, nodeId: mdId } = insert(state, 'form.markdown-editor', contentBodyId);
  state = applyCmsMarkdownEditorProps(sMd, mdId, 'Body (markdown)');
  state = bindValue(state, mdId, 'body');
  state = designerReducer(state, {
    type: 'set-node-visible-condition',
    nodeId: mdId,
    visibleCondition: cmsBodyFormatVisibleCondition('markdown', input.bodyFormatIds),
  });

  const { state: sHtml, nodeId: htmlId } = insert(state, 'form.html-editor', contentBodyId);
  state = sHtml;
  state = setProp(state, htmlId, 'label', 'Body (html)');
  state = setProp(state, htmlId, 'editorHeight', 220);
  state = setProp(state, htmlId, 'enableCodeBlock', true);
  state = setProp(state, htmlId, 'enableTextDirection', true);
  state = setProp(state, htmlId, 'className', 'w-full');
  state = bindValue(state, htmlId, 'body');
  state = designerReducer(state, {
    type: 'set-node-visible-condition',
    nodeId: htmlId,
    visibleCondition: cmsBodyFormatVisibleCondition('html', input.bodyFormatIds),
  });

  // Assets — single upload (top-right); Images / Files stay split in the component.
  const assetsField = insert(state, 'form.cms-content-assets', formScroll.nodeId);
  state = setProp(assetsField.state, assetsField.nodeId, 'className', 'w-full min-w-0 pt-3');
  state = setProp(state, assetsField.nodeId, 'cmsContentAssetsDataSourceRef', 'cmsContentAssets');
  state = setProp(state, assetsField.nodeId, 'cmsContentAssetsContentIdPath', 'routeParams.id');

  // ---------------------------------------------------------------------------
  // Rail (sidebar) — read-only metadata + referential sections, in the round 14
  // order: Tags -> Identity -> Last State -> Related contents
  // -> Operator note -> Audit trail. Comments live behind the top-of-rail
  // link (dialog). Preferences and SEO open from the top header bar (dialog).
  // Every section is its own FormSection (matches EdgeModelModelerSidePanel.tsx);
  // empty operator note uses the clickable dashed-placeholder pattern
  // (MODELER_EMPTY_STATE_CLASS analogue); Tags use inline RelationTagsListControl;
  // Related contents use a merged inline list (no twin empty grids).

  // Tags — inline RelationTagsListControl (Base Components belongs-to-many pattern).
  const tagsSection = formSection(state, sidebar.nodeId, 'Tags', 'violet', true);
  state = tagsSection.state;
  const tagsList = insert(state, 'form.relation-tags-list', tagsSection.bodyId);
  state = setProp(tagsList.state, tagsList.nodeId, 'className', 'w-full min-w-0');
  state = setProp(state, tagsList.nodeId, 'relationTagsDataSourceRef', 'cmsContentTags');
  state = setProp(state, tagsList.nodeId, 'relationTagsContentIdPath', 'routeParams.id');
  state = setProp(state, tagsList.nodeId, 'relationTagsValueField', 'tagCode');
  state = setProp(state, tagsList.nodeId, 'relationTagsRowKeyField', 'id');
  state = setProp(state, tagsList.nodeId, 'relationTagsSelectPlacement', 'inline');
  state = setProp(state, tagsList.nodeId, 'relationTagsPlaceholder', 'Add tag…');
  state = setProp(
    state,
    tagsList.nodeId,
    'relationTagsOptions',
    JSON.stringify(input.filterOptions.contentTags.map((option) => ({
      id: option.value,
      label: option.label,
    }))),
  );

  const identitySection = formSection(state, sidebar.nodeId, 'Identity', 'slate');
  state = identitySection.state;
  state = setProp(
    state,
    identitySection.headerId,
    'className',
    'flex min-h-4 items-center justify-between gap-1 ps-[4px]',
  );
  const identityEditTrigger = insert(state, 'heroui.button-outline', identitySection.headerId);
  state = setProp(identityEditTrigger.state, identityEditTrigger.nodeId, 'text', 'Edit');
  state = setProp(state, identityEditTrigger.nodeId, 'icon', 'Pencil');
  state = setProp(state, identityEditTrigger.nodeId, 'type', 'button');
  state = setProp(state, identityEditTrigger.nodeId, 'aria-label', 'Edit identity');
  state = setProp(state, identityEditTrigger.nodeId, 'title', 'Edit identity');
  state = setProp(
    state,
    identityEditTrigger.nodeId,
    'className',
    'inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded border border-slate-200 bg-white px-1.5 text-[12px] font-semibold leading-none text-slate-700 outline-none hover:bg-slate-50 [&>svg]:block [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0',
  );
  const identityEditTriggerId = identityEditTrigger.nodeId;

  const { state: identityFormState, nodeId: identityFormId } = insert(
    state,
    'html.form',
    identitySection.bodyId,
  );
  state = setProp(identityFormState, identityFormId, 'className', 'flex min-w-0 flex-col gap-2');
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: identityFormId,
    bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
    definition: createRegionDataSourceBindingDefinition(dataSourceId, {
      loadOperation: 'detail',
      urlParams: { id: 'routeParams.id' },
    }),
  });
  state = metaField(state, identityFormId, 'Content ID', 'id', { inline: true });
  state = metaField(state, identityFormId, 'Content type', 'contentTypeCodeTitle', { inline: true });
  state = metaField(state, identityFormId, 'Language', 'languageCodeTitle', { inline: true });

  const publicationSection = formSection(state, sidebar.nodeId, 'Last State', 'emerald', true);
  state = publicationSection.state;
  state = setProp(
    state,
    publicationSection.headerId,
    'className',
    'flex min-h-4 items-center justify-between gap-1 ps-[4px]',
  );
  const changeStatusTrigger = insert(state, 'heroui.button-outline', publicationSection.headerId);
  state = setProp(changeStatusTrigger.state, changeStatusTrigger.nodeId, 'text', 'Change');
  state = setProp(state, changeStatusTrigger.nodeId, 'icon', 'RefreshCw');
  state = setProp(state, changeStatusTrigger.nodeId, 'type', 'button');
  state = setProp(state, changeStatusTrigger.nodeId, 'aria-label', 'Change status');
  state = setProp(state, changeStatusTrigger.nodeId, 'title', 'Change status');
  state = setProp(
    state,
    changeStatusTrigger.nodeId,
    'className',
    'inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded border border-slate-200 bg-white px-1.5 text-[12px] font-semibold leading-none text-slate-700 outline-none hover:bg-slate-50 [&>svg]:block [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0',
  );
  const statusTriggerId = changeStatusTrigger.nodeId;

  const { state: publicationFormState, nodeId: publicationFormId } = insert(
    state,
    'html.form',
    publicationSection.bodyId,
  );
  state = setProp(publicationFormState, publicationFormId, 'className', 'flex min-w-0 flex-col gap-2');
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: publicationFormId,
    bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
    definition: createRegionDataSourceBindingDefinition(dataSourceId, {
      loadOperation: 'detail',
      urlParams: { id: 'routeParams.id' },
    }),
  });
  const statusRow = styledLayout(
    state,
    publicationFormId,
    'layout.flex-row',
    'flex min-w-0 items-center justify-between gap-3 overflow-hidden ps-[4px]',
  );
  const statusLabel = insert(statusRow.state, 'html.text', statusRow.nodeId);
  state = setProp(statusLabel.state, statusLabel.nodeId, 'text', 'Status');
  state = setProp(
    state,
    statusLabel.nodeId,
    'className',
    'text-[11px] font-normal normal-case tracking-normal text-slate-500',
  );
  const statusDisplay = insert(state, 'heroui.button-outline', statusRow.nodeId);
  state = setProp(statusDisplay.state, statusDisplay.nodeId, 'text', 'Status');
  state = setProp(state, statusDisplay.nodeId, 'icon', 'CircleDot');
  state = setProp(state, statusDisplay.nodeId, 'contentStatusTrigger', true);
  state = setProp(state, statusDisplay.nodeId, 'contentStatusDisplay', true);
  state = setProp(state, statusDisplay.nodeId, 'type', 'button');
  state = setProp(state, statusDisplay.nodeId, 'tabIndex', -1);
  state = setProp(state, statusDisplay.nodeId, 'aria-label', 'Current status');
  state = stripOutlineButtonLinkChrome(state, statusDisplay.nodeId);
  state = setProp(
    state,
    statusDisplay.nodeId,
    'className',
    'pointer-events-none inline-flex shrink-0 items-center justify-end gap-1 border-0 bg-transparent p-0 text-[11px] font-semibold leading-none shadow-none',
  );
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: statusDisplay.nodeId,
    bindingKey: propertyBindingKeyForProp('text'),
    definition: createRegionColumnBindingDefinition('text', 'statusCodeTitle'),
  });
  state = metaField(state, publicationFormId, 'Updated at', 'statusCodeUpdatedAt', { inline: true });
  state = metaField(
    state,
    publicationFormId,
    'Updated by',
    'statusCodeUpdatedByUsername',
    { inline: true },
  );

  // Related contents: header Add + merged inline list (single query union, no duplicate grids).
  const relatedSection = formSection(state, sidebar.nodeId, 'Related contents', 'emerald', true);
  state = setProp(
    relatedSection.state,
    relatedSection.headerId,
    'className',
    'flex min-h-4 items-center justify-between gap-1 ps-[4px]',
  );
  state = setProp(state, relatedSection.bodyId, 'className', 'flex min-w-0 flex-col gap-0');
  const relatedAddButton = insert(state, 'heroui.button-outline', relatedSection.headerId);
  state = setProp(relatedAddButton.state, relatedAddButton.nodeId, 'text', 'Add');
  state = setProp(state, relatedAddButton.nodeId, 'icon', 'Plus');
  state = setProp(state, relatedAddButton.nodeId, 'type', 'button');
  state = setProp(
    state,
    relatedAddButton.nodeId,
    'className',
    'inline-flex h-6 shrink-0 items-center justify-center gap-1 rounded border border-slate-200 bg-white px-1.5 text-[12px] font-semibold leading-none text-slate-700 outline-none hover:bg-slate-50 [&>svg]:block [&>svg]:h-3 [&>svg]:w-3 [&>svg]:shrink-0',
  );
  const relatedAddTriggerId = relatedAddButton.nodeId;

  const relationColumnsA: DesignerDataGridColumn[] = [
    {
      key: 'contentIdBTitle',
      label: 'Related content',
      cellKind: 'link',
      cellFields: {
        labelField: 'contentIdBTitle',
        labelFallbackField: 'contentIdB',
        hrefTemplate: '/studio/cms/contents/edit/{contentIdB}',
      },
      cardRole: 'title',
    },
  ];
  const relationToolbar: DesignerGridToolbarConfig = { enabled: false };
  const hiddenRelationGrid = standardGrid(state, relatedSection.bodyId, 'cmsContentRelations', relationColumnsA, {
    searchPlaceholder: 'Search related contents…',
    resourceLabel: 'related contents',
    defaultSortBy: 'id',
    primaryKey: 'id',
    toolbarConfig: relationToolbar,
    presentation: 'cards',
    pagination: false,
    pageSize: 100,
    listQueryParams: { 'filter[contentIdA][eq]': 'routeParams.id' },
  });
  state = setProp(hiddenRelationGrid.state, hiddenRelationGrid.gridId, 'className', 'hidden');
  state = setProp(state, hiddenRelationGrid.gridId, 'emptyContent', '');
  state = setProp(state, hiddenRelationGrid.gridId, 'loadingMessage', '');
  state = setProp(state, hiddenRelationGrid.gridId, 'errorContent', '');

  const relatedList = insert(state, 'form.related-contents-list', relatedSection.bodyId);
  state = setProp(relatedList.state, relatedList.nodeId, 'className', 'w-full min-w-0');
  state = setProp(state, relatedList.nodeId, 'relatedContentsDataSourceRef', 'cmsContentRelations');
  state = setProp(state, relatedList.nodeId, 'relatedContentsContentIdPath', 'routeParams.id');

  const relationDataSource = state.bindingDefinitions.dataSources.cmsContentRelations;
  if (!relationDataSource) {
    throw new Error('CMS content relations data source was not registered.');
  }
  const relationsBuilt = appendRecordsCrudOverlays({
    state,
    gridNodeId: hiddenRelationGrid.gridId,
    dataSource: relationDataSource,
    // Create UI is owned by RelatedContentPickerDialog (maximized + header search + Select).
    // Keep a create modal node only as the Add-button visibility store host.
    formFields: [],
    actions: { create: true, edit: false, delete: true },
    resourceLabel: 'relation',
    toolbarConfig: relationToolbar,
  });
  state = relationsBuilt.state;
  state = setProp(state, relatedList.nodeId, 'relatedContentsCreateModalNodeId', relationsBuilt.createModalNodeId ?? '');
  state = setProp(state, relatedList.nodeId, 'relatedContentsOptionsDataSourceRef', 'cmsContents');
  state = setProp(state, relatedList.nodeId, 'relatedContentsExcludeContentTypeCode', input.commentTypeCode);
  state = setProp(
    state,
    relatedList.nodeId,
    'relatedContentsContentOptions',
    JSON.stringify(input.contentOptions.map((option) => ({
      id: option.value,
      label: option.label,
    }))),
  );

  // Header Add opens the create modal (toolbar is intentionally off).
  if (relationsBuilt.createModalNodeId) {
    const openRelatedCreate = createDynamicAction('showHide');
    openRelatedCreate.targetNodeId = relationsBuilt.createModalNodeId;
    openRelatedCreate.showHideEffect = 'show';
    state = stripOutlineButtonLinkChrome(state, relatedAddTriggerId);
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: relatedAddTriggerId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [openRelatedCreate]),
    });

    let relationDocument = setModalSize(state.document, relationsBuilt.createModalNodeId, 'maximized');
    const createModal = relationDocument.nodes[relationsBuilt.createModalNodeId];
    if (createModal) {
      relationDocument = {
        ...relationDocument,
        nodes: {
          ...relationDocument.nodes,
          [relationsBuilt.createModalNodeId]: {
            ...createModal,
            props: {
              ...createModal.props,
              size: 'maximized',
              relatedContentPickerHost: true,
              title: 'Create relation',
            },
          },
        },
      };
    }
    state = {
      ...state,
      document: relationDocument,
    };
  }

  const operatorNoteSection = formSection(state, sidebar.nodeId, 'Operator note', 'slate', true);
  state = operatorNoteSection.state;
  const operatorNoteForm = insert(state, 'html.form', operatorNoteSection.bodyId);
  state = setProp(operatorNoteForm.state, operatorNoteForm.nodeId, 'className', 'min-w-0');
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: operatorNoteForm.nodeId,
    bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
    definition: createRegionDataSourceBindingDefinition(dataSourceId, {
      loadOperation: 'detail',
      urlParams: { id: 'routeParams.id' },
    }),
  });
  const operatorNoteField = clickableNoteField(
    state,
    operatorNoteForm.nodeId,
    'operatorNote',
    'No operator note yet. Click to add one.',
  );
  state = operatorNoteField.state;
  const operatorNoteTriggerId = operatorNoteField.triggerNodeId;

  const auditSection = formSection(state, sidebar.nodeId, 'Audit trail', 'amber', true);
  state = auditSection.state;
  const { state: auditFormState, nodeId: auditFormId } = insert(state, 'html.form', auditSection.bodyId);
  state = setProp(auditFormState, auditFormId, 'className', 'flex min-w-0 flex-col gap-2');
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: auditFormId,
    bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
    definition: createRegionDataSourceBindingDefinition(dataSourceId, {
      loadOperation: 'detail',
      urlParams: { id: 'routeParams.id' },
    }),
  });
  state = metaField(state, auditFormId, 'Created at', 'createdAt', { inline: true });
  state = metaField(state, auditFormId, 'Created by', 'createdByUsername', { inline: true });
  state = metaField(state, auditFormId, 'Updated at', 'updatedAt', { inline: true });
  state = metaField(state, auditFormId, 'Updated by', 'updatedByUsername', { inline: true });

  // Status changes on the editor open a single "Change status" dialog (select + save).
  // The Contents list uses the same standalone status modal pattern per row.

  const contentsDataSource = state.bindingDefinitions.dataSources[dataSourceId];
  if (!contentsDataSource) {
    throw new Error('CMS contents data source was not registered.');
  }
  // NOTE (plan rule 4/20 — hard): body format is chosen once at create time and is
  // permanently locked afterwards. `bodyFormatCode` must never appear in this (or
  // any) edit form — deliberately excluded from formFields below.
  const identityOverlay = appendStandaloneEditOverlay({
    state,
    dataSource: contentsDataSource,
    title: 'Edit content identity',
    submitLabel: 'Save identity',
    formFields: [
      {
        field: { name: 'contentTypeCode', type: 'string', location: 'body', required: true },
        enabled: true,
        label: 'Content Type',
        controlPaletteItemId: 'heroui.select',
      },
      {
        field: { name: 'languageCode', type: 'string', location: 'body', required: true },
        enabled: true,
        label: 'Language',
        controlPaletteItemId: 'heroui.select',
      },
    ],
  });
  state = {
    ...identityOverlay.state,
    document: wireDocumentSelectFieldLovs(identityOverlay.state.document),
  };

  const seoOverlay = appendStandaloneEditOverlay({
    state,
    dataSource: contentsDataSource,
    title: 'Edit SEO details',
    submitLabel: 'Save SEO',
    formFields: [
      {
        field: { name: 'slug', type: 'string', location: 'body', required: true },
        enabled: true,
        label: 'Slug',
        controlPaletteItemId: 'heroui.input-text',
      },
      {
        field: { name: 'seoTitle', type: 'string', location: 'body', required: false },
        enabled: true,
        label: 'SEO title',
        controlPaletteItemId: 'heroui.input-text',
      },
      {
        field: { name: 'seoNote', type: 'string', location: 'body', required: false },
        enabled: true,
        label: 'SEO description',
        controlPaletteItemId: 'heroui.textarea',
      },
    ],
  });
  state = {
    ...seoOverlay.state,
    document: {
      ...seoOverlay.state.document,
      nodes: Object.fromEntries(Object.entries(seoOverlay.state.document.nodes).map(([nodeId, node]) => {
        const column = Object.values(node.binding).find(
          (definition) => definition?.sourceType === 'regionColumn',
        )?.column;
        if (column !== 'slug') {
          return [nodeId, node];
        }
        return [
          nodeId,
          {
            ...node,
            props: {
              ...node.props,
              // Latin URL segment — keep LTR regardless of surrounding locale.
              autoDir: false,
            },
          },
        ];
      })),
    },
  };

  const operatorNoteOverlay = appendStandaloneEditOverlay({
    state,
    dataSource: contentsDataSource,
    title: 'Edit operator note',
    submitLabel: 'Save note',
    formFields: [{
      field: { name: 'operatorNote', type: 'string', location: 'body', required: false },
      enabled: true,
      label: '',
      controlPaletteItemId: 'heroui.textarea',
      controlProps: {
        placeholder: 'Operator note',
        minRows: 7,
        className: 'min-h-40 w-full',
      },
    }],
  });
  const operatorNoteModal = operatorNoteOverlay.state.document.nodes[operatorNoteOverlay.modalNodeId]!;
  state = {
    ...operatorNoteOverlay.state,
    document: {
      ...operatorNoteOverlay.state.document,
      nodes: {
        ...operatorNoteOverlay.state.document.nodes,
        [operatorNoteOverlay.modalNodeId]: {
          ...operatorNoteModal,
          props: {
            ...operatorNoteModal.props,
            size: 'xl',
          },
        },
      },
    },
  };

  // Preferences dialog — independent PUT of override fields only (NULL = inherit Settings).
  const commentBodyFormats = input.filterOptions.bodyFormats.filter(
    (option) => option.value === input.bodyFormatIds.plain || option.value === input.bodyFormatIds.html,
  );
  const preferencesOverlay = appendStandaloneEditOverlay({
    state,
    dataSource: contentsDataSource,
    title: 'Content preferences',
    submitLabel: 'Save preferences',
    formFields: [
      {
        field: { name: 'commentsEnabled', type: 'string', location: 'body', required: false },
        enabled: true,
        label: 'Comments',
        controlPaletteItemId: 'heroui.select',
      },
      {
        field: { name: 'commentsPolicyCode', type: 'string', location: 'body', required: false },
        enabled: true,
        label: 'Publishing policy',
        controlPaletteItemId: 'heroui.select',
      },
      {
        field: { name: 'commentsBodyFormatCode', type: 'string', location: 'body', required: false },
        enabled: true,
        label: 'Comment body format',
        controlPaletteItemId: 'heroui.select',
      },
    ],
  });
  state = {
    ...preferencesOverlay.state,
    document: {
      ...preferencesOverlay.state.document,
      nodes: Object.fromEntries(Object.entries(preferencesOverlay.state.document.nodes).map(([nodeId, node]) => {
        if (node.props[DESIGNER_PALETTE_ITEM_ID_PROP] !== 'heroui.select') {
          return [nodeId, node];
        }
        const column = Object.values(node.binding).find(
          (definition) => definition?.sourceType === 'regionColumn',
        )?.column;
        if (column === 'commentsEnabled') {
          return [
            nodeId,
            {
              ...node,
              props: {
                ...node.props,
                placeholder: 'Use site default',
                items: JSON.stringify([
                  { id: '', textValue: 'Use site default' },
                  { id: 'true', textValue: 'Enabled' },
                  { id: 'false', textValue: 'Disabled' },
                ]),
                className: 'w-full',
              },
              binding: Object.fromEntries(Object.entries(node.binding).map(([key, definition]) => (
                definition?.sourceType === 'regionColumn'
                  ? [key, { ...definition, payloadTransform: 'nullableBoolean' as const }]
                  : [key, definition]
              ))),
            },
          ];
        }
        if (column === 'commentsPolicyCode') {
          return [
            nodeId,
            {
              ...node,
              props: {
                ...node.props,
                placeholder: 'Use site default',
                items: JSON.stringify([
                  { id: '', textValue: 'Use site default' },
                  ...input.filterOptions.commentPolicies.map((option) => ({
                    id: option.value,
                    textValue: option.label,
                  })),
                ]),
                className: 'w-full',
              },
              binding: Object.fromEntries(Object.entries(node.binding).map(([key, definition]) => (
                definition?.sourceType === 'regionColumn'
                  ? [key, { ...definition, payloadTransform: 'nullableString' as const }]
                  : [key, definition]
              ))),
            },
          ];
        }
        if (column === 'commentsBodyFormatCode') {
          return [
            nodeId,
            {
              ...node,
              props: {
                ...node.props,
                placeholder: 'Use site default',
                items: JSON.stringify([
                  { id: '', textValue: 'Use site default' },
                  ...commentBodyFormats.map((option) => ({
                    id: option.value,
                    textValue: option.label,
                  })),
                ]),
                className: 'w-full',
              },
              binding: Object.fromEntries(Object.entries(node.binding).map(([key, definition]) => (
                definition?.sourceType === 'regionColumn'
                  ? [key, { ...definition, payloadTransform: 'nullableString' as const }]
                  : [key, definition]
              ))),
            },
          ];
        }
        return [nodeId, node];
      })),
    },
  };

  const statusOverlay = appendStatusPickerOverlay({
    state,
    dataSourceId: contentsDataSource.id,
    title: 'Change status',
    statusLovRef: CMS_BASE_INFO_LOV_IDS.statuses,
    mutationRecordIdStorePath: 'routeParams.id',
  });
  state = statusOverlay.state;

  // Wire every rail trigger captured while building the sections above to the
  // overlay/modal built for it (mirrors the existing operator-note pattern: build
  // the trigger node first, wire its onClick once the target overlay exists).
  const wireOpenModal = (triggerNodeId: string, targetModalNodeId: string): void => {
    state = stripOutlineButtonLinkChrome(state, triggerNodeId);
    const openAction = createDynamicAction('showHide');
    openAction.targetNodeId = targetModalNodeId;
    openAction.showHideEffect = 'show';
    state = designerReducer(state, {
      type: 'set-node-binding',
      nodeId: triggerNodeId,
      bindingKey: eventBindingKeyForEvent('onClick'),
      definition: createDynamicActionsEventBindingDefinition('onClick', [openAction]),
    });
  };

  wireOpenModal(identityEditTriggerId, identityOverlay.modalNodeId);
  wireOpenModal(operatorNoteTriggerId, operatorNoteOverlay.modalNodeId);
  wireOpenModal(statusTriggerId, statusOverlay.modalNodeId);
  wireOpenModal(preferencesRailTriggerId, preferencesOverlay.modalNodeId);

  // Header: Back + title/#id identity + SEO + Upload + Save.
  // Comments policy lives beside Comments in the rail (icon-only).
  // Preferences and SEO use independent dialogs (not the main content Save).
  const seoHeaderButton = insert(state, 'heroui.button-outline', identityBar.nodeId);
  state = setProp(seoHeaderButton.state, seoHeaderButton.nodeId, 'text', 'SEO');
  state = setProp(state, seoHeaderButton.nodeId, 'icon', 'Globe');
  state = setProp(state, seoHeaderButton.nodeId, 'type', 'button');
  state = setProp(state, seoHeaderButton.nodeId, 'aria-label', 'Edit SEO details');
  state = setProp(state, seoHeaderButton.nodeId, 'title', 'Edit SEO details');
  state = setProp(
    state,
    seoHeaderButton.nodeId,
    'className',
    'ml-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-cyan-200 bg-white px-2.5 text-xs font-semibold text-cyan-700 hover:bg-cyan-50',
  );
  wireOpenModal(seoHeaderButton.nodeId, seoOverlay.modalNodeId);

  const uploadHeaderButton = insert(state, 'heroui.button-solid', identityBar.nodeId);
  state = setProp(uploadHeaderButton.state, uploadHeaderButton.nodeId, 'text', 'Upload');
  state = setProp(state, uploadHeaderButton.nodeId, 'icon', 'Upload');
  state = setProp(state, uploadHeaderButton.nodeId, 'type', 'button');
  state = setProp(state, uploadHeaderButton.nodeId, 'pickFileCreate', true);
  state = setProp(
    state,
    uploadHeaderButton.nodeId,
    'pickFileCreateConfig',
    JSON.stringify({
      dataSourceRef: 'cmsContentAssets',
      contentIdStorePath: 'routeParams.id',
      multiple: true,
      refreshList: true,
    }),
  );
  state = setProp(
    state,
    uploadHeaderButton.nodeId,
    'className',
    'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700',
  );

  const headerSaveButton = insert(state, 'heroui.button-solid', identityBar.nodeId);
  state = setProp(headerSaveButton.state, headerSaveButton.nodeId, 'text', 'Save');
  state = setProp(state, headerSaveButton.nodeId, 'icon', 'Save');
  state = setProp(state, headerSaveButton.nodeId, 'type', 'submit');
  state = setProp(state, headerSaveButton.nodeId, 'form', 'cms-content-editor-form');
  state = setProp(
    state,
    headerSaveButton.nodeId,
    'className',
    'inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md bg-indigo-600 px-3 text-xs font-semibold text-white hover:bg-indigo-700',
  );

  state = {
    ...state,
    document: {
      ...state.document,
      nodes: Object.fromEntries(Object.entries(state.document.nodes).map(([nodeId, node]) => [
        nodeId,
        {
          ...node,
          binding: Object.fromEntries(Object.entries(node.binding).map(([bindingKey, definition]) => [
            bindingKey,
            bindingKey === REGION_DATA_SOURCE_BINDING_KEY
              && definition?.loadOperation === 'detail'
              && definition.urlParams?.id === 'params.id'
              ? {
                ...definition,
                urlParams: { ...definition.urlParams, id: 'routeParams.id' },
              }
              : definition,
          ])),
        },
      ])),
    },
  };

  const bundle = finalizeDocument(state, 'cms-contents-editor', FOLDER);
  return {
    ...bundle,
    document: patchDocumentPageShell(bundle.document),
  };
};

// ---------------------------------------------------------------------------
// Settings (singleton, id=1)
// ---------------------------------------------------------------------------

export const buildCmsSettingsDraft = (input: {
  commentPolicies: Array<{ value: string; label: string }>;
  commentBodyFormats: Array<{ value: string; label: string }>;
  baseInfoCategoryIds: CmsBaseInfoCategoryIds;
}): CmsDesignerDraftBundle => {
  const dataSourceId = 'cmsSettings';
  let state = mergeCmsBaseInfoLovsIntoState(
    disablePublishedFormAssist(createInitialDesignerState('CMS Settings')),
    input.baseInfoCategoryIds,
  );
  state = setDataSource(state, dataSourceId, 'CMS Settings', {
    endpoint: '/api/cms/settings',
    primaryKey: 'id',
    fields: ['id', 'commentsEnabled', 'commentsPolicyCode', 'commentsBodyFormatCode', 'publicCacheTtlSeconds'],
    operations: {
      // Region hydration treats every `urlParams` value as a designerStore path (never a
      // literal) — see `shouldSkipPreviewHydrationTarget`/`resolveHydrationTargetUrl` in
      // designerPreviewHydration.ts. A literal `urlParams: { id: '1' }` therefore resolves
      // to `undefined` (no store key literally named "1") and the fetch is skipped forever,
      // so this singleton's detail endpoint is hardcoded instead of parameterized — the
      // regionDataSource binding below carries no `urlParams` at all.
      detail: { method: 'GET', endpoint: '/api/cms/settings/1' },
      update: { method: 'PUT', endpoint: '/api/cms/settings/:id' },
    },
  });

  const shell = mountCmsSettingsShell(state, 'general');
  state = shell.state;

  const scroll = styledLayout(
    state,
    shell.mainId,
    'layout.flex-column',
    'min-h-0 flex-1 overflow-y-auto bg-white px-5 py-6',
  );
  state = scroll.state;
  const content = styledLayout(
    state,
    scroll.nodeId,
    'layout.flex-column',
    'flex w-full max-w-3xl flex-col gap-4',
  );
  state = content.state;

  const { state: s1, nodeId: formId } = insert(state, 'html.form', content.nodeId);
  state = setProp(s1, formId, 'className', 'flex min-w-0 flex-col gap-4');
  state = designerReducer(state, {
    type: 'set-node-binding',
    nodeId: formId,
    bindingKey: REGION_DATA_SOURCE_BINDING_KEY,
    definition: createRegionDataSourceBindingDefinition(dataSourceId, {
      loadOperation: 'detail',
    }),
  });

  state = textField(state, formId, 'id', 'Id (fixed)', { hidden: true, readOnly: true, fixedValue: '1' });

  const comments = formSection(state, formId, 'Comment defaults', 'violet');
  state = comments.state;
  state = setProp(state, comments.bodyId, 'className', 'flex flex-col gap-4');
  state = note(
    state,
    comments.bodyId,
    'New content inherits these defaults. Editors can override them for an individual entry.',
  );
  const descriptionId = lastChildId(state, comments.bodyId);
  state = setProp(
    state,
    descriptionId,
    'className',
    'text-xs font-medium leading-relaxed text-slate-500 ps-[4px]',
  );
  state = checkboxField(state, comments.bodyId, 'commentsEnabled', 'Open comments by default');
  const commentFields = fieldPair(state, comments.bodyId);
  state = commentFields.state;
  state = selectField(
    state,
    commentFields.leftId,
    'commentsPolicyCode',
    'Publishing policy',
    input.commentPolicies,
  );
  state = selectField(
    state,
    commentFields.rightId,
    'commentsBodyFormatCode',
    'Body format',
    input.commentBodyFormats,
  );

  // publicCacheTtlSeconds stays in the payload (API still requires it) but is not
  // operator-editable here — platform Cache settings cover API-level TTL.
  state = textField(state, formId, 'publicCacheTtlSeconds', 'Public cache TTL (seconds)', {
    hidden: true,
    readOnly: true,
  });

  const actions = styledLayout(
    state,
    formId,
    'layout.flex-row',
    'flex items-center justify-end border-t border-slate-100 pt-4',
  );
  state = actions.state;
  state = submitButton(
    state,
    actions.nodeId,
    'Save settings',
    'inline-flex h-8 items-center rounded-md bg-emerald-700 px-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800',
    { successToast: 'Settings saved.', refreshDataSourceId: dataSourceId },
  );

  state = {
    ...state,
    document: wireDocumentSelectFieldLovs(state.document),
  };

  const bundle = finalizeDocument(state, 'cms-settings', FOLDER);
  return {
    ...bundle,
    document: patchDocumentPageShell(bundle.document),
  };
};
