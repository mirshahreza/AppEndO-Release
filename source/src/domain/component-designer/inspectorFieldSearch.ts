import type { InspectorFieldSchema, InspectorFieldSection, InspectorTierId } from './inspectorRegistry';
import { resolveNodeEventBindingTargets } from './bindingEngine';
import type { DesignerNode } from './types';

export type InspectorSearchTierId = InspectorTierId | 'behavior' | 'data';

export type InspectorSearchEntry = {
  key: string;
  label: string;
  tier: InspectorSearchTierId;
};

export const INSPECTOR_FIELD_HIGHLIGHT_CLASS =
  'rounded-md ring-2 ring-amber-400/80 bg-amber-50/70 p-1 transition-shadow';

export const normalizeInspectorSearchQuery = (query: string): string => query.trim().toLowerCase();

export const inspectorSearchTextMatches = (haystack: string, query: string): boolean => {
  const normalizedQuery = normalizeInspectorSearchQuery(query);
  if (!normalizedQuery) {
    return false;
  }
  return haystack.toLowerCase().includes(normalizedQuery);
};

export const inspectorFieldMatchesSearch = (field: InspectorFieldSchema, query: string): boolean => {
  if (!normalizeInspectorSearchQuery(query)) {
    return false;
  }
  return inspectorSearchTextMatches(field.label, query) || inspectorSearchTextMatches(field.key, query);
};

const DATA_PANEL_SEARCH_ENTRIES: InspectorSearchEntry[] = [
  { key: 'data-region', label: 'Form Data Connection', tier: 'data' },
  { key: 'grid-binding', label: 'Grid Data Connection', tier: 'data' },
  { key: 'chart-binding', label: 'Chart Data Connection', tier: 'data' },
  { key: 'viz-binding', label: 'Widget Data Connection', tier: 'data' },
  { key: 'dual-mode-content', label: 'Content Data Mode', tier: 'data' },
];

const ADVANCED_PANEL_SEARCH_ENTRIES: InspectorSearchEntry[] = [
  { key: 'conditionals', label: 'Conditionals / Visibility', tier: 'advanced' },
  { key: 'hidden', label: 'Hidden', tier: 'advanced' },
  { key: 'node-binding', label: 'Node Binding', tier: 'advanced' },
  { key: 'global-store', label: 'Global State Store', tier: 'advanced' },
  { key: 'binding-definitions', label: 'Binding Definitions', tier: 'advanced' },
];

export const collectInspectorSearchEntries = (
  sections: InspectorFieldSection[],
  node: DesignerNode,
  options?: { includeDataPanels?: boolean },
): InspectorSearchEntry[] => {
  const entries: InspectorSearchEntry[] = [];

  for (const section of sections) {
    for (const field of section.fields) {
      entries.push({
        key: field.key,
        label: field.label,
        tier: section.id,
      });
    }
  }

  const eventTargets = resolveNodeEventBindingTargets(node);
  for (const targetEvent of eventTargets) {
    entries.push({
      key: `event:${targetEvent}`,
      label: targetEvent,
      tier: 'behavior',
    });
  }
  if (eventTargets.length > 0) {
    entries.push({ key: 'behavior', label: 'Behavior', tier: 'behavior' });
  }

  if (options?.includeDataPanels) {
    entries.push(...DATA_PANEL_SEARCH_ENTRIES);
  }

  entries.push(...ADVANCED_PANEL_SEARCH_ENTRIES);

  return entries;
};

export type InspectorFieldSearchResult = {
  matchedKeys: string[];
  matchedKeySet: Set<string>;
  tiersToOpen: Set<InspectorSearchTierId>;
  firstMatchKey: string | null;
};

export const resolveInspectorFieldSearch = (
  entries: InspectorSearchEntry[],
  query: string,
): InspectorFieldSearchResult => {
  const normalizedQuery = normalizeInspectorSearchQuery(query);
  if (!normalizedQuery) {
    return {
      matchedKeys: [],
      matchedKeySet: new Set(),
      tiersToOpen: new Set(),
      firstMatchKey: null,
    };
  }

  const matchedKeys: string[] = [];
  const tiersToOpen = new Set<InspectorSearchTierId>();

  for (const entry of entries) {
    if (
      inspectorSearchTextMatches(entry.label, normalizedQuery)
      || inspectorSearchTextMatches(entry.key, normalizedQuery)
    ) {
      matchedKeys.push(entry.key);
      tiersToOpen.add(entry.tier);
    }
  }

  return {
    matchedKeys,
    matchedKeySet: new Set(matchedKeys),
    tiersToOpen,
    firstMatchKey: matchedKeys[0] ?? null,
  };
};
