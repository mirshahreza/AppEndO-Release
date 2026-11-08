import * as React from 'react';
import { getNodePropertyBinding } from './bindingEngine';
import { getNodeRegionColumnOptionLovDefinition } from './bindingRegionEngine';
import { mapBaseInfoApiItemsToSelectOptions } from './baseInfoSelectOptions';
import {
  mapLovApiItemsToSelectOptions,
  resolvePropertyBindingFetchEndpoint,
  resolvePropertyBindingLovMapping,
} from './bindingLovRegistry';
import { createDefaultBindingDefinitions, normalizeBindingDefinitions } from './bindingRegistry';
import {
  designerChoiceGroupUsesDynamicOptions,
} from './designerChoiceGroupOptions';
import {
  hasDesignerNodeItemsBinding,
  resolveDesignerNodeOptionItemViews,
  resolveDesignerStaticOptionItemViews,
  toDesignerOptionItemViews,
  type DesignerOptionItemView,
} from './designerOptionItems';
import { designerFetch } from './bindingMutationRuntime';
import type { DesignerNode } from './types';
import type { RuntimeRenderOptions } from './runtimeTypes';

export type { DesignerOptionItemView } from './designerOptionItems';
export { toDesignerOptionItemViews } from './designerOptionItems';

const serializeOptionItems = (items: DesignerOptionItemView[]): string => JSON.stringify(items);

export const useDesignerOptionItems = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): {
  items: DesignerOptionItemView[];
  isLoading: boolean;
} => {
  const nodeId = node.id;
  const itemsBinding = getNodePropertyBinding(node, 'items');
  const regionColumnLovDefinition = getNodeRegionColumnOptionLovDefinition(node);
  const optionBindingDefinition = itemsBinding?.definition ?? regionColumnLovDefinition ?? null;
  const registry = normalizeBindingDefinitions(options.bindingDefinitions ?? createDefaultBindingDefinitions());
  const fetchEndpoint = optionBindingDefinition
    ? resolvePropertyBindingFetchEndpoint(optionBindingDefinition, registry) ?? ''
    : '';
  const lovMapping = optionBindingDefinition
    ? resolvePropertyBindingLovMapping(optionBindingDefinition, registry)
    : undefined;
  const hasBinding = hasDesignerNodeItemsBinding(node) && designerChoiceGroupUsesDynamicOptions(node);
  const staticItemsKey = typeof node.props.items === 'string'
    ? node.props.items
    : JSON.stringify(node.props.items ?? '');

  const nodeRef = React.useRef(node);
  nodeRef.current = node;

  const previewBindingsRef = React.useRef(options.previewBindings);
  previewBindingsRef.current = options.previewBindings;

  const resolvedItemsKey = serializeOptionItems(
    resolveDesignerNodeOptionItemViews(node, options.previewBindings),
  );

  const lovMappingKey = lovMapping
    ? `${lovMapping.returnColumn}:${lovMapping.displayColumn}`
    : '';

  const [items, setItems] = React.useState<DesignerOptionItemView[]>(() =>
    resolveDesignerNodeOptionItemViews(node, options.previewBindings),
  );
  const [isLoading, setIsLoading] = React.useState(
    Boolean(fetchEndpoint) && hasBinding,
  );
  const itemsSnapshotRef = React.useRef<string>(serializeOptionItems(items));

  const commitItems = React.useCallback((nextItems: DesignerOptionItemView[]) => {
    const snapshot = serializeOptionItems(nextItems);
    if (itemsSnapshotRef.current === snapshot) {
      return;
    }

    itemsSnapshotRef.current = snapshot;
    setItems(nextItems);
  }, []);

  React.useEffect(() => {
    const currentNode = nodeRef.current;
    const previewBindings = previewBindingsRef.current;

    if (!hasBinding) {
      commitItems(resolveDesignerStaticOptionItemViews(currentNode));
      setIsLoading(false);
      return undefined;
    }

    const previewSelectItems = previewBindings?.resolveSelectItems?.(currentNode);
    const staticFallbackPreview = serializeOptionItems(resolveDesignerStaticOptionItemViews(currentNode));
    const previewItemsSnapshot = Array.isArray(previewSelectItems) && previewSelectItems.length > 0
      ? serializeOptionItems(toDesignerOptionItemViews(previewSelectItems))
      : '';
    const previewIsStaticFallback = previewItemsSnapshot.length > 0
      && previewItemsSnapshot === staticFallbackPreview;

    if (
      Array.isArray(previewSelectItems)
      && previewSelectItems.length > 0
      && (!fetchEndpoint || !previewIsStaticFallback)
    ) {
      commitItems(toDesignerOptionItemViews(previewSelectItems));
      setIsLoading(false);
      return undefined;
    }

    if (!fetchEndpoint) {
      commitItems(resolveDesignerNodeOptionItemViews(currentNode, previewBindings));
      setIsLoading(false);
      return undefined;
    }

    let cancelled = false;
    const staticFallback = resolveDesignerStaticOptionItemViews(currentNode);

    const load = async () => {
      setIsLoading(true);
      try {
        const response = await designerFetch(fetchEndpoint);
        if (!response.ok) {
          if (!cancelled) {
            commitItems(staticFallback);
          }
          return;
        }

        const payload = await response.json();
        if (!cancelled) {
          const mappedItems = lovMapping
            ? mapLovApiItemsToSelectOptions(payload, lovMapping)
            : mapBaseInfoApiItemsToSelectOptions(payload);
          const fetchedItems = mappedItems.map((item) => ({
            value: item.id,
            label: item.textValue,
          }));
          commitItems(fetchedItems.length > 0 ? fetchedItems : staticFallback);
        }
      } catch {
        if (!cancelled) {
          commitItems(staticFallback);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    commitItems,
    fetchEndpoint,
    hasBinding,
    lovMappingKey,
    nodeId,
    resolvedItemsKey,
    staticItemsKey,
  ]);

  return { items, isLoading };
};
