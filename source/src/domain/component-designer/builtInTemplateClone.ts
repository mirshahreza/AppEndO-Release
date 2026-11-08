import { canInsertPaletteItem, getPaletteItemById } from './catalog';
import { buildPlatformNavigationPaletteItems } from './navigationComponentPalette';
import { buildShellChromePaletteItems } from './shellChromePalette';
import { isShellChromeTemplateId } from './shellChromeTemplates';
import { syncTailwindPropKeys } from './tailwindClasses';
import type { DesignerBindingDefinition, DesignerNode, TemplateNodeSeed } from './types';

export const BUILT_IN_TEMPLATE_ROOT_PROP = '_isBuiltInTemplateRoot';

const DEFAULT_PALETTE_ITEM_ID_BY_NODE_TYPE: Partial<Record<string, string>> = {
  container: 'html.container',
  text: 'html.text',
  heading: 'html.heading',
  link: 'html.link',
  image: 'html.image',
  list: 'html.list',
  'list-item': 'html.list-item',
  iframe: 'html.iframe',
  'file-upload': 'html.file-upload',
};

const TEMPLATE_SEED_NODE_TYPES_WITHOUT_PALETTE_ITEM = new Set<string>([
  'platform-nav',
  'system-slot',
]);

const canInsertTemplateSeedNodeType = (seed: TemplateNodeSeed, parentNode: DesignerNode): boolean => {
  if (!TEMPLATE_SEED_NODE_TYPES_WITHOUT_PALETTE_ITEM.has(seed.type)) {
    return false;
  }

  const parentPaletteItem = getPaletteItemById(
    typeof parentNode.props._designerPaletteItemId === 'string'
      ? parentNode.props._designerPaletteItemId
      : '',
  );
  const parentType = parentPaletteItem?.nodeType ?? parentNode.type;

  if (seed.type === 'platform-nav') {
    return parentType === 'root' || parentType === 'container' || parentType === 'list';
  }

  if (seed.type === 'system-slot') {
    return parentType === 'root' || parentType === 'container' || parentType === 'list';
  }

  return false;
};

const createClonedNodeId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `node-${crypto.randomUUID()}`;
  }

  return `node-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const resolveSeedPaletteItemId = (seed: TemplateNodeSeed): string | null => {
  if (typeof seed.paletteItemId === 'string' && seed.paletteItemId.trim().length > 0) {
    return seed.paletteItemId;
  }

  const fallback = DEFAULT_PALETTE_ITEM_ID_BY_NODE_TYPE[seed.type];
  return fallback ?? null;
};

const buildPropsFromSeed = (seed: TemplateNodeSeed, options: { markTemplateRoot: boolean }): Record<string, unknown> => {
  const props: Record<string, unknown> = { ...(seed.props ?? {}) };
  const paletteItemId = resolveSeedPaletteItemId(seed);

  if (paletteItemId) {
    props._designerPaletteItemId = paletteItemId;
  }

  if (options.markTemplateRoot) {
    props[BUILT_IN_TEMPLATE_ROOT_PROP] = true;
  }

  if (typeof props.className === 'string' && props.className.trim().length > 0) {
    Object.assign(props, syncTailwindPropKeys(props.className));
  } else if (props.className === '') {
    delete props.className;
  }

  return props;
};

const resolvePaletteItemForTemplateSeed = (paletteItemId: string) => {
  const catalogItem = getPaletteItemById(paletteItemId);
  if (catalogItem) {
    return catalogItem;
  }

  if (isShellChromeTemplateId(paletteItemId)) {
    return buildShellChromePaletteItems().find((item) => item.id === paletteItemId);
  }

  if (paletteItemId.startsWith('platform.nav.')) {
    return buildPlatformNavigationPaletteItems().find((item) => item.id === paletteItemId);
  }

  if (paletteItemId.startsWith('platform.slot.')) {
    return undefined;
  }

  return undefined;
};

export const canInsertTemplateSeed = (seed: TemplateNodeSeed, parentNode: DesignerNode): boolean => {
  const paletteItemId = resolveSeedPaletteItemId(seed);
  if (!paletteItemId) {
    return canInsertTemplateSeedNodeType(seed, parentNode);
  }

  const paletteItem = resolvePaletteItemForTemplateSeed(paletteItemId);
  if (!paletteItem) {
    return canInsertTemplateSeedNodeType(seed, parentNode);
  }

  return canInsertPaletteItem(paletteItem, parentNode);
};

export const canInsertTemplateSeeds = (seeds: readonly TemplateNodeSeed[], parentNode: DesignerNode): boolean => {
  if (seeds.length === 0) {
    return false;
  }

  return seeds.every((seed) => canInsertTemplateSeed(seed, parentNode));
};

export type ClonedTemplateSubtree = {
  nodes: Record<string, DesignerNode>;
  rootNodeIds: string[];
};

export type CloneTemplateSeedsOptions = {
  /** Override default random ids (e.g. built-in components on disk). */
  createNodeId?: () => string;
};

export const cloneTemplateSeedsToNodes = (
  seeds: readonly TemplateNodeSeed[],
  targetParentId: string,
  startOrder: number,
  options?: CloneTemplateSeedsOptions,
): ClonedTemplateSubtree => {
  const nodes: Record<string, DesignerNode> = {};
  const rootNodeIds: string[] = [];
  const createNodeId = options?.createNodeId ?? createClonedNodeId;

  const buildNode = (seed: TemplateNodeSeed, parentId: string, order: number, markTemplateRoot: boolean): string => {
    const nodeId = createNodeId();
    const childSeeds = seed.children ?? [];
    const children = childSeeds.map((child, childIndex) => buildNode(child, nodeId, childIndex, false));

    nodes[nodeId] = {
      id: nodeId,
      type: seed.type,
      parentId,
      order,
      props: buildPropsFromSeed(seed, { markTemplateRoot }),
      layout: {},
      binding: { ...(seed.binding ?? {}) } as Record<string, DesignerBindingDefinition>,
      children,
    };

    return nodeId;
  };

  seeds.forEach((seed, index) => {
    const rootId = buildNode(seed, targetParentId, startOrder + index, true);
    rootNodeIds.push(rootId);
  });

  return { nodes, rootNodeIds };
};
