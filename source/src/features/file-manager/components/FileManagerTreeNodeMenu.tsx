import React, { useRef, useState } from 'react';
import {
  Archive,
  ArrowUpFromLine,
  FileArchive,
  FilePlus2,
  FolderInput,
  FolderMinus,
  FolderPlus,
  FolderTree,
  MoreHorizontal,
  Pencil,
  RefreshCw,
  Trash2,
  Upload,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { FileManagerEntryKind } from '../../../shared/api/contracts/file-manager/types';
import { AppSplitButton, SplitButtonMenuItem } from '../../../shared/ui';
import { isFileManagerZipEntry } from '../constants';
import type { FileManagerPageModel } from '../hooks/useFileManagerPage';

const FILE_MANAGER_TREE_MENU_PANEL_CLASS = 'min-w-[11rem] p-1.5 shadow-md';
const FILE_MANAGER_TREE_MENU_ITEM_CLASS = 'rounded-md px-2.5 py-1.5';
const FILE_MANAGER_TREE_MENU_DIVIDER_CLASS = 'my-1 border-t border-slate-100';

export type FileManagerTreeNodeTarget = {
  name: string;
  path: string;
  kind: FileManagerEntryKind;
  extension?: string | null;
  isRoot?: boolean;
  isTreeViewAnchor?: boolean;
};

type FileManagerTreeNodeMenuProps = {
  page: FileManagerPageModel;
  target: FileManagerTreeNodeTarget;
  className?: string;
};

export const FileManagerTreeNodeMenu: React.FC<FileManagerTreeNodeMenuProps> = ({
  page,
  target,
  className,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const isDirectory = target.kind === 'directory';
  const isZipFile = isFileManagerZipEntry(target);
  const canMutate = !target.isRoot;
  const isExtracting = page.extractingPath === target.path;
  const isUploading = page.uploadingPath === target.path;

  const closeMenu = () => setIsOpen(false);

  const runAction = (action: () => void) => {
    closeMenu();
    action();
  };

  return (
    <div
      className={cn(
        'shrink-0 transition-opacity',
        isOpen ? 'opacity-100' : 'opacity-0 group-hover/tree-row:opacity-100 focus-within:opacity-100',
        className,
      )}
      onClick={(event) => event.stopPropagation()}
    >
      {isDirectory ? (
        <input
          ref={uploadInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(event) => {
            const selectedFiles = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (selectedFiles.length > 0) {
              void page.handleUploadFiles(target.path, selectedFiles);
            }
          }}
        />
      ) : null}

      <AppSplitButton
        intent="utility"
        size="compact"
        menuFixed
        hideChevron
        icon={<MoreHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />}
        isOpen={isOpen}
        onOpenChange={setIsOpen}
        menuAriaLabel={`Actions for ${target.name}`}
        triggerAriaLabel={`Actions for ${target.name}`}
        disabled={isExtracting || isUploading}
        menuClassName={FILE_MANAGER_TREE_MENU_PANEL_CLASS}
      >
        {target.isRoot ? (
          <>
            {page.scope === 'workspace' ? (
              <SplitButtonMenuItem
                className={FILE_MANAGER_TREE_MENU_ITEM_CLASS}
                icon={<FolderInput className="h-3.5 w-3.5 shrink-0" />}
                onClick={() => runAction(page.requestProjectScope)}
              >
                Browse project root
              </SplitButtonMenuItem>
            ) : (
              <SplitButtonMenuItem
                className={FILE_MANAGER_TREE_MENU_ITEM_CLASS}
                icon={<ArrowUpFromLine className="h-3.5 w-3.5 shrink-0" />}
                onClick={() => runAction(page.returnToWorkspaceScope)}
              >
                Back to workspace
              </SplitButtonMenuItem>
            )}
          </>
        ) : null}

        {target.isTreeViewAnchor ? (
          <SplitButtonMenuItem
            className={FILE_MANAGER_TREE_MENU_ITEM_CLASS}
            icon={<ArrowUpFromLine className="h-3.5 w-3.5 shrink-0" />}
            onClick={() => runAction(page.viewTreeFromParent)}
          >
            Go to parent folder
          </SplitButtonMenuItem>
        ) : null}

        {isDirectory && !target.isRoot && !target.isTreeViewAnchor ? (
          <SplitButtonMenuItem
            className={FILE_MANAGER_TREE_MENU_ITEM_CLASS}
            icon={<FolderTree className="h-3.5 w-3.5 shrink-0" />}
            onClick={() => runAction(() => page.viewTreeFromPath(target.path))}
          >
            View from here
          </SplitButtonMenuItem>
        ) : null}

        {isDirectory ? (
          <>
            <SplitButtonMenuItem
              className={FILE_MANAGER_TREE_MENU_ITEM_CLASS}
              icon={<Upload className="h-3.5 w-3.5 shrink-0" />}
              disabled={isUploading}
              onClick={() => runAction(() => uploadInputRef.current?.click())}
            >
              {isUploading ? 'Uploading…' : 'Upload files'}
            </SplitButtonMenuItem>
            <SplitButtonMenuItem
              className={FILE_MANAGER_TREE_MENU_ITEM_CLASS}
              icon={<FolderPlus className="h-3.5 w-3.5 shrink-0" />}
              onClick={() => runAction(() => page.openCreateModal('folder', target.path))}
            >
              New folder
            </SplitButtonMenuItem>
            <SplitButtonMenuItem
              className={FILE_MANAGER_TREE_MENU_ITEM_CLASS}
              icon={<FilePlus2 className="h-3.5 w-3.5 shrink-0" />}
              onClick={() => runAction(() => page.openCreateModal('file', target.path))}
            >
              New file
            </SplitButtonMenuItem>
          </>
        ) : null}

        {isZipFile ? (
          <>
            <SplitButtonMenuItem
              className={FILE_MANAGER_TREE_MENU_ITEM_CLASS}
              icon={<FileArchive className="h-3.5 w-3.5 shrink-0" />}
              onClick={() => runAction(() => {
                page.handleSelectPath(target.path, target.kind);
                page.enterZipEditMode(target.path);
              })}
            >
              Edit zip archive
            </SplitButtonMenuItem>
            <SplitButtonMenuItem
              className={FILE_MANAGER_TREE_MENU_ITEM_CLASS}
              icon={<Archive className="h-3.5 w-3.5 shrink-0" />}
              disabled={isExtracting}
              onClick={() => runAction(() => { void page.handleExtractZip(target); })}
            >
              {isExtracting ? 'Extracting…' : 'Extract zip'}
            </SplitButtonMenuItem>
          </>
        ) : null}

        {canMutate ? (
          <>
            <SplitButtonMenuItem
              className={FILE_MANAGER_TREE_MENU_ITEM_CLASS}
              icon={<Pencil className="h-3.5 w-3.5 shrink-0" />}
              onClick={() => runAction(() => page.openRenameModal(target))}
            >
              Rename
            </SplitButtonMenuItem>
            <div className={FILE_MANAGER_TREE_MENU_DIVIDER_CLASS} aria-hidden="true" />
            <SplitButtonMenuItem
              className={FILE_MANAGER_TREE_MENU_ITEM_CLASS}
              icon={<Trash2 className="h-3.5 w-3.5 shrink-0 text-rose-600" />}
              onClick={() => runAction(() => page.openDeleteModal(target))}
            >
              {isDirectory ? 'Delete folder' : 'Delete file'}
            </SplitButtonMenuItem>
          </>
        ) : null}

        {isDirectory ? (
          <>
            <div className={FILE_MANAGER_TREE_MENU_DIVIDER_CLASS} aria-hidden="true" />
            <SplitButtonMenuItem
              className={FILE_MANAGER_TREE_MENU_ITEM_CLASS}
              icon={<FolderMinus className="h-3.5 w-3.5 shrink-0 text-rose-600" />}
              onClick={() => runAction(() => page.openEmptyFolderModal(target))}
            >
              Empty folder
            </SplitButtonMenuItem>
          </>
        ) : null}

        <div className={FILE_MANAGER_TREE_MENU_DIVIDER_CLASS} aria-hidden="true" />
        <SplitButtonMenuItem
          className={FILE_MANAGER_TREE_MENU_ITEM_CLASS}
          icon={<RefreshCw className="h-3.5 w-3.5 shrink-0" />}
          onClick={() => runAction(() => { void page.refreshTreeNode(target); })}
        >
          Refresh
        </SplitButtonMenuItem>
      </AppSplitButton>
    </div>
  );
};
