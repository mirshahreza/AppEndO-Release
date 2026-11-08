export type FileManagerScope = 'workspace' | 'project';

export type FileManagerEntryKind = 'file' | 'directory';

export type FileManagerEntry = {
  name: string;
  path: string;
  kind: FileManagerEntryKind;
  sizeBytes: number | null;
  modifiedAt: string | null;
  extension: string | null;
};

export type FileManagerConfig = {
  defaultScope: FileManagerScope;
  workspaceDir: string;
  workspaceExists: boolean;
  projectRootLabel: string;
};

export type FileManagerContentKind = 'text' | 'image' | 'binary' | 'directory' | 'empty';

export type FileManagerContent = {
  path: string;
  kind: FileManagerContentKind;
  mimeType: string | null;
  sizeBytes: number;
  encoding: 'utf8' | 'base64' | null;
  content: string | null;
  language: string | null;
  modifiedAt: string | null;
  truncated: boolean;
};

export type FileManagerCreateEntryRequest = {
  parentPath: string;
  name: string;
  scope: FileManagerScope;
};

export type FileManagerRenameRequest = {
  path: string;
  newName: string;
  scope: FileManagerScope;
};

export type FileManagerMoveRequest = {
  path: string;
  destinationParentPath: string;
  scope: FileManagerScope;
  overwrite?: boolean;
};

export const FILE_MANAGER_DESTINATION_EXISTS_ERROR = 'An entry with that name already exists in the destination folder.';

export type FileManagerWriteRequest = {
  path: string;
  content: string;
  scope: FileManagerScope;
};

export type FileManagerDeleteRequest = {
  path: string;
  scope: FileManagerScope;
  recursive?: boolean;
};

export type FileManagerEmptyFolderRequest = {
  path: string;
  scope: FileManagerScope;
};

export type FileManagerEmptyFolderResult = {
  path: string;
  removedEntries: number;
};

export type FileManagerExtractRequest = {
  path: string;
  scope: FileManagerScope;
};

export type FileManagerExtractResult = {
  path: string;
  targetPath: string;
  extractedEntries: number;
};

export type FileManagerUploadSkipped = {
  name: string;
  reason: string;
};

export type FileManagerUploadResult = {
  parentPath: string;
  uploaded: FileManagerEntry[];
  skipped: FileManagerUploadSkipped[];
};

export type FileManagerListQuery = {
  path?: string;
  scope?: FileManagerScope;
};

export type FileManagerZipEntryKind = 'file' | 'directory';

export type FileManagerZipEntry = {
  name: string;
  path: string;
  kind: FileManagerZipEntryKind;
  sizeBytes: number;
  compressedSizeBytes: number;
  children?: FileManagerZipEntry[];
};

export type FileManagerZipEntriesResult = {
  archivePath: string;
  archiveSizeBytes: number;
  entryCount: number;
  entries: FileManagerZipEntry[];
};

export type FileManagerZipArchiveRequest = {
  archivePath: string;
  scope: FileManagerScope;
};

export type FileManagerZipEntryRequest = FileManagerZipArchiveRequest & {
  entryPath: string;
};

export type FileManagerZipContent = {
  archivePath: string;
  entryPath: string;
  kind: FileManagerContentKind;
  mimeType: string | null;
  sizeBytes: number;
  encoding: 'utf8' | 'base64' | null;
  content: string | null;
  language: string | null;
  truncated: boolean;
};

export type FileManagerZipWriteRequest = FileManagerZipEntryRequest & {
  content: string;
};

export type FileManagerZipMoveRequest = FileManagerZipEntryRequest & {
  destinationParentPath: string;
  overwrite?: boolean;
};

export type FileManagerZipRenameRequest = FileManagerZipEntryRequest & {
  newName: string;
};

export type FileManagerZipCreateEntryRequest = FileManagerZipArchiveRequest & {
  parentPath: string;
  name: string;
};

export type FileManagerZipImportRequest = FileManagerZipArchiveRequest & {
  destinationParentPath: string;
  sourcePath: string;
  overwrite?: boolean;
};

export type FileManagerZipUploadSkipped = {
  name: string;
  reason: string;
};

export type FileManagerZipUploadResult = {
  archivePath: string;
  destinationParentPath: string;
  uploaded: FileManagerZipEntry[];
  skipped: FileManagerZipUploadSkipped[];
};
