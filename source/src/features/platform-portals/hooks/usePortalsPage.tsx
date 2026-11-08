import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type {
  ExperienceManifestPortal,
} from '../../../shared/api/contracts/platform/experienceManifest';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import {
  createPortalRecord,
  deletePortalRecord,
  duplicatePortalRecord,
  platformQueryKeys,
  refetchPlatformBootQueries,
  updatePortalRecord,
  useExperienceManifestQuery,
} from '../../../shared/api/queries/platform';
import { defaultPortalBrand } from '../../../shared/api/contracts/platform/portalBrand';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../shared/lib/usePersistedListPreferences';
import { BUILTIN_FILTER_ALL, migrateLegacyBuiltInFilter } from '../../../shared/lib/builtInFilter';
import { componentDesignerQueryKeys } from '../../../shared/api/queries/component-designer';
import { filterPortals } from '../lib/portalListFilters';
export type PortalsPageModel = ReturnType<typeof usePortalsPage>;

export type PortalMutationOptions = {
  /** When true, callers surface errors in their own dialog instead of `formError`. */
  suppressFormError?: boolean;
};

type PortalsListFilters = {
  builtInFilter: string;
  query: string;
};

const DEFAULT_PORTALS_FILTERS: PortalsListFilters = {
  builtInFilter: BUILTIN_FILTER_ALL,
  query: '',
};

function sanitizePortalsFilters(raw: unknown): PortalsListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const query = typeof record.query === 'string' ? record.query : '';
  return {
    builtInFilter: migrateLegacyBuiltInFilter(record),
    query,
  };
}

export function usePortalsPage() {
  const queryClient = useQueryClient();
  const manifestQuery = useExperienceManifestQuery('admin');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.platformPortals,
    defaultFilters: DEFAULT_PORTALS_FILTERS,
    sanitize: sanitizePortalsFilters,
  });
  const builtInFilter = filters.builtInFilter;
  const query = filters.query;
  const setBuiltInFilter = useCallback((next: string) => {
    setFilters((current) => ({ ...current, builtInFilter: next }));
  }, [setFilters]);
  const setQuery = useCallback((next: string) => {
    setFilters((current) => ({ ...current, query: next }));
  }, [setFilters]);

  const portals = manifestQuery.data?.portals ?? [];

  const displayPortals = useMemo(
    () => filterPortals(portals, { builtInFilter, query }),
    [builtInFilter, portals, query],
  );

  const invalidateAfterMutation = useCallback(async () => {
    await refetchPlatformBootQueries(queryClient);
    await queryClient.invalidateQueries({ queryKey: [...componentDesignerQueryKeys.all, 'shell'] });
    await queryClient.invalidateQueries({ queryKey: platformQueryKeys.experienceManifest('admin') });
    await manifestQuery.refetch();
  }, [manifestQuery, queryClient]);

  const savePortal = useCallback(async (
    mode: 'create' | 'update' | 'edit',
    portal: ExperienceManifestPortal,
    segment?: string,
    options?: PortalMutationOptions,
  ) => {
    setFormError(null);
    setIsSaving(true);
    try {
      if (mode === 'create') {
        await createPortalRecord(portal);
      } else {
        await updatePortalRecord(segment ?? portal.segment, portal);
      }
      await invalidateAfterMutation();
    } catch (caught) {
      if (!options?.suppressFormError) {
        setFormError(isApiError(caught) ? formatApiErrorMessage(caught) : 'Failed to save portal.');
      }
      throw caught;
    } finally {
      setIsSaving(false);
    }
  }, [invalidateAfterMutation]);

  const removePortal = useCallback(async (
    segment: string,
    options?: PortalMutationOptions,
  ) => {
    setFormError(null);
    setIsSaving(true);
    try {
      await deletePortalRecord(segment);
      await invalidateAfterMutation();
    } catch (caught) {
      if (!options?.suppressFormError) {
        setFormError(isApiError(caught) ? formatApiErrorMessage(caught) : 'Failed to delete portal.');
      }
      throw caught;
    } finally {
      setIsSaving(false);
    }
  }, [invalidateAfterMutation]);

  const duplicatePortal = useCallback(async (
    segment: string,
    target: { segment: string; name: string },
    options?: PortalMutationOptions,
  ) => {
    setFormError(null);
    setIsSaving(true);
    try {
      await duplicatePortalRecord(segment, target);
      await invalidateAfterMutation();
    } catch (caught) {
      if (!options?.suppressFormError) {
        setFormError(isApiError(caught) ? formatApiErrorMessage(caught) : 'Failed to duplicate portal.');
      }
      throw caught;
    } finally {
      setIsSaving(false);
    }
  }, [invalidateAfterMutation]);

  const retryLoad = useCallback(() => {
    void manifestQuery.refetch();
  }, [manifestQuery]);

  const createEmptyPortal = useCallback((): ExperienceManifestPortal => ({
    segment: '',
    name: '',
    shellKey: '',
    entryMode: 'shell',
    notFoundPageRef: null,
    brand: defaultPortalBrand(),
    enabled: true,
    auth: { accessMode: 'authenticated', allowRoles: [], allowUsers: [], denyRoles: [], denyUsers: [] },
    pages: [],
  }), []);

  const shellPortals = useMemo(
    () => portals.filter((portal) => portal.entryMode !== 'redirect'),
    [portals],
  );

    return {
    manifestQuery,
    portals,
    displayPortals,
    builtInFilter,
    setBuiltInFilter,
    query,
    setQuery,
    shellPortals,
    createEmptyPortal,
    isSaving,
    formError,
    savePortal,
    removePortal,
    duplicatePortal,
    retryLoad,
  };
}
