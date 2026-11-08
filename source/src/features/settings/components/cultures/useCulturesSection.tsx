import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { formatQueryError } from '../../../../shared/api/client';
import {
  compareCulturePackDisplayOrder,
  CULTURE_PACK_ID_PATTERN,
  resolveCulturePackSource,
  type PlatformCulturePack,
  type PlatformCulturePackSummary,
} from '../../../../shared/api/contracts/platform/cultures';
import { usePlatformCulturesQuery } from '../../../../shared/api/queries/platform';
import { useUpdatePlatformCulturesMutation } from '../../../../shared/api/queries/platformCrud';
import {
  applyDerivedCulturePack,
  deriveCultureLanguage,
  deriveCultureId,
  deriveTranslationBundleId,
  EMPTY_CULTURE_PACK,
  resolveCultureDisplayLabel,
} from './constants';
import { validateCultureTypographyOverride } from '../../../../core/culture/cultureTypographyMerge';
import { useCultureTranslationsModal } from './useCultureTranslationsModal';
import { useSettingsCulturesOverlayDeepLink } from '../../hooks/useSettingsCulturesOverlayDeepLink';

export type CulturesDraftState = {
  packs: PlatformCulturePack[];
  enabledCulturePackIds: string[];
  defaultCultureId: string;
};

type ToastState = { type: 'success' | 'error'; text: string } | null;

export type CultureFormMode = 'create' | 'edit';

function normalizeDraft(input: CulturesDraftState): CulturesDraftState {
  const packs = input.packs
    .map((pack) => applyDerivedCulturePack({
      ...pack,
      defaultTimezone: pack.defaultTimezone?.trim() || undefined,
      typography: pack.typography?.defaultFontId
        ? {
          defaultFontId: pack.typography.defaultFontId.trim(),
          fonts: pack.typography.fonts,
        }
        : undefined,
    }, { preserveId: pack.id.trim() }))
    .map((pack) => ({
      ...pack,
      language: deriveCultureLanguage(pack.locale, pack.translationBundleId),
    }))
    .filter((pack) => pack.id);

  const packIds = packs.map((pack) => pack.id);
  const enabledCulturePackIds = packIds;
  const defaultCultureId = input.defaultCultureId.trim();

  return {
    packs,
    enabledCulturePackIds,
    defaultCultureId: packIds.includes(defaultCultureId)
      ? defaultCultureId
      : (packIds[0] ?? 'us'),
  };
}

export function validateCulturesDraft(
  draft: CulturesDraftState,
  availablePackIds: string[],
): string | null {
  const defaultCultureId = draft.defaultCultureId.trim();
  const packIds = draft.packs.map((pack) => pack.id.trim()).filter(Boolean);

  if (draft.packs.length === 0) {
    return 'At least one culture pack must be configured.';
  }

  const seenPackIds = new Set<string>();
  for (const pack of draft.packs) {
    const id = pack.id.trim();
    if (!id) {
      continue;
    }
    if (!pack.locale.trim()) {
      return 'Culture locale is required.';
    }
    if (!CULTURE_PACK_ID_PATTERN.test(id)) {
      return `Culture id "${id}" must be 2-32 lowercase letters, numbers, or hyphens.`;
    }
    if (seenPackIds.has(id)) {
      return `Duplicate culture id: ${id}`;
    }
    seenPackIds.add(id);
  }

  for (const cultureId of packIds) {
    if (!availablePackIds.includes(cultureId)) {
      return `Unknown culture pack id: ${cultureId}`;
    }
  }

  if (!availablePackIds.includes(defaultCultureId)) {
    return `Unknown default culture id: ${defaultCultureId}`;
  }

  if (!packIds.includes(defaultCultureId)) {
    return 'Default culture must be one of the configured packs.';
  }

  return null;
}

export function validateCultureForm(
  form: PlatformCulturePack,
  mode: CultureFormMode,
  existingPackIds: string[],
): string | null {
  const locale = form.locale.trim();
  const preservedId = mode === 'edit' ? form.id.trim() : undefined;
  const reservedIds = mode === 'create'
    ? existingPackIds
    : existingPackIds.filter((id) => id !== preservedId);
  const translationBundleId = deriveTranslationBundleId(preservedId ?? '', locale);
  const id = deriveCultureId(locale, form.calendar, reservedIds, preservedId);

  if (!locale) {
    return 'Locale is required.';
  }

  if (!id || !CULTURE_PACK_ID_PATTERN.test(id)) {
    return 'Could not derive a valid culture id from locale.';
  }

  if (mode === 'create' && existingPackIds.includes(id)) {
    return `Culture for locale "${locale}" already exists.`;
  }

  const typographyError = validateCultureTypographyOverride(translationBundleId, form.typography);
  if (typographyError) {
    return typographyError;
  }

  return null;
}

export function useCulturesSection(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const culturesQuery = usePlatformCulturesQuery(enabled);
  const updateMutation = useUpdatePlatformCulturesMutation();

  const [savedDraft, setSavedDraft] = useState<CulturesDraftState>({
    packs: [],
    enabledCulturePackIds: [],
    defaultCultureId: 'us',
  });
  const [draft, setDraft] = useState<CulturesDraftState>(savedDraft);
  const translationsModal = useCultureTranslationsModal(enabled, draft.packs);
  const [formError, setFormError] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<CultureFormMode>('create');
  const [form, setForm] = useState<PlatformCulturePack>(EMPTY_CULTURE_PACK);
  const [formModalError, setFormModalError] = useState<string | null>(null);

  const [deleteTarget, setDeleteTarget] = useState<PlatformCulturePackSummary | null>(null);

  const savedDraftRef = useRef(savedDraft);
  savedDraftRef.current = savedDraft;
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!culturesQuery.data) {
      return;
    }

    const next: CulturesDraftState = {
      packs: (culturesQuery.data.packs ?? []).map((pack) => ({ ...pack })),
      enabledCulturePackIds: [...culturesQuery.data.enabledCulturePackIds],
      defaultCultureId: culturesQuery.data.defaultCultureId,
    };
    const isDirty = JSON.stringify(normalizeDraft(draftRef.current))
      !== JSON.stringify(normalizeDraft(savedDraftRef.current));
    setSavedDraft(next);
    if (!isDirty) {
      setDraft(next);
    }
    setFormError(null);
  }, [culturesQuery.data]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const rows = useMemo((): PlatformCulturePackSummary[] => {
    return draft.packs
      .map((pack) => ({
        ...pack,
        source: resolveCulturePackSource(pack.id),
      }))
      .sort((left, right) => compareCulturePackDisplayOrder(left.id, right.id));
  }, [draft.packs]);

  const isDirty = useMemo(
    () => JSON.stringify(normalizeDraft(savedDraft)) !== JSON.stringify(normalizeDraft(draft)),
    [draft, savedDraft],
  );

  const isDefaultPack = useCallback(
    (packId: string) => draft.defaultCultureId === packId,
    [draft.defaultCultureId],
  );

  const persistDraft = useCallback(async (
    nextDraft: CulturesDraftState,
    successMessage = 'Culture settings saved.',
  ): Promise<boolean> => {
    const payload = normalizeDraft(nextDraft);
    const packIds = payload.packs.map((pack) => pack.id);
    const validationError = validateCulturesDraft(payload, packIds);
    if (validationError) {
      setFormError(validationError);
      return false;
    }

    setFormError(null);

    try {
      await updateMutation.mutateAsync(payload);
      setSavedDraft(payload);
      setDraft(payload);
      setToast({ type: 'success', text: successMessage });
      return true;
    } catch (error) {
      setFormError(formatQueryError(error, 'Failed to save culture settings.'));
      return false;
    }
  }, [updateMutation]);

  const save = useCallback(async () => persistDraft(draft), [draft, persistDraft]);

  const setDefaultCulture = useCallback((packId: string) => {
    const current = draftRef.current;
    if (!current.packs.some((pack) => pack.id === packId)) {
      return;
    }

    const nextDraft = normalizeDraft({
      ...current,
      defaultCultureId: packId,
    });
    setDraft(nextDraft);
    void persistDraft(nextDraft, 'Default culture updated.');
  }, [persistDraft]);

  const openCreateModal = useCallback(() => {
    setFormMode('create');
    setForm({ ...EMPTY_CULTURE_PACK });
    setFormModalError(null);
    setFormOpen(true);
  }, []);

  const openEditModal = useCallback((pack: PlatformCulturePackSummary) => {
    if (pack.id === draft.defaultCultureId) {
      return;
    }

    setFormMode('edit');
    setForm({
      id: pack.id,
      label: pack.label,
      language: pack.language,
      locale: pack.locale,
      calendar: pack.calendar,
      direction: pack.direction,
      translationBundleId: pack.translationBundleId ?? 'us',
      defaultTimezone: pack.defaultTimezone,
      typography: pack.typography,
    });
    setFormModalError(null);
    setFormOpen(true);
  }, [draft.defaultCultureId]);

  const closeFormModal = useCallback(() => {
    setFormOpen(false);
    setFormModalError(null);
  }, []);

  const applyFormToDraft = useCallback(async () => {
    const current = draftRef.current;
    const existingPackIds = current.packs.map((pack) => pack.id);
    const validationError = validateCultureForm(
      form,
      formMode,
      formMode === 'create' ? existingPackIds : existingPackIds.filter((id) => id !== form.id.trim()),
    );
    if (validationError) {
      setFormModalError(validationError);
      return false;
    }

    const reservedIds = formMode === 'create'
      ? existingPackIds
      : existingPackIds.filter((id) => id !== form.id.trim());
    const normalized = applyDerivedCulturePack(form, {
      preserveId: formMode === 'edit' ? form.id.trim() : undefined,
      existingIds: reservedIds,
    });

    const packs = formMode === 'create'
      ? [...current.packs, normalized].sort((left, right) => compareCulturePackDisplayOrder(left.id, right.id))
      : current.packs.map((pack) => (pack.id === normalized.id ? normalized : pack));

    const nextDraft = normalizeDraft({
      ...current,
      packs,
    });

    setDraft(nextDraft);
    setFormModalError(null);
    setFormOpen(false);

    const successMessage = formMode === 'create'
      ? 'Culture created.'
      : 'Culture updated.';
    return persistDraft(nextDraft, successMessage);
  }, [form, formMode, persistDraft]);

  const confirmDelete = useCallback(async () => {
    const target = deleteTarget;
    if (!target || target.id === draftRef.current.defaultCultureId) {
      return false;
    }

    const current = draftRef.current;
    if (current.packs.length <= 1) {
      setFormError('At least one culture pack must remain configured.');
      return false;
    }

    const nextDraft = normalizeDraft({
      ...current,
      packs: current.packs.filter((pack) => pack.id !== target.id),
    });

    setDraft(nextDraft);
    setDeleteTarget(null);
    setFormError(null);
    return persistDraft(nextDraft, 'Culture deleted.');
  }, [deleteTarget, persistDraft]);

  useSettingsCulturesOverlayDeepLink({
    formOpen,
    openCreateModal,
    translationsOpen: translationsModal.open,
    openTranslationsModal: translationsModal.openAll,
  });

  return {
    culturesQuery,
    rows,
    draft,
    formError,
    toast,
    isDirty,
    isSaving: updateMutation.isPending,
    isDefaultPack,
    setDefaultCulture,
    save,
    retryLoad: culturesQuery.refetch,
    formOpen,
    formMode,
    form,
    formModalError,
    setForm,
    openCreateModal,
    openEditModal,
    closeFormModal,
    applyFormToDraft,
    deleteTarget,
    setDeleteTarget,
    confirmDelete,
    translationsModal,
  };
}

export type CulturesSectionModel = ReturnType<typeof useCulturesSection>;
