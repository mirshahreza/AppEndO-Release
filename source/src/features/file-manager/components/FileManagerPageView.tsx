import React from 'react';
import { cn } from '../../../lib/utils';
import { useViewportTier } from '../../../shared/lib/useViewportTier';
import { isCompactChromeTier } from '../../../shared/lib/viewportTokens';
import {
  AppToast, LoadingSpinner, QueryErrorPanel, WorkspaceVerticalSplitHandle,
  ListPageShell,
} from '../../../shared/ui';
import type { FileManagerPageModel } from '../hooks/useFileManagerPage';
import { FileManagerPreviewPanel } from './FileManagerPreviewPanel';
import {
  FileManagerCreateModal,
  FileManagerDeleteModal,
  FileManagerEmptyFolderModal,
  FileManagerMoveConflictModal,
  FileManagerProjectRootWarningModal,
  FileManagerRenameModal,
  FileManagerZipCreateModal,
  FileManagerZipDeleteModal,
  FileManagerZipMoveConflictModal,
  FileManagerZipRenameModal,
} from './FileManagerModals';
import { FileManagerTreePanel } from './FileManagerTreePanel';

type FileManagerPageViewProps = {
  page: FileManagerPageModel;
};

export const FileManagerPageView: React.FC<FileManagerPageViewProps> = ({ page }) => {
  const compactChrome = isCompactChromeTier(useViewportTier());

  if (page.configQuery.isLoading) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  if (page.configQuery.isError) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-white p-4">
        <QueryErrorPanel message={page.configQuery.error?.message ?? 'Failed to load File Manager.'} />
      </div>
    );
  }

  return (
    <ListPageShell onGridScroll={page.onGridScroll}>
      <div
        ref={page.containerRef}
        className={cn(
          'flex min-h-0 flex-1 flex-col lg:flex-row lg:items-stretch',
          page.isResizingSidebar && 'select-none',
        )}
      >
        <div
          className={cn(
            'min-h-0 overflow-hidden',
            compactChrome ? 'max-h-[45%] w-full shrink-0' : 'shrink-0',
          )}
          style={compactChrome
            ? undefined
            : {
                width: page.sidebarWidth > 0 ? page.sidebarWidth : undefined,
                flex: page.sidebarWidth > 0 ? '0 0 auto' : '1 1 auto',
              }}
        >
          <FileManagerTreePanel page={page} />
        </div>

        <WorkspaceVerticalSplitHandle {...page.sidebarSplitHandleProps} />

        <div className="min-h-0 min-w-0 flex-1">
          <FileManagerPreviewPanel page={page} />
        </div>
      </div>

      <FileManagerCreateModal page={page} />
      <FileManagerRenameModal page={page} />
      <FileManagerDeleteModal page={page} />
      <FileManagerEmptyFolderModal page={page} />
      <FileManagerMoveConflictModal page={page} />
      <FileManagerProjectRootWarningModal page={page} />
      <FileManagerZipCreateModal page={page} />
      <FileManagerZipRenameModal page={page} />
      <FileManagerZipDeleteModal page={page} />
      <FileManagerZipMoveConflictModal page={page} />

      {page.toast ? (
        <AppToast type={page.toast.type} text={page.toast.text} />
      ) : null}
    </ListPageShell>
  );
};
