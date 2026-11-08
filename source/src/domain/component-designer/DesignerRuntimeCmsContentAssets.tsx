import * as React from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  type DragEndEvent,
  useDndContext,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Download,
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileImage,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Pencil,
  Trash2,
} from 'lucide-react';
import { showAppFeedbackToast } from '../../shared/ui/appFeedbackToast';
import { cn } from '../../lib/utils';
import { resolveFileIconKind, type FileIconKind } from '../../shared/lib/fileFieldUtils';
import { ImageEditorSaveDialog } from '../../shared/ui/image-editor/ImageEditorSaveDialog';
import { resolveMutationRuntimeUrl } from './bindingDynamicActionsEngine';
import {
  designerFetch,
  parseApiErrorMessage,
  resolveBindingUrl,
} from './bindingMutationRuntime';
import {
  readNestedContextValue,
  resolveDataSourceOperationEndpoint,
} from './bindingResourceModel';
import {
  PICK_FILE_CREATE_COMPLETE_EVENT,
  buildPickFileMutationPayload,
  executePickFileCreateBehavior,
  uploadPickFileCreateFiles,
  type PickFileCreateContext,
} from './designerGridPickFileCreate';
import type { RuntimeRenderOptions } from './runtimeRenderer';
import {
  readBoolean,
  readString,
  resolveRuntimeNodeClassName,
} from './runtimeShared';
import type { DesignerNode } from './types';

type AssetRow = {
  id: string;
  fileName: string;
  fileMime: string;
  filePreviewUrl: string;
  sortOrder: number;
};

const FILE_ICON: Record<FileIconKind, React.ComponentType<{ className?: string }>> = {
  image: FileImage,
  pdf: FileText,
  archive: FileArchive,
  audio: FileAudio,
  video: FileVideo,
  spreadsheet: FileSpreadsheet,
  document: FileText,
  code: FileCode,
  generic: File,
};

const FILE_ICON_CLASS: Record<FileIconKind, string> = {
  image: 'text-sky-600',
  pdf: 'text-rose-600',
  archive: 'text-amber-600',
  audio: 'text-violet-600',
  video: 'text-fuchsia-600',
  spreadsheet: 'text-emerald-600',
  document: 'text-indigo-600',
  code: 'text-slate-600',
  generic: 'text-slate-500',
};

const SECTION_TITLE_CLASS = 'border-s-2 border-cyan-500 ps-1.5 text-[11px] font-bold uppercase tracking-wider leading-none text-cyan-700';
const EMPTY_DESIGNER_STORE: Record<string, unknown> = {};

const coerceContentId = (raw: unknown): string | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return String(Math.trunc(raw));
  }
  if (typeof raw === 'bigint') {
    return String(raw);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw.trim();
  }
  return null;
};

const readRowScalar = (row: Record<string, unknown>, key: string): string => {
  const value = row[key];
  if (typeof value === 'string') {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === 'bigint') {
    return String(value);
  }
  return '';
};

const readAssetString = (row: Record<string, unknown>, key: string): string => (
  readRowScalar(row, key)
);

const readAssetSortOrder = (row: Record<string, unknown>): number => {
  const value = row.sortOrder;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
  }
  return 0;
};

const isImageAsset = (row: Pick<AssetRow, 'fileMime' | 'fileName'>): boolean => (
  resolveFileIconKind(row.fileName, row.fileMime) === 'image'
);

const mapAssetRows = (rows: Record<string, unknown>[]): AssetRow[] => (
  rows
    .map((row) => {
      const id = readAssetString(row, 'id');
      if (!id) return null;
      return {
        id,
        fileName: readAssetString(row, 'fileName') || 'file',
        fileMime: readAssetString(row, 'fileMime'),
        filePreviewUrl: readAssetString(row, 'filePreviewUrl'),
        sortOrder: readAssetSortOrder(row),
      };
    })
    .filter((row): row is AssetRow => row !== null)
    .sort((left, right) => left.sortOrder - right.sortOrder || left.fileName.localeCompare(right.fileName))
);

const buildChangedSortOrderUpdates = (
  currentImages: AssetRow[],
  plannedImages: AssetRow[],
): Array<{ id: string; sortOrder: number }> => {
  const updates: Array<{ id: string; sortOrder: number }> = [];
  plannedImages.forEach((row) => {
    const currentSortOrder = currentImages.find((image) => image.id === row.id)?.sortOrder;
    if (currentSortOrder !== row.sortOrder) {
      updates.push({ id: row.id, sortOrder: row.sortOrder });
    }
  });
  return updates;
};

const assignExistingSortOrderSlots = (
  currentImages: AssetRow[],
  nextImages: AssetRow[],
): AssetRow[] => {
  const hasStrictlyIncreasingSlots = currentImages.every(
    (row, index) => index === 0 || row.sortOrder > currentImages[index - 1].sortOrder,
  );
  return nextImages.map((row, index) => ({
    ...row,
    sortOrder: hasStrictlyIncreasingSlots
      ? (currentImages[index]?.sortOrder ?? ((index + 1) * 10))
      : ((index + 1) * 10),
  }));
};

const mergeReorderedAssets = (
  current: AssetRow[],
  plannedAssets: AssetRow[],
  belongsToGroup: (row: AssetRow) => boolean,
): AssetRow[] => {
  const remaining = current.filter((row) => !belongsToGroup(row));
  return [...plannedAssets, ...remaining].sort(
    (left, right) => left.sortOrder - right.sortOrder || left.fileName.localeCompare(right.fileName),
  );
};

const truncateAssetFileName = (fileName: string): string => (
  fileName.length > 32 ? `${fileName.slice(0, 32)}...` : fileName
);

const binaryValueToDataUrl = (value: unknown, mime: string): string | null => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:')) return trimmed;
    const encoded = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
    return encoded ? `data:${mime};base64,${encoded}` : null;
  }

  const bufferData = value && typeof value === 'object' && 'data' in value
    ? (value as { data?: unknown }).data
    : value;
  if (!Array.isArray(bufferData) || bufferData.length === 0) {
    return null;
  }
  const bytes = Uint8Array.from(bufferData, (entry) => Number(entry));
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return `data:${mime};base64,${btoa(binary)}`;
};

const fetchClientAssetPreview = async (
  assetId: string,
  source: 'preview' | 'original' = 'preview',
): Promise<string | null> => {
  const response = await designerFetch(`/api/cms/assets/${encodeURIComponent(assetId)}`);
  if (!response.ok) return null;
  const json = await response.json() as { data?: Record<string, unknown> };
  const data = json.data;
  if (!data) return null;

  const fileMime = typeof data.fileMime === 'string' ? data.fileMime : '';
  if (!fileMime.toLowerCase().startsWith('image/')) return null;

  const original = binaryValueToDataUrl(data.file, fileMime);
  return source === 'original'
    ? original
    : (binaryValueToDataUrl(data.fileXs, 'image/jpeg') ?? original);
};

const fetchClientAssetOriginal = async (
  assetId: string,
): Promise<{ dataUrl: string; fileName: string } | null> => {
  const response = await designerFetch(`/api/cms/assets/${encodeURIComponent(assetId)}`);
  if (!response.ok) return null;
  const json = await response.json() as { data?: Record<string, unknown> };
  const data = json.data;
  if (!data) return null;
  const fileMime = typeof data.fileMime === 'string' && data.fileMime.trim()
    ? data.fileMime
    : 'application/octet-stream';
  const dataUrl = binaryValueToDataUrl(data.file, fileMime);
  if (!dataUrl) return null;
  return {
    dataUrl,
    fileName: typeof data.fileName === 'string' && data.fileName.trim()
      ? data.fileName
      : 'download',
  };
};

const CmsAssetImageTile: React.FC<{
  asset: AssetRow;
  disabled: boolean;
  onEdit: () => void;
  onDownload: () => void;
  onDelete: () => void;
}> = ({ asset, disabled, onEdit, onDownload, onDelete }) => {
  const [previewUrl, setPreviewUrl] = React.useState(asset.filePreviewUrl);
  const previewFailedRef = React.useRef(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: asset.id, disabled });
  const { active } = useDndContext();

  React.useEffect(() => {
    previewFailedRef.current = false;
    setPreviewUrl(asset.filePreviewUrl);
  }, [asset.filePreviewUrl, asset.id]);

  React.useEffect(() => {
    if (asset.filePreviewUrl || previewFailedRef.current) {
      return undefined;
    }
    let cancelled = false;
    void fetchClientAssetPreview(asset.id)
      .then((url) => {
        if (cancelled) {
          return;
        }
        if (url) {
          setPreviewUrl(url);
          return;
        }
        previewFailedRef.current = true;
      })
      .catch(() => {
        previewFailedRef.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, [asset.filePreviewUrl, asset.id]);

  const handlePreviewError = React.useCallback(() => {
    previewFailedRef.current = true;
    setPreviewUrl('');
  }, []);

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'group relative shrink-0 touch-none select-none cursor-grab outline-none active:cursor-grabbing',
        isDragging && 'z-10 opacity-40',
      )}
      title={asset.fileName}
      data-cms-asset-id={asset.id}
      {...attributes}
      {...listeners}
    >
      {previewUrl ? (
        <img
          src={previewUrl}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          className="pointer-events-none h-[100px] w-[100px] rounded-md object-cover select-none"
          onError={handlePreviewError}
        />
      ) : (
        <div className="h-[100px] w-[100px] rounded-md bg-slate-100 motion-safe:animate-pulse" aria-label={asset.fileName} />
      )}
      {!active ? (
        <div
          data-no-dnd="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center gap-1 rounded-md bg-black/45 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
        >
          <button
            type="button"
            className="rounded p-1 text-white hover:bg-white/20 disabled:opacity-40"
            disabled={disabled}
            aria-label={`Edit ${asset.fileName}`}
            onClick={onEdit}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Pencil className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="rounded p-1 text-white hover:bg-white/20 disabled:opacity-40"
            disabled={disabled}
            aria-label={`Download ${asset.fileName}`}
            onClick={onDownload}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="rounded p-1 text-white hover:bg-white/20 disabled:opacity-40"
            disabled={disabled}
            aria-label={`Delete ${asset.fileName}`}
            onClick={onDelete}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
};

const CmsAssetFileTile: React.FC<{
  asset: AssetRow;
  disabled: boolean;
  onDownload: () => void;
  onDelete: () => void;
}> = ({ asset, disabled, onDownload, onDelete }) => {
  const kind = resolveFileIconKind(asset.fileName, asset.fileMime);
  const Icon = FILE_ICON[kind];
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: asset.id, disabled });
  const { active } = useDndContext();
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={cn(
        'group relative flex h-9 w-[280px] shrink-0 touch-none select-none items-center justify-start gap-2 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-start cursor-grab outline-none hover:border-slate-300 active:cursor-grabbing',
        isDragging && 'z-10 opacity-40',
      )}
      title={asset.fileName}
      data-cms-file-id={asset.id}
      {...attributes}
      {...listeners}
    >
      <Icon className={cn('h-4 w-4 shrink-0', FILE_ICON_CLASS[kind])} aria-hidden="true" />
      <span className="min-w-0 flex-1 whitespace-nowrap text-xs font-medium leading-4 text-slate-800">
        {truncateAssetFileName(asset.fileName)}
      </span>
      {!active ? (
        <div
          data-no-dnd="true"
          className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-md bg-black/45 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100"
        >
          <button
            type="button"
            className="rounded p-1 text-white hover:bg-white/20 disabled:opacity-40"
            disabled={disabled}
            aria-label={`Download ${asset.fileName}`}
            onClick={onDownload}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Download className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            className="rounded p-1 text-white hover:bg-white/20 disabled:opacity-40"
            disabled={disabled}
            aria-label={`Delete ${asset.fileName}`}
            onClick={onDelete}
            onPointerDown={(event) => event.stopPropagation()}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}
    </div>
  );
};

const CmsAssetsSection: React.FC<{
  title: string;
  children: React.ReactNode;
}> = ({ title, children }) => (
  <section className="flex flex-col space-y-2">
    <h3 className={SECTION_TITLE_CLASS}>{title}</h3>
    <div className="flex flex-col gap-2">
      {children}
    </div>
  </section>
);

/** CMS Content Editor assets — split Images (reorderable gallery) and Files (full-name rows). */
export const DesignerRuntimeCmsContentAssets: React.FC<{
  node: DesignerNode;
  options: RuntimeRenderOptions;
}> = ({ node, options }) => {
  const dataSourceRef = readString(node.props.cmsContentAssetsDataSourceRef, 'cmsContentAssets');
  const contentIdPath = readString(node.props.cmsContentAssetsContentIdPath, 'routeParams.id');
  const assetsMode = readString(node.props.cmsContentAssetsMode, 'all');
  const showImages = assetsMode === 'all' || assetsMode === 'images';
  const showFiles = assetsMode === 'all' || assetsMode === 'files';
  const store = options.designerStore ?? EMPTY_DESIGNER_STORE;
  const contentId = coerceContentId(readNestedContextValue(store, contentIdPath));
  const dataSource = dataSourceRef
    ? options.bindingDefinitions?.dataSources?.[dataSourceRef]
    : undefined;
  const isInteractive = options.mode === 'runtime' && Boolean(options.previewEvents);

  const [rows, setRows] = React.useState<AssetRow[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [syncing, setSyncing] = React.useState(false);
  const [editingImage, setEditingImage] = React.useState<{
    asset: AssetRow;
    source: string;
  } | null>(null);
  const [isFileDropActive, setIsFileDropActive] = React.useState(false);
  const fileDropDepthRef = React.useRef(0);
  const isFileDropActiveRef = React.useRef(false);
  const activeContentIdRef = React.useRef(contentId);
  const storeRef = React.useRef(store);
  const bindingDefinitionsRef = React.useRef(options.bindingDefinitions);
  activeContentIdRef.current = contentId;
  storeRef.current = store;
  bindingDefinitionsRef.current = options.bindingDefinitions;
  const imageSortSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const clearFileDropState = React.useCallback(() => {
    fileDropDepthRef.current = 0;
    isFileDropActiveRef.current = false;
    setIsFileDropActive(false);
  }, []);

  const markFileDropActive = React.useCallback(() => {
    if (isFileDropActiveRef.current) {
      return;
    }
    isFileDropActiveRef.current = true;
    setIsFileDropActive(true);
  }, []);

  const pickFileBehavior = React.useMemo(() => ({
    kind: 'pick-file-create' as const,
    dataSourceRef,
    mutationOperation: 'create' as const,
    contentIdStorePath: contentIdPath,
    multiple: true,
    refreshList: false,
  }), [contentIdPath, dataSourceRef]);

  const loadAssets = React.useCallback(async () => {
    const dataSourceDef = dataSourceRef
      ? bindingDefinitionsRef.current?.dataSources?.[dataSourceRef]
      : undefined;
    if (!dataSourceDef || !contentId) {
      return;
    }
    const requestedContentId = contentId;
    setLoading(true);
    try {
      const listEndpoint = resolveDataSourceOperationEndpoint(dataSourceDef, 'list');
      const response = await designerFetch(resolveBindingUrl(listEndpoint, storeRef.current, {
        'filter[contentId][eq]': contentIdPath,
        sort: 'static:sortOrder',
        pageSize: 'static:100',
      }));
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      const json = await response.json() as { data?: unknown };
      const list = Array.isArray(json.data) ? json.data as Record<string, unknown>[] : [];
      if (activeContentIdRef.current === requestedContentId) {
        setRows(mapAssetRows(list));
      }
    } catch (error) {
      if (activeContentIdRef.current === requestedContentId) {
        const message = error instanceof Error ? error.message : 'Could not load assets.';
        showAppFeedbackToast(message, { variant: 'danger' });
      }
    } finally {
      if (activeContentIdRef.current === requestedContentId) {
        setLoading(false);
      }
    }
  }, [contentId, contentIdPath, dataSourceRef]);

  React.useLayoutEffect(() => {
    setRows([]);
    setEditingImage(null);
    clearFileDropState();
  }, [clearFileDropState, contentId]);

  React.useEffect(() => {
    if (isInteractive) {
      void loadAssets();
    }
  }, [isInteractive, loadAssets]);

  React.useEffect(() => {
    if (!isInteractive) {
      return undefined;
    }
    const handleHeaderUploadComplete = (event: Event) => {
      const detail = (event as CustomEvent<{
        dataSourceRef?: string;
        contentId?: number;
      }>).detail;
      if (
        detail?.dataSourceRef === dataSourceRef
        && String(detail.contentId) === contentId
      ) {
        void loadAssets();
      }
    };
    window.addEventListener(PICK_FILE_CREATE_COMPLETE_EVENT, handleHeaderUploadComplete);
    return () => {
      window.removeEventListener(PICK_FILE_CREATE_COMPLETE_EVENT, handleHeaderUploadComplete);
    };
  }, [contentId, dataSourceRef, isInteractive, loadAssets]);

  const refreshContext = React.useCallback(async () => {
    await loadAssets();
  }, [loadAssets]);

  const pickFileContext: PickFileCreateContext = React.useMemo(() => ({
    bindingDefinitions: options.bindingDefinitions,
    designerStore: store,
    onRefresh: refreshContext,
  }), [options.bindingDefinitions, refreshContext, store]);

  const disabled = !isInteractive || !contentId || loading || syncing
    || readBoolean(node.props.isDisabled)
    || readBoolean(node.props.disabled);

  const uploadAssets = async (files?: File[]) => {
    if (!dataSourceRef || syncing || disabled) {
      return;
    }
    setSyncing(true);
    try {
      if (files && files.length > 0) {
        await uploadPickFileCreateFiles(files, pickFileBehavior, pickFileContext);
      } else {
        await executePickFileCreateBehavior(pickFileBehavior, pickFileContext);
      }
      await loadAssets();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      showAppFeedbackToast(message, { variant: 'danger' });
    } finally {
      setSyncing(false);
    }
  };

  const handleExternalFileDragEnter = (event: React.DragEvent<HTMLElement>) => {
    if (disabled || !Array.from(event.dataTransfer.types).includes('Files')) {
      return;
    }
    event.preventDefault();
    fileDropDepthRef.current += 1;
    markFileDropActive();
  };

  const handleExternalFileDragOver = (event: React.DragEvent<HTMLElement>) => {
    if (disabled || !Array.from(event.dataTransfer.types).includes('Files')) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    markFileDropActive();
  };

  const handleExternalFileDragLeave = (event: React.DragEvent<HTMLElement>) => {
    event.preventDefault();
    fileDropDepthRef.current = Math.max(0, fileDropDepthRef.current - 1);
    if (fileDropDepthRef.current === 0) {
      clearFileDropState();
    }
  };

  const handleExternalFileDrop = (event: React.DragEvent<HTMLElement>) => {
    if (disabled) {
      return;
    }
    const droppedFiles = Array.from(event.dataTransfer.files);
    if (droppedFiles.length === 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    clearFileDropState();
    void uploadAssets(droppedFiles);
  };

  React.useEffect(() => {
    if (!isInteractive) {
      return undefined;
    }
    const resetDragUi = () => {
      clearFileDropState();
    };
    window.addEventListener('dragend', resetDragUi);
    return () => {
      window.removeEventListener('dragend', resetDragUi);
    };
  }, [clearFileDropState, isInteractive]);

  const deleteAsset = async (assetId: string) => {
    if (!dataSource || syncing) {
      return;
    }
    setSyncing(true);
    try {
      const deleteEndpoint = resolveDataSourceOperationEndpoint(dataSource, 'delete');
      const deleteUrl = resolveMutationRuntimeUrl(deleteEndpoint, assetId);
      const response = await designerFetch(deleteUrl, { method: 'DELETE' });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      setRows((current) => current.filter((row) => row.id !== assetId));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not delete asset.';
      showAppFeedbackToast(message, { variant: 'danger' });
      await loadAssets();
    } finally {
      setSyncing(false);
    }
  };

  const downloadAsset = async (asset: AssetRow) => {
    if (disabled) {
      return;
    }
    setSyncing(true);
    try {
      const original = await fetchClientAssetOriginal(asset.id);
      if (!original) {
        throw new Error('Could not load the original file.');
      }
      const anchor = document.createElement('a');
      anchor.href = original.dataUrl;
      anchor.download = original.fileName || asset.fileName;
      anchor.style.display = 'none';
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not download the asset.';
      showAppFeedbackToast(message, { variant: 'danger' });
    } finally {
      setSyncing(false);
    }
  };

  const openImageEditor = async (asset: AssetRow) => {
    if (disabled) {
      return;
    }
    setSyncing(true);
    try {
      const source = await fetchClientAssetPreview(asset.id, 'original');
      if (!source) {
        throw new Error('Could not load the original image.');
      }
      setEditingImage({ asset, source });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not open the image editor.';
      showAppFeedbackToast(message, { variant: 'danger' });
    } finally {
      setSyncing(false);
    }
  };

  const saveEditedImage = async (file: File) => {
    if (!dataSource || !editingImage) {
      return;
    }
    setSyncing(true);
    try {
      const payload = await buildPickFileMutationPayload(file);
      const updateEndpoint = resolveDataSourceOperationEndpoint(dataSource, 'update');
      const url = resolveMutationRuntimeUrl(updateEndpoint, editingImage.asset.id);
      const response = await designerFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        throw new Error(await parseApiErrorMessage(response));
      }
      await loadAssets();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save the edited image.';
      showAppFeedbackToast(message, { variant: 'danger' });
      throw error;
    } finally {
      setSyncing(false);
    }
  };

  const persistAssetOrder = async (
    nextAssets: AssetRow[],
    belongsToGroup: (row: AssetRow) => boolean,
    errorMessage: string,
  ) => {
    if (!dataSource) {
      return;
    }
    const currentAssets = rows.filter(belongsToGroup);
    const orderChanged = nextAssets.some((row, index) => currentAssets[index]?.id !== row.id);
    if (!orderChanged) {
      return;
    }

    const plannedAssets = assignExistingSortOrderSlots(currentAssets, nextAssets);
    const updates = buildChangedSortOrderUpdates(currentAssets, plannedAssets);
    const optimisticRows = mergeReorderedAssets(rows, plannedAssets, belongsToGroup);
    setRows(optimisticRows);

    if (updates.length === 0) {
      return;
    }

    setSyncing(true);
    try {
      const updateEndpoint = resolveDataSourceOperationEndpoint(dataSource, 'update');
      for (const update of updates) {
        const url = resolveMutationRuntimeUrl(updateEndpoint, update.id);
        const response = await designerFetch(url, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sortOrder: update.sortOrder }),
        });
        if (!response.ok) {
          throw new Error(await parseApiErrorMessage(response));
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : errorMessage;
      showAppFeedbackToast(message, { variant: 'danger' });
      await loadAssets();
    } finally {
      setSyncing(false);
    }
  };

  const handleImageDragEnd = (event: DragEndEvent) => {
    if (disabled || !event.over || event.active.id === event.over.id) {
      return;
    }
    const images = rows.filter(isImageAsset);
    const sourceIndex = images.findIndex((image) => image.id === String(event.active.id));
    const targetIndex = images.findIndex((image) => image.id === String(event.over?.id));
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }
    void persistAssetOrder(
      arrayMove(images, sourceIndex, targetIndex),
      isImageAsset,
      'Could not reorder images.',
    );
  };

  const handleFileDragEnd = (event: DragEndEvent) => {
    if (disabled || !event.over || event.active.id === event.over.id) {
      return;
    }
    const fileRows = rows.filter((row) => !isImageAsset(row));
    const sourceIndex = fileRows.findIndex((file) => file.id === String(event.active.id));
    const targetIndex = fileRows.findIndex((file) => file.id === String(event.over?.id));
    if (sourceIndex < 0 || targetIndex < 0) {
      return;
    }
    void persistAssetOrder(
      arrayMove(fileRows, sourceIndex, targetIndex),
      (row) => !isImageAsset(row),
      'Could not reorder files.',
    );
  };

  const shellClassName = resolveRuntimeNodeClassName(node, 'w-full min-w-0');

  const images = rows.filter(isImageAsset);
  const files = rows.filter((row) => !isImageAsset(row));

  if (!isInteractive) {
    return (
      <div className={shellClassName} data-designer-component="form.cms-content-assets">
        <div className="flex flex-col gap-4">
          {showImages ? (
            <CmsAssetsSection title="Images">
              <div className="flex flex-wrap gap-[5px]">
                <div className="h-[100px] w-[100px] rounded-md bg-slate-100" />
                <div className="h-[100px] w-[100px] rounded-md bg-slate-100" />
              </div>
            </CmsAssetsSection>
          ) : null}
          {showFiles ? (
            <CmsAssetsSection title="Files">
              <div className="flex flex-wrap gap-[5px]">
                <div className="flex h-9 w-[280px] items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700">
                  <FileText className="h-4 w-4 shrink-0 text-rose-500" aria-hidden="true" />
                  <span className="min-w-0 flex-1 whitespace-nowrap">sample-document.pdf</span>
                </div>
              </div>
            </CmsAssetsSection>
          ) : null}
        </div>
      </div>
    );
  }

  if (!contentId) {
    return (
      <p className="ps-[4px] text-xs text-slate-500">Save the content first, then upload images and files.</p>
    );
  }

  return (
    <div
      className={cn(
        shellClassName,
        isFileDropActive && 'rounded-md ring-2 ring-inset ring-cyan-300 bg-cyan-50/40',
      )}
      data-designer-component="form.cms-content-assets"
      onDragEnter={handleExternalFileDragEnter}
      onDragOver={handleExternalFileDragOver}
      onDragLeave={handleExternalFileDragLeave}
      onDrop={handleExternalFileDrop}
    >
      {isFileDropActive ? (
        <p className="mb-2 text-center text-xs font-medium text-cyan-700">
          Drop files here to upload
        </p>
      ) : null}
      <div className="flex flex-col gap-4">
        {showImages ? (
        <CmsAssetsSection title="Images">
          {loading && images.length === 0 ? null : images.length === 0 ? (
            <p className="ps-[4px] text-xs text-slate-500">No images yet.</p>
          ) : (
            <DndContext
              sensors={imageSortSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleImageDragEnd}
            >
              <SortableContext items={images.map((image) => image.id)} strategy={rectSortingStrategy}>
                <div className="flex flex-wrap items-start gap-[5px]">
                  {images.map((asset) => (
                    <CmsAssetImageTile
                      key={asset.id}
                      asset={asset}
                      disabled={disabled}
                      onEdit={() => { void openImageEditor(asset); }}
                      onDownload={() => { void downloadAsset(asset); }}
                      onDelete={() => { void deleteAsset(asset.id); }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CmsAssetsSection>
        ) : null}

        {showFiles ? (
        <CmsAssetsSection title="Files">
          {loading && files.length === 0 ? null : files.length === 0 ? (
            <p className="ps-[4px] text-xs text-slate-500">No files yet.</p>
          ) : (
            <DndContext
              sensors={imageSortSensors}
              collisionDetection={closestCenter}
              onDragEnd={handleFileDragEnd}
            >
              <SortableContext items={files.map((file) => file.id)} strategy={rectSortingStrategy}>
                <div className="flex flex-wrap items-start gap-[5px]">
                  {files.map((asset) => (
                    <CmsAssetFileTile
                      key={asset.id}
                      asset={asset}
                      disabled={disabled}
                      onDownload={() => { void downloadAsset(asset); }}
                      onDelete={() => { void deleteAsset(asset.id); }}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </CmsAssetsSection>
        ) : null}
      </div>
      {editingImage ? (
        <ImageEditorSaveDialog
          open
          title={`Edit ${editingImage.asset.fileName}`}
          initialSrc={editingImage.source}
          initialFileName={editingImage.asset.fileName}
          onClose={() => setEditingImage(null)}
          onSave={saveEditedImage}
        />
      ) : null}
    </div>
  );
};
