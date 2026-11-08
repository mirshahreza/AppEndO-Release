import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSettingsWebFontsOverlayDeepLink } from '../../hooks/useSettingsWebFontsOverlayDeepLink';
import { formatQueryError } from '../../../../shared/api/client';
import { setPlatformWebFonts } from '../../../../core/culture/platformWebFontRegistry';
import {
  useDeletePlatformWebFontMutation,
  usePlatformWebFontsQuery,
  useUpdatePlatformWebFontScriptMutation,
  useUploadPlatformWebFontMutation,
} from '../../../../shared/api/queries/platformWebFonts';
import type { PlatformWebFont, WebFontScript } from '../../../../shared/api/contracts/platform/webFonts';
import { APP_LIST_PREFERENCE_KEYS } from '../../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../../shared/lib/usePersistedListPreferences';
import {
  WEB_FONT_SCRIPT_FILTER_OPTIONS,
  type WebFontPreviewSize,
  type WebFontScriptFilter,
} from './constants';

type ToastState = { type: 'success' | 'error'; text: string } | null;

type WebFontsListFilters = {
  searchInput: string;
  scriptFilter: WebFontScriptFilter;
};

const DEFAULT_WEB_FONTS_FILTERS: WebFontsListFilters = {
  searchInput: '',
  scriptFilter: 'all',
};

const WEB_FONT_SCRIPT_FILTER_VALUES: ReadonlySet<string> = new Set(
  WEB_FONT_SCRIPT_FILTER_OPTIONS.map((option) => option.value),
);

function sanitizeWebFontsFilters(raw: unknown): WebFontsListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const scriptFilter = typeof record.scriptFilter === 'string'
    && WEB_FONT_SCRIPT_FILTER_VALUES.has(record.scriptFilter)
    ? record.scriptFilter as WebFontScriptFilter
    : 'all';
  return {
    searchInput: typeof record.searchInput === 'string' ? record.searchInput : '',
    scriptFilter,
  };
}

const ALLOWED_FONT_EXTENSIONS = new Set(['woff2', 'woff', 'ttf', 'otf']);

function deriveLabelFromFileName(fileName: string): string {
  const stem = fileName.replace(/\.[^.]+$/, '').trim();
  if (!stem) {
    return 'Custom Font';
  }

  return stem
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function isAllowedFontFile(file: File): boolean {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  return ALLOWED_FONT_EXTENSIONS.has(extension);
}

function filterWebFonts(
  fonts: PlatformWebFont[],
  searchInput: string,
  scriptFilter: WebFontScriptFilter,
): PlatformWebFont[] {
  let result = fonts;

  if (scriptFilter !== 'all') {
    result = result.filter((font) => font.script === scriptFilter);
  }

  const needle = searchInput.trim().toLowerCase();
  if (!needle) {
    return result;
  }

  return result.filter((font) => [
    font.label,
    font.family,
    font.id,
    font.script,
    font.format,
  ].join(' ').toLowerCase().includes(needle));
}

export function useWebFontsSection(options?: { enabled?: boolean }) {
  const enabled = options?.enabled ?? true;
  const fontsQuery = usePlatformWebFontsQuery(enabled);
  const uploadMutation = useUploadPlatformWebFontMutation();
  const updateScriptMutation = useUpdatePlatformWebFontScriptMutation();
  const deleteMutation = useDeletePlatformWebFontMutation();
  const uploadInputRef = useRef<HTMLInputElement>(null);

  const [formError, setFormError] = useState<string | null>(null);
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.webFonts,
    defaultFilters: DEFAULT_WEB_FONTS_FILTERS,
    sanitize: sanitizeWebFontsFilters,
  });
  const { searchInput, scriptFilter } = filters;
  const setSearchInput = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, searchInput: next }));
  }, [setFilters]);
  const setScriptFilter = useCallback((next: WebFontScriptFilter) => {
    setFilters((prev) => ({ ...prev, scriptFilter: next }));
  }, [setFilters]);
  const [previewSize, setPreviewSize] = useState<WebFontPreviewSize>(12);
  const [previewBold, setPreviewBold] = useState(false);
  const [previewItalic, setPreviewItalic] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const filteredFonts = useMemo(
    () => filterWebFonts(fontsQuery.data ?? [], searchInput, scriptFilter),
    [fontsQuery.data, searchInput, scriptFilter],
  );

  useEffect(() => {
    if (!fontsQuery.data) {
      return;
    }
    setPlatformWebFonts(fontsQuery.data);
  }, [fontsQuery.data]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const openUploadPicker = useCallback(() => {
    uploadInputRef.current?.click();
  }, []);

  const handleFilesSelected = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      return;
    }

    const invalid = files.filter((file) => !isAllowedFontFile(file));
    if (invalid.length > 0) {
      setToast({ type: 'error', text: 'Fonts must be WOFF2, WOFF, TTF, or OTF files.' });
      return;
    }

    setFormError(null);

    let uploadedCount = 0;
    try {
      for (const file of files) {
        const label = deriveLabelFromFileName(file.name);
        await uploadMutation.mutateAsync({
          file,
          label,
          family: label,
        });
        uploadedCount += 1;
      }

      setToast({
        type: 'success',
        text: uploadedCount === 1 ? 'Web font uploaded.' : `${uploadedCount} web fonts uploaded.`,
      });
    } catch (error) {
      const message = formatQueryError(error, 'Failed to upload web font.');
      if (uploadedCount > 0) {
        setToast({
          type: 'error',
          text: `${uploadedCount} of ${files.length} fonts uploaded. ${message}`,
        });
      } else {
        setToast({ type: 'error', text: message });
      }
    }
  }, [uploadMutation]);

  const updateFontScript = useCallback(async (fontId: string, script: WebFontScript) => {
    try {
      await updateScriptMutation.mutateAsync({ fontId, script });
      return true;
    } catch (error) {
      setToast({ type: 'error', text: formatQueryError(error, 'Failed to update font script.') });
      return false;
    }
  }, [updateScriptMutation]);

  const copyFontSnippet = useCallback(async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast({ type: 'success', text: successMessage });
    } catch {
      setToast({ type: 'error', text: 'Failed to copy to clipboard.' });
    }
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!deleteTargetId) {
      return false;
    }

    try {
      await deleteMutation.mutateAsync(deleteTargetId);
      setDeleteTargetId(null);
      setToast({ type: 'success', text: 'Web font deleted.' });
      return true;
    } catch (error) {
      setFormError(formatQueryError(error, 'Failed to delete web font.'));
      return false;
    }
  }, [deleteMutation, deleteTargetId]);

  const fontIds = useMemo(
    () => (fontsQuery.data ?? []).map((font) => font.id),
    [fontsQuery.data],
  );

  useSettingsWebFontsOverlayDeepLink({
    deleteTargetId,
    setDeleteTargetId,
    fontIds,
  });

  return {
    fontsQuery,
    filteredFonts,
    searchInput,
    setSearchInput,
    scriptFilter,
    setScriptFilter,
    previewSize,
    setPreviewSize,
    previewBold,
    setPreviewBold,
    previewItalic,
    setPreviewItalic,
    uploadInputRef,
    formError,
    deleteTargetId,
    toast,
    isUploading: uploadMutation.isPending,
    isUpdatingScript: updateScriptMutation.isPending,
    isDeleting: deleteMutation.isPending,
    setDeleteTargetId,
    openUploadPicker,
    handleFilesSelected,
    updateFontScript,
    copyFontSnippet,
    confirmDelete,
  };
}

export type WebFontsSectionModel = ReturnType<typeof useWebFontsSection>;
