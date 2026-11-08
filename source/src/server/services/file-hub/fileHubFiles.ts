import { pipeline } from 'node:stream/promises';
import type { Readable, Writable } from 'node:stream';
import type { FileHubRemoteEntry } from '../../../shared/api/contracts/file-hub/types';
import {
  joinRemotePath,
  parentRemotePath,
  sanitizeRemotePath,
} from '../../../shared/api/contracts/file-hub/validation';
import { getFileHubConnection } from './fileHubStore';
import {
  createRemoteReadStream,
  createRemoteWriteStream,
  FileHubSessionError,
  listRemoteEntries,
  mkdirRemote,
  removeRemote,
  renameRemote,
  resolveHomePath,
  statRemoteSize,
  withFileHubSession,
} from './fileHubSession';

export { FileHubSessionError };

function requirePath(raw: unknown, label: string): string {
  const sanitized = sanitizeRemotePath(raw);
  if (!sanitized) {
    throw new FileHubSessionError(`${label} is invalid.`, 400);
  }
  return sanitized;
}

async function resolveWorkingPath(
  userId: number,
  connectionId: string,
  requested: unknown,
): Promise<string> {
  if (typeof requested === 'string' && requested.trim()) {
    return requirePath(requested, 'Remote path');
  }
  const connection = getFileHubConnection(connectionId);
  if (!connection) {
    throw new FileHubSessionError('File Hub connection was not found.', 404);
  }
  if (connection.initialPath) {
    return requirePath(connection.initialPath, 'Initial path');
  }
  return withFileHubSession(userId, connectionId, (session) => resolveHomePath(session));
}

export async function listFileHubPath(
  userId: number,
  connectionId: string,
  remotePath: unknown,
): Promise<{ path: string; items: FileHubRemoteEntry[] }> {
  const path = await resolveWorkingPath(userId, connectionId, remotePath);
  const items = await withFileHubSession(userId, connectionId, (session) => listRemoteEntries(session, path));
  items.sort((left, right) => {
    if (left.type !== right.type) {
      return left.type === 'directory' ? -1 : 1;
    }
    return left.name.localeCompare(right.name, undefined, { sensitivity: 'base' });
  });
  return { path, items };
}

export async function mkdirFileHubPath(userId: number, connectionId: string, remotePath: unknown): Promise<string> {
  const path = requirePath(remotePath, 'Remote path');
  if (path === '/') {
    throw new FileHubSessionError('Cannot create the root directory.', 400);
  }
  await withFileHubSession(userId, connectionId, (session) => mkdirRemote(session, path));
  return path;
}

export async function renameFileHubPath(
  userId: number,
  connectionId: string,
  oldPath: unknown,
  newPath: unknown,
): Promise<{ oldPath: string; newPath: string }> {
  const from = requirePath(oldPath, 'Source path');
  const to = requirePath(newPath, 'Target path');
  if (from === '/' || to === '/') {
    throw new FileHubSessionError('Cannot rename the root directory.', 400);
  }
  if (from === to) {
    return { oldPath: from, newPath: to };
  }
  if (to === from || to.startsWith(`${from}/`)) {
    throw new FileHubSessionError('Cannot move a folder into itself.', 400);
  }
  await withFileHubSession(userId, connectionId, (session) => renameRemote(session, from, to));
  return { oldPath: from, newPath: to };
}

export async function deleteFileHubPath(
  userId: number,
  connectionId: string,
  remotePath: unknown,
  type: 'file' | 'directory',
): Promise<string> {
  const path = requirePath(remotePath, 'Remote path');
  if (path === '/') {
    throw new FileHubSessionError('Cannot delete the root directory.', 400);
  }
  await withFileHubSession(userId, connectionId, (session) => removeRemote(session, path, type));
  return path;
}

export function buildUploadPath(remoteDir: unknown, fileName: string): string {
  const directory = requirePath(remoteDir, 'Remote directory');
  const joined = joinRemotePath(directory, fileName);
  if (!joined) {
    throw new FileHubSessionError('Upload file name is invalid.', 400);
  }
  return joined;
}

export async function pipeUploadToRemote(
  userId: number,
  connectionId: string,
  remotePath: string,
  source: Readable,
): Promise<void> {
  await withFileHubSession(userId, connectionId, async (session) => {
    const dest = createRemoteWriteStream(session, remotePath);
    await pipeline(source, dest);
  });
}

export async function pipeDownloadFromRemote(
  userId: number,
  connectionId: string,
  remotePath: unknown,
  dest: Writable,
  onReady?: (info: { path: string; size: number | null }) => void,
): Promise<{ path: string; size: number | null }> {
  const path = requirePath(remotePath, 'Remote path');
  if (path === '/') {
    throw new FileHubSessionError('Cannot download a directory.', 400);
  }
  let size: number | null = null;
  await withFileHubSession(userId, connectionId, async (session) => {
    size = await statRemoteSize(session, path);
    onReady?.({ path, size });
    const source = createRemoteReadStream(session, path);
    await pipeline(source, dest);
  });
  return { path, size };
}

export { parentRemotePath };
