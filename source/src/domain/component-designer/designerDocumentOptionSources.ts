import { getNodePropertyBinding } from './bindingEngine';
import { getNodeRegionColumnOptionLovDefinition } from './bindingRegionEngine';
import { mapBaseInfoApiItemsToSelectOptions, parseBaseInfoOptionsRootFromEndpoint } from './baseInfoSelectOptions';
import {
  mapLovApiItemsToSelectOptions,
  resolvePropertyBindingFetchEndpoint,
  resolvePropertyBindingLovMapping,
} from './bindingLovRegistry';
import { createDefaultBindingDefinitions, normalizeBindingDefinitions } from './bindingRegistry';
import { designerFetch } from './bindingMutationRuntime';
import type { DesignerBindingDefinitions, DesignerDocument } from './types';

export type DesignerDocumentOptionSource = {
  nodeId: string;
  endpoint: string;
  lovMapping?: {
    returnColumn: string;
    displayColumn: string;
  };
};

export const collectDocumentItemsFetchSources = (
  document: DesignerDocument,
  bindingDefinitions: DesignerBindingDefinitions = createDefaultBindingDefinitions(),
): DesignerDocumentOptionSource[] => {
  const registry = normalizeBindingDefinitions(bindingDefinitions);
  const sources: DesignerDocumentOptionSource[] = [];

  for (const node of Object.values(document.nodes)) {
    const binding = getNodePropertyBinding(node, 'items');
    const regionColumnLovDefinition = getNodeRegionColumnOptionLovDefinition(node);
    const definition = binding?.definition ?? regionColumnLovDefinition ?? null;
    const endpoint = definition
      ? resolvePropertyBindingFetchEndpoint(definition, registry)
      : undefined;
    if (!endpoint) {
      continue;
    }

    sources.push({
      nodeId: node.id,
      endpoint,
      lovMapping: definition
        ? resolvePropertyBindingLovMapping(definition, registry)
        : undefined,
    });
  }

  return sources;
};

export const fetchDesignerDocumentOptionItems = async (
  endpoint: string,
  lovMapping?: DesignerDocumentOptionSource['lovMapping'],
): Promise<Array<{ id: string; textValue: string }>> => {
  const response = await designerFetch(endpoint, { cache: 'no-store' });
  if (!response.ok) {
    return [];
  }

  const payload = await response.json();
  if (endpoint.includes('/api/base-info/options')) {
    const excludeRootId = parseBaseInfoOptionsRootFromEndpoint(endpoint);
    return mapBaseInfoApiItemsToSelectOptions(payload, { excludeRootId });
  }
  if (lovMapping) {
    return mapLovApiItemsToSelectOptions(payload, lovMapping);
  }

  return mapBaseInfoApiItemsToSelectOptions(payload);
};

export const buildOptionPreviewResults = (
  sources: DesignerDocumentOptionSource[],
  itemsByEndpoint: ReadonlyMap<string, Array<{ id: string; textValue: string }>>,
): Record<string, unknown> => {
  const results: Record<string, unknown> = {};

  for (const source of sources) {
    const items = itemsByEndpoint.get(source.endpoint) ?? [];
    results[`node:${source.nodeId}:prop:items`] = items;
  }

  return results;
};
