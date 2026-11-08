import * as React from 'react';
import { mapBaseInfoApiItemsToRichSelectOptions, parseBaseInfoOptionsRootFromEndpoint } from './baseInfoSelectOptions';
import {
  mapLovApiItemsToSelectOptions,
  resolveLovDefinition,
  resolvePropertyBindingFetchEndpoint,
} from './bindingLovRegistry';
import { designerFetch } from './bindingMutationRuntime';
import { createDefaultBindingDefinitions, normalizeBindingDefinitions } from './bindingRegistry';
import {
  readDesignerLovOptionsCache,
  writeDesignerLovOptionsCache,
} from './designerLovOptionsCache';
import type { DesignerBindingDefinitions } from './types';

export type DesignerLovOption = {
  value: string;
  label: string;
  uiColor?: string | null;
  uiHtml?: string | null;
  description?: string | null;
  shortName?: string | null;
};

const mapPayloadToLovOptions = (
  payload: unknown,
  mapping?: { returnColumn: string; displayColumn: string },
): DesignerLovOption[] => {
  if (mapping) {
    return mapLovApiItemsToSelectOptions(payload, mapping).map((item) => ({
      value: item.id,
      label: item.textValue,
    }));
  }

  return mapBaseInfoApiItemsToRichSelectOptions(payload).map((item) => ({
    value: item.id,
    label: item.textValue,
    uiColor: item.uiColor,
    uiHtml: item.uiHtml,
    description: item.description,
    shortName: item.shortName,
  }));
};

export const resolveDesignerLovEndpoint = (
  lovRef: string,
  bindingDefinitions?: DesignerBindingDefinitions,
): string | null => {
  const registry = normalizeBindingDefinitions(bindingDefinitions ?? createDefaultBindingDefinitions());
  const lov = resolveLovDefinition(registry, lovRef.trim());
  if (!lov) {
    return null;
  }

  const endpoint = resolvePropertyBindingFetchEndpoint(
    { lovRef: lovRef.trim(), sourceType: 'apiRef', targetProp: 'items' },
    registry,
  );
  return endpoint?.trim() || null;
};

export const fetchDesignerLovOptions = async (
  lovRef: string,
  bindingDefinitions?: DesignerBindingDefinitions,
): Promise<DesignerLovOption[]> => {
  const registry = normalizeBindingDefinitions(bindingDefinitions ?? createDefaultBindingDefinitions());
  const lov = resolveLovDefinition(registry, lovRef);
  if (!lov) {
    return [];
  }

  const endpoint = resolvePropertyBindingFetchEndpoint(
    { lovRef, sourceType: 'apiRef', targetProp: 'items' },
    registry,
  );
  if (!endpoint) {
    return [];
  }

  const response = await designerFetch(endpoint, { cache: 'no-store' });
  if (!response.ok) {
    return [];
  }

  const payload = await response.json();

  if (lov.endpoint.includes('/api/base-info/options')) {
    const excludeRootId = parseBaseInfoOptionsRootFromEndpoint(endpoint);
    return mapBaseInfoApiItemsToRichSelectOptions(payload, { excludeRootId }).map((item) => ({
      value: item.id,
      label: item.textValue,
      uiColor: item.uiColor,
      uiHtml: item.uiHtml,
      description: item.description,
      shortName: item.shortName,
    }));
  }

  return mapPayloadToLovOptions(payload, {
    returnColumn: lov.returnValue,
    displayColumn: lov.displayValue,
  });
};

export const loadDesignerLovOptions = async (
  lovRef: string,
  bindingDefinitions?: DesignerBindingDefinitions,
): Promise<DesignerLovOption[]> => {
  const endpoint = resolveDesignerLovEndpoint(lovRef, bindingDefinitions);
  if (!endpoint) {
    return [];
  }

  const options = await fetchDesignerLovOptions(lovRef, bindingDefinitions);
  writeDesignerLovOptionsCache(endpoint, options);
  return options;
};

export const useDesignerLovOptions = (
  lovRef: string | undefined,
  bindingDefinitions?: DesignerBindingDefinitions,
): { options: DesignerLovOption[]; isLoading: boolean; revalidate: () => Promise<void> } => {
  const normalizedRef = lovRef?.trim() || '';
  const endpoint = React.useMemo(
    () => (normalizedRef ? resolveDesignerLovEndpoint(normalizedRef, bindingDefinitions) : null),
    [bindingDefinitions, normalizedRef],
  );

  const [options, setOptions] = React.useState<DesignerLovOption[]>(
    () => (endpoint ? readDesignerLovOptionsCache(endpoint) : undefined) ?? [],
  );
  const [isLoading, setIsLoading] = React.useState(
    () => Boolean(endpoint) && !readDesignerLovOptionsCache(endpoint ?? ''),
  );

  const bindingDefinitionsRef = React.useRef(bindingDefinitions);
  bindingDefinitionsRef.current = bindingDefinitions;

  const revalidate = React.useCallback(async () => {
    if (!normalizedRef) {
      setOptions([]);
      setIsLoading(false);
      return;
    }

    const nextOptions = await loadDesignerLovOptions(normalizedRef, bindingDefinitions);
    setOptions(nextOptions);
    setIsLoading(false);
  }, [bindingDefinitions, normalizedRef]);

  React.useEffect(() => {
    if (!normalizedRef || !endpoint) {
      setOptions([]);
      setIsLoading(false);
      return undefined;
    }

    const cached = readDesignerLovOptionsCache(endpoint);
    if (cached) {
      setOptions(cached);
      setIsLoading(false);
    } else {
      setIsLoading(true);
    }

    let cancelled = false;

    void loadDesignerLovOptions(normalizedRef, bindingDefinitionsRef.current)
      .then((nextOptions) => {
        if (!cancelled) {
          setOptions(nextOptions);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [endpoint, normalizedRef]);

  return { options, isLoading, revalidate };
};
