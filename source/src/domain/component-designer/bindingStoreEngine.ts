import type {
  DesignerBindingDefinition,
  DesignerBindingDefinitions,
  DesignerDiagnostic,
  DesignerDocument,
  DesignerNode,
} from './types';
import { getStoreSegments } from './bindingRegistry';
import { collectNodeSessionAsStoreReadBindings } from './bindingSessionEngine';

const STORE_BINDING_KEY_PREFIX = 'store:';

export type ParsedStoreBindingKey = {
  segmentId: string;
  path: string;
  storePath: string;
};

export type ResolvedStoreReadBinding = {
  bindingKey: string;
  nodeId: string;
  targetProp: string;
  segmentId: string;
  path: string;
  storePath: string;
  definition: DesignerBindingDefinition;
};

export type ResolvedStoreWriteBinding = {
  bindingKey: string;
  nodeId: string;
  targetEvent: string;
  storePath: string;
  definition: DesignerBindingDefinition;
};

export type DesignerStorePlan = {
  readBindings: ResolvedStoreReadBinding[];
  writeBindings: ResolvedStoreWriteBinding[];
  segmentIds: string[];
};

const isStoreBindingKey = (bindingKey: string): boolean =>
  bindingKey.startsWith(STORE_BINDING_KEY_PREFIX);

export const parseStoreBindingKey = (bindingKey: string): ParsedStoreBindingKey | null => {
  if (!isStoreBindingKey(bindingKey)) {
    return null;
  }

  const remainder = bindingKey.slice(STORE_BINDING_KEY_PREFIX.length).trim();
  const dotIndex = remainder.indexOf('.');
  if (dotIndex <= 0) {
    return null;
  }

  const segmentId = remainder.slice(0, dotIndex).trim();
  const path = remainder.slice(dotIndex + 1).trim();
  if (!segmentId || !path) {
    return null;
  }

  return {
    segmentId,
    path,
    storePath: `${segmentId}.${path}`,
  };
};

export const storeBindingKeyForPath = (storePath: string): string =>
  `${STORE_BINDING_KEY_PREFIX}${storePath.trim()}`;

export const resolveStorePathExpression = (
  storePath: string,
  storeVar = 'designerStore',
): string => {
  const segments = storePath.split('.').map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) {
    return storeVar;
  }

  return segments.reduce((expression, segment) => `${expression}?.${segment}`, storeVar);
};

const resolvePropertyBindingTargetProp = (
  definition: DesignerBindingDefinition,
  bindingKey: string,
): string | undefined => {
  if (typeof definition.targetProp === 'string' && definition.targetProp.trim().length > 0) {
    return definition.targetProp.trim();
  }

  return undefined;
};

export const collectNodeStoreReadBindings = (node: DesignerNode): ResolvedStoreReadBinding[] => {
  const resolved: ResolvedStoreReadBinding[] = [];

  for (const [bindingKey, definition] of Object.entries(node.binding)) {
    if (!definition) {
      continue;
    }

    const parsed = parseStoreBindingKey(bindingKey);
    if (!parsed) {
      continue;
    }

    const targetProp = resolvePropertyBindingTargetProp(definition, bindingKey)
      ?? definition.targetProp
      ?? parsed.path.split('.').pop()
      ?? parsed.path;

    resolved.push({
      bindingKey,
      nodeId: node.id,
      targetProp,
      segmentId: parsed.segmentId,
      path: parsed.path,
      storePath: parsed.storePath,
      definition: {
        ...definition,
        sourceType: 'store',
        bindingRole: 'property',
        targetProp,
      },
    });
  }

  return resolved;
};

export const collectNodeStoreWriteBindings = (node: DesignerNode): ResolvedStoreWriteBinding[] => {
  const resolved: ResolvedStoreWriteBinding[] = [];

  for (const [bindingKey, definition] of Object.entries(node.binding)) {
    if (!definition) {
      continue;
    }

    const storeWritePath = typeof definition.storeWritePath === 'string'
      ? definition.storeWritePath.trim()
      : '';
    if (!storeWritePath) {
      continue;
    }

    const targetEvent = definition.targetEvent
      ?? (bindingKey.startsWith('event:') ? bindingKey.slice('event:'.length) : undefined);
    if (!targetEvent) {
      continue;
    }

    resolved.push({
      bindingKey,
      nodeId: node.id,
      targetEvent,
      storePath: storeWritePath,
      definition,
    });
  }

  return resolved;
};

export const collectDocumentStorePlan = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions,
): DesignerStorePlan => {
  const readBindings: ResolvedStoreReadBinding[] = [];
  const writeBindings: ResolvedStoreWriteBinding[] = [];

  for (const node of Object.values(document.nodes)) {
    readBindings.push(...collectNodeStoreReadBindings(node));
    readBindings.push(...collectNodeSessionAsStoreReadBindings(node));
    writeBindings.push(...collectNodeStoreWriteBindings(node));
  }

  const segmentIds = new Set<string>(Object.keys(getStoreSegments(bindingDefinitions)));
  for (const binding of readBindings) {
    segmentIds.add(binding.segmentId);
  }
  for (const binding of writeBindings) {
    const segmentId = binding.storePath.split('.')[0];
    if (segmentId) {
      segmentIds.add(segmentId);
    }
  }

  return {
    readBindings,
    writeBindings,
    segmentIds: Array.from(segmentIds).sort(),
  };
};

export const countStoreSegmentReaders = (
  document: DesignerDocument,
  segmentId: string,
): number => {
  let count = 0;
  for (const node of Object.values(document.nodes)) {
    for (const bindingKey of Object.keys(node.binding)) {
      const parsed = parseStoreBindingKey(bindingKey);
      if (parsed?.segmentId === segmentId) {
        count += 1;
      }
    }
  }
  return count;
};

const countStorePathReaders = (
  document: DesignerDocument,
  storePath: string,
): number => {
  let count = 0;
  for (const node of Object.values(document.nodes)) {
    for (const bindingKey of Object.keys(node.binding)) {
      const parsed = parseStoreBindingKey(bindingKey);
      if (parsed?.storePath === storePath) {
        count += 1;
      }
    }
  }
  return count;
};

const detectStoreDependencyCycles = (
  document: DesignerDocument,
): string[] => {
  const edges = new Map<string, Set<string>>();

  for (const node of Object.values(document.nodes)) {
    const writes = collectNodeStoreWriteBindings(node);
    const reads = collectNodeStoreReadBindings(node);
    if (writes.length === 0 || reads.length === 0) {
      continue;
    }

    for (const write of writes) {
      const dependents = edges.get(write.storePath) ?? new Set<string>();
      for (const read of reads) {
        if (read.storePath !== write.storePath) {
          dependents.add(read.storePath);
        }
      }
      edges.set(write.storePath, dependents);
    }
  }

  const cycles: string[] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();

  const visit = (path: string, trail: string[]): void => {
    if (visiting.has(path)) {
      cycles.push([...trail, path].join(' → '));
      return;
    }
    if (visited.has(path)) {
      return;
    }

    visiting.add(path);
    for (const next of edges.get(path) ?? []) {
      visit(next, [...trail, path]);
    }
    visiting.delete(path);
    visited.add(path);
  };

  for (const path of edges.keys()) {
    visit(path, []);
  }

  return cycles;
};

export const validateStoreDependencies = (
  document: DesignerDocument,
): DesignerDiagnostic[] => {
  const cycles = detectStoreDependencyCycles(document);
  return cycles.map((cycle, index) => ({
    id: `store-cycle-${index}`,
    code: 'binding-dependency' as const,
    level: 'error' as const,
    message: `Circular store dependency detected: ${cycle}`,
  }));
};

export const getNodeStoreReadBindingForProp = (
  node: DesignerNode,
  targetProp: string,
): ResolvedStoreReadBinding | null => {
  for (const binding of collectNodeStoreReadBindings(node)) {
    if (binding.targetProp === targetProp) {
      return binding;
    }
  }

  for (const binding of collectNodeSessionAsStoreReadBindings(node)) {
    if (binding.targetProp === targetProp) {
      return binding;
    }
  }

  return null;
};

export const createStoreReadBindingDefinition = (
  targetProp: string,
  storePath: string,
): { bindingKey: string; definition: import('./types').DesignerBindingDefinition } => ({
  bindingKey: storeBindingKeyForPath(storePath),
  definition: {
    sourceType: 'store',
    bindingRole: 'property',
    targetProp,
  },
});
