import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useOptionalPortal } from '../../../app/platform/PortalContext';
import { usePlatformMount } from '../../../app/platform/PlatformMountContext';
import { useAccentTheme } from '../../../contexts/AccentThemeContext';
import { useClientContext } from '../../../contexts/ClientContextContext';
import { formatApiErrorMessage, isApiError } from '../../../shared/api/client';
import {
  useThemePresetQuery,
  useUpdateThemePresetMutation,
} from '../../../shared/api/queries/appearance-presets';
import type { AccentPaletteSource } from '../../../shared/theme/accentColorUtils';
import {
  persistThemeTokenMap,
  reconcileNeutralChromeTokens,
  syncDerivedThemeTokens,
  type ThemeTokenMap,
} from '../../../shared/theme/themePresetUtils';
import {
  applyAppearanceLivePreview,
  setAppearanceLivePreviewTokens,
} from '../../../shared/theme/appearanceLivePreview';
import {
  THEME_PRESETS_CONTEXT_KEY,
  upsertUserThemePresetTokens,
} from '../../../shared/theme/userThemePresets';
import {
  buildAppearanceListRelativePath,
  parseAppearanceEditId,
  resolveActiveAppearanceSwatchId,
  resolveAppearanceRouteSuffix,
} from '../lib/appearanceRoute';

const AUTO_SAVE_DEBOUNCE_MS = 450;
const HISTORY_LIMIT = 50;

type ThemeDraft = {
  swatchId: string;
  label: string;
  baseHex: string;
  source: AccentPaletteSource;
  tokens: ThemeTokenMap;
};

const buildDraftFromPreset = (preset: {
  id: string;
  name: string;
  baseHex: string;
  source: AccentPaletteSource;
  tokens: ThemeTokenMap;
}): ThemeDraft => ({
  swatchId: preset.id,
  label: preset.name,
  baseHex: preset.baseHex,
  source: preset.source,
  tokens: reconcileNeutralChromeTokens(preset.tokens, preset.baseHex, preset.source),
});

const cloneThemeTokens = (tokens: ThemeTokenMap): ThemeTokenMap => ({ ...tokens });

export function useAppearancePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { mountId, toMountPath } = usePlatformMount();
  const application = useOptionalPortal();
  const { accentHex } = useAccentTheme();
  const { clientContext, patchClientContext } = useClientContext();
  const routeParamSuffix = useParams()['*'];
  const applicationSuffix = application?.pageRemainderPath.replace(/^\/+/, '') || undefined;
  const pathSuffix = resolveAppearanceRouteSuffix(applicationSuffix ?? routeParamSuffix);
  const activeSwatchId = useMemo(
    () => resolveActiveAppearanceSwatchId(accentHex),
    [accentHex],
  );

  const detailQuery = useThemePresetQuery(activeSwatchId);
  const updateMutation = useUpdateThemePresetMutation();

  const [draft, setDraft] = useState<ThemeDraft | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [historyVersion, setHistoryVersion] = useState(0);

  const isDirtyRef = useRef(false);
  const isSavingRef = useRef(false);
  const hydratedSwatchIdRef = useRef<string | null>(null);
  const draftRef = useRef<ThemeDraft | null>(null);
  const pastTokensRef = useRef<ThemeTokenMap[]>([]);
  const futureTokensRef = useRef<ThemeTokenMap[]>([]);
  const isApplyingHistoryRef = useRef(false);

  draftRef.current = draft;

  const resetHistory = useCallback(() => {
    pastTokensRef.current = [];
    futureTokensRef.current = [];
    setHistoryVersion((version) => version + 1);
  }, []);

  const bumpHistory = useCallback(() => {
    setHistoryVersion((version) => version + 1);
  }, []);

  const pushHistorySnapshot = useCallback((tokens: ThemeTokenMap) => {
    pastTokensRef.current = [
      ...pastTokensRef.current.slice(-(HISTORY_LIMIT - 1)),
      cloneThemeTokens(tokens),
    ];
    futureTokensRef.current = [];
    bumpHistory();
  }, [bumpHistory]);

  const applyDraftTokens = useCallback((
    tokens: ThemeTokenMap,
    options?: { preferredMirrorKey?: string },
  ) => {
    const syncedTokens = syncDerivedThemeTokens(tokens, options);
    applyAppearanceLivePreview(syncedTokens);
    return syncedTokens;
  }, []);

  const persistTokens = useCallback(async (tokens: ThemeTokenMap) => {
    isSavingRef.current = true;
    try {
      const syncedTokens = syncDerivedThemeTokens(tokens);
      const saved = await updateMutation.mutateAsync({
        swatchId: activeSwatchId,
        payload: {
          tokens: syncedTokens,
        },
      });
      persistThemeTokenMap(saved.tokens);
      patchClientContext({
        [THEME_PRESETS_CONTEXT_KEY]: upsertUserThemePresetTokens(
          clientContext[THEME_PRESETS_CONTEXT_KEY],
          activeSwatchId,
          saved.tokens,
        ),
      });
      isDirtyRef.current = false;
      setFormError(null);
    } catch (error) {
      setFormError(isApiError(error) ? formatApiErrorMessage(error) : 'Failed to save theme preset.');
    } finally {
      isSavingRef.current = false;
    }
  }, [activeSwatchId, clientContext, patchClientContext, updateMutation]);

  const commitTokens = useCallback((
    produceNextTokens: (current: ThemeTokenMap) => ThemeTokenMap,
    options?: { recordHistory?: boolean; preferredMirrorKey?: string },
  ) => {
    const current = draftRef.current;
    if (!current) {
      return;
    }

    if (options?.recordHistory !== false && !isApplyingHistoryRef.current) {
      pushHistorySnapshot(current.tokens);
    }

    const nextTokens = applyDraftTokens(
      produceNextTokens(current.tokens),
      { preferredMirrorKey: options?.preferredMirrorKey },
    );

    setDraft({
      ...current,
      tokens: nextTokens,
    });
    isDirtyRef.current = true;
    setFormError(null);
  }, [applyDraftTokens, pushHistorySnapshot]);

  useEffect(() => {
    if (!parseAppearanceEditId(pathSuffix)) {
      return;
    }
    navigate(toMountPath(buildAppearanceListRelativePath(mountId)), { replace: true });
  }, [mountId, navigate, pathSuffix, toMountPath]);

  useEffect(() => {
    if (!detailQuery.data || detailQuery.data.id !== activeSwatchId) {
      return;
    }

    if (hydratedSwatchIdRef.current === activeSwatchId && draftRef.current) {
      return;
    }

    const nextDraft = buildDraftFromPreset(detailQuery.data);
    setDraft(nextDraft);
    applyAppearanceLivePreview(nextDraft.tokens);
    isDirtyRef.current = false;
    setFormError(null);
    hydratedSwatchIdRef.current = activeSwatchId;
    resetHistory();
  }, [activeSwatchId, detailQuery.data, resetHistory]);

  useEffect(() => {
    if (!isDirtyRef.current || !draftRef.current?.tokens) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      const currentDraft = draftRef.current;
      if (!currentDraft?.tokens || !isDirtyRef.current) {
        return;
      }
      void persistTokens(currentDraft.tokens);
    }, AUTO_SAVE_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [draft?.tokens, persistTokens]);

  useEffect(() => () => {
    setAppearanceLivePreviewTokens(null);
  }, []);

  const updateToken = useCallback((key: string, value: string) => {
    commitTokens(
      (tokens) => ({ ...tokens, [key]: value }),
      { preferredMirrorKey: key },
    );
  }, [commitTokens]);

  const regenerateFromBase = useCallback(() => {
    const current = draftRef.current;
    if (!current) {
      return;
    }

    pushHistorySnapshot(current.tokens);
    isDirtyRef.current = false;
    isSavingRef.current = true;
    void (async () => {
      try {
        const saved = await updateMutation.mutateAsync({
          swatchId: activeSwatchId,
          payload: { resetToDefaults: true },
        });
        const nextDraft = buildDraftFromPreset(saved);
        setDraft(nextDraft);
        applyAppearanceLivePreview(nextDraft.tokens);
        persistThemeTokenMap(saved.tokens);
        patchClientContext({
          [THEME_PRESETS_CONTEXT_KEY]: upsertUserThemePresetTokens(
            clientContext[THEME_PRESETS_CONTEXT_KEY],
            activeSwatchId,
            null,
          ),
        });
        isDirtyRef.current = false;
        setFormError(null);
      } catch (error) {
        setFormError(isApiError(error) ? formatApiErrorMessage(error) : 'Failed to reset theme preset.');
      } finally {
        isSavingRef.current = false;
      }
    })();
  }, [activeSwatchId, clientContext, patchClientContext, pushHistorySnapshot, updateMutation]);

  const undo = useCallback(() => {
    const previous = pastTokensRef.current.pop();
    const current = draftRef.current;
    if (!previous || !current) {
      return;
    }

    isApplyingHistoryRef.current = true;
    futureTokensRef.current.push(cloneThemeTokens(current.tokens));
    const nextTokens = applyDraftTokens(previous);
    setDraft({
      ...current,
      tokens: nextTokens,
    });
    isDirtyRef.current = true;
    setFormError(null);
    bumpHistory();
    isApplyingHistoryRef.current = false;
  }, [applyDraftTokens, bumpHistory]);

  const redo = useCallback(() => {
    const next = futureTokensRef.current.pop();
    const current = draftRef.current;
    if (!next || !current) {
      return;
    }

    isApplyingHistoryRef.current = true;
    pastTokensRef.current.push(cloneThemeTokens(current.tokens));
    const nextTokens = applyDraftTokens(next);
    setDraft({
      ...current,
      tokens: nextTokens,
    });
    isDirtyRef.current = true;
    setFormError(null);
    bumpHistory();
    isApplyingHistoryRef.current = false;
  }, [applyDraftTokens, bumpHistory]);

  const retryLoad = useCallback(() => {
    void detailQuery.refetch();
  }, [detailQuery]);

  const reloadSavedPreset = useCallback(async () => {
    setFormError(null);
    try {
      const result = await detailQuery.refetch();
      const preset = result.data;
      if (!preset || preset.id !== activeSwatchId) {
        return;
      }
      const nextDraft = buildDraftFromPreset(preset);
      setDraft(nextDraft);
      applyAppearanceLivePreview(nextDraft.tokens);
      isDirtyRef.current = false;
      resetHistory();
    } catch {
      setFormError('Failed to reload saved theme preset.');
    }
  }, [activeSwatchId, detailQuery, resetHistory]);

  const canUndo = useMemo(() => pastTokensRef.current.length > 0, [historyVersion]);
  const canRedo = useMemo(() => futureTokensRef.current.length > 0, [historyVersion]);

  return {
    swatchId: activeSwatchId,
    draft,
    formError,
    updateToken,
    regenerateFromBase,
    reloadSavedPreset,
    undo,
    redo,
    canUndo,
    canRedo,
    isEditorLoading: detailQuery.isLoading || !draft,
    isEditorError: detailQuery.isError,
    editorErrorMessage: detailQuery.error?.message,
    isPersisting: updateMutation.isPending,
    isRefreshing: detailQuery.isFetching,
    retryLoad,
    pathname: location.pathname,
  };
}

export type AppearancePageModel = ReturnType<typeof useAppearancePage>;
