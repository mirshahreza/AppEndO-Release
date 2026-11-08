import type { DesignerBindingDefinition, DesignerDocument, DesignerNode } from './types';
import { getPaletteItemById } from './catalog';
import { DESIGNER_PALETTE_ITEM_ID_PROP } from './propRegistry';
import { syncTailwindPropKeys } from './tailwindClasses';

export type ParsedDesignerNodeDraft = {
  type: string;
  paletteItemId?: string;
  props: Record<string, unknown>;
  layout: Record<string, unknown>;
  binding: Record<string, DesignerBindingDefinition>;
  componentRef?: DesignerNode['componentRef'];
  children: ParsedDesignerNodeDraft[];
  signature: string;
};

const stableSerialize = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableSerialize(record[key])}`).join(',')}}`;
  }

  return '';
};

const SIGNATURE_PROP_KEYS = new Set([
  'text',
  'name',
  'className',
  'href',
  'src',
  'alt',
  'title',
  'description',
  'placeholder',
  'value',
  'type',
  'variant',
  'size',
  'color',
  '_jsxSourceTag',
  'data-node-type',
]);

export const buildParsedNodeSignature = (draft: ParsedDesignerNodeDraft): string => {
  const propEntries = Object.keys(draft.props)
    .filter((key) => SIGNATURE_PROP_KEYS.has(key) || key.startsWith('aria'))
    .sort()
    .map((key) => `${key}:${stableSerialize(draft.props[key])}`);

  const childSignatures = draft.children.map((child) => child.signature).join('|');

  return [
    draft.type,
    draft.paletteItemId ?? '',
    propEntries.join(';'),
    childSignatures,
  ].join('::');
};

export const attachParsedNodeSignatures = (draft: ParsedDesignerNodeDraft): ParsedDesignerNodeDraft => {
  const children = draft.children.map((child) => attachParsedNodeSignatures(child));
  const next: ParsedDesignerNodeDraft = {
    ...draft,
    children,
    signature: '',
  };
  next.signature = buildParsedNodeSignature(next);
  return next;
};

const createReconciledNodeId = (draft: ParsedDesignerNodeDraft, index: number): string => {
  const seed = draft.paletteItemId ?? draft.type;
  return `${seed.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}-jsx-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 7)}`;
};

const cloneNodeWithoutTree = (node: DesignerNode): Omit<DesignerNode, 'children' | 'parentId' | 'order'> => ({
  id: node.id,
  type: node.type,
  props: structuredClone(node.props),
  layout: structuredClone(node.layout),
  binding: structuredClone(node.binding),
  componentRef: node.componentRef ? structuredClone(node.componentRef) : undefined,
});

const indexExistingNodesBySignature = (
  document: DesignerDocument,
  rootNodeId: string,
): Map<string, DesignerNode[]> => {
  const buckets = new Map<string, DesignerNode[]>();

  const walk = (nodeId: string) => {
    const node = document.nodes[nodeId];
    if (!node) {
      return;
    }

    const draft: ParsedDesignerNodeDraft = {
      type: node.type,
      paletteItemId: typeof node.props[DESIGNER_PALETTE_ITEM_ID_PROP] === 'string'
        ? node.props[DESIGNER_PALETTE_ITEM_ID_PROP]
        : undefined,
      props: node.props,
      layout: node.layout,
      binding: node.binding,
      componentRef: node.componentRef,
      children: node.children
        .map((childId) => document.nodes[childId])
        .filter(Boolean)
        .map((child) => attachParsedNodeSignatures({
          type: child.type,
          paletteItemId: typeof child.props[DESIGNER_PALETTE_ITEM_ID_PROP] === 'string'
            ? child.props[DESIGNER_PALETTE_ITEM_ID_PROP]
            : undefined,
          props: child.props,
          layout: child.layout,
          binding: child.binding,
          componentRef: child.componentRef,
          children: [],
          signature: '',
        })),
      signature: '',
    };
    const signature = buildParsedNodeSignature(draft);
    const bucket = buckets.get(signature) ?? [];
    bucket.push(node);
    buckets.set(signature, bucket);

    for (const childId of node.children) {
      walk(childId);
    }
  };

  const root = document.nodes[rootNodeId];
  if (root) {
    for (const childId of root.children) {
      walk(childId);
    }
  }

  return buckets;
};

const takeMatchingExistingNode = (
  buckets: Map<string, DesignerNode[]>,
  signature: string,
): DesignerNode | null => {
  const bucket = buckets.get(signature);
  if (!bucket || bucket.length === 0) {
    return null;
  }

  return bucket.shift() ?? null;
};

const DESIGNER_JSON_ROUNDTRIP_PROP_KEYS = ['columns', 'items'] as const;

const preserveDesignerJsonPropsFromBase = (
  base: Pick<DesignerNode, 'props'> | null,
  draft: ParsedDesignerNodeDraft,
  props: Record<string, unknown>,
): Record<string, unknown> => {
  if (!base) {
    return props;
  }

  const paletteItemId = draft.paletteItemId
    ?? (typeof props[DESIGNER_PALETTE_ITEM_ID_PROP] === 'string' ? props[DESIGNER_PALETTE_ITEM_ID_PROP] : undefined);
  const paletteItem = typeof paletteItemId === 'string' ? getPaletteItemById(paletteItemId) : null;
  if (!paletteItem) {
    return props;
  }

  const next = { ...props };
  for (const key of DESIGNER_JSON_ROUNDTRIP_PROP_KEYS) {
    const baseValue = base.props[key];
    const draftValue = next[key];
    const defaultValue = paletteItem.defaultProps[key];
    if (
      typeof baseValue === 'string'
      && baseValue.trim().length > 0
      && draftValue === defaultValue
      && baseValue !== draftValue
    ) {
      next[key] = baseValue;
    }
  }

  return next;
};

const materializeDraftNode = (
  draft: ParsedDesignerNodeDraft,
  parentId: string,
  order: number,
  nodeId: string,
  existingNode: DesignerNode | null,
): DesignerNode => {
  const base = existingNode ? cloneNodeWithoutTree(existingNode) : null;

  const props = preserveDesignerJsonPropsFromBase(existingNode, draft, {
    ...(base?.props ?? {}),
    ...draft.props,
  });

  if (typeof props.className === 'string') {
    Object.assign(props, syncTailwindPropKeys(props.className));
  }

  if (draft.paletteItemId) {
    props[DESIGNER_PALETTE_ITEM_ID_PROP] = draft.paletteItemId;
  }

  const preservedBaseBindings = Object.fromEntries(
    Object.entries(base?.binding ?? {}).filter(([key]) => {
      if (Object.prototype.hasOwnProperty.call(draft.binding, key)) {
        return false;
      }

      return key.startsWith('store:') || key.startsWith('event:');
    }),
  );

  return {
    id: nodeId,
    type: draft.type,
    parentId,
    order,
    props,
    layout: {
      ...(base?.layout ?? {}),
      ...draft.layout,
    },
    binding: {
      ...preservedBaseBindings,
      ...draft.binding,
    },
    componentRef: draft.componentRef ?? base?.componentRef,
    children: [],
  };
};

const samePaletteIdentity = (left: DesignerNode, draft: ParsedDesignerNodeDraft): boolean => {
  const leftPalette = left.props[DESIGNER_PALETTE_ITEM_ID_PROP];
  const rightPalette = draft.paletteItemId;
  if (typeof leftPalette === 'string' || typeof rightPalette === 'string') {
    return leftPalette === rightPalette;
  }

  return left.type === draft.type;
};

const buildTreeFromDrafts = (
  drafts: ParsedDesignerNodeDraft[],
  parentId: string,
  existingParent: DesignerNode | null,
  baseNodes: Record<string, DesignerNode>,
  buckets: Map<string, DesignerNode[]>,
  nodes: Record<string, DesignerNode>,
  idCounter: { value: number },
): string[] => {
  const childIds: string[] = [];
  const existingChildIds = existingParent?.children ?? [];

  drafts.forEach((draft, order) => {
    const signatureMatch = takeMatchingExistingNode(buckets, draft.signature);
    const positionalExistingId = existingChildIds[order];
    const positionalExisting = positionalExistingId ? baseNodes[positionalExistingId] ?? null : null;
    const existingNode = signatureMatch && samePaletteIdentity(signatureMatch, draft)
      ? signatureMatch
      : (positionalExisting && samePaletteIdentity(positionalExisting, draft)
        ? positionalExisting
        : null);

    const nodeId = existingNode?.id ?? createReconciledNodeId(draft, idCounter.value++);
    const node = materializeDraftNode(draft, parentId, order, nodeId, existingNode);
    nodes[nodeId] = node;
    childIds.push(nodeId);

    const nestedChildIds = buildTreeFromDrafts(
      draft.children,
      nodeId,
      existingNode,
      baseNodes,
      buckets,
      nodes,
      idCounter,
    );
    nodes[nodeId] = {
      ...nodes[nodeId],
      children: nestedChildIds,
    };
  });

  return childIds;
};

export const reconcileParsedJsxTree = (
  drafts: ParsedDesignerNodeDraft[],
  baseDocument: DesignerDocument,
): DesignerDocument => {
  const rootNodeId = baseDocument.rootNodeId;
  const rootNode = baseDocument.nodes[rootNodeId];
  if (!rootNode) {
    throw new Error('Designer document is missing its root node.');
  }

  const signedDrafts = drafts.map((draft) => attachParsedNodeSignatures(draft));
  const buckets = indexExistingNodesBySignature(baseDocument, rootNodeId);
  const nodes: Record<string, DesignerNode> = {
    [rootNodeId]: {
      ...rootNode,
      children: [],
    },
  };

  const childIds = buildTreeFromDrafts(
    signedDrafts,
    rootNodeId,
    rootNode,
    baseDocument.nodes,
    buckets,
    nodes,
    { value: 0 },
  );
  nodes[rootNodeId] = {
    ...nodes[rootNodeId],
    children: childIds,
  };

  return {
    ...baseDocument,
    nodes,
  };
};

export const computeJsxStructureFingerprint = (drafts: ParsedDesignerNodeDraft[]): string => {
  return drafts.map((draft) => attachParsedNodeSignatures(draft).signature).join('\n');
};
