import * as React from 'react';
import {
  resolveFieldFilterStaticOptions,
  type DesignerGridToolbarFieldFilterConfig,
} from './designerGridToolbarConfig';
import { isDeprecatedHwyMembershipStatusShortName } from '../hwy/hwyMembershipStatusFilterOptions';
import { loadDesignerLovOptions, resolveDesignerLovEndpoint } from './useDesignerLovOptions';
import { readDesignerLovOptionsCache } from './designerLovOptionsCache';
import type { DesignerBindingDefinitions } from './types';

type LovEndpointEntry = {
  filterId: string;
  lovRef: string;
  endpoint: string;
};

const mapToolbarLovOptions = (
  lovRef: string,
  options: Awaited<ReturnType<typeof loadDesignerLovOptions>>,
): Array<{ value: string; label: string }> => (
  options
    .filter((option) => (
      lovRef !== 'hwyMembershipStatus'
      || !isDeprecatedHwyMembershipStatusShortName(option.shortName)
    ))
    .map((option) => ({ value: option.value, label: option.label }))
);

const buildLovEndpointEntries = (
  fieldFilters: readonly DesignerGridToolbarFieldFilterConfig[],
  bindingDefinitions?: DesignerBindingDefinitions,
): LovEndpointEntry[] => (
  fieldFilters
    .filter((filter) => filter.optionsSource === 'lov' && filter.lovRef?.trim())
    .map((filter) => {
      const lovRef = filter.lovRef!.trim();
      const endpoint = resolveDesignerLovEndpoint(lovRef, bindingDefinitions);
      if (!endpoint) {
        return null;
      }
      return {
        filterId: filter.id,
        lovRef,
        endpoint,
      };
    })
    .filter((entry): entry is LovEndpointEntry => entry !== null)
);

const buildFieldFiltersSignature = (
  fieldFilters: readonly DesignerGridToolbarFieldFilterConfig[],
): string => JSON.stringify(
  fieldFilters.map((filter) => ({
    id: filter.id,
    field: filter.field,
    label: filter.label,
    controlType: filter.controlType,
    optionsSource: filter.optionsSource,
    lovRef: filter.lovRef,
    apiParam: filter.apiParam,
    storePath: filter.storePath,
    defaultValue: filter.defaultValue,
    matchLogic: filter.matchLogic,
  })),
);

export const useResolvedToolbarFieldFilters = (
  fieldFilters: readonly DesignerGridToolbarFieldFilterConfig[],
  bindingDefinitions?: DesignerBindingDefinitions,
): {
  fieldFilters: DesignerGridToolbarFieldFilterConfig[];
  revalidateLovFilter: (filterId: string) => Promise<void>;
} => {
  const fieldFiltersSignature = React.useMemo(
    () => buildFieldFiltersSignature(fieldFilters),
    [fieldFilters],
  );

  const lovEndpoints = React.useMemo(
    () => buildLovEndpointEntries(fieldFilters, bindingDefinitions),
    [bindingDefinitions, fieldFiltersSignature],
  );

  const lovEndpointsSignature = React.useMemo(
    () => lovEndpoints.map((entry) => `${entry.filterId}:${entry.endpoint}`).join('|'),
    [lovEndpoints],
  );

  const lovEndpointsRef = React.useRef(lovEndpoints);
  lovEndpointsRef.current = lovEndpoints;

  const bindingDefinitionsRef = React.useRef(bindingDefinitions);
  bindingDefinitionsRef.current = bindingDefinitions;

  const [lovOptionsByRef, setLovOptionsByRef] = React.useState<
    Record<string, Array<{ value: string; label: string }>>
  >(() => {
    const initial: Record<string, Array<{ value: string; label: string }>> = {};
    for (const entry of lovEndpoints) {
      const cached = readDesignerLovOptionsCache(entry.endpoint);
      if (cached && cached.length > 0) {
        initial[entry.lovRef] = mapToolbarLovOptions(entry.lovRef, cached);
      }
    }
    return initial;
  });

  React.useEffect(() => {
    const entries = lovEndpointsRef.current;
    if (entries.length === 0) {
      setLovOptionsByRef((current) => (Object.keys(current).length === 0 ? current : {}));
      return undefined;
    }

    let cancelled = false;

    void Promise.all(
      entries.map(async (entry) => {
        const options = await loadDesignerLovOptions(entry.lovRef, bindingDefinitionsRef.current);
        return [entry.lovRef, mapToolbarLovOptions(entry.lovRef, options)] as const;
      }),
    ).then((loaded) => {
      if (!cancelled) {
        setLovOptionsByRef((current) => {
          const next = Object.fromEntries(loaded);
          const currentKeys = Object.keys(current);
          const nextKeys = Object.keys(next);
          if (
            currentKeys.length === nextKeys.length
            && currentKeys.every((key) => {
              const currentOptions = current[key] ?? [];
              const nextOptions = next[key] ?? [];
              return currentOptions.length === nextOptions.length
                && currentOptions.every((option, index) => (
                  option.value === nextOptions[index]?.value
                  && option.label === nextOptions[index]?.label
                ));
            })
          ) {
            return current;
          }
          return next;
        });
      }
    });

    return () => {
      cancelled = true;
    };
  }, [lovEndpointsSignature]);

  const revalidateLovFilter = React.useCallback(async (filterId: string) => {
    const entry = lovEndpointsRef.current.find((candidate) => candidate.filterId === filterId);
    if (!entry) {
      return;
    }

    const options = await loadDesignerLovOptions(entry.lovRef, bindingDefinitionsRef.current);
    setLovOptionsByRef((current) => ({
      ...current,
      [entry.lovRef]: mapToolbarLovOptions(entry.lovRef, options),
    }));
  }, []);

  const resolvedFieldFilters = React.useMemo(
    () => fieldFilters.map((filter) => {
      if (filter.optionsSource !== 'lov' || !filter.lovRef?.trim()) {
        return filter;
      }

      const lovOptions = lovOptionsByRef[filter.lovRef.trim()] ?? [];
      if (lovOptions.length === 0) {
        return filter;
      }

      return {
        ...filter,
        options: lovOptions,
      };
    }),
    [fieldFiltersSignature, lovOptionsByRef],
  );

  return {
    fieldFilters: resolvedFieldFilters,
    revalidateLovFilter,
  };
};

export const resolveToolbarFieldFilterOptions = (
  filter: DesignerGridToolbarFieldFilterConfig,
  lovOptionsByRef: Readonly<Record<string, Array<{ value: string; label: string }>>>,
): Array<{ value: string; label: string }> => {
  if (filter.optionsSource === 'lov' && filter.lovRef?.trim()) {
    const lovOptions = lovOptionsByRef[filter.lovRef.trim()];
    if (lovOptions && lovOptions.length > 0) {
      return lovOptions;
    }
  }
  return resolveFieldFilterStaticOptions(filter);
};
