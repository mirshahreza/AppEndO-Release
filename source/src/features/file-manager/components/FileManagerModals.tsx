import React from 'react';
import { AlertTriangle, ArrowRight, FolderMinus, Pencil, Plus, Trash2, X } from 'lucide-react';
import {
  AppButton,
  ConfirmDialogShell,
  CreateEditModalShell,
  DestructiveConfirmBody,
  FormField,
  UiInput,
} from '../../../shared/ui';
import type { FileManagerPageModel } from '../hooks/useFileManagerPage';
import { getFileManagerEntryName } from '../constants';

type FileManagerCreateModalProps = {
  page: FileManagerPageModel;
};

export const FileManagerCreateModal: React.FC<FileManagerCreateModalProps> = ({ page }) => {
  if (!page.createMode) {
    return null;
  }

  const title = page.createMode === 'folder' ? 'New Folder' : 'New File';

  return (
    <CreateEditModalShell
      size="sm"
      title={title}
      onClose={page.closeCreateModal}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={page.closeCreateModal}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="primary"
            size="sm"
            disabled={page.isCreating || !page.createName.trim()}
            onClick={() => { void page.submitCreate(); }}
          >
            <Plus className="h-3.5 w-3.5" />
            Create
          </AppButton>
        </>
      )}
    >
      <FormField label="Name" required invalid={Boolean(page.actionError)} error={page.actionError}>
        <UiInput
          id="file-manager-create-name"
          size="sm"
          value={page.createName}
          onChange={(event) => page.setCreateName(event.target.value)}
          placeholder={page.createMode === 'folder' ? 'my-folder' : 'notes.txt'}
          autoFocus
          autoDir={false}
        />
      </FormField>
    </CreateEditModalShell>
  );
};

type FileManagerRenameModalProps = {
  page: FileManagerPageModel;
};

export const FileManagerRenameModal: React.FC<FileManagerRenameModalProps> = ({ page }) => {
  if (!page.renameTarget) {
    return null;
  }

  return (
    <CreateEditModalShell
      size="sm"
      title="Rename"
      onClose={page.closeRenameModal}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={page.closeRenameModal}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="primary"
            size="sm"
            disabled={page.isRenaming || !page.renameName.trim()}
            onClick={() => { void page.submitRename(); }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </AppButton>
        </>
      )}
    >
      <FormField label="New name" required invalid={Boolean(page.actionError)} error={page.actionError}>
        <UiInput
          id="file-manager-rename-name"
          size="sm"
          value={page.renameName}
          onChange={(event) => page.setRenameName(event.target.value)}
          autoFocus
          autoDir={false}
        />
      </FormField>
    </CreateEditModalShell>
  );
};

type FileManagerDeleteModalProps = {
  page: FileManagerPageModel;
};

export const FileManagerDeleteModal: React.FC<FileManagerDeleteModalProps> = ({ page }) => {
  if (!page.deleteTarget) {
    return null;
  }

  return (
    <ConfirmDialogShell
      size="md"
      title={page.deleteTarget.kind === 'directory' ? 'Delete Folder' : 'Delete File'}
      icon={<Trash2 className="h-4 w-4" />}
      onClose={page.closeDeleteModal}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={page.closeDeleteModal}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton intent="destructive" size="sm" disabled={page.isDeleting} onClick={() => { void page.submitDelete(); }}>
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </AppButton>
        </>
      )}
    >
      <DestructiveConfirmBody
        question={`Are you sure you want to delete this ${page.deleteTarget.kind}?`}
        entityName={page.deleteTarget.name}
        entityDetail={page.deleteTarget.path}
        warning={page.deleteTarget.kind === 'directory'
          ? 'All files and subfolders inside this folder will be permanently removed.'
          : 'This action cannot be undone.'}
      />
    </ConfirmDialogShell>
  );
};

type FileManagerEmptyFolderModalProps = {
  page: FileManagerPageModel;
};

export const FileManagerEmptyFolderModal: React.FC<FileManagerEmptyFolderModalProps> = ({ page }) => {
  if (!page.emptyFolderTarget) {
    return null;
  }

  return (
    <ConfirmDialogShell
      size="md"
      title="Empty Folder"
      icon={<FolderMinus className="h-4 w-4" />}
      onClose={page.closeEmptyFolderModal}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={page.closeEmptyFolderModal}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="destructive"
            size="sm"
            disabled={page.isEmptyingFolder}
            onClick={() => { void page.submitEmptyFolder(); }}
          >
            <FolderMinus className="h-3.5 w-3.5" />
            Empty folder
          </AppButton>
        </>
      )}
    >
      <DestructiveConfirmBody
        question="Remove everything inside this folder?"
        entityName={page.emptyFolderTarget.name}
        entityDetail={page.emptyFolderTarget.path}
        warning="All files and subfolders inside this folder will be permanently removed. The folder itself will remain."
      />
      {page.actionError ? (
        <p className="mt-3 text-xs text-rose-600">{page.actionError}</p>
      ) : null}
    </ConfirmDialogShell>
  );
};

type FileManagerProjectRootWarningModalProps = {
  page: FileManagerPageModel;
};

export const FileManagerMoveConflictModal: React.FC<{ page: FileManagerPageModel }> = ({ page }) => {
  const conflict = page.moveConflict;
  if (!conflict) {
    return null;
  }

  const destinationLabel = getFileManagerEntryName(conflict.destinationParentPath) || conflict.destinationParentPath;

  return (
    <ConfirmDialogShell
      size="md"
      title="Replace Existing Entry"
      tone="default"
      icon={<AlertTriangle className="h-4 w-4" />}
      iconToneClassName="text-amber-600"
      onClose={page.closeMoveConflictModal}
      onConfirm={() => { void page.confirmMoveOverwrite(conflict); }}
      confirmLabel="Replace"
      confirmIntent="destructive"
      isConfirming={page.isResolvingMoveConflict}
      confirmingLabel="Replacing…"
      error={page.actionError}
      cancelDisabled={page.isResolvingMoveConflict}
      confirmDisabled={page.isResolvingMoveConflict}
    >
      <div className="space-y-2 text-sm text-slate-700">
        <p className="font-semibold text-slate-800">
          An entry named <span className="font-mono">{conflict.entryName}</span> already exists in{' '}
          <span className="font-mono">{destinationLabel}</span>.
        </p>
        <p className="text-xs text-slate-600">
          Cancel to keep the destination unchanged, or replace it with the item you are moving.
        </p>
        <p className="text-xs text-amber-700">
          Replacing a folder removes its existing contents permanently.
        </p>
      </div>
    </ConfirmDialogShell>
  );
};

export const FileManagerProjectRootWarningModal: React.FC<FileManagerProjectRootWarningModalProps> = ({ page }) => {
  if (!page.showProjectRootWarning) {
    return null;
  }

  return (
    <ConfirmDialogShell
      size="md"
      title="Browse Project Root"
      tone="default"
      icon={<AlertTriangle className="h-4 w-4" />}
      iconToneClassName="text-amber-600"
      onClose={page.cancelProjectScope}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={page.cancelProjectScope}>
            <X className="h-3.5 w-3.5" />
            Stay in workspace
          </AppButton>
          <AppButton intent="primary" size="sm" onClick={page.confirmProjectScope}>
            <ArrowRight className="h-3.5 w-3.5" />
            Continue to project root
          </AppButton>
        </>
      )}
    >
      <div className="space-y-2 text-sm text-slate-700">
        <p className="font-semibold text-slate-800">
          You are leaving the safe workspace sandbox.
        </p>
        <p className="text-xs text-slate-600">
          By default, File Manager only exposes the <span className="font-mono">workspace/</span> folder.
          Project root access lets you browse and modify application source files, runtime assets, and configuration-adjacent paths.
        </p>
        <p className="text-xs text-amber-700">
          Proceed only if you understand the impact. Sensitive paths such as `.env`, `settings.json`, `node_modules`, and `.git` remain blocked.
        </p>
      </div>
    </ConfirmDialogShell>
  );
};

export const FileManagerZipCreateModal: React.FC<{ page: FileManagerPageModel }> = ({ page }) => {
  if (!page.zipCreateMode) {
    return null;
  }

  const title = page.zipCreateMode === 'folder' ? 'New Zip Folder' : 'New Zip File';

  return (
    <CreateEditModalShell
      size="sm"
      title={title}
      onClose={page.closeZipCreateModal}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={page.closeZipCreateModal}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="primary"
            size="sm"
            disabled={page.isCreatingZipEntry || !page.zipCreateName.trim()}
            onClick={() => { void page.submitZipCreate(); }}
          >
            <Plus className="h-3.5 w-3.5" />
            Create
          </AppButton>
        </>
      )}
    >
      <FormField label="Name" required invalid={Boolean(page.actionError)} error={page.actionError}>
        <UiInput
          id="file-manager-zip-create-name"
          size="sm"
          value={page.zipCreateName}
          onChange={(event) => page.setZipCreateName(event.target.value)}
          placeholder={page.zipCreateMode === 'folder' ? 'my-folder' : 'notes.txt'}
          autoFocus
          autoDir={false}
        />
      </FormField>
    </CreateEditModalShell>
  );
};

export const FileManagerZipRenameModal: React.FC<{ page: FileManagerPageModel }> = ({ page }) => {
  if (!page.zipRenameTarget) {
    return null;
  }

  return (
    <CreateEditModalShell
      size="sm"
      title="Rename Zip Entry"
      onClose={page.closeZipRenameModal}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={page.closeZipRenameModal}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="primary"
            size="sm"
            disabled={page.isRenamingZipEntry || !page.zipRenameName.trim()}
            onClick={() => { void page.submitZipRename(); }}
          >
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </AppButton>
        </>
      )}
    >
      <FormField label="New name" required invalid={Boolean(page.actionError)} error={page.actionError}>
        <UiInput
          id="file-manager-zip-rename-name"
          size="sm"
          value={page.zipRenameName}
          onChange={(event) => page.setZipRenameName(event.target.value)}
          autoFocus
          autoDir={false}
        />
      </FormField>
    </CreateEditModalShell>
  );
};

export const FileManagerZipDeleteModal: React.FC<{ page: FileManagerPageModel }> = ({ page }) => {
  if (!page.zipDeleteTarget) {
    return null;
  }

  const isDirectory = page.zipDeleteTarget.kind === 'directory';

  return (
    <ConfirmDialogShell
      size="sm"
      title={isDirectory ? 'Delete Zip Folder' : 'Delete Zip File'}
      tone="danger"
      icon={<Trash2 className="h-4 w-4" />}
      iconToneClassName="text-rose-600"
      onClose={page.closeZipDeleteModal}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={page.closeZipDeleteModal}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="destructive"
            size="sm"
            disabled={page.isDeletingZipEntry}
            onClick={() => { void page.submitZipDelete(); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </AppButton>
        </>
      )}
    >
      <DestructiveConfirmBody
        question={isDirectory ? 'Delete this folder from the zip archive?' : 'Delete this file from the zip archive?'}
        entityName={page.zipDeleteTarget.name}
        warning={isDirectory
          ? 'This removes the folder and all nested entries from the zip archive.'
          : 'This removes the file from the zip archive.'}
      />
    </ConfirmDialogShell>
  );
};

export const FileManagerZipMoveConflictModal: React.FC<{ page: FileManagerPageModel }> = ({ page }) => {
  if (!page.zipMoveConflict) {
    return null;
  }

  const actionLabel = page.zipMoveConflict.kind === 'import' ? 'Import' : 'Move';

  return (
    <ConfirmDialogShell
      size="sm"
      title="Replace Existing Zip Entry?"
      tone="default"
      icon={<AlertTriangle className="h-4 w-4" />}
      iconToneClassName="text-amber-600"
      onClose={page.closeZipMoveConflictModal}
      footer={(
        <>
          <AppButton intent="cancel" size="sm" onClick={page.closeZipMoveConflictModal}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton intent="primary" size="sm" onClick={() => { void page.confirmZipMoveOverwrite(); }}>
            <ArrowRight className="h-3.5 w-3.5" />
            Replace
          </AppButton>
        </>
      )}
    >
      <div className="space-y-2 text-sm text-slate-700">
        <p>
          <span className="font-semibold">{page.zipMoveConflict.entryName}</span> already exists in the destination.
        </p>
        <p className="text-xs text-slate-600">
          Cancel to keep the existing zip entry, or replace it with the item you are {actionLabel.toLowerCase()}ing.
        </p>
      </div>
    </ConfirmDialogShell>
  );
};
