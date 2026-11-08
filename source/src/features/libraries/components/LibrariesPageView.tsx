import React from 'react';
import {
  ConfirmDialogShell,
  ListPageShell,
} from '../../../shared/ui';
import type { LibrariesPageState } from '../hooks/useLibrariesPage';
import { LibrariesTableGrid } from './LibrariesTableGrid';
import { LibrariesToolbar } from './LibrariesToolbar';
import { LibraryInstallModal } from './LibraryInstallModal';

export type LibrariesPageViewProps = {
  page: LibrariesPageState;
};

export const LibrariesPageView: React.FC<LibrariesPageViewProps> = ({ page }) => (
  <ListPageShell>
    <LibrariesToolbar
      searchInput={page.searchInput}
      onSearchInputChange={page.setSearchInput}
      builtInFilter={page.builtInFilter}
      onBuiltInFilterChange={page.setBuiltInFilter}
      onInstall={page.openInstall}
      onRefresh={page.retryLoad}
      isRefreshing={page.isRefreshing}
    />

    {page.actionError ? (
      <div className="border-b border-rose-100 bg-rose-50 px-4 py-2 text-xs text-rose-700">{page.actionError}</div>
    ) : null}

    <LibrariesTableGrid
      isLoading={page.isLoading}
      isError={page.isError}
      error={page.error}
      onRetry={page.retryLoad}
      isRetrying={page.isRetrying}
      columns={page.gridColumns}
      getCardRowActions={page.getCardRowActions}
      rows={page.displayRows}
      rowCount={page.rowCount}
    />

    <LibraryInstallModal
      open={page.installOpen}
      name={page.installForm.name}
      versionRange={page.installForm.versionRange}
      error={page.installError}
      isSaving={page.isInstalling}
      onNameChange={page.setInstallName}
      onVersionRangeChange={page.setInstallVersionRange}
      onClose={page.closeInstall}
      onSubmit={() => void page.submitInstall()}
    />

    <ConfirmDialogShell
      open={Boolean(page.deleteTarget)}
      title="Uninstall library"
      subtitle={page.deleteTarget?.name}
      confirmLabel="Uninstall"
      confirmIntent="destructive"
      isConfirming={page.isMutating}
      onClose={page.cancelDelete}
      onConfirm={() => void page.confirmDelete()}
    >
      <p className="text-sm text-slate-600">
        Remove {page.deleteTarget?.name} from this node? Packages that still declare it will fail until it is installed again.
      </p>
    </ConfirmDialogShell>
  </ListPageShell>
);
