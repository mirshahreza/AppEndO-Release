import React from 'react';
import { ChevronDown, ChevronRight, File, Folder, GripVertical, Loader2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AppSearchBox } from '../../../shared/ui';
import type { FileManagerEntry } from '../../../shared/api/queries/file-manager';
import { FILE_MANAGER_DRAG_MIME, getFileManagerEntryName, isFileManagerZipEntry } from '../constants';
import type { FileManagerPageModel } from '../hooks/useFileManagerPage';
import { FILE_MANAGER_HEADER_BAR_OVERRIDES } from './FileManagerPreviewHeader';
import { FileManagerTreeNodeMenu } from './FileManagerTreeNodeMenu';

const TREE_DEPTH_INDENT_PX = 10;
const TREE_BASE_INDENT_PX = 4;

type FileManagerTreeRowProps = {
  page: FileManagerPageModel;
  depth: number;
  name: string;
  path: string;
  kind: FileManagerEntry['kind'];
  extension?: string | null;
  isRoot?: boolean;
  isTreeViewAnchor?: boolean;
  isExpanded?: boolean;
  isLoading?: boolean;
  error?: string;
  onToggleExpand?: () => void;
  onSelect: () => void;
  onOpen?: () => void;
  children?: React.ReactNode;
};

const FileManagerTreeRow: React.FC<FileManagerTreeRowProps> = ({
  page,
  depth,
  name,
  path,
  kind,
  extension,
  isRoot = false,
  isTreeViewAnchor = false,
  isExpanded = false,
  isLoading = false,
  error,
  onToggleExpand,
  onSelect,
  onOpen,
  children,
}) => {
  const isDirectory = kind === 'directory';
  const isSelected = page.selectedPath === path;
  const isDragging = page.draggingPath === path;
  const isDropTarget = isDirectory && page.dropTargetPath === path;
  const isMoveLocked = Boolean(page.movingPath);
  const rowIndent = depth * TREE_DEPTH_INDENT_PX + TREE_BASE_INDENT_PX;

  const handleDragStart = (event: React.DragEvent<HTMLSpanElement>) => {
    if (isRoot || isTreeViewAnchor || isMoveLocked) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(FILE_MANAGER_DRAG_MIME, path);
    page.handleDragStart(path);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isDirectory || !page.draggingPath || isMoveLocked) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    page.handleDragOver(path);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isDirectory || isMoveLocked) {
      return;
    }

    event.preventDefault();
    const sourcePath = event.dataTransfer.getData(FILE_MANAGER_DRAG_MIME);
    if (sourcePath) {
      void page.handleMoveEntry(sourcePath, path);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'group/tree-row flex h-6 w-full items-center gap-0.5 rounded px-1 text-left text-xs leading-none transition-colors',
          isSelected ? 'bg-sky-50 text-sky-950' : 'text-slate-900 hover:bg-slate-50',
          isDragging && 'opacity-40',
          isDropTarget && 'bg-emerald-50 ring-1 ring-inset ring-emerald-300',
        )}
        style={{ paddingInlineStart: `${rowIndent}px` }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDirectory ? (
          <button
            type="button"
            className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center text-slate-600"
            aria-label={isExpanded ? 'Collapse folder' : 'Expand folder'}
            onClick={onToggleExpand}
          >
            {isExpanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          </button>
        ) : (
          <span className="inline-flex h-3.5 w-3.5 shrink-0" />
        )}

        {!isRoot && !isTreeViewAnchor ? (
          <span
            draggable={!isMoveLocked}
            onDragStart={handleDragStart}
            onDragEnd={page.handleDragEnd}
            className={cn(
              'inline-flex h-3.5 w-3 shrink-0 items-center justify-center text-slate-500 opacity-0 transition-opacity group-hover/tree-row:opacity-100',
              isMoveLocked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
            )}
            aria-label={`Drag ${name}`}
            title="Drag to move"
          >
            <GripVertical className="h-3 w-3" />
          </span>
        ) : (
          <span className="inline-flex h-3.5 w-3 shrink-0" />
        )}

        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
          onClick={onSelect}
          onDoubleClick={onOpen}
        >
          {isDirectory ? (
            <Folder className={cn('h-3 w-3 shrink-0', isRoot || isTreeViewAnchor ? 'text-sky-700' : 'text-amber-600')} />
          ) : (
            <File className="h-3 w-3 shrink-0 text-slate-600" />
          )}
          <span className={cn('truncate', isRoot || isTreeViewAnchor ? 'font-semibold' : 'font-medium')}>{name}</span>
        </button>

        {isLoading || page.movingPath === path ? (
          <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin text-slate-600" />
        ) : null}

        <FileManagerTreeNodeMenu
          page={page}
          target={{ name, path, kind, extension, isRoot, isTreeViewAnchor }}
        />
      </div>

      {error ? (
        <p
          className="px-1 py-0.5 text-[10px] leading-snug text-rose-600"
          style={{ paddingInlineStart: `${rowIndent + 14}px` }}
        >
          {error}
        </p>
      ) : null}

      {children}
    </div>
  );
};

type FileManagerTreeNodeProps = {
  page: FileManagerPageModel;
  entry: FileManagerEntry;
  depth: number;
};

const FileManagerTreeNode: React.FC<FileManagerTreeNodeProps> = ({ page, entry, depth }) => {
  const isExpanded = Boolean(page.expandedPaths[entry.path]);
  const children = page.treeEntriesByPath[entry.path] ?? [];

  return (
    <FileManagerTreeRow
      page={page}
      depth={depth}
      name={entry.name}
      path={entry.path}
      kind={entry.kind}
      extension={entry.extension}
      isExpanded={isExpanded}
      isLoading={Boolean(page.treeLoadingPaths[entry.path])}
      error={page.treeErrorsByPath[entry.path]}
      onToggleExpand={() => page.toggleExpanded(entry.path)}
      onSelect={() => page.handleSelectPath(entry.path, entry.kind)}
      onOpen={entry.kind === 'file' ? () => {
        page.handleSelectPath(entry.path, entry.kind);
        if (isFileManagerZipEntry(entry)) {
          page.enterZipEditMode(entry.path);
          return;
        }
        page.enterTextEditMode();
      } : undefined}
    >
      {entry.kind === 'directory' && isExpanded ? (
        <div>
          {children.map((child) => (
            <FileManagerTreeNode key={child.path} page={page} entry={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </FileManagerTreeRow>
  );
};

type FileManagerTreePanelProps = {
  page: FileManagerPageModel;
};

export const FileManagerTreePanel: React.FC<FileManagerTreePanelProps> = ({ page }) => {
  const displayTreeRootPath = page.effectiveTreeRootPath;
  const isTreeViewAnchored = page.treeViewRootPath !== null;
  const rootEntries = page.treeEntriesByPath[displayTreeRootPath] ?? [];
  const rootLabel = isTreeViewAnchored
    ? getFileManagerEntryName(page.treeViewRootPath!)
    : (page.scope === 'workspace' ? 'workspace' : page.projectRootLabel);
  const isRootExpanded = Boolean(page.expandedPaths[displayTreeRootPath]);

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-slate-200 bg-white">
      <AppSearchBox
        value={page.searchQuery}
        onChange={page.setSearchQuery}
        placeholder="files…"
        ariaLabel="Search files"
        className={FILE_MANAGER_HEADER_BAR_OVERRIDES}
      />

      <div className="min-h-0 flex-1 overflow-auto px-0.5 py-1">
        <FileManagerTreeRow
          page={page}
          depth={0}
          name={rootLabel}
          path={displayTreeRootPath}
          kind="directory"
          isRoot={!isTreeViewAnchored}
          isTreeViewAnchor={isTreeViewAnchored}
          isExpanded={isRootExpanded}
          isLoading={Boolean(page.treeLoadingPaths[displayTreeRootPath])}
          error={page.treeErrorsByPath[displayTreeRootPath]}
          onToggleExpand={() => page.toggleExpanded(displayTreeRootPath)}
          onSelect={() => page.handleSelectPath(displayTreeRootPath, 'directory')}
        >
          {isRootExpanded ? (
            <div>
              {rootEntries.map((entry) => (
                <FileManagerTreeNode key={entry.path} page={page} entry={entry} depth={1} />
              ))}
            </div>
          ) : null}
        </FileManagerTreeRow>
      </div>
    </div>
  );
};
