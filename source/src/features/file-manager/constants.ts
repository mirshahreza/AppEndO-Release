import type { FileManagerScope } from '../../shared/api/contracts/file-manager/types';
import { FILE_MANAGER_DESTINATION_EXISTS_ERROR } from '../../shared/api/contracts/file-manager/types';
import { formatQueryError } from '../../shared/api/client';

export const FILE_MANAGER_DEFAULT_SCOPE: FileManagerScope = 'workspace';

export const FILE_MANAGER_WORKSPACE_ROOT = 'workspace';

/** Default tree focus in workspace scope — still allows navigating up to parents. */
export const FILE_MANAGER_WORKSPACE_ASSETS_PATH = `${FILE_MANAGER_WORKSPACE_ROOT}/assets`;

export const getFileManagerDefaultTreeViewRootPath = (scope: FileManagerScope): string | null => (
  scope === 'workspace' ? FILE_MANAGER_WORKSPACE_ASSETS_PATH : null
);

export const formatFileManagerBytes = (sizeBytes: number | null): string => {
  if (sizeBytes === null) {
    return '—';
  }

  if (sizeBytes < 1024) {
    return `${sizeBytes} B`;
  }

  if (sizeBytes < 1024 * 1024) {
    return `${(sizeBytes / 1024).toFixed(1)} KB`;
  }

  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
};

export const getFileManagerScopeRootPath = (scope: FileManagerScope): string => (
  scope === 'workspace' ? FILE_MANAGER_WORKSPACE_ROOT : ''
);

export const getFileManagerParentPath = (path: string): string | null => {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const index = normalized.lastIndexOf('/');
  if (index <= 0) {
    return null;
  }
  return normalized.slice(0, index);
};

export const getFileManagerEntryName = (path: string): string => {
  const normalized = path.replace(/\\/g, '/').replace(/\/+$/, '');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(index + 1) : normalized;
};

export const joinFileManagerPath = (parentPath: string, entryName: string): string => {
  const parent = parentPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const name = entryName.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!parent) {
    return name;
  }
  return `${parent}/${name}`;
};

export const isFileManagerDestinationExistsError = (error: unknown): boolean => {
  const status = (error as Error & { status?: number }).status;
  if (status === 409) {
    return true;
  }

  const message = formatQueryError(error, '');
  return message === FILE_MANAGER_DESTINATION_EXISTS_ERROR
    || message.includes('already exists in the destination folder');
};

export const openFileManagerMoveConflict = (
  sourcePath: string,
  destinationParentPath: string,
): FileManagerMoveConflictState => ({
  sourcePath,
  destinationParentPath,
  entryName: getFileManagerEntryName(sourcePath),
});

export type FileManagerMoveConflictState = {
  sourcePath: string;
  destinationParentPath: string;
  entryName: string;
};

export const isFileManagerZipEntry = (entry: { kind: string; extension?: string | null; name?: string }): boolean => {
  if (entry.kind !== 'file') {
    return false;
  }

  if (entry.extension === '.zip') {
    return true;
  }

  return typeof entry.name === 'string' && entry.name.toLowerCase().endsWith('.zip');
};

export const FILE_MANAGER_DRAG_MIME = 'application/x-appendo-file-manager-path';

export const FILE_MANAGER_ZIP_INTERNAL_DRAG_MIME = 'application/x-appendo-file-manager-zip-entry';

export const isFileManagerDescendantPath = (ancestorPath: string, candidatePath: string): boolean => {
  const ancestor = ancestorPath.replace(/\\/g, '/').replace(/\/+$/, '');
  const candidate = candidatePath.replace(/\\/g, '/').replace(/\/+$/, '');
  if (!ancestor) {
    return false;
  }
  if (candidate === ancestor) {
    return true;
  }
  return candidate.startsWith(`${ancestor}/`);
};

export const remapFileManagerPathPrefix = (
  value: string,
  oldPrefix: string,
  newPrefix: string,
): string => {
  if (value === oldPrefix) {
    return newPrefix;
  }
  if (value.startsWith(`${oldPrefix}/`)) {
    return `${newPrefix}${value.slice(oldPrefix.length)}`;
  }
  return value;
};
