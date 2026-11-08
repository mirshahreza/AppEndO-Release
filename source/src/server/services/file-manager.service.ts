import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import path from 'node:path';
import AdmZip from 'adm-zip';
import type {
  FileManagerConfig,
  FileManagerContent,
  FileManagerEntry,
  FileManagerExtractResult,
  FileManagerScope,
  FileManagerEmptyFolderResult,
  FileManagerUploadResult,
  FileManagerUploadSkipped,
  FileManagerZipContent,
  FileManagerZipCreateEntryRequest,
  FileManagerZipEntriesResult,
  FileManagerZipEntry,
  FileManagerZipImportRequest,
  FileManagerZipUploadResult,
  FileManagerZipUploadSkipped,
} from '../../shared/api/contracts/file-manager/types';
import { FILE_MANAGER_DESTINATION_EXISTS_ERROR } from '../../shared/api/contracts/file-manager/types';
import {
  ensureFileManagerWorkspaceDirectory,
  FILE_MANAGER_BINARY_MAX_BYTES,
  FILE_MANAGER_TEXT_MAX_BYTES,
  FILE_MANAGER_UPLOAD_MAX_BYTES,
  FILE_MANAGER_UPLOAD_MAX_FILES,
  FILE_MANAGER_WORKSPACE_DIR,
  FILE_MANAGER_ZIP_MAX_BYTES,
  getFileManagerExtension,
  getFileManagerRepoRoot,
  isFileManagerHiddenEntryName,
  isFileManagerImagePath,
  isFileManagerPathInsideDirectory,
  isFileManagerTextPath,
  isFileManagerZipPath,
  isLikelyUtf8TextBuffer,
  normalizeFileManagerRelativePath,
  resolveFileManagerParentPath,
  resolveFileManagerPath,
  resolveMimeType,
  resolveMonacoLanguage,
  sanitizeFileManagerEntryName,
  validateZipEntryExtractPath,
} from '../domain/file-manager/pathScope';
import {
  buildZipEntryTree,
  collectZipEntriesWithPrefix,
  deleteZipEntryTree,
  findZipEntry,
  joinZipInternalPath,
  moveZipEntryTree,
  normalizeZipInternalEntryPath,
  renameZipEntryInArchive,
  validateZipInternalEntryPath,
  zipEntryExists,
} from '../domain/file-manager/zipArchive';

type ServiceResult<T> = { ok: true; body: T } | { ok: false; status: number; error: string };

type ServiceFailure = Extract<ServiceResult<unknown>, { ok: false }>;

const propagateServiceFailure = <T>(source: ServiceFailure): ServiceResult<T> => ({
  ok: false,
  status: source.status,
  error: source.error,
});

const toIsoString = (value: Date | null): string | null => (
  value ? value.toISOString() : null
);

const pathExists = (absolutePath: string): Promise<boolean> => (
  fsp.access(absolutePath).then(() => true, () => false)
);

const createMoveStagingEntryName = (): string => (
  `.appendo-move-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
);

const relocateFileManagerEntry = async (
  sourceAbsolutePath: string,
  targetAbsolutePath: string,
  isDirectory: boolean,
): Promise<void> => {
  try {
    await fsp.rename(sourceAbsolutePath, targetAbsolutePath);
    return;
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error
      ? String((error as NodeJS.ErrnoException).code)
      : '';
    if (isDirectory || !['EXDEV', 'EPERM', 'EACCES', 'EBUSY'].includes(code)) {
      throw error;
    }
  }

  await fsp.copyFile(sourceAbsolutePath, targetAbsolutePath);
  if (isDirectory) {
    await fsp.rm(sourceAbsolutePath, { recursive: true, force: true });
  } else {
    await fsp.unlink(sourceAbsolutePath);
  }
};

const mapEntry = async (
  repoRoot: string,
  absolutePath: string,
  dirent: fs.Dirent,
): Promise<FileManagerEntry | null> => {
  const name = dirent.name;
  if (name === '.' || name === '..') {
    return null;
  }

  const childAbsolutePath = path.join(absolutePath, name);
  const relativePath = path.relative(repoRoot, childAbsolutePath).replace(/\\/g, '/');
  let stat: fs.Stats;

  try {
    stat = await fsp.stat(childAbsolutePath);
  } catch {
    return null;
  }

  const kind = stat.isDirectory() ? 'directory' : 'file';

  return {
    name,
    path: relativePath,
    kind,
    sizeBytes: kind === 'file' ? stat.size : null,
    modifiedAt: toIsoString(stat.mtime),
    extension: kind === 'file' ? getFileManagerExtension(name) : null,
  };
};

export class FileManagerService {
  async getConfig(): Promise<ServiceResult<FileManagerConfig>> {
    ensureFileManagerWorkspaceDirectory();
    const repoRoot = getFileManagerRepoRoot();
    const workspaceAbsolutePath = path.join(repoRoot, FILE_MANAGER_WORKSPACE_DIR);

    return {
      ok: true,
      body: {
        defaultScope: 'workspace',
        workspaceDir: FILE_MANAGER_WORKSPACE_DIR,
        workspaceExists: await pathExists(workspaceAbsolutePath),
        projectRootLabel: path.basename(repoRoot) || repoRoot,
      },
    };
  }

  async listChildren(relativePath: string, scope: FileManagerScope): Promise<ServiceResult<FileManagerEntry[]>> {
    ensureFileManagerWorkspaceDirectory();
    const resolved = resolveFileManagerPath(relativePath, scope);
    if (resolved.ok === false) {
      return { ok: false, status: 400, error: resolved.error };
    }

    let stat: fs.Stats;
    try {
      stat = await fsp.stat(resolved.absolutePath);
    } catch {
      return { ok: false, status: 404, error: 'Path not found.' };
    }

    if (!stat.isDirectory()) {
      return { ok: false, status: 400, error: 'Path is not a directory.' };
    }

    const repoRoot = getFileManagerRepoRoot();
    const dirents = await fsp.readdir(resolved.absolutePath, { withFileTypes: true });
    const mappedEntries = await Promise.all(
      dirents.map((entry) => mapEntry(repoRoot, resolved.absolutePath, entry)),
    );
    const entries = mappedEntries
      .filter((entry): entry is FileManagerEntry => entry !== null)
      .filter((entry) => !isFileManagerHiddenEntryName(entry.name))
      .filter((entry) => {
        const childResolved = resolveFileManagerPath(entry.path, scope);
        return childResolved.ok;
      })
      .sort((left, right) => {
        if (left.kind !== right.kind) {
          return left.kind === 'directory' ? -1 : 1;
        }
        return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
      });

    return { ok: true, body: entries };
  }

  async readContent(relativePath: string, scope: FileManagerScope): Promise<ServiceResult<FileManagerContent>> {
    const resolved = resolveFileManagerPath(relativePath, scope);
    if (resolved.ok === false) {
      return { ok: false, status: 400, error: resolved.error };
    }

    let stat: fs.Stats;
    try {
      stat = await fsp.stat(resolved.absolutePath);
    } catch {
      return { ok: false, status: 404, error: 'Path not found.' };
    }

    if (stat.isDirectory()) {
      return {
        ok: true,
        body: {
          path: resolved.relativePath,
          kind: 'directory',
          mimeType: null,
          sizeBytes: 0,
          encoding: null,
          content: null,
          language: null,
          modifiedAt: toIsoString(stat.mtime),
          truncated: false,
        },
      };
    }

    const modifiedAt = toIsoString(stat.mtime);
    const mimeType = resolveMimeType(resolved.relativePath);

    if (stat.size === 0) {
      return {
        ok: true,
        body: {
          path: resolved.relativePath,
          kind: 'empty',
          mimeType,
          sizeBytes: 0,
          encoding: 'utf8',
          content: '',
          language: resolveMonacoLanguage(resolved.relativePath),
          modifiedAt,
          truncated: false,
        },
      };
    }

    if (isFileManagerImagePath(resolved.relativePath)) {
      if (stat.size > FILE_MANAGER_BINARY_MAX_BYTES) {
        return {
          ok: false,
          status: 413,
          error: `Image exceeds ${FILE_MANAGER_BINARY_MAX_BYTES} bytes preview limit.`,
        };
      }

      const buffer = await fsp.readFile(resolved.absolutePath);
      return {
        ok: true,
        body: {
          path: resolved.relativePath,
          kind: 'image',
          mimeType,
          sizeBytes: stat.size,
          encoding: 'base64',
          content: buffer.toString('base64'),
          language: null,
          modifiedAt,
          truncated: false,
        },
      };
    }

    if (isFileManagerTextPath(resolved.relativePath)) {
      if (stat.size > FILE_MANAGER_TEXT_MAX_BYTES) {
        return {
          ok: false,
          status: 413,
          error: `Text file exceeds ${FILE_MANAGER_TEXT_MAX_BYTES} bytes preview limit.`,
        };
      }

      const content = await fsp.readFile(resolved.absolutePath, 'utf8');
      return {
        ok: true,
        body: {
          path: resolved.relativePath,
          kind: 'text',
          mimeType: mimeType ?? 'text/plain',
          sizeBytes: stat.size,
          encoding: 'utf8',
          content,
          language: resolveMonacoLanguage(resolved.relativePath),
          modifiedAt,
          truncated: false,
        },
      };
    }

    if (stat.size <= FILE_MANAGER_TEXT_MAX_BYTES) {
      const buffer = await fsp.readFile(resolved.absolutePath);
      if (isLikelyUtf8TextBuffer(buffer)) {
        const content = buffer.toString('utf8');
        return {
          ok: true,
          body: {
            path: resolved.relativePath,
            kind: 'text',
            mimeType: mimeType ?? 'text/plain',
            sizeBytes: stat.size,
            encoding: 'utf8',
            content,
            language: resolveMonacoLanguage(resolved.relativePath),
            modifiedAt,
            truncated: false,
          },
        };
      }
    }

    return {
      ok: true,
      body: {
        path: resolved.relativePath,
        kind: 'binary',
        mimeType,
        sizeBytes: stat.size,
        encoding: null,
        content: null,
        language: null,
        modifiedAt,
        truncated: false,
      },
    };
  }

  async readRawFile(relativePath: string, scope: FileManagerScope): Promise<ServiceResult<{ buffer: Buffer; mimeType: string | null }>> {
    const resolved = resolveFileManagerPath(relativePath, scope);
    if (resolved.ok === false) {
      return { ok: false, status: 400, error: resolved.error };
    }

    let stat: fs.Stats;
    try {
      stat = await fsp.stat(resolved.absolutePath);
    } catch {
      return { ok: false, status: 404, error: 'Path not found.' };
    }

    if (!stat.isFile()) {
      return { ok: false, status: 400, error: 'Path is not a file.' };
    }

    if (stat.size > FILE_MANAGER_BINARY_MAX_BYTES) {
      return { ok: false, status: 413, error: 'File exceeds preview size limit.' };
    }

    return {
      ok: true,
      body: {
        buffer: await fsp.readFile(resolved.absolutePath),
        mimeType: resolveMimeType(resolved.relativePath),
      },
    };
  }

  async writeContent(relativePath: string, content: string, scope: FileManagerScope): Promise<ServiceResult<{ path: string }>> {
    const resolved = resolveFileManagerPath(relativePath, scope);
    if (resolved.ok === false) {
      return { ok: false, status: 400, error: resolved.error };
    }

    let stat: fs.Stats;
    try {
      stat = await fsp.stat(resolved.absolutePath);
    } catch {
      return { ok: false, status: 404, error: 'Path not found.' };
    }

    if (!stat.isFile()) {
      return { ok: false, status: 400, error: 'Path is not a file.' };
    }

    const existingBuffer = await fsp.readFile(resolved.absolutePath);
    const canEdit = isFileManagerTextPath(resolved.relativePath)
      || (stat.size <= FILE_MANAGER_TEXT_MAX_BYTES && isLikelyUtf8TextBuffer(existingBuffer));
    if (!canEdit) {
      return { ok: false, status: 400, error: 'Only text files can be edited in File Manager.' };
    }

    if (Buffer.byteLength(content, 'utf8') > FILE_MANAGER_TEXT_MAX_BYTES) {
      return { ok: false, status: 413, error: 'File content exceeds size limit.' };
    }

    await fsp.writeFile(resolved.absolutePath, content, 'utf8');
    return { ok: true, body: { path: resolved.relativePath } };
  }

  async replaceImageFile(
    relativePath: string,
    buffer: Buffer,
    scope: FileManagerScope,
  ): Promise<ServiceResult<FileManagerEntry>> {
    const resolved = resolveFileManagerPath(relativePath, scope);
    if (resolved.ok === false) {
      return { ok: false, status: 400, error: resolved.error };
    }

    if (!isFileManagerImagePath(resolved.relativePath)) {
      return { ok: false, status: 400, error: 'Only image files can be replaced from the image editor.' };
    }

    let stat: fs.Stats;
    try {
      stat = await fsp.stat(resolved.absolutePath);
    } catch {
      return { ok: false, status: 404, error: 'Path not found.' };
    }

    if (!stat.isFile()) {
      return { ok: false, status: 400, error: 'Path is not a file.' };
    }

    if (buffer.length > FILE_MANAGER_UPLOAD_MAX_BYTES) {
      return {
        ok: false,
        status: 413,
        error: `Image exceeds ${FILE_MANAGER_UPLOAD_MAX_BYTES} bytes.`,
      };
    }

    await fsp.writeFile(resolved.absolutePath, buffer);
    const updatedStat = await fsp.stat(resolved.absolutePath);

    return {
      ok: true,
      body: {
        name: path.basename(resolved.relativePath),
        path: resolved.relativePath,
        kind: 'file',
        sizeBytes: updatedStat.size,
        modifiedAt: toIsoString(updatedStat.mtime),
        extension: getFileManagerExtension(resolved.relativePath),
      },
    };
  }

  async createFolder(parentPath: string, name: string, scope: FileManagerScope): Promise<ServiceResult<FileManagerEntry>> {
    ensureFileManagerWorkspaceDirectory();
    const sanitizedName = sanitizeFileManagerEntryName(name);
    if (!sanitizedName) {
      return { ok: false, status: 400, error: 'Invalid folder name.' };
    }

    const parentResolved = resolveFileManagerPath(parentPath, scope);
    if (parentResolved.ok === false) {
      return { ok: false, status: 400, error: parentResolved.error };
    }

    let parentStat: fs.Stats;
    try {
      parentStat = await fsp.stat(parentResolved.absolutePath);
    } catch {
      return { ok: false, status: 404, error: 'Parent path not found.' };
    }

    if (!parentStat.isDirectory()) {
      return { ok: false, status: 400, error: 'Parent path is not a directory.' };
    }

    const repoRoot = getFileManagerRepoRoot();
    const targetAbsolutePath = path.join(parentResolved.absolutePath, sanitizedName);
    const targetRelativePath = path.relative(repoRoot, targetAbsolutePath).replace(/\\/g, '/');
    const targetResolved = resolveFileManagerPath(targetRelativePath, scope);
    if (targetResolved.ok === false) {
      return { ok: false, status: 400, error: targetResolved.error };
    }

    if (await pathExists(targetResolved.absolutePath)) {
      return { ok: false, status: 409, error: 'An entry with that name already exists.' };
    }

    await fsp.mkdir(targetResolved.absolutePath, { recursive: false });
    const stat = await fsp.stat(targetResolved.absolutePath);

    return {
      ok: true,
      body: {
        name: sanitizedName,
        path: targetResolved.relativePath,
        kind: 'directory',
        sizeBytes: null,
        modifiedAt: toIsoString(stat.mtime),
        extension: null,
      },
    };
  }

  async createFile(parentPath: string, name: string, scope: FileManagerScope): Promise<ServiceResult<FileManagerEntry>> {
    ensureFileManagerWorkspaceDirectory();
    const sanitizedName = sanitizeFileManagerEntryName(name);
    if (!sanitizedName) {
      return { ok: false, status: 400, error: 'Invalid file name.' };
    }

    const parentResolved = resolveFileManagerPath(parentPath, scope);
    if (parentResolved.ok === false) {
      return { ok: false, status: 400, error: parentResolved.error };
    }

    let parentStat: fs.Stats;
    try {
      parentStat = await fsp.stat(parentResolved.absolutePath);
    } catch {
      return { ok: false, status: 404, error: 'Parent path not found.' };
    }

    if (!parentStat.isDirectory()) {
      return { ok: false, status: 400, error: 'Parent path is not a directory.' };
    }

    const repoRoot = getFileManagerRepoRoot();
    const targetAbsolutePath = path.join(parentResolved.absolutePath, sanitizedName);
    const targetRelativePath = path.relative(repoRoot, targetAbsolutePath).replace(/\\/g, '/');
    const targetResolved = resolveFileManagerPath(targetRelativePath, scope);
    if (targetResolved.ok === false) {
      return { ok: false, status: 400, error: targetResolved.error };
    }

    if (await pathExists(targetResolved.absolutePath)) {
      return { ok: false, status: 409, error: 'An entry with that name already exists.' };
    }

    await fsp.writeFile(targetResolved.absolutePath, '', 'utf8');
    const stat = await fsp.stat(targetResolved.absolutePath);

    return {
      ok: true,
      body: {
        name: sanitizedName,
        path: targetResolved.relativePath,
        kind: 'file',
        sizeBytes: stat.size,
        modifiedAt: toIsoString(stat.mtime),
        extension: getFileManagerExtension(sanitizedName),
      },
    };
  }

  async renameEntry(relativePath: string, newName: string, scope: FileManagerScope): Promise<ServiceResult<FileManagerEntry>> {
    const sanitizedName = sanitizeFileManagerEntryName(newName);
    if (!sanitizedName) {
      return { ok: false, status: 400, error: 'Invalid entry name.' };
    }

    const resolved = resolveFileManagerPath(relativePath, scope);
    if (resolved.ok === false) {
      return { ok: false, status: 400, error: resolved.error };
    }

    if (!await pathExists(resolved.absolutePath)) {
      return { ok: false, status: 404, error: 'Path not found.' };
    }

    const repoRoot = getFileManagerRepoRoot();
    const parentRelativePath = normalizeFileManagerRelativePath(path.dirname(resolved.relativePath));
    const parentScopePath = parentRelativePath === '.' ? FILE_MANAGER_WORKSPACE_DIR : parentRelativePath;
    const parentResolved = resolveFileManagerPath(
      scope === 'workspace' && parentRelativePath === '.'
        ? FILE_MANAGER_WORKSPACE_DIR
        : parentScopePath,
      scope,
    );
    if (parentResolved.ok === false) {
      return { ok: false, status: 400, error: parentResolved.error };
    }

    const targetAbsolutePath = path.join(parentResolved.absolutePath, sanitizedName);
    const targetRelativePath = path.relative(repoRoot, targetAbsolutePath).replace(/\\/g, '/');
    const targetResolved = resolveFileManagerPath(targetRelativePath, scope);
    if (targetResolved.ok === false) {
      return { ok: false, status: 400, error: targetResolved.error };
    }

    if (await pathExists(targetResolved.absolutePath)) {
      return { ok: false, status: 409, error: 'An entry with that name already exists.' };
    }

    await fsp.rename(resolved.absolutePath, targetResolved.absolutePath);
    const stat = await fsp.stat(targetResolved.absolutePath);

    return {
      ok: true,
      body: {
        name: sanitizedName,
        path: targetResolved.relativePath,
        kind: stat.isDirectory() ? 'directory' : 'file',
        sizeBytes: stat.isFile() ? stat.size : null,
        modifiedAt: toIsoString(stat.mtime),
        extension: stat.isFile() ? getFileManagerExtension(sanitizedName) : null,
      },
    };
  }

  async moveEntry(
    relativePath: string,
    destinationParentPath: string,
    scope: FileManagerScope,
    overwrite = false,
  ): Promise<ServiceResult<FileManagerEntry>> {
    const sourceResolved = resolveFileManagerPath(relativePath, scope);
    if (sourceResolved.ok === false) {
      return { ok: false, status: 400, error: sourceResolved.error };
    }

    const scopeRootPath = scope === 'workspace' ? FILE_MANAGER_WORKSPACE_DIR : '';
    if (sourceResolved.relativePath === scopeRootPath) {
      return { ok: false, status: 400, error: 'The root folder cannot be moved.' };
    }

    if (!await pathExists(sourceResolved.absolutePath)) {
      return { ok: false, status: 404, error: 'Path not found.' };
    }

    const destinationResolved = resolveFileManagerPath(destinationParentPath, scope);
    if (destinationResolved.ok === false) {
      return { ok: false, status: 400, error: destinationResolved.error };
    }

    let destinationStat: fs.Stats;
    try {
      destinationStat = await fsp.stat(destinationResolved.absolutePath);
    } catch {
      return { ok: false, status: 404, error: 'Destination folder not found.' };
    }

    if (!destinationStat.isDirectory()) {
      return { ok: false, status: 400, error: 'Destination is not a folder.' };
    }

    const sourceParentPath = resolveFileManagerParentPath(sourceResolved.relativePath, scope);
    if (sourceParentPath === destinationResolved.relativePath) {
      return { ok: false, status: 400, error: 'Entry is already in this folder.' };
    }

    if (sourceResolved.relativePath === destinationResolved.relativePath) {
      return { ok: false, status: 400, error: 'Cannot move a folder into itself.' };
    }

    let sourceStat: fs.Stats;
    try {
      sourceStat = await fsp.stat(sourceResolved.absolutePath);
    } catch {
      return { ok: false, status: 404, error: 'Path not found.' };
    }

    if (
      sourceStat.isDirectory()
      && isFileManagerPathInsideDirectory(sourceResolved.relativePath, destinationResolved.relativePath)
    ) {
      return { ok: false, status: 400, error: 'Cannot move a folder into its own subfolder.' };
    }

    const entryName = path.basename(sourceResolved.relativePath);
    const repoRoot = getFileManagerRepoRoot();
    const targetAbsolutePath = path.join(destinationResolved.absolutePath, entryName);
    const targetRelativePath = path.relative(repoRoot, targetAbsolutePath).replace(/\\/g, '/');
    const targetResolved = resolveFileManagerPath(targetRelativePath, scope);
    if (targetResolved.ok === false) {
      return { ok: false, status: 400, error: targetResolved.error };
    }

    if (await pathExists(targetResolved.absolutePath)) {
      if (!overwrite) {
        return { ok: false, status: 409, error: FILE_MANAGER_DESTINATION_EXISTS_ERROR };
      }

      let existingStat: fs.Stats;
      try {
        existingStat = await fsp.stat(targetResolved.absolutePath);
      } catch {
        return { ok: false, status: 404, error: 'Existing destination entry not found.' };
      }

      if (existingStat.isDirectory() !== sourceStat.isDirectory()) {
        return {
          ok: false,
          status: 400,
          error: 'Cannot replace a file with a folder or a folder with a file.',
        };
      }

      const sourceInsideTarget = isFileManagerPathInsideDirectory(
        targetResolved.relativePath,
        sourceResolved.relativePath,
      );

      if (sourceInsideTarget) {
        const stagingName = createMoveStagingEntryName();
        const stagingAbsolutePath = path.join(destinationResolved.absolutePath, stagingName);
        await relocateFileManagerEntry(sourceResolved.absolutePath, stagingAbsolutePath, sourceStat.isDirectory());

        if (existingStat.isDirectory()) {
          await fsp.rm(targetResolved.absolutePath, { recursive: true, force: true });
        } else {
          await fsp.unlink(targetResolved.absolutePath);
        }

        await relocateFileManagerEntry(stagingAbsolutePath, targetResolved.absolutePath, sourceStat.isDirectory());
      } else {
        if (existingStat.isDirectory()) {
          await fsp.rm(targetResolved.absolutePath, { recursive: true, force: true });
        } else {
          await fsp.unlink(targetResolved.absolutePath);
        }

        await relocateFileManagerEntry(
          sourceResolved.absolutePath,
          targetResolved.absolutePath,
          sourceStat.isDirectory(),
        );
      }
    } else {
      await relocateFileManagerEntry(
        sourceResolved.absolutePath,
        targetResolved.absolutePath,
        sourceStat.isDirectory(),
      );
    }

    const stat = await fsp.stat(targetResolved.absolutePath);

    return {
      ok: true,
      body: {
        name: entryName,
        path: targetResolved.relativePath,
        kind: stat.isDirectory() ? 'directory' : 'file',
        sizeBytes: stat.isFile() ? stat.size : null,
        modifiedAt: toIsoString(stat.mtime),
        extension: stat.isFile() ? getFileManagerExtension(entryName) : null,
      },
    };
  }

  async deleteEntry(relativePath: string, scope: FileManagerScope, recursive = false): Promise<ServiceResult<{ path: string }>> {
    const resolved = resolveFileManagerPath(relativePath, scope);
    if (resolved.ok === false) {
      return { ok: false, status: 400, error: resolved.error };
    }

    if (resolved.relativePath === FILE_MANAGER_WORKSPACE_DIR) {
      return { ok: false, status: 400, error: 'The workspace root folder cannot be deleted.' };
    }

    if (!await pathExists(resolved.absolutePath)) {
      return { ok: false, status: 404, error: 'Path not found.' };
    }

    const stat = await fsp.stat(resolved.absolutePath);
    if (stat.isDirectory()) {
      await fsp.rm(resolved.absolutePath, { recursive, force: true });
    } else {
      await fsp.unlink(resolved.absolutePath);
    }

    return { ok: true, body: { path: resolved.relativePath } };
  }

  async emptyFolder(relativePath: string, scope: FileManagerScope): Promise<ServiceResult<FileManagerEmptyFolderResult>> {
    const resolved = resolveFileManagerPath(relativePath, scope);
    if (resolved.ok === false) {
      return { ok: false, status: 400, error: resolved.error };
    }

    if (!await pathExists(resolved.absolutePath)) {
      return { ok: false, status: 404, error: 'Path not found.' };
    }

    const stat = await fsp.stat(resolved.absolutePath);
    if (!stat.isDirectory()) {
      return { ok: false, status: 400, error: 'Path is not a directory.' };
    }

    const repoRoot = getFileManagerRepoRoot();
    let removedEntries = 0;

    for (const dirent of await fsp.readdir(resolved.absolutePath, { withFileTypes: true })) {
      const mapped = await mapEntry(repoRoot, resolved.absolutePath, dirent);
      if (!mapped) {
        continue;
      }

      const childResolved = resolveFileManagerPath(mapped.path, scope);
      if (childResolved.ok === false) {
        continue;
      }

      await fsp.rm(childResolved.absolutePath, { recursive: true, force: true });
      removedEntries += 1;
    }

    return { ok: true, body: { path: resolved.relativePath, removedEntries } };
  }

  async uploadFiles(
    parentPath: string,
    files: Array<{ originalName: string; buffer: Buffer }>,
    scope: FileManagerScope,
  ): Promise<ServiceResult<FileManagerUploadResult>> {
    ensureFileManagerWorkspaceDirectory();

    if (!files.length) {
      return { ok: false, status: 400, error: 'No files provided.' };
    }

    if (files.length > FILE_MANAGER_UPLOAD_MAX_FILES) {
      return {
        ok: false,
        status: 400,
        error: `You can upload up to ${FILE_MANAGER_UPLOAD_MAX_FILES} files at once.`,
      };
    }

    const parentResolved = resolveFileManagerPath(parentPath, scope);
    if (parentResolved.ok === false) {
      return { ok: false, status: 400, error: parentResolved.error };
    }

    let parentStat: fs.Stats;
    try {
      parentStat = await fsp.stat(parentResolved.absolutePath);
    } catch {
      return { ok: false, status: 404, error: 'Parent folder not found.' };
    }

    if (!parentStat.isDirectory()) {
      return { ok: false, status: 400, error: 'Upload target is not a folder.' };
    }

    const repoRoot = getFileManagerRepoRoot();
    const uploaded: FileManagerEntry[] = [];
    const skipped: FileManagerUploadSkipped[] = [];

    for (const file of files) {
      const baseName = path.basename(file.originalName.replace(/\\/g, '/'));
      const sanitizedName = sanitizeFileManagerEntryName(baseName);
      if (!sanitizedName) {
        skipped.push({ name: baseName || file.originalName, reason: 'Invalid file name.' });
        continue;
      }

      if (file.buffer.length > FILE_MANAGER_UPLOAD_MAX_BYTES) {
        skipped.push({
          name: sanitizedName,
          reason: `File exceeds ${FILE_MANAGER_UPLOAD_MAX_BYTES} bytes.`,
        });
        continue;
      }

      const targetAbsolutePath = path.join(parentResolved.absolutePath, sanitizedName);
      const targetRelativePath = path.relative(repoRoot, targetAbsolutePath).replace(/\\/g, '/');
      const targetResolved = resolveFileManagerPath(targetRelativePath, scope);
      if (targetResolved.ok === false) {
        skipped.push({ name: sanitizedName, reason: targetResolved.error });
        continue;
      }

      if (await pathExists(targetResolved.absolutePath)) {
        skipped.push({ name: sanitizedName, reason: 'A file with that name already exists.' });
        continue;
      }

      await fsp.writeFile(targetResolved.absolutePath, file.buffer);
      const stat = await fsp.stat(targetResolved.absolutePath);
      uploaded.push({
        name: sanitizedName,
        path: targetResolved.relativePath,
        kind: 'file',
        sizeBytes: stat.size,
        modifiedAt: toIsoString(stat.mtime),
        extension: getFileManagerExtension(sanitizedName),
      });
    }

    if (uploaded.length === 0) {
      const firstReason = skipped[0]?.reason ?? 'No files could be uploaded.';
      return { ok: false, status: 400, error: firstReason };
    }

    return {
      ok: true,
      body: {
        parentPath: parentResolved.relativePath,
        uploaded,
        skipped,
      },
    };
  }

  async extractZipArchive(relativePath: string, scope: FileManagerScope): Promise<ServiceResult<FileManagerExtractResult>> {
    const resolved = resolveFileManagerPath(relativePath, scope);
    if (resolved.ok === false) {
      return { ok: false, status: 400, error: resolved.error };
    }

    if (!isFileManagerZipPath(resolved.relativePath)) {
      return { ok: false, status: 400, error: 'Only .zip archives can be extracted.' };
    }

    let stat: fs.Stats;
    try {
      stat = await fsp.stat(resolved.absolutePath);
    } catch {
      return { ok: false, status: 404, error: 'Zip file not found.' };
    }

    if (!stat.isFile()) {
      return { ok: false, status: 400, error: 'Path is not a file.' };
    }

    if (stat.size > FILE_MANAGER_ZIP_MAX_BYTES) {
      return { ok: false, status: 413, error: `Zip file exceeds ${FILE_MANAGER_ZIP_MAX_BYTES} bytes extract limit.` };
    }

    const repoRoot = getFileManagerRepoRoot();
    const parentAbsolutePath = path.dirname(resolved.absolutePath);
    const folderName = path.basename(resolved.relativePath, '.zip');
    const sanitizedFolderName = sanitizeFileManagerEntryName(folderName);
    if (!sanitizedFolderName) {
      return { ok: false, status: 400, error: 'Invalid extract destination name.' };
    }

    const destinationAbsolutePath = path.join(parentAbsolutePath, sanitizedFolderName);
    const destinationRelativePath = path.relative(repoRoot, destinationAbsolutePath).replace(/\\/g, '/');
    const destinationResolved = resolveFileManagerPath(destinationRelativePath, scope);
    if (destinationResolved.ok === false) {
      return { ok: false, status: 400, error: destinationResolved.error };
    }

    if (await pathExists(destinationResolved.absolutePath)) {
      return { ok: false, status: 409, error: 'An extract destination folder with that name already exists.' };
    }

    let zip: AdmZip;
    try {
      zip = new AdmZip(await fsp.readFile(resolved.absolutePath));
    } catch {
      return { ok: false, status: 400, error: 'Failed to read zip archive.' };
    }

    const entries = zip.getEntries();
    if (entries.length === 0) {
      return { ok: false, status: 400, error: 'Zip archive is empty.' };
    }

    for (const entry of entries) {
      const validation = validateZipEntryExtractPath(
        destinationResolved.absolutePath,
        entry.entryName,
        scope,
      );
      if (validation.ok === false) {
        return { ok: false, status: 400, error: validation.error };
      }
    }

    await fsp.mkdir(destinationResolved.absolutePath, { recursive: true });
    for (const entry of entries) {
      const targetPath = path.join(destinationResolved.absolutePath, entry.entryName);
      if (entry.isDirectory || entry.entryName.endsWith('/')) {
        await fsp.mkdir(targetPath, { recursive: true });
        continue;
      }
      await fsp.mkdir(path.dirname(targetPath), { recursive: true });
      await fsp.writeFile(targetPath, entry.getData());
    }

    return {
      ok: true,
      body: {
        path: resolved.relativePath,
        targetPath: destinationResolved.relativePath,
        extractedEntries: entries.length,
      },
    };
  }

  private async openZipArchive(
    relativePath: string,
    scope: FileManagerScope,
  ): Promise<ServiceResult<{ zip: AdmZip; absolutePath: string; relativePath: string; sizeBytes: number }>> {
    const resolved = resolveFileManagerPath(relativePath, scope);
    if (resolved.ok === false) {
      return { ok: false, status: 400, error: resolved.error };
    }

    if (!isFileManagerZipPath(resolved.relativePath)) {
      return { ok: false, status: 400, error: 'Only .zip archives can be edited.' };
    }

    let stat: fs.Stats;
    try {
      stat = await fsp.stat(resolved.absolutePath);
    } catch {
      return { ok: false, status: 404, error: 'Zip file not found.' };
    }

    if (!stat.isFile()) {
      return { ok: false, status: 400, error: 'Path is not a file.' };
    }

    if (stat.size > FILE_MANAGER_ZIP_MAX_BYTES) {
      return { ok: false, status: 413, error: `Zip file exceeds ${FILE_MANAGER_ZIP_MAX_BYTES} bytes edit limit.` };
    }

    try {
      const zip = new AdmZip(await fsp.readFile(resolved.absolutePath));
      return {
        ok: true,
        body: {
          zip,
          absolutePath: resolved.absolutePath,
          relativePath: resolved.relativePath,
          sizeBytes: stat.size,
        },
      };
    } catch {
      return { ok: false, status: 400, error: 'Failed to read zip archive.' };
    }
  }

  private async persistZipArchive(zip: AdmZip, absolutePath: string): Promise<ServiceResult<{ path: string }>> {
    try {
      await fsp.writeFile(absolutePath, zip.toBuffer());
      return { ok: true, body: { path: absolutePath } };
    } catch {
      return { ok: false, status: 500, error: 'Failed to save zip archive.' };
    }
  }

  private mapZipEntryFromPath(
    zip: AdmZip,
    entryPath: string,
  ): FileManagerZipEntry | null {
    const normalized = normalizeZipInternalEntryPath(entryPath);
    const entry = findZipEntry(zip, normalized);
    if (!entry) {
      return null;
    }

    const isDirectory = entry.isDirectory || entry.entryName.endsWith('/');
    return {
      name: normalized.split('/').pop() ?? normalized,
      path: normalized,
      kind: isDirectory ? 'directory' : 'file',
      sizeBytes: isDirectory ? 0 : entry.header.size,
      compressedSizeBytes: isDirectory ? 0 : entry.header.compressedSize,
    };
  }

  async listZipEntries(relativePath: string, scope: FileManagerScope): Promise<ServiceResult<FileManagerZipEntriesResult>> {
    const opened = await this.openZipArchive(relativePath, scope);
    if (opened.ok === false) {
      return propagateServiceFailure(opened);
    }

    const entries = buildZipEntryTree(opened.body.zip);
    const entryCount = opened.body.zip.getEntries().length;

    return {
      ok: true,
      body: {
        archivePath: opened.body.relativePath,
        archiveSizeBytes: opened.body.sizeBytes,
        entryCount,
        entries,
      },
    };
  }

  async readZipEntryContent(
    archivePath: string,
    entryPath: string,
    scope: FileManagerScope,
  ): Promise<ServiceResult<FileManagerZipContent>> {
    const opened = await this.openZipArchive(archivePath, scope);
    if (opened.ok === false) {
      return propagateServiceFailure(opened);
    }

    const validation = validateZipInternalEntryPath(entryPath);
    if (validation.ok === false) {
      return { ok: false, status: 400, error: validation.error };
    }

    const entry = findZipEntry(opened.body.zip, validation.normalized);
    if (!entry || entry.isDirectory || entry.entryName.endsWith('/')) {
      return { ok: false, status: 404, error: 'Zip entry not found.' };
    }

    const mimeType = resolveMimeType(validation.normalized);
    const sizeBytes = entry.header.size;

    if (sizeBytes === 0) {
      return {
        ok: true,
        body: {
          archivePath: opened.body.relativePath,
          entryPath: validation.normalized,
          kind: 'empty',
          mimeType,
          sizeBytes: 0,
          encoding: 'utf8',
          content: '',
          language: resolveMonacoLanguage(validation.normalized),
          truncated: false,
        },
      };
    }

    const buffer = entry.getData();

    if (isFileManagerImagePath(validation.normalized)) {
      if (sizeBytes > FILE_MANAGER_BINARY_MAX_BYTES) {
        return {
          ok: false,
          status: 413,
          error: `Image exceeds ${FILE_MANAGER_BINARY_MAX_BYTES} bytes preview limit.`,
        };
      }

      return {
        ok: true,
        body: {
          archivePath: opened.body.relativePath,
          entryPath: validation.normalized,
          kind: 'image',
          mimeType,
          sizeBytes,
          encoding: 'base64',
          content: buffer.toString('base64'),
          language: null,
          truncated: false,
        },
      };
    }

    if (isFileManagerTextPath(validation.normalized) || sizeBytes <= FILE_MANAGER_TEXT_MAX_BYTES) {
      if (sizeBytes > FILE_MANAGER_TEXT_MAX_BYTES) {
        return {
          ok: false,
          status: 413,
          error: `Text file exceeds ${FILE_MANAGER_TEXT_MAX_BYTES} bytes preview limit.`,
        };
      }

      if (!isFileManagerTextPath(validation.normalized) && !isLikelyUtf8TextBuffer(buffer)) {
        return {
          ok: true,
          body: {
            archivePath: opened.body.relativePath,
            entryPath: validation.normalized,
            kind: 'binary',
            mimeType,
            sizeBytes,
            encoding: null,
            content: null,
            language: null,
            truncated: false,
          },
        };
      }

      return {
        ok: true,
        body: {
          archivePath: opened.body.relativePath,
          entryPath: validation.normalized,
          kind: 'text',
          mimeType: mimeType ?? 'text/plain',
          sizeBytes,
          encoding: 'utf8',
          content: buffer.toString('utf8'),
          language: resolveMonacoLanguage(validation.normalized),
          truncated: false,
        },
      };
    }

    return {
      ok: true,
      body: {
        archivePath: opened.body.relativePath,
        entryPath: validation.normalized,
        kind: 'binary',
        mimeType,
        sizeBytes,
        encoding: null,
        content: null,
        language: null,
        truncated: false,
      },
    };
  }

  async writeZipEntryContent(
    archivePath: string,
    entryPath: string,
    content: string,
    scope: FileManagerScope,
  ): Promise<ServiceResult<FileManagerZipEntry>> {
    const opened = await this.openZipArchive(archivePath, scope);
    if (opened.ok === false) {
      return propagateServiceFailure(opened);
    }

    const validation = validateZipInternalEntryPath(entryPath);
    if (validation.ok === false) {
      return { ok: false, status: 400, error: validation.error };
    }

    const entry = findZipEntry(opened.body.zip, validation.normalized);
    if (!entry || entry.isDirectory || entry.entryName.endsWith('/')) {
      return { ok: false, status: 404, error: 'Zip entry not found.' };
    }

    if (!isFileManagerTextPath(validation.normalized)) {
      return { ok: false, status: 400, error: 'Only text files can be edited inside a zip archive.' };
    }

    opened.body.zip.updateFile(entry, Buffer.from(content, 'utf8'));
    const saved = await this.persistZipArchive(opened.body.zip, opened.body.absolutePath);
    if (saved.ok === false) {
      return propagateServiceFailure(saved);
    }

    const mapped = this.mapZipEntryFromPath(opened.body.zip, validation.normalized);
    if (!mapped) {
      return { ok: false, status: 500, error: 'Failed to read updated zip entry.' };
    }

    return { ok: true, body: mapped };
  }

  async deleteZipEntry(
    archivePath: string,
    entryPath: string,
    scope: FileManagerScope,
  ): Promise<ServiceResult<{ archivePath: string; entryPath: string; removedEntries: number }>> {
    const opened = await this.openZipArchive(archivePath, scope);
    if (opened.ok === false) {
      return propagateServiceFailure(opened);
    }

    const validation = validateZipInternalEntryPath(entryPath);
    if (validation.ok === false) {
      return { ok: false, status: 400, error: validation.error };
    }

    if (!zipEntryExists(opened.body.zip, validation.normalized)) {
      return { ok: false, status: 404, error: 'Zip entry not found.' };
    }

    const removedEntries = deleteZipEntryTree(opened.body.zip, validation.normalized);
    const saved = await this.persistZipArchive(opened.body.zip, opened.body.absolutePath);
    if (saved.ok === false) {
      return propagateServiceFailure(saved);
    }

    return {
      ok: true,
      body: {
        archivePath: opened.body.relativePath,
        entryPath: validation.normalized,
        removedEntries,
      },
    };
  }

  async moveZipEntry(
    archivePath: string,
    entryPath: string,
    destinationParentPath: string,
    scope: FileManagerScope,
    overwrite = false,
  ): Promise<ServiceResult<FileManagerZipEntry>> {
    const opened = await this.openZipArchive(archivePath, scope);
    if (opened.ok === false) {
      return propagateServiceFailure(opened);
    }

    const sourceValidation = validateZipInternalEntryPath(entryPath);
    if (sourceValidation.ok === false) {
      return { ok: false, status: 400, error: sourceValidation.error };
    }

    const destinationParentValidation = validateZipInternalEntryPath(destinationParentPath);
    if (destinationParentPath.trim() && destinationParentValidation.ok === false) {
      return { ok: false, status: 400, error: destinationParentValidation.error };
    }

    const destinationParent = destinationParentPath.trim()
      ? destinationParentValidation.ok ? destinationParentValidation.normalized : ''
      : '';

    if (destinationParent && !zipEntryExists(opened.body.zip, destinationParent)) {
      return { ok: false, status: 404, error: 'Destination folder not found in zip archive.' };
    }

    const moved = moveZipEntryTree(
      opened.body.zip,
      sourceValidation.normalized,
      destinationParent,
      overwrite,
    );
    if (moved.ok === false) {
      return { ok: false, status: moved.error.includes('already exists') ? 409 : 400, error: moved.error };
    }

    const saved = await this.persistZipArchive(opened.body.zip, opened.body.absolutePath);
    if (saved.ok === false) {
      return propagateServiceFailure(saved);
    }

    const mapped = this.mapZipEntryFromPath(opened.body.zip, moved.movedPath);
    if (!mapped) {
      return { ok: false, status: 500, error: 'Failed to read moved zip entry.' };
    }

    return { ok: true, body: mapped };
  }

  async renameZipEntry(
    archivePath: string,
    entryPath: string,
    newName: string,
    scope: FileManagerScope,
  ): Promise<ServiceResult<FileManagerZipEntry>> {
    const sanitizedName = sanitizeFileManagerEntryName(newName);
    if (!sanitizedName) {
      return { ok: false, status: 400, error: 'Invalid entry name.' };
    }

    const opened = await this.openZipArchive(archivePath, scope);
    if (opened.ok === false) {
      return propagateServiceFailure(opened);
    }

    const validation = validateZipInternalEntryPath(entryPath);
    if (validation.ok === false) {
      return { ok: false, status: 400, error: validation.error };
    }

    const renamed = renameZipEntryInArchive(opened.body.zip, validation.normalized, sanitizedName);
    if (renamed.ok === false) {
      return { ok: false, status: renamed.error.includes('already exists') ? 409 : 400, error: renamed.error };
    }

    const saved = await this.persistZipArchive(opened.body.zip, opened.body.absolutePath);
    if (saved.ok === false) {
      return propagateServiceFailure(saved);
    }

    const mapped = this.mapZipEntryFromPath(opened.body.zip, renamed.renamedPath);
    if (!mapped) {
      return { ok: false, status: 500, error: 'Failed to read renamed zip entry.' };
    }

    return { ok: true, body: mapped };
  }

  async createZipFolder(
    input: FileManagerZipCreateEntryRequest,
  ): Promise<ServiceResult<FileManagerZipEntry>> {
    const opened = await this.openZipArchive(input.archivePath, input.scope);
    if (opened.ok === false) {
      return propagateServiceFailure(opened);
    }

    const sanitizedName = sanitizeFileManagerEntryName(input.name);
    if (!sanitizedName) {
      return { ok: false, status: 400, error: 'Invalid folder name.' };
    }

    const parentValidation = validateZipInternalEntryPath(input.parentPath);
    const parentPath = input.parentPath.trim()
      ? (parentValidation.ok ? parentValidation.normalized : '')
      : '';

    if (parentPath && !zipEntryExists(opened.body.zip, parentPath)) {
      return { ok: false, status: 404, error: 'Parent folder not found in zip archive.' };
    }

    const entryPath = joinZipInternalPath(parentPath, sanitizedName);
    if (zipEntryExists(opened.body.zip, entryPath)) {
      return { ok: false, status: 409, error: FILE_MANAGER_DESTINATION_EXISTS_ERROR };
    }

    opened.body.zip.addFile(`${entryPath}/`, Buffer.alloc(0));
    const saved = await this.persistZipArchive(opened.body.zip, opened.body.absolutePath);
    if (saved.ok === false) {
      return propagateServiceFailure(saved);
    }

    return {
      ok: true,
      body: {
        name: sanitizedName,
        path: entryPath,
        kind: 'directory',
        sizeBytes: 0,
        compressedSizeBytes: 0,
      },
    };
  }

  async createZipFile(
    input: FileManagerZipCreateEntryRequest,
  ): Promise<ServiceResult<FileManagerZipEntry>> {
    const opened = await this.openZipArchive(input.archivePath, input.scope);
    if (opened.ok === false) {
      return propagateServiceFailure(opened);
    }

    const sanitizedName = sanitizeFileManagerEntryName(input.name);
    if (!sanitizedName) {
      return { ok: false, status: 400, error: 'Invalid file name.' };
    }

    const parentValidation = validateZipInternalEntryPath(input.parentPath);
    const parentPath = input.parentPath.trim()
      ? (parentValidation.ok ? parentValidation.normalized : '')
      : '';

    if (parentPath && !zipEntryExists(opened.body.zip, parentPath)) {
      return { ok: false, status: 404, error: 'Parent folder not found in zip archive.' };
    }

    const entryPath = joinZipInternalPath(parentPath, sanitizedName);
    if (zipEntryExists(opened.body.zip, entryPath)) {
      return { ok: false, status: 409, error: FILE_MANAGER_DESTINATION_EXISTS_ERROR };
    }

    opened.body.zip.addFile(entryPath, Buffer.alloc(0));
    const saved = await this.persistZipArchive(opened.body.zip, opened.body.absolutePath);
    if (saved.ok === false) {
      return propagateServiceFailure(saved);
    }

    return {
      ok: true,
      body: {
        name: sanitizedName,
        path: entryPath,
        kind: 'file',
        sizeBytes: 0,
        compressedSizeBytes: 0,
      },
    };
  }

  async importZipEntryFromWorkspace(
    input: FileManagerZipImportRequest,
  ): Promise<ServiceResult<FileManagerZipEntry>> {
    const opened = await this.openZipArchive(input.archivePath, input.scope);
    if (opened.ok === false) {
      return propagateServiceFailure(opened);
    }

    const sourceResolved = resolveFileManagerPath(input.sourcePath, input.scope);
    if (sourceResolved.ok === false) {
      return { ok: false, status: 400, error: sourceResolved.error };
    }

    let sourceStat: fs.Stats;
    try {
      sourceStat = await fsp.stat(sourceResolved.absolutePath);
    } catch {
      return { ok: false, status: 404, error: 'Source file not found.' };
    }

    if (!sourceStat.isFile()) {
      return { ok: false, status: 400, error: 'Only files can be imported into a zip archive.' };
    }

    if (sourceStat.size > FILE_MANAGER_UPLOAD_MAX_BYTES) {
      return {
        ok: false,
        status: 413,
        error: `Source file exceeds ${FILE_MANAGER_UPLOAD_MAX_BYTES} bytes.`,
      };
    }

    const parentValidation = validateZipInternalEntryPath(input.destinationParentPath);
    const parentPath = input.destinationParentPath.trim()
      ? (parentValidation.ok ? parentValidation.normalized : '')
      : '';

    if (parentPath && !zipEntryExists(opened.body.zip, parentPath)) {
      return { ok: false, status: 404, error: 'Destination folder not found in zip archive.' };
    }

    const entryName = sanitizeFileManagerEntryName(path.basename(sourceResolved.relativePath));
    if (!entryName) {
      return { ok: false, status: 400, error: 'Invalid source file name.' };
    }

    const entryPath = joinZipInternalPath(parentPath, entryName);
    if (zipEntryExists(opened.body.zip, entryPath) && !input.overwrite) {
      return { ok: false, status: 409, error: FILE_MANAGER_DESTINATION_EXISTS_ERROR };
    }

    if (zipEntryExists(opened.body.zip, entryPath) && input.overwrite) {
      deleteZipEntryTree(opened.body.zip, entryPath);
    }

    const buffer = await fsp.readFile(sourceResolved.absolutePath);
    opened.body.zip.addFile(entryPath, buffer);
    const saved = await this.persistZipArchive(opened.body.zip, opened.body.absolutePath);
    if (saved.ok === false) {
      return propagateServiceFailure(saved);
    }

    const mapped = this.mapZipEntryFromPath(opened.body.zip, entryPath);
    if (!mapped) {
      return { ok: false, status: 500, error: 'Failed to read imported zip entry.' };
    }

    return { ok: true, body: mapped };
  }

  async uploadZipEntries(
    archivePath: string,
    destinationParentPath: string,
    files: Array<{ originalName: string; buffer: Buffer }>,
    scope: FileManagerScope,
  ): Promise<ServiceResult<FileManagerZipUploadResult>> {
    const opened = await this.openZipArchive(archivePath, scope);
    if (opened.ok === false) {
      return propagateServiceFailure(opened);
    }

    const parentValidation = validateZipInternalEntryPath(destinationParentPath);
    const parentPath = destinationParentPath.trim()
      ? (parentValidation.ok ? parentValidation.normalized : '')
      : '';

    if (parentPath && !zipEntryExists(opened.body.zip, parentPath)) {
      return { ok: false, status: 404, error: 'Destination folder not found in zip archive.' };
    }

    const uploaded: FileManagerZipEntry[] = [];
    const skipped: FileManagerZipUploadSkipped[] = [];

    for (const file of files) {
      const baseName = path.basename(file.originalName.replace(/\\/g, '/'));
      const sanitizedName = sanitizeFileManagerEntryName(baseName);
      if (!sanitizedName) {
        skipped.push({ name: baseName || file.originalName, reason: 'Invalid file name.' });
        continue;
      }

      if (file.buffer.length > FILE_MANAGER_UPLOAD_MAX_BYTES) {
        skipped.push({
          name: sanitizedName,
          reason: `File exceeds ${FILE_MANAGER_UPLOAD_MAX_BYTES} bytes.`,
        });
        continue;
      }

      const entryPath = joinZipInternalPath(parentPath, sanitizedName);
      if (zipEntryExists(opened.body.zip, entryPath)) {
        skipped.push({ name: sanitizedName, reason: 'A file with that name already exists.' });
        continue;
      }

      opened.body.zip.addFile(entryPath, file.buffer);
      uploaded.push({
        name: sanitizedName,
        path: entryPath,
        kind: 'file',
        sizeBytes: file.buffer.length,
        compressedSizeBytes: 0,
      });
    }

    if (uploaded.length === 0) {
      const firstReason = skipped[0]?.reason ?? 'No files could be uploaded.';
      return { ok: false, status: 400, error: firstReason };
    }

    const saved = await this.persistZipArchive(opened.body.zip, opened.body.absolutePath);
    if (saved.ok === false) {
      return propagateServiceFailure(saved);
    }

    for (const entry of uploaded) {
      const mapped = this.mapZipEntryFromPath(opened.body.zip, entry.path);
      if (mapped) {
        entry.compressedSizeBytes = mapped.compressedSizeBytes;
      }
    }

    return {
      ok: true,
      body: {
        archivePath: opened.body.relativePath,
        destinationParentPath: parentPath,
        uploaded,
        skipped,
      },
    };
  }
}
