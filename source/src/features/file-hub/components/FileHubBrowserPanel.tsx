import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, File, Folder, FolderPlus, Pencil, Trash2, Upload, X } from 'lucide-react';
import { formatQueryError } from '../../../shared/api/client';
import type { FileHubConnectionPublic, FileHubRemoteEntry } from '../../../shared/api/contracts/file-hub/types';
import { joinRemotePath, parentRemotePath, sanitizeRemoteEntryName } from '../../../shared/api/contracts/file-hub/validation';
import {
  deleteFileHubPath,
  listFileHubFiles,
  mkdirFileHubPath,
  renameFileHubPath,
  triggerFileHubDownload,
  uploadFileHubFiles,
} from '../../../shared/api/queries/file-hub';
import { useAiSettingsQuery } from '../../../shared/api/queries/aiModels';
import { isAiGloballyEnabled } from '../../../shared/lib/aiAccess';
import { useCultureT } from '../../../core/culture/CultureContext';
import { cn } from '../../../lib/utils';
import type { AppTableGridColumnDef } from '../../../shared/lib/appTableGridQuery';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import {
  AppButton,
  AppTableGrid,
  ConfirmDialogShell,
  CreateEditModalShell,
  DestructiveConfirmBody,
  DevelopmentCatalogIconAction,
  FormField,
  LoadingSpinner,
  ToolbarActionGroupWithRefresh,
  UiBreadcrumbs,
  UiChip,
  UiInput,
  WorkspaceBackIcon,
} from '../../../shared/ui';
import type { FileHubPageState } from '../hooks/useFileHubPage';
import { executeFileHubAiCommand, formatFileHubSnapshot } from '../lib/fileHubAiCommands';
import { FileHubAiPanel } from './FileHubAiPanel';
import { useListPageToolbarScroll } from '../../../shared/lib/useListPageToolbarScroll';
import { ListPageToolbarScrollHost } from '../../../shared/ui/list-page/listPageToolbarChrome';

export type FileHubBrowserStatus = 'connecting' | 'connected' | 'error';

type FileHubBrowserPanelProps = {
  connection: FileHubConnectionPublic;
  showToast: FileHubPageState['showToast'];
  onBack?: () => void;
};

const statusChipClass: Record<FileHubBrowserStatus, string> = {
  connecting: 'border-amber-200 bg-amber-50 text-amber-800',
  connected: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  error: 'border-rose-200 bg-rose-50 text-rose-800',
};

type BrowserRow = FileHubRemoteEntry & {
  path: string;
  isParent?: boolean;
};

const formatBytes = (bytes: number, type: FileHubRemoteEntry['type']): string => {
  if (type === 'directory' || !Number.isFinite(bytes) || bytes <= 0) {
    return type === 'directory' ? '—' : '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const rounded = index === 0 || value >= 10 ? Math.round(value).toString() : value.toFixed(1);
  return `${rounded} ${units[index]}`;
};

const formatModified = (value: number | null): string => {
  if (!value) {
    return '—';
  }
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
};

export const FileHubBrowserPanel: React.FC<FileHubBrowserPanelProps> = ({
  connection,
  showToast,
  onBack,
}) => {
  const t = useCultureT();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const clickTimerRef = useRef<number | null>(null);
  const [status, setStatus] = useState<FileHubBrowserStatus>('connecting');
  const [items, setItems] = useState<FileHubRemoteEntry[]>([]);
  const [resolvedPath, setResolvedPath] = useState(connection.initialPath || '/');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [mkdirOpen, setMkdirOpen] = useState(false);
  const [mkdirName, setMkdirName] = useState('');
  const [renameTarget, setRenameTarget] = useState<BrowserRow | null>(null);
  const [renameName, setRenameName] = useState('');
  const [deleteTargets, setDeleteTargets] = useState<BrowserRow[]>([]);
  const listingRef = useRef({ path: connection.initialPath || '/', items: [] as FileHubRemoteEntry[] });
  const aiSettingsQuery = useAiSettingsQuery();
  const showAi = isAiGloballyEnabled(aiSettingsQuery.data?.enabled);
  const [aiReady, setAiReady] = useState(false);
  const { listToolbarCollapsed, handleGridScroll } = useListPageToolbarScroll();

  const loadPath = useCallback(async (nextPath: string) => {
    setIsLoading(true);
    setStatus((current) => (current === 'connected' ? 'connected' : 'connecting'));
    try {
      const result = await listFileHubFiles(connection.id, nextPath);
      setItems(result.items);
      setResolvedPath(result.path);
      listingRef.current = { path: result.path, items: result.items };
      setSelectedKeys([]);
      setStatus('connected');
      setAiReady(true);
    } catch (error) {
      setStatus('error');
      showToast('error', formatQueryError(error, 'Failed to list remote files.'));
    } finally {
      setIsLoading(false);
    }
  }, [connection.id, showToast]);

  useEffect(() => {
    setAiReady(false);
    void loadPath(connection.initialPath || '');
  }, [connection.id, connection.initialPath, loadPath]);

  const executeAiCommand = useCallback(async (command: string) => {
    const result = await executeFileHubAiCommand({
      connectionId: connection.id,
      cwd: listingRef.current.path,
      items: listingRef.current.items,
      command,
    });
    listingRef.current = { path: result.cwd, items: result.items };
    setItems(result.items);
    setResolvedPath(result.cwd);
    setSelectedKeys([]);
    setStatus('connected');
  }, [connection.id]);

  const readAiSnapshot = useCallback(() => formatFileHubSnapshot({
    protocol: connection.protocol,
    path: listingRef.current.path,
    items: listingRef.current.items,
  }), [connection.protocol]);

  const rows = useMemo<BrowserRow[]>(() => {
    const mapped: BrowserRow[] = items.map((item) => ({
      ...item,
      path: joinRemotePath(resolvedPath, item.name) ?? `${resolvedPath}/${item.name}`,
    }));
    if (resolvedPath !== '/') {
      mapped.unshift({
        name: '..',
        type: 'directory',
        size: 0,
        modifyTime: null,
        permissions: '',
        path: parentRemotePath(resolvedPath),
        isParent: true,
      });
    }
    return mapped;
  }, [items, resolvedPath]);

  const selectedRows = useMemo(
    () => rows.filter((row) => !row.isParent && selectedKeys.includes(row.path)),
    [rows, selectedKeys],
  );

  const breadcrumbItems = useMemo(() => {
    const segments = resolvedPath.split('/').filter(Boolean);
    const items = [{
      key: 'root',
      label: '/',
      onPress: () => {
        void loadPath('/');
      },
    }];
    let acc = '';
    for (const segment of segments) {
      acc = `${acc}/${segment}`;
      const path = acc;
      items.push({
        key: path,
        label: segment,
        onPress: () => {
          void loadPath(path);
        },
      });
    }
    return items;
  }, [loadPath, resolvedPath]);

  const openEntry = useCallback((row: BrowserRow) => {
    if (row.type === 'directory') {
      void loadPath(row.path);
      return;
    }
    triggerFileHubDownload(connection.id, row.path);
  }, [connection.id, loadPath]);

  const handleRowClick = useCallback((row: BrowserRow) => {
    if (row.isParent) {
      void loadPath(row.path);
      return;
    }
    if (clickTimerRef.current) {
      window.clearTimeout(clickTimerRef.current);
      clickTimerRef.current = null;
      openEntry(row);
      return;
    }
    clickTimerRef.current = window.setTimeout(() => {
      clickTimerRef.current = null;
    }, 320);
    setSelectedKeys((current) => (
      current.includes(row.path) ? current.filter((key) => key !== row.path) : [...current, row.path]
    ));
  }, [loadPath, openEntry]);

  const uploadFiles = useCallback(async (files: File[]) => {
    if (files.length === 0) {
      return;
    }
    setIsUploading(true);
    try {
      await uploadFileHubFiles(connection.id, resolvedPath, files);
      showToast('success', files.length === 1 ? 'File uploaded.' : `${files.length} files uploaded.`);
      await loadPath(resolvedPath);
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to upload files.'));
    } finally {
      setIsUploading(false);
    }
  }, [connection.id, loadPath, resolvedPath, showToast]);

  const submitMkdir = useCallback(async () => {
    const name = sanitizeRemoteEntryName(mkdirName);
    const dest = name ? joinRemotePath(resolvedPath, name) : null;
    if (!dest) {
      showToast('error', 'Folder name is invalid.');
      return;
    }
    setIsBusy(true);
    try {
      await mkdirFileHubPath(connection.id, dest);
      setMkdirOpen(false);
      setMkdirName('');
      showToast('success', 'Folder created.');
      await loadPath(resolvedPath);
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to create folder.'));
    } finally {
      setIsBusy(false);
    }
  }, [connection.id, loadPath, mkdirName, resolvedPath, showToast]);

  const submitRename = useCallback(async () => {
    if (!renameTarget) {
      return;
    }
    const name = sanitizeRemoteEntryName(renameName);
    const dest = name ? joinRemotePath(resolvedPath, name) : null;
    if (!dest) {
      showToast('error', 'Name is invalid.');
      return;
    }
    setIsBusy(true);
    try {
      await renameFileHubPath(connection.id, renameTarget.path, dest);
      setRenameTarget(null);
      showToast('success', 'Renamed.');
      await loadPath(resolvedPath);
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to rename.'));
    } finally {
      setIsBusy(false);
    }
  }, [connection.id, loadPath, renameName, renameTarget, resolvedPath, showToast]);

  const submitDelete = useCallback(async () => {
    if (deleteTargets.length === 0) {
      return;
    }
    setIsBusy(true);
    try {
      for (const target of deleteTargets) {
        await deleteFileHubPath(connection.id, target.path, target.type);
      }
      setDeleteTargets([]);
      showToast('success', deleteTargets.length === 1 ? 'Deleted.' : 'Selected items deleted.');
      await loadPath(resolvedPath);
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to delete remote item.'));
    } finally {
      setIsBusy(false);
    }
  }, [connection.id, deleteTargets, loadPath, resolvedPath, showToast]);

  const columns = useMemo<AppTableGridColumnDef<BrowserRow>[]>(() => [
    {
      id: 'name',
      label: t('fileHub.files.column.name'),
      card: { role: 'title' },
      getSortValue: (row) => `${row.type === 'directory' ? '0' : '1'}:${row.name.toLowerCase()}`,
      renderCell: (row) => (
        <div className="flex min-w-0 items-center gap-2">
          {row.type === 'directory'
            ? <Folder className="h-3.5 w-3.5 shrink-0 text-amber-600" />
            : <File className="h-3.5 w-3.5 shrink-0 text-slate-500" />}
          <span className="truncate font-medium text-slate-800">{row.name}</span>
        </div>
      ),
    },
    {
      id: 'size',
      label: t('fileHub.files.column.size'),
      hideBelow: 'md',
      card: { role: 'meta' },
      getSortValue: (row) => row.size,
      renderCell: (row) => (
        <span className="font-mono text-[11px] text-slate-500">{formatBytes(row.size, row.type)}</span>
      ),
    },
    {
      id: 'modified',
      label: t('fileHub.files.column.modified'),
      hideBelow: 'lg',
      card: { role: 'meta' },
      getSortValue: (row) => row.modifyTime ?? 0,
      renderCell: (row) => (
        <span className="text-[11px] text-slate-500">{formatModified(row.modifyTime)}</span>
      ),
    },
    {
      id: 'actions',
      label: t('fileHub.files.column.actions'),
      sort: false,
      filter: false,
      layout: false,
      card: { role: 'actions' },
      renderCell: (row) => {
        if (row.isParent) {
          return null;
        }
        return (
          <div className="flex items-center justify-end gap-1" onClick={(event) => event.stopPropagation()}>
            {row.type === 'file' ? (
              <DevelopmentCatalogIconAction
                intent="duplicate"
                aria-label={`Download ${row.name}`}
                title="Download"
                onClick={() => triggerFileHubDownload(connection.id, row.path)}
              >
                <Download className="h-3 w-3" />
              </DevelopmentCatalogIconAction>
            ) : null}
            <DevelopmentCatalogIconAction
              intent="settings"
              aria-label={`Rename ${row.name}`}
              title="Rename"
              onClick={() => {
                setRenameTarget(row);
                setRenameName(row.name);
              }}
            >
              <Pencil className="h-3 w-3" />
            </DevelopmentCatalogIconAction>
            <DevelopmentCatalogIconAction
              intent="delete"
              aria-label={`Delete ${row.name}`}
              title="Delete"
              onClick={() => setDeleteTargets([row])}
            >
              <Trash2 className="h-3 w-3" />
            </DevelopmentCatalogIconAction>
          </div>
        );
      },
    },
  ], [connection.id, t]);

  return (
    <div
      className="relative flex h-full min-h-0 flex-1 flex-col bg-white"
      onDragEnter={(event) => {
        event.preventDefault();
        if (event.dataTransfer.types.includes('Files')) {
          setIsDragging(true);
        }
      }}
      onDragOver={(event) => {
        event.preventDefault();
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node)) {
          return;
        }
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        void uploadFiles(Array.from(event.dataTransfer.files ?? []));
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          event.target.value = '';
          void uploadFiles(files);
        }}
      />

      <ListPageToolbarScrollHost collapsed={listToolbarCollapsed}>
      <div
        className={cn(
          'shrink-0 border-b border-slate-200 bg-white px-3 py-[9px]',
        )}
      >
        <div className="flex min-h-8 min-w-0 flex-1 items-center justify-between gap-2 font-sans text-xs font-semibold text-slate-500">
          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            {onBack ? (
              <WorkspaceBackIcon
                ariaLabel={t('fileHub.editor.backAria')}
                title={t('fileHub.editor.backTitle')}
                onClick={onBack}
              />
            ) : null}
            <span className="truncate font-mono text-xs font-semibold text-slate-700" title={connection.name}>
              {connection.name}
            </span>
            <span className="hidden truncate font-mono text-[11px] text-slate-500 lg:inline">
              {connection.username}@{connection.host}:{connection.port}
            </span>
            <UiChip size="sm" variant="soft" className="border-cyan-200 bg-cyan-50 text-cyan-800">
              {connection.protocol.toUpperCase()}
            </UiChip>
            <UiChip size="sm" variant="soft" className={cn(statusChipClass[status])}>
              {t(`fileHub.editor.${status}`)}
            </UiChip>
            <UiBreadcrumbs items={breadcrumbItems} separator="slash" className="min-w-0 flex-1 text-xs" />
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <ToolbarActionGroupWithRefresh
              onRefresh={() => void loadPath(resolvedPath)}
              isRefreshing={isLoading && items.length > 0}
              actions={[
                {
                  id: 'upload',
                  label: t('fileHub.editor.upload'),
                  icon: <Upload className="h-3.5 w-3.5" aria-hidden="true" />,
                  intent: 'create',
                  primary: true,
                  loading: isUploading,
                  disabled: isUploading || isBusy,
                  onClick: () => fileInputRef.current?.click(),
                },
                {
                  id: 'mkdir',
                  label: t('fileHub.editor.mkdir'),
                  icon: <FolderPlus className="h-3.5 w-3.5" aria-hidden="true" />,
                  intent: 'secondary',
                  disabled: isBusy,
                  onClick: () => {
                    setMkdirName('');
                    setMkdirOpen(true);
                  },
                },
                {
                  id: 'delete',
                  label: t('fileHub.editor.deleteSelected'),
                  icon: <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />,
                  intent: 'destructive-soft',
                  disabled: selectedRows.length === 0 || isBusy,
                  onClick: () => setDeleteTargets(selectedRows),
                },
              ]}
            />
          </div>
        </div>
      </div>
      </ListPageToolbarScrollHost>

      <div className="flex min-h-0 min-w-0 flex-1">
        <div className="relative flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden">
          <AppTableGrid
          persistListKey={APP_LIST_PREFERENCE_KEYS.fileHub}
          size="xs"
          presentation="auto"
          stickyHeader
          columns={columns}
          rows={rows}
          getRowKey={(row) => row.path}
          onScroll={handleGridScroll}
          compact={{ tablet: { cardsPerRow: 2 } }}
          onRowClick={handleRowClick}
          getRowClassName={(row) => (row.isParent
            ? 'text-slate-500'
            : selectedKeys.includes(row.path)
              ? 'bg-slate-100'
              : undefined)}
          isLoading={isLoading && items.length === 0}
          loadingMessage={t('fileHub.files.loading')}
          isEmpty={!isLoading && rows.every((row) => row.isParent) && items.length === 0}
          emptyMessage={t('fileHub.files.empty')}
        />
        {(isUploading || isBusy) ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/60">
            <LoadingSpinner />
          </div>
        ) : null}
        {isDragging ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center border-2 border-dashed border-cyan-400 bg-cyan-50/80">
            <p className="text-sm font-semibold text-cyan-800">{t('fileHub.files.drop')}</p>
          </div>
        ) : null}
        </div>
        {showAi && aiReady ? (
          <FileHubAiPanel
            key={connection.id}
            readSnapshot={readAiSnapshot}
            onExecuteCommand={executeAiCommand}
          />
        ) : null}
      </div>

      {mkdirOpen ? (
        <CreateEditModalShell
          size="sm"
          title={t('fileHub.mkdir.title')}
          onClose={() => setMkdirOpen(false)}
          onBackdropClick={() => setMkdirOpen(false)}
          footer={(
            <>
              <AppButton intent="cancel" onClick={() => setMkdirOpen(false)}>
                <X className="h-3.5 w-3.5" />
                {t('actions.cancel')}
              </AppButton>
              <AppButton intent="primary" onClick={() => void submitMkdir()} disabled={!mkdirName.trim() || isBusy}>
                <FolderPlus className="h-3.5 w-3.5" />
                {t('fileHub.mkdir.submit')}
              </AppButton>
            </>
          )}
        >
          <FormField label={t('fileHub.mkdir.name')} required>
            <UiInput
              size="sm"
              aiAssist={false}
              autoDir={false}
              value={mkdirName}
              onChange={(event) => setMkdirName(event.target.value)}
              ariaLabel={t('fileHub.mkdir.name')}
            />
          </FormField>
        </CreateEditModalShell>
      ) : null}

      {renameTarget ? (
        <CreateEditModalShell
          size="sm"
          title={t('fileHub.rename.title')}
          onClose={() => setRenameTarget(null)}
          onBackdropClick={() => setRenameTarget(null)}
          footer={(
            <>
              <AppButton intent="cancel" onClick={() => setRenameTarget(null)}>
                <X className="h-3.5 w-3.5" />
                {t('actions.cancel')}
              </AppButton>
              <AppButton intent="primary" onClick={() => void submitRename()} disabled={!renameName.trim() || isBusy}>
                <Pencil className="h-3.5 w-3.5" />
                {t('fileHub.rename.submit')}
              </AppButton>
            </>
          )}
        >
          <FormField label={t('fileHub.rename.name')} required>
            <UiInput
              size="sm"
              aiAssist={false}
              autoDir={false}
              value={renameName}
              onChange={(event) => setRenameName(event.target.value)}
              ariaLabel={t('fileHub.rename.name')}
            />
          </FormField>
        </CreateEditModalShell>
      ) : null}

      {deleteTargets.length > 0 ? (
        <ConfirmDialogShell
          size="md"
          title={t('fileHub.deleteFile.title')}
          icon={<Trash2 className="h-4 w-4" />}
          onClose={() => setDeleteTargets([])}
          footer={(
            <>
              <AppButton intent="cancel" size="sm" onClick={() => setDeleteTargets([])}>
                <X className="h-3.5 w-3.5" />
                {t('actions.cancel')}
              </AppButton>
              <AppButton intent="destructive" size="sm" onClick={() => void submitDelete()} disabled={isBusy}>
                <Trash2 className="h-3.5 w-3.5" />
                {t('actions.delete')}
              </AppButton>
            </>
          )}
        >
          <DestructiveConfirmBody
            question={deleteTargets.length === 1 ? t('fileHub.deleteFile.question') : t('fileHub.deleteMany.question')}
            entityName={deleteTargets.length === 1 ? deleteTargets[0]?.name : `${deleteTargets.length} items`}
            entityDetail={deleteTargets.length === 1 ? deleteTargets[0]?.path : deleteTargets.map((item) => item.name).join(', ')}
          />
        </ConfirmDialogShell>
      ) : null}
    </div>
  );
};
