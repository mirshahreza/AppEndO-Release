import { useCallback, useMemo, useRef, useState } from 'react';
import {
  useExportPlatformTransferMutation,
  useImportPlatformTransferMutation,
  usePlatformTransferCatalogQuery,
  downloadPlatformTransferBundle,
} from '../../../../shared/api/queries/platformTransfer';
import {
  PLATFORM_TRANSFER_GROUP_LABELS,
  defaultPlatformTransferSelection,
  isPlatformTransferSectionKey,
  type PlatformTransferBundle,
  type PlatformTransferCatalogEntry,
  type PlatformTransferGroupId,
  type PlatformTransferSectionKey,
} from '../../../../shared/api/contracts/settings/platformTransfer';

export type PlatformTransferMode = 'export' | 'import';

export function usePlatformTransferPage() {
  const catalogQuery = usePlatformTransferCatalogQuery();
  const exportMutation = useExportPlatformTransferMutation();
  const importMutation = useImportPlatformTransferMutation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<PlatformTransferMode>('export');
  const [selectedKeys, setSelectedKeys] = useState<PlatformTransferSectionKey[]>(defaultPlatformTransferSelection);
  const [pendingBundle, setPendingBundle] = useState<PlatformTransferBundle | null>(null);
  const [importFileName, setImportFileName] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const catalog = catalogQuery.data ?? [];
  const catalogByGroup = useMemo(() => {
    const groups = new Map<PlatformTransferGroupId, PlatformTransferCatalogEntry[]>();
    for (const entry of catalog) {
      const current = groups.get(entry.group) ?? [];
      current.push(entry);
      groups.set(entry.group, current);
    }
    return groups;
  }, [catalog]);

  const selectedSet = useMemo(() => new Set(selectedKeys), [selectedKeys]);

  const toggleKey = useCallback((key: PlatformTransferSectionKey, checked: boolean) => {
    setSelectedKeys((current) => {
      if (checked) {
        return current.includes(key) ? current : [...current, key];
      }
      return current.filter((item) => item !== key);
    });
  }, []);

  const selectDefaults = useCallback(() => {
    setSelectedKeys(defaultPlatformTransferSelection());
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedKeys([]);
  }, []);

  const handleExport = useCallback(async () => {
    setErrorMessage(null);
    setStatusMessage(null);
    if (selectedKeys.length === 0) {
      setErrorMessage('Select at least one section to export.');
      return;
    }

    try {
      const bundle = await exportMutation.mutateAsync(selectedKeys);
      downloadPlatformTransferBundle(bundle);
      setStatusMessage(`Exported ${bundle.exportedAt.slice(0, 19).replace('T', ' ')} UTC (${selectedKeys.length} section(s)).`);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Export failed.');
    }
  }, [exportMutation, selectedKeys]);

  const parseBundleFile = useCallback(async (file: File) => {
    setErrorMessage(null);
    setStatusMessage(null);

    const text = await file.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      setErrorMessage('Selected file is not valid JSON.');
      return;
    }

    if (!parsed || typeof parsed !== 'object') {
      setErrorMessage('Import bundle must be a JSON object.');
      return;
    }

    const bundle = parsed as PlatformTransferBundle;
    if (bundle.version !== 1 || !bundle.sections || typeof bundle.sections !== 'object') {
      setErrorMessage('Unsupported or invalid transfer bundle format.');
      return;
    }

    const bundleKeys = Object.keys(bundle.sections).filter(isPlatformTransferSectionKey);
    if (bundleKeys.length === 0) {
      setErrorMessage('Transfer bundle does not contain any known sections.');
      return;
    }

    setPendingBundle(bundle);
    setImportFileName(file.name);
    setSelectedKeys((current) => {
      const intersection = current.filter((key) => bundleKeys.includes(key));
      return intersection.length > 0 ? intersection : bundleKeys;
    });
    setMode('import');
    setStatusMessage(`Loaded ${file.name} (${bundleKeys.length} section(s)).`);
  }, []);

  const cancelImport = useCallback(() => {
    setPendingBundle(null);
    setImportFileName(null);
    setErrorMessage(null);
    setStatusMessage(null);
    setSelectedKeys(defaultPlatformTransferSelection());
  }, []);

  const handleImport = useCallback(async () => {
    setErrorMessage(null);
    setStatusMessage(null);

    if (!pendingBundle) {
      setErrorMessage('Choose a transfer bundle file first.');
      return;
    }
    if (selectedKeys.length === 0) {
      setErrorMessage('Select at least one section to import.');
      return;
    }

    try {
      const result = await importMutation.mutateAsync({
        sections: selectedKeys,
        bundle: pendingBundle,
      });
      setStatusMessage(`Imported ${result.imported.length} section(s).`);
      setPendingBundle(null);
      setImportFileName(null);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Import failed.');
    }
  }, [importMutation, pendingBundle, selectedKeys]);

  const bundleSectionKeys = useMemo(
    () => (pendingBundle ? Object.keys(pendingBundle.sections).filter(isPlatformTransferSectionKey) : []),
    [pendingBundle],
  );

  const hasSensitiveSelection = useMemo(
    () => selectedKeys.some((key) => catalog.find((entry) => entry.key === key)?.sensitive),
    [catalog, selectedKeys],
  );

  const importPreviewEntries = useMemo(
    () => bundleSectionKeys
      .map((key) => catalog.find((entry) => entry.key === key))
      .filter((entry): entry is PlatformTransferCatalogEntry => entry != null),
    [bundleSectionKeys, catalog],
  );

  const hasSensitiveImport = useMemo(
    () => importPreviewEntries.some((entry) => entry.sensitive),
    [importPreviewEntries],
  );

  return {
    mode,
    setMode,
    catalog,
    catalogByGroup,
    groupLabels: PLATFORM_TRANSFER_GROUP_LABELS,
    selectedSet,
    selectedCount: selectedKeys.length,
    toggleKey,
    selectDefaults,
    clearSelection,
    handleExport,
    handleImport,
    cancelImport,
    parseBundleFile,
    fileInputRef,
    pendingBundle,
    importFileName,
    bundleSectionKeys,
    hasSensitiveSelection,
    importPreviewEntries,
    hasSensitiveImport,
    statusMessage,
    errorMessage,
    isLoading: catalogQuery.isLoading,
    isExporting: exportMutation.isPending,
    isImporting: importMutation.isPending,
  };
}

export type PlatformTransferPageModel = ReturnType<typeof usePlatformTransferPage>;
