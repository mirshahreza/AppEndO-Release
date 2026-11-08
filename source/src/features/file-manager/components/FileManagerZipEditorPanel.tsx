import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  ChevronDown,
  File,
  FilePlus2,
  Folder,
  FolderPlus,
  GripVertical,
  Loader2,
  Pencil,
  Save,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { MonacoEditorPanel } from '../../server-functions/components/MonacoEditorPanel';
import type { FileManagerZipEntry } from '../../../shared/api/queries/file-manager';
import { AppButton, LoadingSpinner, QueryErrorPanel } from '../../../shared/ui';
import {
  FILE_MANAGER_DRAG_MIME,
  FILE_MANAGER_ZIP_INTERNAL_DRAG_MIME,
  formatFileManagerBytes,
} from '../constants';
import type { FileManagerPageModel } from '../hooks/useFileManagerPage';
import { isFileManagerPlainTextLanguage } from '../textPreview';
import { fileManagerPreviewMonacoFontSize } from '../previewZoom';
import { FileManagerPreviewHeader } from './FileManagerPreviewHeader';
import { cn } from '../../../lib/utils';

const ZIP_TREE_DEPTH_INDENT_PX = 12;
const ZIP_TREE_BASE_INDENT_PX = 4;

type ZipTreeRowProps = {
  page: FileManagerPageModel;
  entry: FileManagerZipEntry;
  depth: number;
};

const ZipTreeRow: React.FC<ZipTreeRowProps> = ({ page, entry, depth }) => {
  const isDirectory = entry.kind === 'directory';
  const isSelected = page.zipSelectedEntryPath === entry.path;
  const isDragging = page.zipDraggingPath === entry.path;
  const isDropTarget = isDirectory && page.zipDropTargetPath === entry.path;
  const isMoveLocked = Boolean(page.zipMovingPath);
  const rowIndent = depth * ZIP_TREE_DEPTH_INDENT_PX + ZIP_TREE_BASE_INDENT_PX;

  const handleDragStart = (event: React.DragEvent<HTMLSpanElement>) => {
    if (isMoveLocked) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(FILE_MANAGER_ZIP_INTERNAL_DRAG_MIME, entry.path);
    page.handleZipDragStart(entry.path);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isDirectory || isMoveLocked) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    page.handleZipDragOver(entry.path);
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (!isDirectory || isMoveLocked) {
      return;
    }

    event.preventDefault();
    const workspaceSource = event.dataTransfer.getData(FILE_MANAGER_DRAG_MIME);
    if (workspaceSource) {
      void page.handleZipImportFromWorkspace(workspaceSource, entry.path);
      return;
    }

    const zipSource = event.dataTransfer.getData(FILE_MANAGER_ZIP_INTERNAL_DRAG_MIME);
    if (zipSource) {
      void page.handleZipMoveEntry(zipSource, entry.path);
    }
  };

  return (
    <div>
      <div
        className={cn(
          'group/zip-row flex h-6 w-full items-center gap-0.5 rounded px-1 text-left text-xs leading-none transition-colors',
          isSelected ? 'bg-sky-50 text-sky-900' : 'text-slate-700 hover:bg-slate-50',
          isDragging && 'opacity-40',
          isDropTarget && 'bg-emerald-50 ring-1 ring-inset ring-emerald-300',
        )}
        style={{ paddingInlineStart: `${rowIndent}px` }}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      >
        {isDirectory ? (
          <ChevronDown className="inline-flex h-3 w-3 shrink-0 text-slate-400" aria-hidden="true" />
        ) : (
          <span className="inline-flex h-3 w-3 shrink-0" />
        )}

        <span
          draggable={!isMoveLocked}
          onDragStart={handleDragStart}
          onDragEnd={page.handleZipDragEnd}
          className={cn(
            'inline-flex h-3.5 w-3 shrink-0 items-center justify-center text-slate-300 opacity-0 transition-opacity group-hover/zip-row:opacity-100',
            isMoveLocked ? 'cursor-not-allowed' : 'cursor-grab active:cursor-grabbing',
          )}
          aria-label={`Drag ${entry.name}`}
          title="Drag to move"
        >
          <GripVertical className="h-3 w-3" />
        </span>

        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-1 text-left"
          onClick={() => page.handleZipSelectEntry(entry)}
          onDoubleClick={() => {
            page.handleZipSelectEntry(entry);
            if (entry.kind === 'file') {
              page.enterZipTextEditMode();
            }
          }}
        >
          {isDirectory ? (
            <Folder className="h-3 w-3 shrink-0 text-amber-500" />
          ) : (
            <File className="h-3 w-3 shrink-0 text-slate-400" />
          )}
          <span className="truncate font-medium">{entry.name}</span>
          {!isDirectory ? (
            <span className="truncate text-[10px] text-slate-400">
              {formatFileManagerBytes(entry.sizeBytes)}
            </span>
          ) : null}
        </button>

        {page.zipMovingPath === entry.path ? (
          <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin text-slate-400" />
        ) : null}

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover/zip-row:opacity-100">
          {isDirectory ? (
            <button
              type="button"
              className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              title="Upload into folder"
              onClick={(event) => {
                event.stopPropagation();
                page.openZipUploadPicker(entry.path);
              }}
            >
              <Upload className="h-3 w-3" />
            </button>
          ) : null}
          <button
            type="button"
            className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            title="Rename"
            onClick={(event) => {
              event.stopPropagation();
              page.openZipRenameModal(entry);
            }}
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            className="rounded p-0.5 text-rose-400 hover:bg-rose-50 hover:text-rose-700"
            title="Delete"
            onClick={(event) => {
              event.stopPropagation();
              page.openZipDeleteModal(entry);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </button>
        </div>
      </div>

      {isDirectory && entry.children?.length ? (
        <div>
          {entry.children.map((child) => (
            <ZipTreeRow key={child.path} page={page} entry={child} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
};

type ZipRootDropRowProps = {
  page: FileManagerPageModel;
};

const ZipRootDropRow: React.FC<ZipRootDropRowProps> = ({ page }) => {
  const isDropTarget = page.zipDropTargetPath === '';
  const isMoveLocked = Boolean(page.zipMovingPath);

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    if (isMoveLocked) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    page.handleZipDragOver('');
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    if (isMoveLocked) {
      return;
    }

    event.preventDefault();
    const workspaceSource = event.dataTransfer.getData(FILE_MANAGER_DRAG_MIME);
    if (workspaceSource) {
      void page.handleZipImportFromWorkspace(workspaceSource, '');
      return;
    }

    const zipSource = event.dataTransfer.getData(FILE_MANAGER_ZIP_INTERNAL_DRAG_MIME);
    if (zipSource) {
      void page.handleZipMoveEntry(zipSource, '');
    }
  };

  return (
    <div
      className={cn(
        'mb-1 flex h-6 items-center gap-1 rounded px-1 text-xs text-slate-500',
        isDropTarget && 'bg-emerald-50 ring-1 ring-inset ring-emerald-300',
      )}
      style={{ paddingInlineStart: `${ZIP_TREE_BASE_INDENT_PX}px` }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Folder className="h-3 w-3 shrink-0 text-sky-600" />
      <span className="font-semibold text-slate-700">{page.zipArchiveName}</span>
      <span className="text-[10px] text-slate-400">Archive root</span>
    </div>
  );
};

const ZipEntryDetail: React.FC<{ page: FileManagerPageModel }> = ({ page }) => {
  const content = page.zipContentQuery.data;
  const selectedPath = page.zipSelectedEntryPath;

  if (!selectedPath || !content) {
    return null;
  }

  if (page.zipContentQuery.isLoading) {
    return (
      <div className="flex min-h-[120px] items-center justify-center border-t border-slate-200 bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  if (page.zipContentQuery.isError) {
    return (
      <div className="border-t border-slate-200 bg-white p-4">
        <QueryErrorPanel message={page.zipContentQuery.error?.message ?? 'Failed to load zip entry.'} />
      </div>
    );
  }

  if (content.kind === 'text' || content.kind === 'empty') {
    const language = content.language ?? 'plaintext';
    const isPlainText = isFileManagerPlainTextLanguage(language);

    return (
      <div className="flex min-h-[180px] flex-col border-t border-slate-200 bg-white">
        <FileManagerPreviewHeader
          title={page.zipSelectedEntryName ?? selectedPath}
          subtitle={page.zipIsTextEditing
            ? (page.zipIsDirty ? 'Unsaved changes' : 'Editing')
            : 'Double-click tree row to edit'}
          actions={page.zipIsTextEditing && page.zipIsDirty ? (
            <AppButton intent="primary" size="sm" disabled={page.isSavingZipContent} onClick={() => { void page.handleZipSaveContent(); }}>
              <Save className="h-3.5 w-3.5" />
              Save
            </AppButton>
          ) : null}
        />
        <div className="min-h-0 flex-1">
          {page.zipIsTextEditing ? (
            <MonacoEditorPanel
              documentKey={`${page.scope}:${page.zipEditArchivePath}:${selectedPath}:edit`}
              language={language}
              value={page.zipEditorValue}
              onChange={page.handleZipEditorChange}
              options={{
                readOnly: false,
                minimap: { enabled: false },
                fontSize: fileManagerPreviewMonacoFontSize(page.previewZoom),
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          ) : isPlainText ? (
            <pre className="h-full overflow-auto whitespace-pre-wrap break-words bg-slate-50 p-4 font-sans text-sm leading-relaxed text-slate-800">
              {content.content || ' '}
            </pre>
          ) : (
            <MonacoEditorPanel
              documentKey={`${page.scope}:${page.zipEditArchivePath}:${selectedPath}:preview`}
              language={language}
              value={content.content ?? ''}
              onChange={() => {}}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: fileManagerPreviewMonacoFontSize(page.previewZoom),
                wordWrap: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
              }}
            />
          )}
        </div>
      </div>
    );
  }

  if (content.kind === 'image' && content.encoding === 'base64' && content.mimeType) {
    return (
      <div className="flex min-h-[180px] flex-col border-t border-slate-200 bg-slate-50">
        <FileManagerPreviewHeader
          title={page.zipSelectedEntryName ?? selectedPath}
          subtitle={formatFileManagerBytes(content.sizeBytes)}
        />
        <div className="flex flex-1 items-center justify-center overflow-auto p-4">
          <img
            src={`data:${content.mimeType};base64,${content.content}`}
            alt={page.zipSelectedEntryName ?? selectedPath}
            className="max-h-full max-w-full object-contain"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-500">
      Preview is not available for this zip entry.
    </div>
  );
};

type FileManagerZipEditorPanelProps = {
  page: FileManagerPageModel;
};

export const FileManagerZipEditorPanel: React.FC<FileManagerZipEditorPanelProps> = ({ page }) => {
  const archiveLabel = useMemo(() => {
    if (!page.zipEditArchivePath) {
      return 'Zip archive';
    }
    return page.zipEditArchivePath.split('/').pop() ?? page.zipEditArchivePath;
  }, [page.zipEditArchivePath]);

  if (page.zipEntriesQuery.isLoading) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  if (page.zipEntriesQuery.isError) {
    return (
      <div className="flex h-full min-h-0 flex-1 items-center justify-center bg-white p-4">
        <QueryErrorPanel message={page.zipEntriesQuery.error?.message ?? 'Failed to load zip archive.'} />
      </div>
    );
  }

  const zipData = page.zipEntriesQuery.data;
  const selectedParentPath = page.zipSelectedEntry?.kind === 'directory'
    ? page.zipSelectedEntry.path
    : (page.zipSelectedParentPath ?? '');

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-white">
      <input
        ref={page.zipUploadInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          if (files.length > 0) {
            void page.handleZipUploadFiles(page.zipUploadParentPath, files);
          }
        }}
      />

      <FileManagerPreviewHeader
        title={archiveLabel}
        subtitle={zipData
          ? `${formatFileManagerBytes(zipData.archiveSizeBytes)} · ${zipData.entryCount} entries · Editing archive`
          : 'Editing archive'}
        actions={(
          <>
            <AppButton
              intent="utility"
              size="sm"
              disabled={page.isUploadingZip}
              onClick={() => page.openZipUploadPicker(selectedParentPath)}
            >
              <Upload className="h-3.5 w-3.5" />
              Upload
            </AppButton>
            <AppButton
              intent="utility"
              size="sm"
              disabled={page.isCreatingZipEntry}
              onClick={() => page.openZipCreateModal('folder', selectedParentPath)}
            >
              <FolderPlus className="h-3.5 w-3.5" />
              Folder
            </AppButton>
            <AppButton
              intent="utility"
              size="sm"
              disabled={page.isCreatingZipEntry}
              onClick={() => page.openZipCreateModal('file', selectedParentPath)}
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              File
            </AppButton>
            <AppButton intent="utility" size="sm" onClick={page.exitZipEditMode}>
              <X className="h-3.5 w-3.5" />
              Close
            </AppButton>
          </>
        )}
      />

      <div className="min-h-0 flex-1 overflow-auto px-1 py-2">
        <ZipRootDropRow page={page} />
        {zipData?.entries.length ? (
          zipData.entries.map((entry) => (
            <ZipTreeRow key={entry.path} page={page} entry={entry} depth={0} />
          ))
        ) : (
          <p className="px-2 py-4 text-center text-xs text-slate-500">
            Archive is empty. Upload files or drag items from the workspace tree.
          </p>
        )}
      </div>

      <ZipEntryDetail page={page} />
    </div>
  );
};

export const shouldShowZipEditor = (page: FileManagerPageModel): boolean => (
  Boolean(page.zipEditArchivePath)
);
