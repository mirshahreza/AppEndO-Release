import { PassThrough, type Readable, type Writable } from 'node:stream';
import { logger } from '../../../core/logging/Logger';
import type { FileHubConnectionRecord, FileHubRemoteEntry } from '../../../shared/api/contracts/file-hub/types';
import { requireRemoteHubLibrary } from '../remote-hubs/requireRemoteHubLibrary';
import { getFileHubConnectionSecrets } from './fileHubStore';

type BasicFtpModule = typeof import('basic-ftp');
type Ssh2Module = typeof import('ssh2');
type FtpClient = InstanceType<BasicFtpModule['Client']>;
type FileInfo = import('basic-ftp').FileInfo;
type SshClient = InstanceType<Ssh2Module['Client']>;
type SFTPWrapper = import('ssh2').SFTPWrapper;

function loadBasicFtp(): BasicFtpModule {
  return requireRemoteHubLibrary<BasicFtpModule>('basic-ftp');
}

function loadSsh2(): Ssh2Module {
  return requireRemoteHubLibrary<Ssh2Module>('ssh2');
}

const SSH_CONNECT_TIMEOUT_MS = 20_000;
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 30_000;
const MAX_SESSIONS_TOTAL = 40;
const FTP_TRANSFER_TIMEOUT_MS = 30 * 60 * 1000;

export class FileHubSessionError extends Error {
  constructor(
    message: string,
    readonly status: number = 502,
  ) {
    super(message);
    this.name = 'FileHubSessionError';
  }
}

type SftpPooled = {
  kind: 'sftp';
  key: string;
  client: SshClient;
  sftp: SFTPWrapper;
  inUse: number;
  lastUsed: number;
  disposed: boolean;
};

type FtpPooled = {
  kind: 'ftp';
  key: string;
  client: FtpClient;
  chain: Promise<void>;
  inUse: number;
  lastUsed: number;
  disposed: boolean;
};

type PooledSession = SftpPooled | FtpPooled;

const sessions = new Map<string, PooledSession>();
let sweepTimer: NodeJS.Timeout | null = null;

function poolKey(userId: number, connectionId: string): string {
  return `${userId}:${connectionId}`;
}

function ensureSweeper(): void {
  if (sweepTimer) {
    return;
  }
  sweepTimer = setInterval(() => {
    const now = Date.now();
    for (const session of [...sessions.values()]) {
      if (session.inUse === 0 && now - session.lastUsed >= IDLE_TIMEOUT_MS) {
        void disposeSession(session);
      }
    }
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
}

async function disposeSession(session: PooledSession): Promise<void> {
  if (session.disposed) {
    return;
  }
  session.disposed = true;
  sessions.delete(session.key);
  try {
    if (session.kind === 'sftp') {
      session.sftp.end();
      session.client.end();
    } else {
      session.client.close();
    }
  } catch {
    try {
      if (session.kind === 'sftp') {
        session.client.destroy();
      }
    } catch {
      // ignore
    }
  }
}

function evictOldestIdle(): void {
  let oldest: PooledSession | null = null;
  for (const session of sessions.values()) {
    if (session.inUse > 0) {
      continue;
    }
    if (!oldest || session.lastUsed < oldest.lastUsed) {
      oldest = session;
    }
  }
  if (oldest) {
    void disposeSession(oldest);
  }
}

async function connectSftp(record: FileHubConnectionRecord, secrets: { password?: string; privateKey?: string; passphrase?: string }): Promise<{ client: SshClient; sftp: SFTPWrapper }> {
  return new Promise((resolve, reject) => {
    const client = new (loadSsh2().Client)();
    let settled = false;
    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      try {
        client.end();
      } catch {
        try {
          client.destroy();
        } catch {
          // ignore
        }
      }
      reject(error);
    };

    client
      .on('ready', () => {
        client.sftp((error, sftp) => {
          if (error || !sftp) {
            fail(error instanceof Error ? error : new FileHubSessionError('Failed to open SFTP subsystem.'));
            return;
          }
          if (settled) {
            return;
          }
          settled = true;
          resolve({ client, sftp });
        });
      })
      .on('error', (error) => {
        fail(error instanceof Error ? error : new FileHubSessionError('SFTP connection failed.'));
      });

    const connectConfig: Record<string, unknown> = {
      host: record.host,
      port: record.port,
      username: record.username,
      readyTimeout: SSH_CONNECT_TIMEOUT_MS,
      keepaliveInterval: 15_000,
    };
    if (record.authMethod === 'privateKey' && secrets.privateKey) {
      connectConfig.privateKey = secrets.privateKey;
      if (secrets.passphrase) {
        connectConfig.passphrase = secrets.passphrase;
      }
    } else if (secrets.password) {
      connectConfig.password = secrets.password;
    } else {
      fail(new FileHubSessionError('Stored credentials are missing for this connection.', 400));
      return;
    }

    client.connect(connectConfig as Parameters<SshClient['connect']>[0]);
  });
}

async function connectFtp(record: FileHubConnectionRecord, secrets: { password?: string }): Promise<FtpClient> {
  const { Client: FtpClient } = loadBasicFtp();
  const client = new FtpClient(FTP_TRANSFER_TIMEOUT_MS);
  try {
    await client.access({
      host: record.host,
      port: record.port,
      user: record.username,
      password: secrets.password ?? '',
      secure: record.protocol === 'ftps',
    });
    return client;
  } catch (error) {
    try {
      client.close();
    } catch {
      // ignore
    }
    throw error instanceof FileHubSessionError
      ? error
      : new FileHubSessionError(error instanceof Error ? error.message : 'FTP connection failed.');
  }
}

async function acquireSession(userId: number, connectionId: string): Promise<PooledSession> {
  ensureSweeper();
  const key = poolKey(userId, connectionId);
  const existing = sessions.get(key);
  if (existing && !existing.disposed) {
    existing.inUse += 1;
    existing.lastUsed = Date.now();
    return existing;
  }

  const resolved = await getFileHubConnectionSecrets(connectionId);
  if (!resolved) {
    throw new FileHubSessionError('File Hub connection was not found.', 404);
  }
  const { record, secrets } = resolved;

  if (sessions.size >= MAX_SESSIONS_TOTAL) {
    evictOldestIdle();
  }

  logger.info('FileHub', 'Opening remote file session', {
    connectionId: record.id,
    protocol: record.protocol,
    host: record.host,
    port: record.port,
    username: record.username,
    userId,
  });

  try {
    if (record.protocol === 'sftp') {
      const { client, sftp } = await connectSftp(record, secrets);
      const pooled: SftpPooled = {
        kind: 'sftp',
        key,
        client,
        sftp,
        inUse: 1,
        lastUsed: Date.now(),
        disposed: false,
      };
      client.on('close', () => {
        void disposeSession(pooled);
      });
      sessions.set(key, pooled);
      return pooled;
    }

    const ftp = await connectFtp(record, secrets);
    const pooled: FtpPooled = {
      kind: 'ftp',
      key,
      client: ftp,
      chain: Promise.resolve(),
      inUse: 1,
      lastUsed: Date.now(),
      disposed: false,
    };
    sessions.set(key, pooled);
    return pooled;
  } catch (error) {
    logger.warn('FileHub', 'Failed to open remote file session', {
      connectionId: record.id,
      protocol: record.protocol,
      host: record.host,
      userId,
      message: error instanceof Error ? error.message : 'connect failed',
    });
    throw error instanceof FileHubSessionError
      ? error
      : new FileHubSessionError(error instanceof Error ? error.message : 'Failed to connect.');
  }
}

function releaseSession(session: PooledSession, failed: boolean): void {
  session.inUse = Math.max(0, session.inUse - 1);
  session.lastUsed = Date.now();
  if (failed) {
    void disposeSession(session);
  }
}

export async function withFileHubSession<T>(
  userId: number,
  connectionId: string,
  fn: (session: PooledSession) => Promise<T>,
): Promise<T> {
  const session = await acquireSession(userId, connectionId);
  let failed = false;
  try {
    if (session.kind === 'ftp') {
      let result!: T;
      session.chain = session.chain.catch(() => undefined).then(async () => {
        result = await fn(session);
      });
      await session.chain;
      return result;
    }
    return await fn(session);
  } catch (error) {
    failed = true;
    throw error;
  } finally {
    releaseSession(session, failed);
  }
}

export async function resolveHomePath(session: PooledSession): Promise<string> {
  if (session.kind === 'sftp') {
    return await new Promise((resolve, reject) => {
      session.sftp.realpath('.', (error, path) => {
        if (error) {
          reject(new FileHubSessionError(error.message));
          return;
        }
        resolve(path && path.startsWith('/') ? path : `/${path || ''}`);
      });
    });
  }
  const pwd = await session.client.pwd();
  return pwd.startsWith('/') ? pwd : `/${pwd}`;
}

function unixModeToString(mode: number | undefined, isDirectory: boolean): string {
  if (typeof mode !== 'number' || !Number.isFinite(mode)) {
    return isDirectory ? '0755' : '0644';
  }
  return (mode & 0o777).toString(8).padStart(4, '0');
}

function ftpPermissions(info: FileInfo): string {
  const { FileType } = loadBasicFtp();
  const raw = info.rawModifiedAt ? String(info.permissions ?? '') : String(info.permissions ?? '');
  if (typeof info.permissions === 'number') {
    return unixModeToString(info.permissions, info.type === FileType.Directory);
  }
  return raw || (info.type === FileType.Directory ? '0755' : '0644');
}

export async function listRemoteEntries(session: PooledSession, remotePath: string): Promise<FileHubRemoteEntry[]> {
  if (session.kind === 'sftp') {
    return await new Promise((resolve, reject) => {
      session.sftp.readdir(remotePath, (error, list) => {
        if (error) {
          reject(new FileHubSessionError(error.message));
          return;
        }
        const items: FileHubRemoteEntry[] = (list ?? [])
          .filter((entry) => entry.filename !== '.' && entry.filename !== '..')
          .map((entry) => {
            const isDirectory = Boolean(entry.attrs?.isDirectory?.() || ((entry.attrs?.mode ?? 0) & 0o170000) === 0o040000);
            return {
              name: entry.filename,
              type: isDirectory ? 'directory' : 'file',
              size: Number(entry.attrs?.size ?? 0),
              modifyTime: typeof entry.attrs?.mtime === 'number' ? entry.attrs.mtime * 1000 : null,
              permissions: unixModeToString(entry.attrs?.mode, isDirectory),
            };
          });
        resolve(items);
      });
    });
  }

  const { FileType } = loadBasicFtp();
  const list = await session.client.list(remotePath);
  return list
    .filter((entry) => entry.name !== '.' && entry.name !== '..')
    .map((entry) => ({
      name: entry.name,
      type: entry.type === FileType.Directory ? 'directory' : 'file',
      size: Number(entry.size ?? 0),
      modifyTime: entry.modifiedAt ? entry.modifiedAt.getTime() : null,
      permissions: ftpPermissions(entry),
    }));
}

export function createRemoteReadStream(session: PooledSession, remotePath: string): Readable {
  if (session.kind === 'sftp') {
    return session.sftp.createReadStream(remotePath);
  }
  const pass = new PassThrough();
  void session.client.downloadTo(pass, remotePath).catch((error) => {
    pass.destroy(error instanceof Error ? error : new Error('FTP download failed.'));
  });
  return pass;
}

export function createRemoteWriteStream(session: PooledSession, remotePath: string): Writable {
  if (session.kind === 'sftp') {
    return session.sftp.createWriteStream(remotePath);
  }
  const pass = new PassThrough();
  void session.client.uploadFrom(pass, remotePath).catch((error) => {
    pass.destroy(error instanceof Error ? error : new Error('FTP upload failed.'));
  });
  return pass;
}

export async function mkdirRemote(session: PooledSession, remotePath: string): Promise<void> {
  if (session.kind === 'sftp') {
    await new Promise<void>((resolve, reject) => {
      session.sftp.mkdir(remotePath, (error) => {
        if (error) {
          reject(new FileHubSessionError(error.message));
          return;
        }
        resolve();
      });
    });
    return;
  }
  const cwd = await session.client.pwd();
  try {
    await session.client.ensureDir(remotePath);
  } finally {
    try {
      await session.client.cd(cwd);
    } catch {
      // ignore
    }
  }
}

export async function renameRemote(session: PooledSession, oldPath: string, newPath: string): Promise<void> {
  if (session.kind === 'sftp') {
    await new Promise<void>((resolve, reject) => {
      session.sftp.rename(oldPath, newPath, (error) => {
        if (error) {
          reject(new FileHubSessionError(error.message));
          return;
        }
        resolve();
      });
    });
    return;
  }
  await session.client.rename(oldPath, newPath);
}

export async function removeRemote(
  session: PooledSession,
  remotePath: string,
  type: 'file' | 'directory',
): Promise<void> {
  if (session.kind === 'ftp') {
    if (type === 'directory') {
      await session.client.removeDir(remotePath);
    } else {
      await session.client.remove(remotePath);
    }
    return;
  }

  if (type === 'file') {
    await new Promise<void>((resolve, reject) => {
      session.sftp.unlink(remotePath, (error) => {
        if (error) {
          reject(new FileHubSessionError(error.message));
          return;
        }
        resolve();
      });
    });
    return;
  }

  const children = await listRemoteEntries(session, remotePath);
  for (const child of children) {
    const childPath = remotePath === '/' ? `/${child.name}` : `${remotePath}/${child.name}`;
    await removeRemote(session, childPath, child.type);
  }
  await new Promise<void>((resolve, reject) => {
    session.sftp.rmdir(remotePath, (error) => {
      if (error) {
        reject(new FileHubSessionError(error.message));
        return;
      }
      resolve();
    });
  });
}

export async function statRemoteSize(session: PooledSession, remotePath: string): Promise<number | null> {
  if (session.kind === 'sftp') {
    return await new Promise((resolve) => {
      session.sftp.stat(remotePath, (error, stats) => {
        if (error || !stats) {
          resolve(null);
          return;
        }
        resolve(Number(stats.size ?? 0));
      });
    });
  }
  try {
    const size = await session.client.size(remotePath);
    return Number(size);
  } catch {
    return null;
  }
}

export function closeAllFileHubSessions(): void {
  for (const session of [...sessions.values()]) {
    void disposeSession(session);
  }
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
}
