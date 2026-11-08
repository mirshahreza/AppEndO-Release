import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  downloadPackageArtifact,
  fetchPackageDetail,
  useApplyPackageDeploymentMutation,
  useDeletePackageMutation,
  useInstallPackageMutation,
  usePackageFeatureFlagsQuery,
  usePackagesGridQuery,
  useReinstallPackageMutation,
  useRepackPackageMutation,
  useUninstallPackageMutation,
} from '../../../shared/api/queries/packages';
import type { PackageRepackAdditionsPayload, PackageRepackChangedItem, PackageRepackRemovalsPayload } from '../../../shared/api/contracts/package/repack';
import type { PackageUninstallRemoveScope } from '../../../shared/api/contracts/package/uninstall';
import { DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE } from '../../../shared/api/contracts/package/uninstall';
import type {
  PackageDetail,
  PackageRow,
  PackageStatusFilter,
  PackagesToastState,
} from '../types';
import {
  filterPackageRowsByVersionVisibility,
  isPackageVersionSwitch,
  PACKAGE_INSTALL_OVERRIDE_POLICY,
  readPackageFailureLines,
  resolvePackageUninstallScopeForSubmit,
} from '../utils';
import { pickPackageZipFile, uploadPackageZipWithValidation } from '../utils/packageZipUpload';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { usePersistedListFilters } from '../../../shared/lib/usePersistedListPreferences';
import { useCurrentUserDisplay } from '../../../hooks/useCurrentUserDisplay';
import { formatPackageCreatedBy } from '../../../shared/lib/formatPackageCreatedBy';

type PackagesListFilters = {
  nameFilter: string;
  statusFilter: PackageStatusFilter;
  showOlderVersions: boolean;
};

const DEFAULT_PACKAGES_FILTERS: PackagesListFilters = {
  nameFilter: '',
  statusFilter: 'all',
  showOlderVersions: false,
};

const PACKAGE_STATUS_FILTERS: ReadonlyArray<PackageStatusFilter> = [
  'all',
  'installed',
  'not_installed',
  'failed',
  'busy',
];

function sanitizePackagesFilters(raw: unknown): PackagesListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return null;
  const record = raw as Record<string, unknown>;
  const statusFilter = typeof record.statusFilter === 'string'
    && (PACKAGE_STATUS_FILTERS as readonly string[]).includes(record.statusFilter)
    ? record.statusFilter as PackageStatusFilter
    : 'all';
  return {
    nameFilter: typeof record.nameFilter === 'string' ? record.nameFilter : '',
    statusFilter,
    showOlderVersions: typeof record.showOlderVersions === 'boolean' ? record.showOlderVersions : false,
  };
}

export function usePackagesPage() {
  const { currentUser, profile } = useCurrentUserDisplay();
  const gridQuery = usePackagesGridQuery();
  const featureFlagsQuery = usePackageFeatureFlagsQuery();
  const installPackageMutation = useInstallPackageMutation();
  const applyDeploymentMutation = useApplyPackageDeploymentMutation();
  const uninstallPackageMutation = useUninstallPackageMutation();
  const deletePackageMutation = useDeletePackageMutation();
  const reinstallPackageMutation = useReinstallPackageMutation();
  const repackPackageMutation = useRepackPackageMutation();

  const rows = gridQuery.data ?? [];
  const isLoading = gridQuery.isLoading;
  const error = gridQuery.error instanceof Error ? gridQuery.error.message : gridQuery.error ? String(gridQuery.error) : null;

  const [toast, setToast] = useState<PackagesToastState>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.packages,
    defaultFilters: DEFAULT_PACKAGES_FILTERS,
    sanitize: sanitizePackagesFilters,
  });
  const { nameFilter, statusFilter, showOlderVersions } = filters;

  const setNameFilter = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, nameFilter: next }));
  }, [setFilters]);

  const setStatusFilter = useCallback((next: PackageStatusFilter) => {
    setFilters((prev) => ({ ...prev, statusFilter: next }));
  }, [setFilters]);

  const setShowOlderVersions = useCallback((next: boolean) => {
    setFilters((prev) => ({ ...prev, showOlderVersions: next }));
  }, [setFilters]);

  const [installTarget, setInstallTarget] = useState<PackageRow | null>(null);
  const [installTargetDataSource, setInstallTargetDataSource] = useState('default');
  const [installOptionalRecords, setInstallOptionalRecords] = useState(true);

  const [uninstallTarget, setUninstallTarget] = useState<PackageRow | null>(null);
  const [uninstallRemoveScope, setUninstallRemoveScope] = useState<PackageUninstallRemoveScope>(
    DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE,
  );

  const [deleteTarget, setDeleteTarget] = useState<PackageRow | null>(null);
  const [deploymentTarget, setDeploymentTarget] = useState<PackageRow | null>(null);
  const [deploymentErrors, setDeploymentErrors] = useState<string[]>([]);
  const [failureNotice, setFailureNotice] = useState<{
    title: string;
    packageLabel: string;
    lines: string[];
    rolledBack: boolean;
  } | null>(null);

  const closeFailureNotice = useCallback(() => {
    setFailureNotice(null);
  }, []);

  const [detailTarget, setDetailTarget] = useState<PackageRow | null>(null);
  const [detailData, setDetailData] = useState<PackageDetail | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailStep, setDetailStep] = useState(0);
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);

  const [repairTarget, setRepairTarget] = useState<PackageRow | null>(null);

  const [repackTarget, setRepackTarget] = useState<PackageRow | null>(null);
  const [repackDiffItem, setRepackDiffItem] = useState<PackageRepackChangedItem | null>(null);
  const [repackErrors, setRepackErrors] = useState<string[]>([]);

  const isBuilderEnabled = featureFlagsQuery.data?.builderEnabled ?? true;

  useEffect(() => {
    if (!featureFlagsQuery.data) return;
    if (!featureFlagsQuery.data.builderEnabled) {
      setIsBuilderOpen(false);
    }
  }, [featureFlagsQuery.data]);

  useEffect(() => {
    if (!toast || toast.type === 'error') return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
  }, []);

  const dismissToast = useCallback(() => {
    setToast(null);
  }, []);

  const loadPackages = useCallback(async (options?: { silent?: boolean }) => {
    if (options?.silent) {
      await gridQuery.refetch();
      return;
    }
    await gridQuery.refetch();
  }, [gridQuery]);

  const filteredRows = useMemo(() => {
    const normalizedName = nameFilter.trim().toLowerCase();
    const statusFiltered = rows.filter((row) => {
      const matchesName = !normalizedName
        || row.displayName.toLowerCase().includes(normalizedName);

      const isBusy = row.installStatus === 'installing' || row.installStatus === 'uninstalling';
      const matchesStatus =
        statusFilter === 'all'
        || (statusFilter === 'installed' && row.installStatus === 'installed')
        || (statusFilter === 'not_installed' && row.installStatus === 'not_installed')
        || (statusFilter === 'failed' && row.installStatus === 'failed')
        || (statusFilter === 'busy' && isBusy);

      return matchesName && matchesStatus;
    });

    return filterPackageRowsByVersionVisibility(statusFiltered, showOlderVersions);
  }, [rows, nameFilter, statusFilter, showOlderVersions]);

  const visibleRows = useMemo(() => [...filteredRows], [filteredRows]);

  const handleDirectUpload = useCallback(async () => {
    if (isUploading) return;

    const file = await pickPackageZipFile();
    if (!file) return;

    setIsUploading(true);
    try {
      const createdBy = formatPackageCreatedBy(currentUser, profile);
      const message = await uploadPackageZipWithValidation(file, {
        createdBy: createdBy || undefined,
      });
      showToast('success', message);
      await loadPackages({ silent: true });
    } catch (err: unknown) {
      showToast('error', (err as Error).message || 'Upload failed.');
    } finally {
      setIsUploading(false);
    }
  }, [currentUser, isUploading, loadPackages, profile, showToast]);

  const openInstallModal = useCallback((row: PackageRow) => {
    setInstallTarget(row);
    setInstallTargetDataSource('default');
    setInstallOptionalRecords(true);
    setFailureNotice(null);
  }, []);

  const handleDownload = useCallback(async (row: PackageRow) => {
    try {
      const blob = await downloadPackageArtifact(row.packageId, row.version);
      const objectUrl = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${row.packageId}-${row.version}.zip`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(objectUrl);
    } catch (err: unknown) {
      showToast('error', (err as Error).message || 'Download failed.');
    }
  }, [showToast]);

  const handleInstall = useCallback(async () => {
    if (!installTarget) return;

    setFailureNotice(null);

    try {
      const switchingVersion = isPackageVersionSwitch(installTarget);
      const result = switchingVersion
        ? await reinstallPackageMutation.mutateAsync({
          packageId: installTarget.packageId,
          payload: {
            version: installTarget.version,
            targetDataSource: installTargetDataSource.trim() || 'default',
            overridePolicy: PACKAGE_INSTALL_OVERRIDE_POLICY,
            installOptionalRecords,
          },
        })
        : await installPackageMutation.mutateAsync({
          packageId: installTarget.packageId,
          payload: {
            version: installTarget.version,
            targetDataSource: installTargetDataSource.trim() || 'default',
            overridePolicy: PACKAGE_INSTALL_OVERRIDE_POLICY,
            installOptionalRecords,
          },
        });
      setInstallTarget(null);
      if (result.deploymentStatus === 'pending' && result.pluginKind === 'vertical-app') {
        const installedRow = rows.find((row) => row.packageId === installTarget.packageId) ?? installTarget;
        setDeploymentTarget({
          ...installedRow,
          installStatus: 'installed',
          deploymentStatus: 'pending',
          pluginKind: 'vertical-app',
        });
        showToast('success', `Package ${installTarget.displayName} installed — review deployment proposal.`);
      } else {
        const detail = await fetchPackageDetail(installTarget.packageId, installTarget.version).catch(() => null);
        const uiCount = detail?.bundleManifest?.capabilities?.ui_components?.length ?? 0;
        const workflowCount = detail?.bundleManifest?.capabilities?.workflows?.length ?? 0;
        const dashboardHint = uiCount > 0
          ? ` ${uiCount} UI component(s) are listed in Client Components and render on the admin Dashboard.`
          : '';
        const workflowHint = workflowCount > 0
          ? ` ${workflowCount} workflow(s) installed as drafts — publish them from Workflows when ready.`
          : '';
        showToast(
          'success',
          switchingVersion
            ? `Package ${installTarget.displayName} switched to v${installTarget.version}.${dashboardHint}${workflowHint}`
            : `Package ${installTarget.displayName} installed.${dashboardHint}${workflowHint}`,
        );
      }
    } catch (err: unknown) {
      const lines = readPackageFailureLines(err, 'Install failed.');
      setInstallTarget(null);
      setFailureNotice({
        title: 'Install failed',
        packageLabel: `${installTarget.displayName} v${installTarget.version}`,
        lines,
        rolledBack: true,
      });
      await loadPackages({ silent: true });
    }
  }, [
    installPackageMutation,
    installTarget,
    installTargetDataSource,
    installOptionalRecords,
    loadPackages,
    reinstallPackageMutation,
    rows,
    showToast,
  ]);

  const openDeploymentModal = useCallback((row: PackageRow) => {
    setDeploymentTarget(row);
    setDeploymentErrors([]);
  }, []);

  const handleApplyDeployment = useCallback(async () => {
    if (!deploymentTarget) return;

    setDeploymentErrors([]);
    try {
      await applyDeploymentMutation.mutateAsync(deploymentTarget.packageId);
      setDeploymentTarget(null);
      showToast('success', `Deployment applied for ${deploymentTarget.displayName}.`);
    } catch (err: unknown) {
      const details = (err as Error & { details?: string[] }).details ?? [];
      setDeploymentErrors([(err as Error).message || 'Failed to apply deployment.', ...details]);
    }
  }, [applyDeploymentMutation, deploymentTarget, showToast]);

  const handleUninstall = useCallback(async () => {
    if (!uninstallTarget) return;

    try {
      await uninstallPackageMutation.mutateAsync({
        packageId: uninstallTarget.packageId,
        removeScope: resolvePackageUninstallScopeForSubmit(uninstallRemoveScope),
      });
      setUninstallTarget(null);
      setUninstallRemoveScope(DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE);
      showToast('success', `Package ${uninstallTarget.displayName} uninstalled.`);
    } catch (err: unknown) {
      showToast('error', (err as Error).message || 'Uninstall failed.');
    }
  }, [showToast, uninstallPackageMutation, uninstallRemoveScope, uninstallTarget]);

  const handleDelete = useCallback(async () => {
    if (!deleteTarget) return;

    try {
      await deletePackageMutation.mutateAsync({
        packageId: deleteTarget.packageId,
        version: deleteTarget.version,
      });
      setDeleteTarget(null);
      showToast('success', `Package ${deleteTarget.displayName} v${deleteTarget.version} deleted.`);
    } catch (err: unknown) {
      showToast('error', (err as Error).message || 'Delete failed.');
    }
  }, [deletePackageMutation, deleteTarget, showToast]);

  const openRepairModal = useCallback((row: PackageRow) => {
    setRepairTarget(row);
  }, []);

  const closeRepairModal = useCallback(() => {
    setRepairTarget(null);
  }, []);

  const handleReinstall = useCallback(async () => {
    if (!repairTarget) return;

    try {
      await reinstallPackageMutation.mutateAsync({
        packageId: repairTarget.packageId,
        payload: { version: repairTarget.version },
      });
      setRepairTarget(null);
      showToast('success', `Package ${repairTarget.displayName} repaired.`);
    } catch (err: unknown) {
      const lines = readPackageFailureLines(err, 'Repair failed.');
      setRepairTarget(null);
      setFailureNotice({
        title: 'Repair failed',
        packageLabel: `${repairTarget.displayName} v${repairTarget.version}`,
        lines,
        rolledBack: true,
      });
    }
  }, [reinstallPackageMutation, repairTarget, showToast]);

  const openRepackModal = useCallback((row: PackageRow) => {
    setRepackTarget(row);
    setRepackDiffItem(null);
    setRepackErrors([]);
  }, []);

  const closeRepackFlow = useCallback(() => {
    setRepackTarget(null);
    setRepackDiffItem(null);
    setRepackErrors([]);
  }, []);

  const handleRepack = useCallback(async (payload: {
    version: string;
    description: string;
    descriptionMode: 'replace' | 'append';
    createdBy: string;
    additions?: PackageRepackAdditionsPayload;
    removals?: PackageRepackRemovalsPayload;
  }) => {
    if (!repackTarget) return;

    setRepackErrors([]);
    try {
      const result = await repackPackageMutation.mutateAsync({
        packageId: repackTarget.packageId,
        payload: {
          version: payload.version,
          description: payload.description || undefined,
          descriptionMode: payload.descriptionMode,
          createdBy: payload.createdBy || undefined,
          additions: payload.additions,
          removals: payload.removals,
        },
      });
      closeRepackFlow();
      const preservedHint = result.preservedVersions.length > 1
        ? ` ${result.preservedVersions.length} versions are available in the catalog.`
        : '';
      if (result.deploymentStatus === 'pending' && repackTarget.pluginKind === 'vertical-app') {
        const installedRow = rows.find((row) => row.packageId === repackTarget.packageId) ?? repackTarget;
        setDeploymentTarget({
          ...installedRow,
          installStatus: 'installed',
          activeInstalledVersion: result.version,
          version: result.version,
          deploymentStatus: 'pending',
          pluginKind: 'vertical-app',
        });
        showToast('success', `Package ${repackTarget.displayName} repacked to v${result.version} — review deployment proposal.${preservedHint}`);
      } else {
        showToast('success', `Package ${repackTarget.displayName} repacked and installed as v${result.version}.${preservedHint}`);
      }
    } catch (err: unknown) {
      const details = (err as Error & { details?: string[] }).details ?? [];
      setRepackErrors([(err as Error).message || 'Repack failed.', ...details]);
    }
  }, [closeRepackFlow, repackPackageMutation, repackTarget, rows, showToast]);

  const openDetailModal = useCallback(async (row: PackageRow) => {
    setDetailTarget(row);
    setDetailData(null);
    setDetailStep(0);
    setIsDetailLoading(true);

    try {
      const detailVersion = row.activeInstalledVersion ?? row.version;
      const detail = await fetchPackageDetail(row.packageId, detailVersion);
      if (!detail) {
        throw new Error('Failed to load package detail.');
      }
      setDetailData(detail);
    } catch (err: unknown) {
      showToast('error', (err as Error).message || 'Failed to load package detail.');
      setDetailTarget(null);
    } finally {
      setIsDetailLoading(false);
    }
  }, [showToast]);

  const openUninstallModal = useCallback((row: PackageRow) => {
    setUninstallTarget(row);
    setUninstallRemoveScope(DEFAULT_PACKAGE_UNINSTALL_REMOVE_SCOPE);
  }, []);

  const onClickNewPackage = useCallback(() => {
    if (!isBuilderEnabled) return;
    setIsBuilderOpen(true);
  }, [isBuilderEnabled]);

  const handleBuilderRegistered = useCallback(async (message: string) => {
    showToast('success', message);
    await loadPackages({ silent: true });
  }, [loadPackages, showToast]);

  return {
    rows,
    isLoading,
    error,
    toast,
    dismissToast,
    isUploading,
    handleDirectUpload,
    nameFilter,
    setNameFilter,
    statusFilter,
    setStatusFilter,
    showOlderVersions,
    setShowOlderVersions,
    installTarget,
    setInstallTarget,
    installTargetDataSource,
    setInstallTargetDataSource,
    installOptionalRecords,
    setInstallOptionalRecords,
    isInstalling: installPackageMutation.isPending || reinstallPackageMutation.isPending,
    openInstallModal,
    handleInstall,
    failureNotice,
    closeFailureNotice,
    deploymentTarget,
    setDeploymentTarget,
    deploymentErrors,
    isApplyingDeployment: applyDeploymentMutation.isPending,
    openDeploymentModal,
    handleApplyDeployment,
    uninstallTarget,
    setUninstallTarget,
    uninstallRemoveScope,
    setUninstallRemoveScope,
    isUninstalling: uninstallPackageMutation.isPending,
    openUninstallModal,
    handleUninstall,
    deleteTarget,
    setDeleteTarget,
    isDeleting: deletePackageMutation.isPending,
    handleDelete,
    detailTarget,
    setDetailTarget,
    detailData,
    isDetailLoading,
    detailStep,
    setDetailStep,
    openDetailModal,
    isBuilderOpen,
    setIsBuilderOpen,
    isBuilderEnabled,
    onClickNewPackage,
    handleBuilderRegistered,
    showToast,
    loadPackages,
    handleDownload,
    repairTarget,
    openRepairModal,
    closeRepairModal,
    handleReinstall,
    isRepairing: reinstallPackageMutation.isPending,
    openRepackModal,
    closeRepackFlow,
    repackTarget,
    repackDiffItem,
    setRepackDiffItem,
    handleRepack,
    repackErrors,
    isRepacking: repackPackageMutation.isPending,
    visibleRows,
  };
}

export type UsePackagesPageResult = ReturnType<typeof usePackagesPage>;
