import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  fetchFileManagerEntries,
  useCreateFileManagerFileMutation,
  useCreateFileManagerFolderMutation,
  useCreateFileManagerZipFileMutation,
  useCreateFileManagerZipFolderMutation,
  useDeleteFileManagerEntryMutation,
  useDeleteFileManagerZipEntryMutation,
  useEmptyFileManagerFolderMutation,
  useExtractFileManagerZipMutation,
  useFileManagerConfigQuery,
  useFileManagerContentQuery,
  useFileManagerZipContentQuery,
  useFileManagerZipEntriesQuery,
  useImportFileManagerZipEntryMutation,
  useMoveFileManagerEntryMutation,
  useMoveFileManagerZipEntryMutation,
  useRenameFileManagerEntryMutation,
  useRenameFileManagerZipEntryMutation,
  useReplaceFileManagerImageMutation,
  useUploadFileManagerFilesMutation,
  useUploadFileManagerZipEntriesMutation,
  useWriteFileManagerContentMutation,
  useWriteFileManagerZipContentMutation,
  type FileManagerEntry,
  type FileManagerScope,
  type FileManagerZipEntry,
} from '../../../shared/api/queries/file-manager';
import { formatQueryError } from '../../../shared/api/client';
import {
  useWorkspaceVerticalSplitPanel,
  WORKSPACE_SPLIT_PANEL_KEYS,
} from '../../../shared/ui';
import {
  FILE_MANAGER_DEFAULT_SCOPE,
  FILE_MANAGER_WORKSPACE_ASSETS_PATH,
  getFileManagerDefaultTreeViewRootPath,
  getFileManagerEntryName,
  getFileManagerParentPath,
  getFileManagerScopeRootPath,
  isFileManagerDescendantPath,
  isFileManagerDestinationExistsError,
  isFileManagerZipEntry,
  openFileManagerMoveConflict,
  remapFileManagerPathPrefix,
  type FileManagerMoveConflictState,
} from '../constants';
import {
  getZipInternalEntryName,
  getZipInternalParentPath,
  isZipInternalDescendantPath,
  remapZipInternalPathPrefix,
} from '../zipPaths';
import { FILE_MANAGER_PREVIEW_ZOOM_DEFAULT } from '../previewZoom';

export type FileManagerCreateMode = 'file' | 'folder';

export type FileManagerMoveConflict = FileManagerMoveConflictState;

export type FileManagerZipEntryTarget = Pick<FileManagerZipEntry, 'path' | 'name' | 'kind'>;

const findZipEntryInTree = (
  entries: FileManagerZipEntry[],
  entryPath: string,
): FileManagerZipEntry | null => {
  for (const entry of entries) {
    if (entry.path === entryPath) {
      return entry;
    }
    if (entry.children?.length) {
      const match = findZipEntryInTree(entry.children, entryPath);
      if (match) {
        return match;
      }
    }
  }
  return null;
};

export type FileManagerPageModel = ReturnType<typeof useFileManagerPage>;

export function useFileManagerPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scope, setScope] = useState<FileManagerScope>(FILE_MANAGER_DEFAULT_SCOPE);
  const [selectedPath, setSelectedPath] = useState<string>(FILE_MANAGER_WORKSPACE_ASSETS_PATH);
  const [expandedPaths, setExpandedPaths] = useState<Record<string, boolean>>({
    [FILE_MANAGER_WORKSPACE_ASSETS_PATH]: true,
  });
  const [treeEntriesByPath, setTreeEntriesByPath] = useState<Record<string, FileManagerEntry[]>>({});
  const [treeLoadingPaths, setTreeLoadingPaths] = useState<Record<string, boolean>>({});
  const [treeErrorsByPath, setTreeErrorsByPath] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [treeViewRootPath, setTreeViewRootPath] = useState<string | null>(FILE_MANAGER_WORKSPACE_ASSETS_PATH);
  const [editorValue, setEditorValue] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [createMode, setCreateMode] = useState<FileManagerCreateMode | null>(null);
  const [createParentPath, setCreateParentPath] = useState<string | null>(null);
  const [createName, setCreateName] = useState('');
  const [renameTarget, setRenameTarget] = useState<FileManagerEntry | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<FileManagerEntry | null>(null);
  const [emptyFolderTarget, setEmptyFolderTarget] = useState<FileManagerEntry | null>(null);
  const [showProjectRootWarning, setShowProjectRootWarning] = useState(false);
  const [extractingPath, setExtractingPath] = useState<string | null>(null);
  const [uploadingPath, setUploadingPath] = useState<string | null>(null);
  const [isTextEditing, setIsTextEditing] = useState(false);
  const [draggingPath, setDraggingPath] = useState<string | null>(null);
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null);
  const [movingPath, setMovingPath] = useState<string | null>(null);
  const [moveConflict, setMoveConflict] = useState<FileManagerMoveConflict | null>(null);
  const [isResolvingMoveConflict, setIsResolvingMoveConflict] = useState(false);
  const [previewZoom, setPreviewZoom] = useState(FILE_MANAGER_PREVIEW_ZOOM_DEFAULT);

  const [zipEditArchivePath, setZipEditArchivePath] = useState<string | null>(null);
  const [zipSelectedEntryPath, setZipSelectedEntryPath] = useState<string | null>(null);
  const [zipDraggingPath, setZipDraggingPath] = useState<string | null>(null);
  const [zipDropTargetPath, setZipDropTargetPath] = useState<string | null>(null);
  const [zipMovingPath, setZipMovingPath] = useState<string | null>(null);
  const [zipEditorValue, setZipEditorValue] = useState('');
  const [zipIsDirty, setZipIsDirty] = useState(false);
  const [zipIsTextEditing, setZipIsTextEditing] = useState(false);
  const [zipCreateMode, setZipCreateMode] = useState<FileManagerCreateMode | null>(null);
  const [zipCreateParentPath, setZipCreateParentPath] = useState('');
  const [zipCreateName, setZipCreateName] = useState('');
  const [zipRenameTarget, setZipRenameTarget] = useState<FileManagerZipEntryTarget | null>(null);
  const [zipRenameName, setZipRenameName] = useState('');
  const [zipDeleteTarget, setZipDeleteTarget] = useState<FileManagerZipEntryTarget | null>(null);
  const [zipUploadParentPath, setZipUploadParentPath] = useState('');
  const [zipMoveConflict, setZipMoveConflict] = useState<{
    kind: 'move' | 'import';
    sourcePath: string;
    destinationParentPath: string;
    entryName: string;
  } | null>(null);
  const zipUploadInputRef = useRef<HTMLInputElement | null>(null);

  const configQuery = useFileManagerConfigQuery();
  const scopeRootPath = getFileManagerScopeRootPath(scope);
  const effectiveTreeRootPath = treeViewRootPath ?? scopeRootPath;

  const selectedEntry = useMemo((): FileManagerEntry | null => {
    if (selectedPath === scopeRootPath) {
      return {
        name: scope === 'workspace' ? 'workspace' : configQuery.data?.projectRootLabel ?? 'Project',
        path: scopeRootPath,
        kind: 'directory',
        sizeBytes: null,
        modifiedAt: null,
        extension: null,
      };
    }

    for (const entries of Object.values(treeEntriesByPath)) {
      const match = entries.find((entry) => entry.path === selectedPath);
      if (match) {
        return match;
      }
    }

    return null;
  }, [configQuery.data?.projectRootLabel, scope, scopeRootPath, selectedPath, treeEntriesByPath]);

  const shouldLoadContent = selectedEntry?.kind === 'file';

  const contentQuery = useFileManagerContentQuery(
    shouldLoadContent ? selectedPath : null,
    scope,
  );

  const isSelectedFile = selectedEntry?.kind === 'file';

  const zipEntriesQuery = useFileManagerZipEntriesQuery(zipEditArchivePath, scope);

  const zipSelectedEntry = useMemo((): FileManagerZipEntry | null => {
    if (!zipSelectedEntryPath || !zipEntriesQuery.data?.entries) {
      return null;
    }
    return findZipEntryInTree(zipEntriesQuery.data.entries, zipSelectedEntryPath);
  }, [zipEntriesQuery.data?.entries, zipSelectedEntryPath]);

  const zipContentQuery = useFileManagerZipContentQuery(
    zipEditArchivePath,
    zipSelectedEntry?.kind === 'file' ? zipSelectedEntryPath : null,
    scope,
  );

  const zipSelectedParentPath = useMemo(() => {
    if (!zipSelectedEntryPath) {
      return '';
    }
    return getZipInternalParentPath(zipSelectedEntryPath);
  }, [zipSelectedEntryPath]);

  const zipArchiveName = useMemo(() => {
    if (!zipEditArchivePath) {
      return 'archive.zip';
    }
    return getZipInternalEntryName(zipEditArchivePath);
  }, [zipEditArchivePath]);

  const writeMutation = useWriteFileManagerContentMutation();
  const replaceImageMutation = useReplaceFileManagerImageMutation();
  const createFolderMutation = useCreateFileManagerFolderMutation();
  const createFileMutation = useCreateFileManagerFileMutation();
  const renameMutation = useRenameFileManagerEntryMutation();
  const moveMutation = useMoveFileManagerEntryMutation();
  const deleteMutation = useDeleteFileManagerEntryMutation();
  const emptyFolderMutation = useEmptyFileManagerFolderMutation();
  const extractZipMutation = useExtractFileManagerZipMutation();
  const uploadFilesMutation = useUploadFileManagerFilesMutation();
  const writeZipContentMutation = useWriteFileManagerZipContentMutation();
  const deleteZipEntryMutation = useDeleteFileManagerZipEntryMutation();
  const moveZipEntryMutation = useMoveFileManagerZipEntryMutation();
  const renameZipEntryMutation = useRenameFileManagerZipEntryMutation();
  const createZipFolderMutation = useCreateFileManagerZipFolderMutation();
  const createZipFileMutation = useCreateFileManagerZipFileMutation();
  const importZipEntryMutation = useImportFileManagerZipEntryMutation();
  const uploadZipEntriesMutation = useUploadFileManagerZipEntriesMutation();

  const sidebarSplit = useWorkspaceVerticalSplitPanel({
    panelKey: WORKSPACE_SPLIT_PANEL_KEYS.fileManagerTree,
    defaultSize: 320,
    minSize: 240,
    maxSize: 520,
    measure: 'leading',
    containerRef,
    side: 'start',
    displayClassName: 'hidden lg:block',
  });

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
  }, []);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const loadTreePath = useCallback(async (path: string) => {
    setTreeLoadingPaths((current) => ({ ...current, [path]: true }));
    setTreeErrorsByPath((current) => {
      const next = { ...current };
      delete next[path];
      return next;
    });

    try {
      const entries = await fetchFileManagerEntries(path, scope);
      setTreeEntriesByPath((current) => ({ ...current, [path]: entries }));
    } catch (error) {
      setTreeErrorsByPath((current) => ({
        ...current,
        [path]: formatQueryError(error, 'Failed to load folder.'),
      }));
    } finally {
      setTreeLoadingPaths((current) => ({ ...current, [path]: false }));
    }
  }, [scope]);

  const refreshTree = useCallback(async () => {
    const pathsToReload = Object.keys(expandedPaths).filter((path) => expandedPaths[path]);
    await Promise.all([
      loadTreePath(scopeRootPath),
      ...pathsToReload.filter((path) => path !== scopeRootPath).map((path) => loadTreePath(path)),
    ]);
  }, [expandedPaths, loadTreePath, scopeRootPath]);

  const refreshTreeNode = useCallback((node: {
    path: string;
    kind: FileManagerEntry['kind'];
    isRoot?: boolean;
  }) => {
    if (node.isRoot) {
      void refreshTree();
      return;
    }

    const pathToRefresh = node.kind === 'directory'
      ? node.path
      : (getFileManagerParentPath(node.path) ?? scopeRootPath);
    void loadTreePath(pathToRefresh);
  }, [loadTreePath, refreshTree, scopeRootPath]);

  useEffect(() => {
    const defaultTreeRoot = getFileManagerDefaultTreeViewRootPath(scope);
    const initialPath = defaultTreeRoot ?? scopeRootPath;
    setExpandedPaths({ [initialPath]: true });
    setSelectedPath(initialPath);
    setTreeViewRootPath(defaultTreeRoot);
    setTreeEntriesByPath({});
    setTreeErrorsByPath({});
    setIsDirty(false);
    setEditorValue('');
    setIsTextEditing(false);
    setPreviewZoom(FILE_MANAGER_PREVIEW_ZOOM_DEFAULT);
    setZipEditArchivePath(null);
    setZipSelectedEntryPath(null);
    setZipIsTextEditing(false);
    setZipIsDirty(false);
    setZipEditorValue('');
  }, [scope, scopeRootPath]);

  useEffect(() => {
    void loadTreePath(effectiveTreeRootPath);
  }, [effectiveTreeRootPath, loadTreePath]);

  const viewTreeFromPath = useCallback((path: string) => {
    if (path === scopeRootPath) {
      setTreeViewRootPath(null);
      setSelectedPath(scopeRootPath);
      setExpandedPaths({ [scopeRootPath]: true });
      return;
    }

    setTreeViewRootPath(path);
    setSelectedPath(path);
    setExpandedPaths((current) => ({ ...current, [path]: true }));
    void loadTreePath(path);
  }, [loadTreePath, scopeRootPath]);

  const resetTreeViewRoot = useCallback(() => {
    setTreeViewRootPath(null);
    setSelectedPath(scopeRootPath);
    setExpandedPaths({ [scopeRootPath]: true });
  }, [scopeRootPath]);

  const viewTreeFromParent = useCallback(() => {
    if (!treeViewRootPath) {
      return;
    }

    const parentPath = getFileManagerParentPath(treeViewRootPath);
    if (!parentPath || parentPath === scopeRootPath) {
      resetTreeViewRoot();
      return;
    }

    viewTreeFromPath(parentPath);
  }, [resetTreeViewRoot, scopeRootPath, treeViewRootPath, viewTreeFromPath]);

  useEffect(() => {
    setPreviewZoom(FILE_MANAGER_PREVIEW_ZOOM_DEFAULT);
  }, [selectedPath]);

  useEffect(() => {
    if (!contentQuery.data || contentQuery.data.kind !== 'text' && contentQuery.data.kind !== 'empty') {
      return;
    }

    setEditorValue(contentQuery.data.content ?? '');
    setIsDirty(false);
  }, [contentQuery.data]);

  useEffect(() => {
    if (!zipContentQuery.data || zipContentQuery.data.kind !== 'text' && zipContentQuery.data.kind !== 'empty') {
      return;
    }

    setZipEditorValue(zipContentQuery.data.content ?? '');
    setZipIsDirty(false);
  }, [zipContentQuery.data]);

  const toggleExpanded = useCallback((path: string) => {
    setExpandedPaths((current) => {
      const nextExpanded = !current[path];
      const next = { ...current, [path]: nextExpanded };
      if (nextExpanded) {
        void loadTreePath(path);
      }
      return next;
    });
  }, [loadTreePath]);

  const handleSelectPath = useCallback((path: string, kind: FileManagerEntry['kind']) => {
    setSelectedPath(path);
    setIsTextEditing(false);
    if (zipEditArchivePath && path !== zipEditArchivePath) {
      setZipEditArchivePath(null);
      setZipSelectedEntryPath(null);
      setZipIsTextEditing(false);
      setZipIsDirty(false);
      setZipEditorValue('');
    }
    if (kind === 'directory') {
      setExpandedPaths((current) => ({ ...current, [path]: true }));
      void loadTreePath(path);
    }
  }, [loadTreePath, zipEditArchivePath]);

  const enterTextEditMode = useCallback(() => {
    if (!isSelectedFile) {
      return;
    }

    setIsTextEditing(true);
  }, [isSelectedFile]);

  const enterZipEditMode = useCallback((archivePath: string) => {
    setZipEditArchivePath(archivePath);
    setZipSelectedEntryPath(null);
    setZipIsTextEditing(false);
    setZipIsDirty(false);
    setZipEditorValue('');
    setZipDraggingPath(null);
    setZipDropTargetPath(null);
  }, []);

  const exitZipEditMode = useCallback(() => {
    setZipEditArchivePath(null);
    setZipSelectedEntryPath(null);
    setZipIsTextEditing(false);
    setZipIsDirty(false);
    setZipEditorValue('');
    setZipDraggingPath(null);
    setZipDropTargetPath(null);
  }, []);

  const handleZipSelectEntry = useCallback((entry: FileManagerZipEntry) => {
    setZipSelectedEntryPath(entry.path);
    setZipIsTextEditing(false);
    setZipIsDirty(false);
  }, []);

  const enterZipTextEditMode = useCallback(() => {
    if (!zipSelectedEntryPath || zipSelectedEntry?.kind !== 'file') {
      return;
    }
    setZipIsTextEditing(true);
  }, [zipSelectedEntry?.kind, zipSelectedEntryPath]);

  const handleZipEditorChange = useCallback((value: string | undefined) => {
    setZipEditorValue(value ?? '');
    setZipIsDirty(true);
  }, []);

  const handleZipSaveContent = useCallback(async () => {
    if (!zipEditArchivePath || !zipSelectedEntryPath) {
      return;
    }

    setActionError(null);
    try {
      await writeZipContentMutation.mutateAsync({
        archivePath: zipEditArchivePath,
        entryPath: zipSelectedEntryPath,
        content: zipEditorValue,
        scope,
      });
      setZipIsDirty(false);
      showToast('success', 'Zip entry saved.');
    } catch (error) {
      const message = formatQueryError(error, 'Failed to save zip entry.');
      setActionError(message);
      showToast('error', message);
    }
  }, [scope, showToast, writeZipContentMutation, zipEditArchivePath, zipEditorValue, zipSelectedEntryPath]);

  const openZipUploadPicker = useCallback((parentPath: string) => {
    setZipUploadParentPath(parentPath);
    zipUploadInputRef.current?.click();
  }, []);

  const handleZipUploadFiles = useCallback(async (parentPath: string, files: File[]) => {
    if (!zipEditArchivePath || !files.length) {
      return;
    }

    setActionError(null);
    try {
      const result = await uploadZipEntriesMutation.mutateAsync({
        archivePath: zipEditArchivePath,
        destinationParentPath: parentPath,
        files,
        scope,
      });
      if (result.uploaded[0]) {
        setZipSelectedEntryPath(result.uploaded[0].path);
      }
      const skippedCount = result.skipped.length;
      showToast(
        'success',
        skippedCount > 0
          ? `Uploaded ${result.uploaded.length} file(s) into zip. Skipped ${skippedCount}.`
          : `Uploaded ${result.uploaded.length} file(s) into zip.`,
      );
    } catch (error) {
      const message = formatQueryError(error, 'Failed to upload into zip.');
      setActionError(message);
      showToast('error', message);
    }
  }, [scope, showToast, uploadZipEntriesMutation, zipEditArchivePath]);

  const openZipCreateModal = useCallback((mode: FileManagerCreateMode, parentPath: string) => {
    setZipCreateMode(mode);
    setZipCreateParentPath(parentPath);
    setZipCreateName('');
    setActionError(null);
  }, []);

  const closeZipCreateModal = useCallback(() => {
    setZipCreateMode(null);
    setZipCreateParentPath('');
    setZipCreateName('');
  }, []);

  const submitZipCreate = useCallback(async () => {
    if (!zipEditArchivePath || !zipCreateMode || !zipCreateName.trim()) {
      return;
    }

    setActionError(null);
    try {
      const mutation = zipCreateMode === 'folder' ? createZipFolderMutation : createZipFileMutation;
      const created = await mutation.mutateAsync({
        archivePath: zipEditArchivePath,
        parentPath: zipCreateParentPath,
        name: zipCreateName.trim(),
        scope,
      });
      closeZipCreateModal();
      setZipSelectedEntryPath(created.path);
      showToast('success', `${zipCreateMode === 'folder' ? 'Folder' : 'File'} created in zip.`);
    } catch (error) {
      const message = formatQueryError(error, 'Failed to create zip entry.');
      setActionError(message);
      showToast('error', message);
    }
  }, [
    closeZipCreateModal,
    createZipFileMutation,
    createZipFolderMutation,
    scope,
    showToast,
    zipCreateMode,
    zipCreateName,
    zipCreateParentPath,
    zipEditArchivePath,
  ]);

  const openZipRenameModal = useCallback((entry: FileManagerZipEntryTarget) => {
    setZipRenameTarget(entry);
    setZipRenameName(entry.name);
    setActionError(null);
  }, []);

  const closeZipRenameModal = useCallback(() => {
    setZipRenameTarget(null);
    setZipRenameName('');
  }, []);

  const submitZipRename = useCallback(async () => {
    if (!zipEditArchivePath || !zipRenameTarget || !zipRenameName.trim()) {
      return;
    }

    setActionError(null);
    try {
      const renamed = await renameZipEntryMutation.mutateAsync({
        archivePath: zipEditArchivePath,
        entryPath: zipRenameTarget.path,
        newName: zipRenameName.trim(),
        scope,
      });
      closeZipRenameModal();
      setZipSelectedEntryPath((current) => (
        current ? remapZipInternalPathPrefix(current, zipRenameTarget.path, renamed.path) : renamed.path
      ));
      showToast('success', 'Zip entry renamed.');
    } catch (error) {
      const message = formatQueryError(error, 'Failed to rename zip entry.');
      setActionError(message);
      showToast('error', message);
    }
  }, [
    closeZipRenameModal,
    renameZipEntryMutation,
    scope,
    showToast,
    zipEditArchivePath,
    zipRenameName,
    zipRenameTarget,
  ]);

  const openZipDeleteModal = useCallback((entry: FileManagerZipEntryTarget) => {
    setZipDeleteTarget(entry);
    setActionError(null);
  }, []);

  const closeZipDeleteModal = useCallback(() => {
    setZipDeleteTarget(null);
  }, []);

  const submitZipDelete = useCallback(async () => {
    if (!zipEditArchivePath || !zipDeleteTarget) {
      return;
    }

    setActionError(null);
    try {
      await deleteZipEntryMutation.mutateAsync({
        archivePath: zipEditArchivePath,
        entryPath: zipDeleteTarget.path,
        scope,
      });
      closeZipDeleteModal();
      if (zipSelectedEntryPath === zipDeleteTarget.path || (
        zipDeleteTarget.kind === 'directory'
        && zipSelectedEntryPath?.startsWith(`${zipDeleteTarget.path}/`)
      )) {
        setZipSelectedEntryPath(null);
      }
      showToast('success', 'Zip entry deleted.');
    } catch (error) {
      const message = formatQueryError(error, 'Failed to delete zip entry.');
      setActionError(message);
      showToast('error', message);
    }
  }, [
    closeZipDeleteModal,
    deleteZipEntryMutation,
    scope,
    showToast,
    zipDeleteTarget,
    zipEditArchivePath,
    zipSelectedEntryPath,
  ]);

  const handleZipDragStart = useCallback((entryPath: string) => {
    setZipDraggingPath(entryPath);
    setZipDropTargetPath(null);
  }, []);

  const handleZipDragEnd = useCallback(() => {
    setZipDraggingPath(null);
    setZipDropTargetPath(null);
  }, []);

  const handleZipDragOver = useCallback((destinationParentPath: string) => {
    if (!zipDraggingPath) {
      return;
    }

    if (
      zipDraggingPath === destinationParentPath
      || isZipInternalDescendantPath(zipDraggingPath, destinationParentPath)
    ) {
      setZipDropTargetPath(null);
      return;
    }

    const sourceParent = getZipInternalParentPath(zipDraggingPath);
    if (sourceParent === destinationParentPath) {
      setZipDropTargetPath(null);
      return;
    }

    setZipDropTargetPath(destinationParentPath);
  }, [zipDraggingPath]);

  const applyZipMovedEntry = useCallback((sourcePath: string, moved: FileManagerZipEntry) => {
    setZipSelectedEntryPath((current) => (
      current ? remapZipInternalPathPrefix(current, sourcePath, moved.path) : moved.path
    ));
    showToast('success', `Moved ${moved.name} inside zip.`);
  }, [showToast]);

  const handleZipMoveEntry = useCallback(async (
    sourcePath: string,
    destinationParentPath: string,
    overwrite = false,
  ) => {
    handleZipDragEnd();

    if (!zipEditArchivePath || !sourcePath || sourcePath === destinationParentPath) {
      return;
    }

    if (
      isZipInternalDescendantPath(sourcePath, destinationParentPath)
      || getZipInternalParentPath(sourcePath) === destinationParentPath
    ) {
      return;
    }

    const entryName = getZipInternalEntryName(sourcePath);
    setZipMovingPath(sourcePath);

    try {
      const moved = await moveZipEntryMutation.mutateAsync({
        archivePath: zipEditArchivePath,
        entryPath: sourcePath,
        destinationParentPath,
        scope,
        overwrite,
      });
      applyZipMovedEntry(sourcePath, moved);
    } catch (error) {
      if (isFileManagerDestinationExistsError(error)) {
        setZipMoveConflict({
          kind: 'move',
          sourcePath,
          destinationParentPath,
          entryName,
        });
        return;
      }
      const message = formatQueryError(error, 'Failed to move zip entry.');
      setActionError(message);
      showToast('error', message);
    } finally {
      setZipMovingPath(null);
    }
  }, [
    applyZipMovedEntry,
    handleZipDragEnd,
    moveZipEntryMutation,
    scope,
    showToast,
    zipEditArchivePath,
  ]);

  const handleZipImportFromWorkspace = useCallback(async (
    sourcePath: string,
    destinationParentPath: string,
    overwrite = false,
  ) => {
    if (!zipEditArchivePath || !sourcePath) {
      return;
    }

    handleZipDragEnd();
    setZipMovingPath(sourcePath);

    try {
      const imported = await importZipEntryMutation.mutateAsync({
        archivePath: zipEditArchivePath,
        destinationParentPath,
        sourcePath,
        scope,
        overwrite,
      });
      setZipSelectedEntryPath(imported.path);
      showToast('success', `Imported ${imported.name} into zip.`);
    } catch (error) {
      if (isFileManagerDestinationExistsError(error)) {
        setZipMoveConflict({
          kind: 'import',
          sourcePath,
          destinationParentPath,
          entryName: getFileManagerEntryName(sourcePath),
        });
        return;
      }
      const message = formatQueryError(error, 'Failed to import file into zip.');
      setActionError(message);
      showToast('error', message);
    } finally {
      setZipMovingPath(null);
    }
  }, [handleZipDragEnd, importZipEntryMutation, scope, showToast, zipEditArchivePath]);

  const confirmZipMoveOverwrite = useCallback(async () => {
    if (!zipMoveConflict) {
      return;
    }

    setActionError(null);
    try {
      if (zipMoveConflict.kind === 'import') {
        await handleZipImportFromWorkspace(
          zipMoveConflict.sourcePath,
          zipMoveConflict.destinationParentPath,
          true,
        );
      } else {
        await handleZipMoveEntry(
          zipMoveConflict.sourcePath,
          zipMoveConflict.destinationParentPath,
          true,
        );
      }
      setZipMoveConflict(null);
    } catch (error) {
      const message = formatQueryError(error, 'Failed to replace zip entry.');
      setActionError(message);
      showToast('error', message);
    }
  }, [handleZipImportFromWorkspace, handleZipMoveEntry, showToast, zipMoveConflict]);

  const handleEditorChange = useCallback((value: string | undefined) => {
    setEditorValue(value ?? '');
    setIsDirty(true);
  }, []);

  const handleSave = useCallback(async () => {
    if (!selectedPath || !isSelectedFile) {
      return;
    }

    setActionError(null);
    try {
      await writeMutation.mutateAsync({ path: selectedPath, content: editorValue, scope });
      setIsDirty(false);
      showToast('success', 'File saved.');
      await refreshTree();
    } catch (error) {
      const message = formatQueryError(error, 'Failed to save file.');
      setActionError(message);
      showToast('error', message);
    }
  }, [editorValue, isSelectedFile, refreshTree, scope, selectedPath, showToast, writeMutation]);

  const handleSaveImage = useCallback(async (file: File) => {
    if (!selectedPath?.trim()) {
      throw new Error('No file selected.');
    }

    try {
      await replaceImageMutation.mutateAsync({ path: selectedPath, file, scope });
      showToast('success', 'Image saved.');
      await refreshTree();
    } catch (error) {
      const message = formatQueryError(error, 'Failed to save image.');
      throw error instanceof Error ? error : new Error(message);
    }
  }, [refreshTree, replaceImageMutation, scope, selectedPath, showToast]);

  const openCreateModal = useCallback((mode: FileManagerCreateMode, parentPath?: string) => {
    setCreateMode(mode);
    setCreateParentPath(parentPath ?? null);
    setCreateName('');
    setActionError(null);
  }, []);

  const closeCreateModal = useCallback(() => {
    setCreateMode(null);
    setCreateParentPath(null);
    setCreateName('');
  }, []);

  const submitCreate = useCallback(async () => {
    const parentPath = createParentPath
      ?? (selectedEntry?.kind === 'directory'
        ? selectedEntry.path
        : getFileManagerParentPath(selectedPath) ?? scopeRootPath);

    if (!createMode || !createName.trim()) {
      return;
    }

    setActionError(null);
    try {
      const mutation = createMode === 'folder' ? createFolderMutation : createFileMutation;
      const created = await mutation.mutateAsync({
        parentPath,
        name: createName.trim(),
        scope,
      });
      closeCreateModal();
      setExpandedPaths((current) => ({ ...current, [parentPath]: true }));
      await loadTreePath(parentPath);
      setSelectedPath(created.path);
      showToast('success', `${createMode === 'folder' ? 'Folder' : 'File'} created.`);
    } catch (error) {
      const message = formatQueryError(error, 'Failed to create entry.');
      setActionError(message);
      showToast('error', message);
    }
  }, [
    closeCreateModal,
    createFileMutation,
    createFolderMutation,
    createMode,
    createName,
    createParentPath,
    loadTreePath,
    scope,
    scopeRootPath,
    selectedEntry,
    selectedPath,
    showToast,
  ]);

  const openRenameModal = useCallback((entry: Pick<FileManagerEntry, 'name' | 'path' | 'kind'>) => {
    setRenameTarget({
      name: entry.name,
      path: entry.path,
      kind: entry.kind,
      sizeBytes: null,
      modifiedAt: null,
      extension: null,
    });
    setRenameName(entry.name);
    setActionError(null);
  }, []);

  const closeRenameModal = useCallback(() => {
    setRenameTarget(null);
    setRenameName('');
  }, []);

  const submitRename = useCallback(async () => {
    if (!renameTarget || !renameName.trim()) {
      return;
    }

    setActionError(null);
    try {
      const renamed = await renameMutation.mutateAsync({
        path: renameTarget.path,
        newName: renameName.trim(),
        scope,
      });
      closeRenameModal();
      const parentPath = getFileManagerParentPath(renameTarget.path) ?? scopeRootPath;
      await loadTreePath(parentPath);
      setSelectedPath(renamed.path);
      showToast('success', 'Entry renamed.');
    } catch (error) {
      const message = formatQueryError(error, 'Failed to rename entry.');
      setActionError(message);
      showToast('error', message);
    }
  }, [closeRenameModal, loadTreePath, renameMutation, renameName, renameTarget, scope, scopeRootPath, showToast]);

  const openDeleteModal = useCallback((entry: Pick<FileManagerEntry, 'name' | 'path' | 'kind'>) => {
    setDeleteTarget({
      name: entry.name,
      path: entry.path,
      kind: entry.kind,
      sizeBytes: null,
      modifiedAt: null,
      extension: null,
    });
    setActionError(null);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleteTarget(null);
  }, []);

  const openEmptyFolderModal = useCallback((entry: Pick<FileManagerEntry, 'name' | 'path' | 'kind'>) => {
    if (entry.kind !== 'directory') {
      return;
    }

    setEmptyFolderTarget({
      name: entry.name,
      path: entry.path,
      kind: entry.kind,
      sizeBytes: null,
      modifiedAt: null,
      extension: null,
    });
    setActionError(null);
  }, []);

  const closeEmptyFolderModal = useCallback(() => {
    setEmptyFolderTarget(null);
    setActionError(null);
  }, []);

  const submitEmptyFolder = useCallback(async () => {
    if (!emptyFolderTarget) {
      return;
    }

    const folderPath = emptyFolderTarget.path;
    setActionError(null);
    try {
      const result = await emptyFolderMutation.mutateAsync({
        path: folderPath,
        scope,
      });
      closeEmptyFolderModal();
      setTreeEntriesByPath((current) => {
        const nextEntries: Record<string, FileManagerEntry[]> = { ...current, [folderPath]: [] };
        for (const key of Object.keys(nextEntries)) {
          if (key.startsWith(`${folderPath}/`)) {
            delete nextEntries[key];
          }
        }
        return nextEntries;
      });
      setExpandedPaths((current) => {
        const nextExpanded = { ...current };
        for (const key of Object.keys(nextExpanded)) {
          if (key.startsWith(`${folderPath}/`)) {
            delete nextExpanded[key];
          }
        }
        return nextExpanded;
      });
      if (selectedPath !== folderPath && selectedPath.startsWith(`${folderPath}/`)) {
        setSelectedPath(folderPath);
      }
      await loadTreePath(folderPath);
      if (result.removedEntries === 0) {
        showToast('success', 'Folder is already empty.');
      } else {
        showToast('success', `Removed ${result.removedEntries} item(s) from folder.`);
      }
    } catch (error) {
      const message = formatQueryError(error, 'Failed to empty folder.');
      setActionError(message);
      showToast('error', message);
    }
  }, [
    closeEmptyFolderModal,
    emptyFolderMutation,
    emptyFolderTarget,
    loadTreePath,
    scope,
    selectedPath,
    showToast,
  ]);

  const submitDelete = useCallback(async () => {
    if (!deleteTarget) {
      return;
    }

    setActionError(null);
    try {
      await deleteMutation.mutateAsync({
        path: deleteTarget.path,
        scope,
        recursive: deleteTarget.kind === 'directory',
      });
      closeDeleteModal();
      const parentPath = getFileManagerParentPath(deleteTarget.path) ?? scopeRootPath;
      if (
        treeViewRootPath === deleteTarget.path
        || (treeViewRootPath && deleteTarget.kind === 'directory' && (
          treeViewRootPath.startsWith(`${deleteTarget.path}/`)
          || deleteTarget.path.startsWith(`${treeViewRootPath}/`)
        ))
      ) {
        setTreeViewRootPath(null);
      }
      if (selectedPath === deleteTarget.path || (deleteTarget.kind === 'directory' && selectedPath.startsWith(`${deleteTarget.path}/`))) {
        setSelectedPath(parentPath);
      }
      await loadTreePath(parentPath);
      showToast('success', 'Entry deleted.');
    } catch (error) {
      const message = formatQueryError(error, 'Failed to delete entry.');
      setActionError(message);
      showToast('error', message);
    }
  }, [
    closeDeleteModal,
    deleteMutation,
    deleteTarget,
    loadTreePath,
    scope,
    scopeRootPath,
    selectedPath,
    showToast,
    treeViewRootPath,
  ]);

  const requestProjectScope = useCallback(() => {
    if (scope === 'project') {
      return;
    }
    setShowProjectRootWarning(true);
  }, [scope]);

  const confirmProjectScope = useCallback(() => {
    setScope('project');
    setShowProjectRootWarning(false);
  }, []);

  const returnToWorkspaceScope = useCallback(() => {
    setScope('workspace');
  }, []);

  const handleExtractZip = useCallback(async (entry: Pick<FileManagerEntry, 'path'>) => {
    setActionError(null);
    setExtractingPath(entry.path);

    try {
      const result = await extractZipMutation.mutateAsync({ path: entry.path, scope });
      const parentPath = getFileManagerParentPath(entry.path) ?? scopeRootPath;
      setExpandedPaths((current) => ({
        ...current,
        [parentPath]: true,
        [result.targetPath]: true,
      }));
      await loadTreePath(parentPath);
      await loadTreePath(result.targetPath);
      setSelectedPath(result.targetPath);
      showToast('success', `Extracted ${result.extractedEntries} entries.`);
    } catch (error) {
      const message = formatQueryError(error, 'Failed to extract zip archive.');
      setActionError(message);
      showToast('error', message);
    } finally {
      setExtractingPath(null);
    }
  }, [extractZipMutation, loadTreePath, scope, scopeRootPath, showToast]);

  const handleUploadFiles = useCallback(async (parentPath: string, files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) {
      return;
    }

    setActionError(null);
    setUploadingPath(parentPath);

    try {
      const result = await uploadFilesMutation.mutateAsync({ parentPath, files: fileArray, scope });
      setExpandedPaths((current) => ({ ...current, [parentPath]: true }));
      await loadTreePath(parentPath);
      if (result.uploaded[0]) {
        setSelectedPath(result.uploaded[0].path);
      }

      const skippedCount = result.skipped.length;
      if (skippedCount > 0) {
        showToast(
          'success',
          `Uploaded ${result.uploaded.length} file(s). Skipped ${skippedCount}.`,
        );
      } else {
        showToast('success', `Uploaded ${result.uploaded.length} file(s).`);
      }
    } catch (error) {
      const message = formatQueryError(error, 'Failed to upload files.');
      setActionError(message);
      showToast('error', message);
    } finally {
      setUploadingPath(null);
    }
  }, [loadTreePath, scope, showToast, uploadFilesMutation]);

  const handleDragStart = useCallback((path: string) => {
    setDraggingPath(path);
    setDropTargetPath(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingPath(null);
    setDropTargetPath(null);
  }, []);

  const handleDragOver = useCallback((destinationParentPath: string) => {
    if (!draggingPath) {
      return;
    }

    if (
      draggingPath === destinationParentPath
      || isFileManagerDescendantPath(draggingPath, destinationParentPath)
    ) {
      setDropTargetPath(null);
      return;
    }

    const sourceParentPath = getFileManagerParentPath(draggingPath) ?? scopeRootPath;
    if (sourceParentPath === destinationParentPath) {
      setDropTargetPath(null);
      return;
    }

    setDropTargetPath(destinationParentPath);
  }, [draggingPath, scopeRootPath]);

  const applyMovedEntry = useCallback(async (
    sourcePath: string,
    destinationParentPath: string,
    moved: FileManagerEntry,
  ) => {
    const sourceParentPath = getFileManagerParentPath(sourcePath) ?? scopeRootPath;

    setExpandedPaths((current) => {
      const next: Record<string, boolean> = { ...current, [destinationParentPath]: true };

      for (const [key, value] of Object.entries(current)) {
        if (key === sourcePath || key.startsWith(`${sourcePath}/`)) {
          delete next[key];
          next[remapFileManagerPathPrefix(key, sourcePath, moved.path)] = value;
        }
      }

      if (moved.kind === 'directory') {
        next[moved.path] = current[sourcePath] ?? current[moved.path] ?? true;
      }

      return next;
    });

    setSelectedPath((current) => remapFileManagerPathPrefix(current, sourcePath, moved.path));
    setTreeEntriesByPath((current) => {
      const next = { ...current };
      for (const key of Object.keys(next)) {
        if (key === sourcePath || key.startsWith(`${sourcePath}/`)) {
          delete next[key];
        }
      }
      return next;
    });

    await Promise.all([
      loadTreePath(sourceParentPath),
      loadTreePath(destinationParentPath),
    ]);

    showToast('success', `Moved ${getFileManagerEntryName(moved.path)}.`);
  }, [loadTreePath, scopeRootPath, showToast]);

  const closeMoveConflictModal = useCallback(() => {
    setMoveConflict(null);
    setActionError(null);
  }, []);

  const confirmMoveOverwrite = useCallback(async (conflict: FileManagerMoveConflict) => {
    setActionError(null);
    setIsResolvingMoveConflict(true);
    setMovingPath(conflict.sourcePath);

    try {
      const moved = await moveMutation.mutateAsync({
        path: conflict.sourcePath,
        destinationParentPath: conflict.destinationParentPath,
        scope,
        overwrite: true,
      });
      setMoveConflict(null);
      await applyMovedEntry(conflict.sourcePath, conflict.destinationParentPath, moved);
    } catch (error) {
      const message = isFileManagerDestinationExistsError(error)
        ? 'Failed to replace the destination entry. Try again or cancel.'
        : formatQueryError(error, 'Failed to move entry.');
      setActionError(message);
      showToast('error', message);
    } finally {
      setIsResolvingMoveConflict(false);
      setMovingPath(null);
    }
  }, [applyMovedEntry, moveMutation, scope, showToast]);

  const handleMoveEntry = useCallback(async (sourcePath: string, destinationParentPath: string) => {
    handleDragEnd();

    if (!sourcePath || sourcePath === destinationParentPath) {
      return;
    }

    if (
      isFileManagerDescendantPath(sourcePath, destinationParentPath)
      || (getFileManagerParentPath(sourcePath) ?? scopeRootPath) === destinationParentPath
    ) {
      return;
    }

    const entryName = getFileManagerEntryName(sourcePath);
    setActionError(null);

    let destinationEntries = treeEntriesByPath[destinationParentPath];
    if (!destinationEntries) {
      try {
        destinationEntries = await fetchFileManagerEntries(destinationParentPath, scope);
        setTreeEntriesByPath((current) => ({ ...current, [destinationParentPath]: destinationEntries }));
      } catch {
        destinationEntries = [];
      }
    }

    if (destinationEntries.some((entry) => entry.name === entryName)) {
      setMoveConflict(openFileManagerMoveConflict(sourcePath, destinationParentPath));
      return;
    }

    setMovingPath(sourcePath);

    try {
      const moved = await moveMutation.mutateAsync({
        path: sourcePath,
        destinationParentPath,
        scope,
      });
      await applyMovedEntry(sourcePath, destinationParentPath, moved);
    } catch (error) {
      if (isFileManagerDestinationExistsError(error)) {
        setMoveConflict(openFileManagerMoveConflict(sourcePath, destinationParentPath));
        return;
      }
      const message = formatQueryError(error, 'Failed to move entry.');
      setActionError(message);
      showToast('error', message);
    } finally {
      setMovingPath(null);
    }
  }, [
    applyMovedEntry,
    handleDragEnd,
    moveMutation,
    scope,
    scopeRootPath,
    showToast,
    treeEntriesByPath,
  ]);

  const filteredTreeEntriesByPath = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
      return treeEntriesByPath;
    }

    const filtered: Record<string, FileManagerEntry[]> = {};
    for (const [path, entries] of Object.entries(treeEntriesByPath)) {
      filtered[path] = entries.filter((entry) => entry.name.toLowerCase().includes(query));
    }
    return filtered;
  }, [searchQuery, treeEntriesByPath]);

  return {
    containerRef,
    configQuery,
    contentQuery,
    scope,
    scopeRootPath,
    treeViewRootPath,
    effectiveTreeRootPath,
    viewTreeFromPath,
    viewTreeFromParent,
    resetTreeViewRoot,
    selectedPath,
    selectedEntry,
    expandedPaths,
    treeEntriesByPath: filteredTreeEntriesByPath,
    treeLoadingPaths,
    treeErrorsByPath,
    searchQuery,
    setSearchQuery,
    editorValue,
    isDirty,
    isSelectedFile,
    actionError,
    toast,
    setToast,
    sidebarWidth: sidebarSplit.size,
    isResizingSidebar: sidebarSplit.isResizing,
    sidebarSplitHandleProps: sidebarSplit.splitHandleProps,
    handleSelectPath,
    enterTextEditMode,
    isTextEditing,
    toggleExpanded,
    refreshTree,
    refreshTreeNode,
    handleEditorChange,
    handleSave,
    handleSaveImage,
    isSaving: writeMutation.isPending,
    isSavingImage: replaceImageMutation.isPending,
    createMode,
    createName,
    setCreateName,
    openCreateModal,
    closeCreateModal,
    submitCreate,
    isCreating: createFolderMutation.isPending || createFileMutation.isPending,
    renameTarget,
    renameName,
    setRenameName,
    openRenameModal,
    closeRenameModal,
    submitRename,
    isRenaming: renameMutation.isPending,
    deleteTarget,
    openDeleteModal,
    closeDeleteModal,
    submitDelete,
    isDeleting: deleteMutation.isPending,
    emptyFolderTarget,
    openEmptyFolderModal,
    closeEmptyFolderModal,
    submitEmptyFolder,
    isEmptyingFolder: emptyFolderMutation.isPending,
    showProjectRootWarning,
    requestProjectScope,
    confirmProjectScope,
    cancelProjectScope: () => setShowProjectRootWarning(false),
    returnToWorkspaceScope,
    handleExtractZip,
    extractingPath,
    handleUploadFiles,
    uploadingPath,
    draggingPath,
    dropTargetPath,
    movingPath,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleMoveEntry,
    isMoving: moveMutation.isPending,
    isResolvingMoveConflict,
    moveConflict,
    closeMoveConflictModal,
    confirmMoveOverwrite,
    previewZoom,
    setPreviewZoom,
    projectRootLabel: configQuery.data?.projectRootLabel ?? 'Project',
    zipEditArchivePath,
    zipArchiveName,
    zipEntriesQuery,
    zipContentQuery,
    zipSelectedEntryPath,
    zipSelectedEntry,
    zipSelectedEntryName: zipSelectedEntry?.name ?? null,
    zipSelectedParentPath,
    zipDraggingPath,
    zipDropTargetPath,
    zipMovingPath,
    zipEditorValue,
    zipIsDirty,
    zipIsTextEditing,
    zipUploadInputRef,
    zipUploadParentPath,
    enterZipEditMode,
    exitZipEditMode,
    handleZipSelectEntry,
    enterZipTextEditMode,
    handleZipEditorChange,
    handleZipSaveContent,
    isSavingZipContent: writeZipContentMutation.isPending,
    openZipUploadPicker,
    handleZipUploadFiles,
    isUploadingZip: uploadZipEntriesMutation.isPending,
    zipCreateMode,
    zipCreateName,
    setZipCreateName,
    openZipCreateModal,
    closeZipCreateModal,
    submitZipCreate,
    isCreatingZipEntry: createZipFolderMutation.isPending || createZipFileMutation.isPending,
    zipRenameTarget,
    zipRenameName,
    setZipRenameName,
    openZipRenameModal,
    closeZipRenameModal,
    submitZipRename,
    isRenamingZipEntry: renameZipEntryMutation.isPending,
    zipDeleteTarget,
    openZipDeleteModal,
    closeZipDeleteModal,
    submitZipDelete,
    isDeletingZipEntry: deleteZipEntryMutation.isPending,
    handleZipDragStart,
    handleZipDragEnd,
    handleZipDragOver,
    handleZipMoveEntry,
    handleZipImportFromWorkspace,
    zipMoveConflict,
    closeZipMoveConflictModal: () => setZipMoveConflict(null),
    confirmZipMoveOverwrite,
  };
}
