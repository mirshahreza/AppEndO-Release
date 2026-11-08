import { resolveDesignerHtmlTag } from './domProps';
import { isLayoutColumnSlotNode } from './layoutGridSlots';
import { isLogicRepeaterNode } from './repeaterEngine';
import type { DesignerNode, DesignerPaletteItem } from './types';

export type DesignerContentCategory =
  | 'root'
  | 'flow'
  | 'sectioning'
  | 'form'
  | 'list'
  | 'list-item'
  | 'table'
  | 'choice-group'
  | 'select'
  | 'optgroup'
  | 'option'
  | 'phrasing'
  | 'heading'
  | 'link'
  | 'button'
  | 'form-control'
  | 'media'
  | 'structural-slot'
  | 'logic'
  | 'leaf';

export type Html5ContentModelViolation = {
  code: 'html5-content-model';
  message: string;
};

const PALETTE_CONTENT_CATEGORY: Record<string, DesignerContentCategory> = {
  'html.container': 'flow',
  'html.section': 'sectioning',
  'html.article': 'sectioning',
  'html.figure': 'flow',
  'html.form': 'form',
  'html.text': 'phrasing',
  'html.heading': 'heading',
  'html.link': 'link',
  'html.image': 'media',
  'html.iframe': 'media',
  'html.file-upload': 'form-control',
  'html.list': 'list',
  'html.list-item': 'list-item',
  'layout.flex-row': 'flow',
  'layout.flex-column': 'flow',
  'layout.grid-2': 'flow',
  'layout.grid-3': 'flow',
  'layout.columns': 'flow',
  'layout.stack-compact': 'flow',
  'layout.stack-relaxed': 'flow',
  'layout.center': 'flow',
  'layout.wrapper': 'flow',
  'layout.scroll': 'flow',
  'layout.sticky-bar': 'flow',
  'layout.dock-pane': 'flow',
  'layout.split-pane': 'flow',
  'heroui.input-text': 'form-control',
  'heroui.number-input': 'form-control',
  'heroui.textarea': 'form-control',
  'heroui.select': 'select',
  'heroui.autocomplete': 'select',
  'heroui.dropdown': 'select',
  'heroui.listbox': 'select',
  'heroui.entity-picker': 'select',
  'heroui.button-solid': 'button',
  'heroui.button-outline': 'button',
  'heroui.link': 'link',
  'heroui.chip': 'phrasing',
  'heroui.spinner': 'leaf',
  'heroui.skeleton': 'leaf',
  'heroui.avatar': 'leaf',
  'heroui.switch': 'form-control',
  'heroui.progress': 'leaf',
  'heroui.slider': 'form-control',
  'heroui.date-picker': 'form-control',
  'form.date-range': 'form-control',
  'form.code-editor': 'form-control',
  'form.html-editor': 'form-control',
  'form.markdown-editor': 'form-control',
  'form.mask-input': 'form-control',
  'form.calculator': 'form-control',
  'form.relation-tags-list': 'form-control',
  'heroui.color-control': 'form-control',
  'heroui.checkbox-group': 'choice-group',
  'heroui.radio-group': 'choice-group',
  'heroui.card': 'flow',
  'heroui.tabs': 'flow',
  'heroui.accordion-item': 'flow',
  'heroui.modal': 'flow',
  'heroui.alert-dialog': 'flow',
  'heroui.drawer': 'flow',
  'heroui.table': 'table',
  'heroui.data-grid': 'table',
  'heroui.app-table-grid': 'table',
  'heroui.crud-set': 'table',
  'heroui.record-form': 'flow',
  'viz.chart-bar': 'leaf',
  'viz.chart-line': 'leaf',
  'viz.chart-pie': 'leaf',
  'viz.chart-sparkline': 'leaf',
  'viz.chart': 'leaf',
  'viz.map-pin': 'leaf',
  'viz.map-choropleth': 'leaf',
  'viz.tree-view': 'leaf',
  'viz.tree-select': 'form-control',
  'viz.cascader': 'form-control',
  'viz.tree-combobox': 'form-control',
  'viz.timeline': 'leaf',
  'viz.gantt': 'leaf',
  'viz.sheet': 'table',
  'viz.kanban': 'leaf',
  'layout.separator': 'leaf',
  'layout.spacer': 'leaf',
  'feedback.alert': 'flow',
  'feedback.banner': 'flow',
  'feedback.empty-state': 'flow',
  'feedback.result': 'flow',
  'content.stepper': 'flow',
  'content.carousel': 'flow',
  'content.icon': 'phrasing',
  'form.rating': 'form-control',
  'form.otp-input': 'form-control',
  'form.time-input': 'form-control',
  'form.datetime-input': 'form-control',
  'content.description-list': 'flow',
  'content.stat-trend': 'flow',
  'layout.aspect-ratio': 'flow',
  'layout.sticky': 'flow',
  'layout.overlay': 'flow',
  'content.segmented-control': 'form-control',
  'marketing.faq-accordion': 'flow',
  'marketing.testimonial-carousel': 'flow',
  'marketing.pricing-table': 'table',
  'logic.visibility-container': 'logic',
  'marketing.hero-cta': 'sectioning',
  'content.feature-grid': 'flow',
  'content.blog-card': 'flow',
  'content.team-member': 'flow',
  'content.contact-form-block': 'form',
  'content.split-media': 'flow',
  'content.video-player': 'media',
  'content.audio-player': 'media',
  'content.qr-code': 'flow',
  'content.barcode': 'flow',
  'platform-navigation.command-palette': 'flow',
  'platform-navigation.notification-bell': 'flow',
  'platform-navigation.user-menu': 'flow',
  'heroui.chat-widget': 'flow',
  'marketing.newsletter-signup': 'form',
  'content.cta-banner': 'flow',
  'heroui.breadcrumbs': 'list',
  'heroui.pagination': 'flow',
  'logic.repeater': 'logic',
};

const NODE_TYPE_CONTENT_CATEGORY: Record<string, DesignerContentCategory> = {
  root: 'root',
  container: 'flow',
  section: 'sectioning',
  text: 'phrasing',
  heading: 'heading',
  link: 'link',
  image: 'media',
  iframe: 'media',
  'file-upload': 'form-control',
  list: 'list',
  'list-item': 'list-item',
  'platform-nav': 'structural-slot',
  'system-slot': 'structural-slot',
  'reusable-slot': 'structural-slot',
};

const HTML_TAG_CONTENT_CATEGORY: Record<string, DesignerContentCategory> = {
  div: 'flow',
  section: 'sectioning',
  article: 'sectioning',
  aside: 'sectioning',
  nav: 'sectioning',
  header: 'sectioning',
  footer: 'sectioning',
  main: 'sectioning',
  figure: 'flow',
  form: 'form',
  ul: 'list',
  ol: 'list',
  li: 'list-item',
  p: 'phrasing',
  span: 'phrasing',
  label: 'phrasing',
  a: 'link',
  button: 'button',
  input: 'form-control',
  textarea: 'form-control',
  select: 'select',
  optgroup: 'optgroup',
  option: 'option',
  datalist: 'select',
  img: 'media',
  iframe: 'media',
  h1: 'heading',
  h2: 'heading',
  h3: 'heading',
  h4: 'heading',
  h5: 'heading',
  h6: 'heading',
  table: 'table',
  thead: 'table',
  tbody: 'table',
  tfoot: 'table',
  tr: 'table',
  td: 'flow',
  th: 'flow',
  fieldset: 'flow',
  legend: 'phrasing',
};

const PARENTS_WITHOUT_CHILDREN = new Set<DesignerContentCategory>([
  'phrasing',
  'heading',
  'media',
  'form-control',
  'button',
  'link',
  'option',
  'optgroup',
  'select',
  'leaf',
]);

const INLINE_ONLY_PARENTS = new Set<DesignerContentCategory>([
  'phrasing',
  'heading',
  'button',
  'link',
  'option',
  'optgroup',
]);

const BLOCK_LIKE_CHILD_CATEGORIES = new Set<DesignerContentCategory>([
  'flow',
  'sectioning',
  'form',
  'list',
  'table',
  'choice-group',
  'logic',
  'select',
]);

const INTERACTIVE_CHILD_CATEGORIES = new Set<DesignerContentCategory>([
  'form-control',
  'button',
  'link',
  'select',
]);

const HTML_TAG_ALLOWED_CHILD_CATEGORIES: Record<string, ReadonlySet<DesignerContentCategory>> = {
  select: new Set(['option', 'optgroup']),
  optgroup: new Set(['option']),
  datalist: new Set(['option']),
  ul: new Set(['list-item']),
  ol: new Set(['list-item']),
  button: new Set(['phrasing', 'media', 'link']),
  a: new Set(['phrasing', 'media']),
  p: new Set(['phrasing', 'media', 'link', 'form-control']),
  label: new Set(['phrasing', 'media', 'form-control']),
  legend: new Set(['phrasing', 'media']),
};

const resolvePaletteItemId = (node: DesignerNode): string | null => {
  const paletteItemId = node.props._designerPaletteItemId;
  return typeof paletteItemId === 'string' && paletteItemId.length > 0 ? paletteItemId : null;
};

export const resolveEffectiveHtmlTag = (node: DesignerNode, fallback = 'div'): string => {
  if (typeof node.props.htmlTag === 'string' && node.props.htmlTag.trim().length > 0) {
    return node.props.htmlTag.trim().toLowerCase();
  }

  return resolveDesignerHtmlTag(node, fallback).toLowerCase();
};

export const resolveDesignerContentCategory = (
  node: DesignerNode,
  paletteItem?: DesignerPaletteItem,
): DesignerContentCategory => {
  if (node.type === 'root') {
    return 'root';
  }

  if (isLogicRepeaterNode(node)) {
    return 'logic';
  }

  if (isLayoutColumnSlotNode(node)) {
    return 'structural-slot';
  }

  const paletteItemId = paletteItem?.id ?? resolvePaletteItemId(node);
  if (paletteItemId && PALETTE_CONTENT_CATEGORY[paletteItemId]) {
    return PALETTE_CONTENT_CATEGORY[paletteItemId];
  }

  const htmlTag = resolveEffectiveHtmlTag(node, node.type === 'list' ? 'ul' : 'div');
  if (HTML_TAG_CONTENT_CATEGORY[htmlTag]) {
    return HTML_TAG_CONTENT_CATEGORY[htmlTag];
  }

  if (NODE_TYPE_CONTENT_CATEGORY[node.type]) {
    return NODE_TYPE_CONTENT_CATEGORY[node.type];
  }

  return paletteItem?.canHaveChildren ? 'flow' : 'leaf';
};

const resolveNodeLabel = (node: DesignerNode, paletteItem?: DesignerPaletteItem): string => {
  if (paletteItem?.label) {
    return paletteItem.label;
  }

  if (node.type === 'root') {
    return 'Root';
  }

  return node.type;
};

export const validateHtml5ContentPlacement = (
  child: DesignerNode,
  parent: DesignerNode,
  childPaletteItem?: DesignerPaletteItem,
  parentPaletteItem?: DesignerPaletteItem,
): Html5ContentModelViolation | null => {
  const childCategory = resolveDesignerContentCategory(child, childPaletteItem);
  const parentCategory = resolveDesignerContentCategory(parent, parentPaletteItem);
  const childLabel = resolveNodeLabel(child, childPaletteItem);
  const parentLabel = resolveNodeLabel(parent, parentPaletteItem);
  const parentHtmlTag = resolveEffectiveHtmlTag(parent);

  if (PARENTS_WITHOUT_CHILDREN.has(parentCategory)) {
    return {
      code: 'html5-content-model',
      message: `${parentLabel} cannot contain child components in HTML.`,
    };
  }

  const htmlTagAllowedChildren = HTML_TAG_ALLOWED_CHILD_CATEGORIES[parentHtmlTag];
  if (htmlTagAllowedChildren && !htmlTagAllowedChildren.has(childCategory)) {
    return {
      code: 'html5-content-model',
      message: `<${parentHtmlTag}> cannot contain ${childLabel}.`,
    };
  }

  if (childCategory === 'list-item' && parentCategory !== 'list' && parentHtmlTag !== 'ul' && parentHtmlTag !== 'ol') {
    return {
      code: 'html5-content-model',
      message: 'List items can only be placed inside a list.',
    };
  }

  if (childCategory === 'option' && parentCategory !== 'select' && parentCategory !== 'optgroup' && parentHtmlTag !== 'select' && parentHtmlTag !== 'optgroup' && parentHtmlTag !== 'datalist') {
    return {
      code: 'html5-content-model',
      message: 'Option elements can only be placed inside select, optgroup, or datalist.',
    };
  }

  if (childCategory === 'form' && parentCategory === 'form') {
    return {
      code: 'html5-content-model',
      message: 'Forms cannot be nested inside another form.',
    };
  }

  if (INLINE_ONLY_PARENTS.has(parentCategory) && BLOCK_LIKE_CHILD_CATEGORIES.has(childCategory)) {
    return {
      code: 'html5-content-model',
      message: `${childLabel} cannot be placed inside ${parentLabel} because block content is not allowed there.`,
    };
  }

  if (INLINE_ONLY_PARENTS.has(parentCategory) && INTERACTIVE_CHILD_CATEGORIES.has(childCategory)) {
    return {
      code: 'html5-content-model',
      message: `${childLabel} cannot be placed inside ${parentLabel} because interactive content is not allowed there.`,
    };
  }

  if (parentCategory === 'select') {
    return {
      code: 'html5-content-model',
      message: `${parentLabel} options are configured in Properties. Drop components outside the select instead of inside it.`,
    };
  }

  if (parentCategory === 'choice-group') {
    const allowedChoiceChildren = new Set<DesignerContentCategory>([
      'form-control',
      'phrasing',
      'button',
      'link',
      'structural-slot',
    ]);
    if (!allowedChoiceChildren.has(childCategory)) {
      return {
        code: 'html5-content-model',
        message: `${childLabel} cannot be placed inside ${parentLabel}. Only choice controls belong in this group.`,
      };
    }
  }

  if (parentCategory === 'list' && childCategory !== 'list-item') {
    return {
      code: 'html5-content-model',
      message: `${childLabel} cannot be placed directly inside a list. Use a list item wrapper.`,
    };
  }

  if (parentCategory === 'media') {
    return {
      code: 'html5-content-model',
      message: `${parentLabel} cannot contain child components in HTML.`,
    };
  }

  return null;
};

export const satisfiesHtml5ContentModel = (
  child: DesignerNode,
  parent: DesignerNode,
  childPaletteItem?: DesignerPaletteItem,
  parentPaletteItem?: DesignerPaletteItem,
): boolean => validateHtml5ContentPlacement(child, parent, childPaletteItem, parentPaletteItem) === null;

export const satisfiesHtml5ContentModelForPaletteItem = (
  item: DesignerPaletteItem,
  parent: DesignerNode,
  parentPaletteItem?: DesignerPaletteItem,
): boolean => {
  const syntheticChild: DesignerNode = {
    id: '__preview__',
    type: item.nodeType,
    parentId: parent.id,
    order: 0,
    props: {
      ...item.defaultProps,
      _designerPaletteItemId: item.id,
    },
    layout: {},
    binding: {},
    children: [],
  };

  return satisfiesHtml5ContentModel(syntheticChild, parent, item, parentPaletteItem);
};

export const describeHtml5ContentModelViolationForPaletteItem = (
  item: DesignerPaletteItem,
  parent: DesignerNode,
  parentPaletteItem?: DesignerPaletteItem,
): string | null => {
  const syntheticChild: DesignerNode = {
    id: '__preview__',
    type: item.nodeType,
    parentId: parent.id,
    order: 0,
    props: {
      ...item.defaultProps,
      _designerPaletteItemId: item.id,
    },
    layout: {},
    binding: {},
    children: [],
  };

  return describeHtml5ContentModelViolation(syntheticChild, parent, item, parentPaletteItem);
};

export const describeHtml5ContentModelViolation = (
  child: DesignerNode,
  parent: DesignerNode,
  childPaletteItem?: DesignerPaletteItem,
  parentPaletteItem?: DesignerPaletteItem,
): string | null => validateHtml5ContentPlacement(child, parent, childPaletteItem, parentPaletteItem)?.message ?? null;
