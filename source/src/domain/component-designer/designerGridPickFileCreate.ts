import { toast } from '@heroui/react';
import { resizeImageFile } from '../../shared/lib/fileFieldUtils';
import { readNestedContextValue, resolveDataSourceOperationEndpoint } from './bindingResourceModel';
import { resolveMutationRuntimeUrl } from './bindingDynamicActionsEngine';
import { designerFetch, parseApiErrorMessage } from './bindingMutationRuntime';
import {
  hidePickFileUploadProgress,
  showPickFileUploadProgress,
  updatePickFileUploadProgress,
} from './designerGridPickFileUploadProgress';
import type { DesignerGridRowActionBehavior } from './designerGridActionColumns';
import type { DesignerBindingDefinitions } from './types';

export const PICK_FILE_CREATE_COMPLETE_EVENT = 'appendo:pick-file-create-complete';

const pickLocalFiles = (accept?: string, multiple?: boolean): Promise<File[]> => (
  new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    if (accept?.trim()) {
      input.accept = accept.trim();
    }
    input.multiple = multiple === true;
    input.style.display = 'none';
    const cleanup = () => {
      input.remove();
    };
    input.addEventListener('change', () => {
      const files = input.files ? Array.from(input.files) : [];
      cleanup();
      resolve(files);
    }, { once: true });
    input.addEventListener('cancel', () => {
      cleanup();
      resolve([]);
    }, { once: true });
    document.body.appendChild(input);
    input.click();
  })
);

const readFileAsDataUrl = (file: File): Promise<string> => (
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Failed to read file.'));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file.'));
    };
    reader.readAsDataURL(file);
  })
);

const guessMimeFromName = (fileName: string): string => {
  const dot = fileName.lastIndexOf('.');
  const ext = dot > 0 ? fileName.slice(dot + 1).toLowerCase() : '';
  const map: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    avif: 'image/avif',
    pdf: 'application/pdf',
    zip: 'application/zip',
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    txt: 'text/plain',
    json: 'application/json',
    csv: 'text/csv',
  };
  return map[ext] ?? 'application/octet-stream';
};

const isImageUpload = (file: File): boolean => {
  const type = (file.type || '').toLowerCase();
  if (type.startsWith('image/')) return true;
  return guessMimeFromName(file.name).startsWith('image/');
};

/** Height-100 JPEG xs thumbnail — matches server `buildImageThumbnail` / list preview. */
const buildUploadFileXs = async (file: File): Promise<string | null> => {
  if (!isImageUpload(file)) return null;
  try {
    const thumb = await resizeImageFile(file, { maxWidth: 10000, maxHeight: 100, quality: 72 });
    return await readFileAsDataUrl(thumb);
  } catch {
    return null;
  }
};

/** SHA-256 hex digest — required by DATA_API create (server does not derive fields). */
const sha256HexOfFile = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};

export const buildPickFileMutationPayload = async (file: File): Promise<{
  file: string;
  fileXs?: string;
  fileName: string;
  fileMime: string;
  fileSize: number;
  sha256: string;
  updatedAt: string;
}> => {
  const [fileDataUrl, sha256, fileXs] = await Promise.all([
    readFileAsDataUrl(file),
    sha256HexOfFile(file),
    buildUploadFileXs(file),
  ]);
  return {
    file: fileDataUrl,
    ...(fileXs ? { fileXs } : {}),
    fileName: file.name,
    fileMime: (file.type || guessMimeFromName(file.name)).trim() || 'application/octet-stream',
    fileSize: file.size,
    sha256,
    updatedAt: new Date().toISOString(),
  };
};

const coerceContentId = (raw: unknown): number | null => {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.trunc(raw);
  }
  if (typeof raw === 'bigint') {
    return Number(raw);
  }
  if (typeof raw === 'string' && raw.trim()) {
    const parsed = Number(raw.trim());
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return null;
};

export type PickFileCreateContext = {
  bindingDefinitions?: DesignerBindingDefinitions;
  designerStore?: Record<string, unknown>;
  onRefresh?: () => void | Promise<void>;
};

export const uploadPickFileCreateFiles = async (
  files: File[],
  behavior: DesignerGridRowActionBehavior,
  context: PickFileCreateContext,
): Promise<void> => {
  if (behavior.kind !== 'pick-file-create') {
    return;
  }

  const dataSourceRef = behavior.dataSourceRef?.trim();
  const dataSource = dataSourceRef
    ? context.bindingDefinitions?.dataSources?.[dataSourceRef]
    : undefined;
  if (!dataSourceRef || !dataSource) {
    toast('Upload data source is not configured.', { variant: 'danger' });
    return;
  }

  const contentIdPath = behavior.contentIdStorePath?.trim() || 'routeParams.id';
  const contentId = coerceContentId(
    readNestedContextValue(context.designerStore ?? {}, contentIdPath),
  );
  if (contentId === null) {
    toast('Save the content first, then upload assets.', { variant: 'danger' });
    return;
  }

  let selectedFiles = files;
  if (behavior.imageOnly) {
    selectedFiles = files.filter((file) => isImageUpload(file));
    if (selectedFiles.length < files.length) {
      toast('Non-image files were skipped. Use the Files section for other file types.', { variant: 'warning' });
    }
  } else if (behavior.nonImageOnly) {
    selectedFiles = files.filter((file) => !isImageUpload(file));
    if (selectedFiles.length < files.length) {
      toast('Image files were skipped. Use the Images section for images.', { variant: 'warning' });
    }
  }
  if (selectedFiles.length === 0) {
    return;
  }

  const endpoint = resolveDataSourceOperationEndpoint(dataSource, behavior.mutationOperation ?? 'create');
  const url = resolveMutationRuntimeUrl(endpoint, undefined);
  if (!url) {
    toast('Upload endpoint is not configured.', { variant: 'danger' });
    return;
  }

  let uploaded = 0;
  const failures: string[] = [];
  // INTEGER column — must stay within int32 (Date.now() ms overflows). Seconds + batch index.
  let sortOrder = Math.floor(Date.now() / 1000);

  showPickFileUploadProgress(selectedFiles.length);

  try {
    for (let index = 0; index < selectedFiles.length; index += 1) {
      const file = selectedFiles[index];
      updatePickFileUploadProgress({
        completed: index,
        currentFileName: file.name,
        phase: 'preparing',
        withinFileRatio: 0.05,
      });

      try {
        const payload = await buildPickFileMutationPayload(file);
        updatePickFileUploadProgress({
          phase: 'uploading',
          withinFileRatio: 0.35,
        });

        const response = await designerFetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contentId,
            ...payload,
            sortOrder,
            createdAt: payload.updatedAt,
            ...(behavior.mutationBody ?? {}),
          }),
        });
        sortOrder += 1;
        if (!response.ok) {
          const message = await parseApiErrorMessage(response);
          failures.push(`${file.name}: ${message}`);
          updatePickFileUploadProgress({
            completed: index + 1,
            withinFileRatio: 0,
          });
          continue;
        }
        uploaded += 1;
        updatePickFileUploadProgress({
          completed: index + 1,
          withinFileRatio: 0,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Upload failed.';
        failures.push(`${file.name}: ${message}`);
        updatePickFileUploadProgress({
          completed: index + 1,
          withinFileRatio: 0,
        });
      }
    }
  } finally {
    hidePickFileUploadProgress();
  }

  if (uploaded > 0 && behavior.refreshList !== false) {
    await context.onRefresh?.();
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(PICK_FILE_CREATE_COMPLETE_EVENT, {
        detail: { dataSourceRef, contentId },
      }));
    }
  }

  if (failures.length === 0) {
    toast(
      uploaded === 1 ? 'Asset uploaded.' : `${uploaded} assets uploaded.`,
      { variant: 'success' },
    );
    return;
  }

  if (uploaded === 0) {
    toast(failures[0] ?? 'Upload failed.', { variant: 'danger' });
    return;
  }

  toast(
    `${uploaded} uploaded; ${failures.length} failed. ${failures[0]}`,
    { variant: 'danger' },
  );
};

/** Parse `pickFileCreate` / `pickFileCreateConfig` button props into a behavior. */
export const parsePickFileCreateBehaviorFromProps = (
  props: Record<string, unknown>,
): DesignerGridRowActionBehavior | null => {
  const enabled = props.pickFileCreate === true || props.pickFileCreate === 'true';
  if (!enabled) {
    return null;
  }

  let config: Record<string, unknown> = {};
  const raw = props.pickFileCreateConfig;
  if (typeof raw === 'string' && raw.trim()) {
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        config = parsed as Record<string, unknown>;
      }
    } catch {
      config = {};
    }
  } else if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    config = raw as Record<string, unknown>;
  }

  const dataSourceRef = typeof config.dataSourceRef === 'string'
    ? config.dataSourceRef.trim()
    : typeof props.pickFileCreateDataSourceRef === 'string'
      ? props.pickFileCreateDataSourceRef.trim()
      : '';
  if (!dataSourceRef) {
    return null;
  }

  const contentIdStorePath = typeof config.contentIdStorePath === 'string'
    ? config.contentIdStorePath.trim()
    : 'routeParams.id';
  const accept = typeof config.accept === 'string' ? config.accept.trim() : '';
  const multiple = config.multiple !== false;
  const imageOnly = config.imageOnly === true;
  const nonImageOnly = config.nonImageOnly === true;

  return {
    kind: 'pick-file-create',
    dataSourceRef,
    mutationOperation: 'create',
    contentIdStorePath: contentIdStorePath || 'routeParams.id',
    ...(accept ? { accept } : {}),
    multiple,
    refreshList: config.refreshList !== false,
    ...(imageOnly ? { imageOnly: true } : {}),
    ...(nonImageOnly ? { nonImageOnly: true } : {}),
  };
};

/**
 * Opens the native file picker (optional multi-select), POSTs a full create
 * body per file to the data-source create endpoint, then refreshes the host grid.
 *
 * CMS assets use engineType DATA_API — the stock create path does **not** run
 * custom `.ts` derivation, so the client must send every required column
 * (`fileSize`, `sha256`, `sortOrder`, `createdAt`, `updatedAt`, …).
 */
export const executePickFileCreateBehavior = async (
  behavior: DesignerGridRowActionBehavior,
  context: PickFileCreateContext,
): Promise<void> => {
  if (behavior.kind !== 'pick-file-create') {
    return;
  }

  const dataSourceRef = behavior.dataSourceRef?.trim();
  const dataSource = dataSourceRef
    ? context.bindingDefinitions?.dataSources?.[dataSourceRef]
    : undefined;
  if (!dataSourceRef || !dataSource) {
    toast('Upload data source is not configured.', { variant: 'danger' });
    return;
  }

  const contentIdPath = behavior.contentIdStorePath?.trim() || 'routeParams.id';
  const contentId = coerceContentId(
    readNestedContextValue(context.designerStore ?? {}, contentIdPath),
  );
  if (contentId === null) {
    toast('Save the content first, then upload assets.', { variant: 'danger' });
    return;
  }

  const files = await pickLocalFiles(behavior.accept, behavior.multiple !== false);
  if (files.length === 0) {
    return;
  }

  await uploadPickFileCreateFiles(files, behavior, context);
};
