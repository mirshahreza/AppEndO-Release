import React from 'react';
import { ListPageShell } from '../../../shared/ui';
import { PackageBuilderModal } from './PackageBuilderModal';
import type { UsePackagesPageResult } from '../hooks/usePackagesPage';
import { PackageDeploymentProposalModal } from './PackageDeploymentProposalModal';
import { PackageDeleteModal } from './PackageDeleteModal';
import { PackageDetailModal } from './PackageDetailModal';
import { PackageFailureDialog } from './PackageFailureDialog';
import { PackageInstallModal } from './PackageInstallModal';
import { PackageUninstallModal } from './PackageUninstallModal';
import { PackagesGrid } from './PackagesGrid';
import { PackagesToast } from './PackagesToast';
import { PackagesToolbar } from './PackagesToolbar';
import { PackageRepairModal } from './PackageRepairModal';
import { PackageRepackDiffModal } from './PackageRepackDiffModal';
import { PackageRepackModal } from './PackageRepackModal';

export type PackagesPageViewProps = {
  page: UsePackagesPageResult;
};

export const PackagesPageView: React.FC<PackagesPageViewProps> = ({ page }) => (
  <ListPageShell className="min-w-0" data-testid="package-manager-page-wrapper">
    <PackagesToolbar
      statusFilter={page.statusFilter}
      onStatusFilterChange={page.setStatusFilter}
      nameFilter={page.nameFilter}
      onNameFilterChange={page.setNameFilter}
      showOlderVersions={page.showOlderVersions}
      onShowOlderVersionsChange={page.setShowOlderVersions}
      onUpload={() => void page.handleDirectUpload()}
      isUploading={page.isUploading}
      onNewPackage={page.onClickNewPackage}
      isBuilderEnabled={page.isBuilderEnabled}
    />

    <PackagesGrid
      error={page.error}
      isLoading={page.isLoading}
      visibleRows={page.visibleRows}
      onOpenInstall={page.openInstallModal}
      onOpenUninstall={page.openUninstallModal}
      onOpenDelete={page.setDeleteTarget}
      onOpenDetail={(row) => void page.openDetailModal(row)}
      onDownload={(row) => void page.handleDownload(row)}
      onOpenDeployment={page.openDeploymentModal}
      onOpenRepair={page.openRepairModal}
      onOpenRepack={page.openRepackModal}
    />

    <PackagesToast toast={page.toast} onDismiss={page.dismissToast} />

    <PackageInstallModal
      target={page.installTarget}
      targetDataSource={page.installTargetDataSource}
      onTargetDataSourceChange={page.setInstallTargetDataSource}
      isInstalling={page.isInstalling}
      installOptionalRecords={page.installOptionalRecords}
      onInstallOptionalRecordsChange={page.setInstallOptionalRecords}
      onClose={() => page.setInstallTarget(null)}
      onConfirm={() => void page.handleInstall()}
    />

    {page.failureNotice ? (
      <PackageFailureDialog
        title={page.failureNotice.title}
        packageLabel={page.failureNotice.packageLabel}
        lines={page.failureNotice.lines}
        rolledBack={page.failureNotice.rolledBack}
        onClose={page.closeFailureNotice}
      />
    ) : null}

    <PackageUninstallModal
      target={page.uninstallTarget}
      removeScope={page.uninstallRemoveScope}
      onRemoveScopeChange={page.setUninstallRemoveScope}
      isUninstalling={page.isUninstalling}
      onClose={() => page.setUninstallTarget(null)}
      onConfirm={() => void page.handleUninstall()}
    />

    <PackageDeploymentProposalModal
      target={page.deploymentTarget}
      isApplying={page.isApplyingDeployment}
      applyErrors={page.deploymentErrors}
      onClose={() => page.setDeploymentTarget(null)}
      onConfirm={() => void page.handleApplyDeployment()}
    />

    <PackageDeleteModal
      target={page.deleteTarget}
      isDeleting={page.isDeleting}
      onClose={() => page.setDeleteTarget(null)}
      onConfirm={() => void page.handleDelete()}
    />

    <PackageDetailModal
      open={page.detailTarget !== null}
      isLoading={page.isDetailLoading}
      detailData={page.detailData}
      step={page.detailStep}
      onStepChange={page.setDetailStep}
      onClose={() => page.setDetailTarget(null)}
    />

    {page.isBuilderEnabled && (
      <PackageBuilderModal
        isOpen={page.isBuilderOpen}
        onClose={() => page.setIsBuilderOpen(false)}
        onRegistered={async (message) => {
          await page.handleBuilderRegistered(message);
        }}
        onNotify={page.showToast}
      />
    )}

    <PackageRepairModal
      target={page.repairTarget}
      isRepairing={page.isRepairing}
      onClose={page.closeRepairModal}
      onConfirm={() => void page.handleReinstall()}
    />

    <PackageRepackModal
      target={page.repackTarget}
      isRepacking={page.isRepacking}
      errors={page.repackErrors}
      onClose={page.closeRepackFlow}
      onRepack={(payload) => void page.handleRepack(payload)}
      onOpenDiff={(item) => page.setRepackDiffItem(item)}
      onNotify={page.showToast}
    />

    <PackageRepackDiffModal
      target={page.repackTarget}
      item={page.repackDiffItem}
      onClose={() => page.setRepackDiffItem(null)}
    />

  </ListPageShell>
);
