import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatQueryError } from '../../../../shared/api/client';
import type { PlatformCulturePack } from '../../../../shared/api/contracts/platform/cultures';
import { platformQueryKeys } from '../../../../shared/api/queries/platform';
import {
  usePlatformCultureTranslationsQuery,
  useUpdatePlatformCultureTranslationsMutation,
} from '../../../../shared/api/queries/platformCrud';
import { bootstrapCultureTranslationRuntime } from '../../../../core/culture/CultureTranslationOverrides';
import {
  APP_LIST_PREFERENCE_KEYS,
  useGridListPresentation,
  usePersistedListPaging,
} from '../../../../shared/ui';
import {
  buildEffectiveTranslationsDraft,
  buildTranslationsSavePayload,
  filterTranslationKeys,
  isRtlCultureTranslationColumn,
  mergeCultureTranslationColumns,
  sortTranslationKeys,
  type CultureTranslationSortField,
  type CultureTranslationsDraft,
} from './cultureTranslationsUtils';
import { resolveCultureDisplayLabel } from './constants';

export type CultureTranslationsModalMode = 'single' | 'all';

type ToastState = { type: 'success' | 'error'; text: string } | null;

export const CULTURE_TRANSLATION_SORT_OPTIONS: ReadonlyArray<{
  value: CultureTranslationSortField;
  label: string;
}> = [
  { value: 'key', label: 'Key' },
  { value: 'native', label: 'Native' },
];

export function useCultureTranslationsModal(
  sectionEnabled = false,
  culturePacks: PlatformCulturePack[] = [],
) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const translationsQuery = usePlatformCultureTranslationsQuery(sectionEnabled || open);
  const updateMutation = useUpdatePlatformCultureTranslationsMutation();
  const [mode, setMode] = useState<CultureTranslationsModalMode>('all');
  const [cultureId, setCultureId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<CultureTranslationSortField>('key');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [draft, setDraft] = useState<CultureTranslationsDraft>({});
  const [savedDraft, setSavedDraft] = useState<CultureTranslationsDraft>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const { pageSize, setPageSize, listMode, setListMode } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.cultureTranslations,
  });

  const resolvedTranslationsData = useMemo(() => {
    if (!translationsQuery.data) {
      return undefined;
    }

    return {
      ...translationsQuery.data,
      cultures: mergeCultureTranslationColumns(translationsQuery.data.cultures, culturePacks),
    };
  }, [culturePacks, translationsQuery.data]);

  const activeCultureIds = useMemo(() => {
    const cultures = resolvedTranslationsData?.cultures;
    if (!Array.isArray(cultures) || cultures.length === 0) {
      return [];
    }

    if (mode === 'single' && cultureId) {
      return cultures.some((culture) => culture.id === cultureId) ? [cultureId] : [];
    }

    return cultures.map((culture) => culture.id);
  }, [cultureId, mode, resolvedTranslationsData]);

  const activeCultureColumns = useMemo(
    () => resolvedTranslationsData?.cultures.filter(
      (culture) => activeCultureIds.includes(culture.id),
    ) ?? [],
    [activeCultureIds, resolvedTranslationsData?.cultures],
  );

  const activeModalDirection = useMemo(() => {
    if (mode !== 'single' || activeCultureColumns.length !== 1) {
      return 'ltr' as const;
    }

    return isRtlCultureTranslationColumn(activeCultureColumns[0]) ? 'rtl' as const : 'ltr' as const;
  }, [activeCultureColumns, mode]);

  const refreshTranslations = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: platformQueryKeys.cultureTranslations() });
    await translationsQuery.refetch();
  }, [queryClient, translationsQuery]);

  useEffect(() => {
    if (!resolvedTranslationsData || !open) {
      return;
    }

    const nextDraft = buildEffectiveTranslationsDraft(resolvedTranslationsData, activeCultureIds);
    setDraft(nextDraft);
    setSavedDraft(nextDraft);
    setFormError(null);
  }, [activeCultureIds, open, resolvedTranslationsData]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filteredKeys = useMemo(() => {
    if (!resolvedTranslationsData) {
      return [];
    }
    return filterTranslationKeys(resolvedTranslationsData.keys, search);
  }, [resolvedTranslationsData, search]);

  const sortedKeys = useMemo(
    () => sortTranslationKeys(
      filteredKeys,
      sortBy,
      sortDirection,
      resolvedTranslationsData?.masterBundle ?? {},
    ),
    [filteredKeys, resolvedTranslationsData?.masterBundle, sortBy, sortDirection],
  );

  const presentation = useGridListPresentation({
    items: sortedKeys,
    pageSize,
    listMode,
    resetKeys: [search, sortBy, sortDirection, mode, cultureId, open],
  });

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(savedDraft),
    [draft, savedDraft],
  );

  const openAll = useCallback(() => {
    setMode('all');
    setCultureId(null);
    setSearch('');
    setOpen(true);
    void refreshTranslations();
  }, [refreshTranslations]);

  const openForCulture = useCallback((nextCultureId: string) => {
    setMode('single');
    setCultureId(nextCultureId);
    setSearch('');
    setOpen(true);
    void refreshTranslations();
  }, [refreshTranslations]);

  const close = useCallback(() => {
    setOpen(false);
    setFormError(null);
  }, []);

  const updateTranslation = useCallback((key: string, targetCultureId: string, value: string) => {
    setDraft((current) => ({
      ...current,
      [targetCultureId]: {
        ...(current[targetCultureId] ?? {}),
        [key]: value,
      },
    }));
  }, []);

  const save = useCallback(async () => {
    if (!resolvedTranslationsData) {
      return false;
    }

    setFormError(null);

    try {
      const payload = buildTranslationsSavePayload(resolvedTranslationsData, draft);
      await updateMutation.mutateAsync(payload);
      bootstrapCultureTranslationRuntime({
        revision: payload.revision,
        cultureOverrides: payload.cultureOverrides,
      });
      setSavedDraft(draft);
      setToast({ type: 'success', text: 'Translations saved.' });
      return true;
    } catch (error) {
      setFormError(formatQueryError(error, 'Failed to save translations.'));
      return false;
    }
  }, [draft, resolvedTranslationsData, updateMutation]);

  const activeTitle = useMemo(() => {
    if (mode === 'all') {
      return 'Builtin Translations';
    }

    const culture = resolvedTranslationsData?.cultures.find((entry) => entry.id === cultureId);
    return culture ? `${resolveCultureDisplayLabel(culture)} Translations` : 'Translations';
  }, [cultureId, mode, resolvedTranslationsData?.cultures]);

  const handlePageSizeChange = useCallback((nextSize: number) => {
    setPageSize(nextSize);
    presentation.setPage(1);
  }, [presentation, setPageSize]);

  const handleSortByChange = useCallback((value: CultureTranslationSortField) => {
    setSortBy(value);
  }, []);

  const toggleSortDirection = useCallback(() => {
    setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
  }, []);

  return {
    open,
    mode,
    cultureId,
    search,
    setSearch,
    draft,
    filteredKeys,
    visibleKeys: presentation.displayItems,
    presentation,
    pageSize,
    setPageSize: handlePageSizeChange,
    listMode,
    setListMode,
    sortBy,
    sortDirection,
    sortOptions: CULTURE_TRANSLATION_SORT_OPTIONS,
    setSortBy: handleSortByChange,
    toggleSortDirection,
    activeCultureIds,
    activeCultureColumns,
    activeModalDirection,
    activeTitle,
    translationsQuery,
    resolvedTranslationsData,
    formError,
    toast,
    isDirty,
    isSaving: updateMutation.isPending,
    openAll,
    openForCulture,
    close,
    updateTranslation,
    save,
  };
}

export type CultureTranslationsModalModel = ReturnType<typeof useCultureTranslationsModal>;
