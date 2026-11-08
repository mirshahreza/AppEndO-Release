import fs from 'node:fs';
import path from 'node:path';

const SQLITE_SIDECAR_SUFFIXES = ['', '-wal', '-shm', '-journal'] as const;

export const DEFAULT_SQLITE_INSTALL_PATH = path.join(process.cwd(), 'data', 'appendo-control.db');

export const parseSqliteInstallFilePath = (urlOrPath: string): string => {
  let raw = urlOrPath.trim();
  if (raw.toLowerCase().startsWith('file:')) {
    raw = raw.slice('file:'.length);
  }
  if (raw.startsWith('///')) {
    raw = raw.slice(3);
  } else if (/^\/\/localhost\//i.test(raw)) {
    raw = raw.replace(/^\/\/localhost\//i, '');
  }
  return path.resolve(raw);
};

export const readSqliteUrlFromSettingsFile = (settingsPath: string): string | undefined => {
  if (!fs.existsSync(settingsPath)) {
    return undefined;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
      database?: { provider?: unknown; url?: unknown };
    };
    const provider = String(parsed.database?.provider ?? '').trim().toLowerCase();
    const url = String(parsed.database?.url ?? '').trim();
    if (provider === 'sqlite' && url) {
      return url;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

export const isPendingInstallSettings = (settingsPath: string): boolean => {
  if (!fs.existsSync(settingsPath)) {
    return false;
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as {
      install?: { pending?: unknown };
    };
    return parsed.install?.pending === true;
  } catch {
    return false;
  }
};

export type SqliteResetRemoval = {
  removed: boolean;
  locked: string[];
};

export const removeSqliteInstallFiles = (label: string, urlOrPath: string): SqliteResetRemoval => {
  const resolved = parseSqliteInstallFilePath(urlOrPath);
  let removed = false;
  const locked: string[] = [];
  for (const suffix of SQLITE_SIDECAR_SUFFIXES) {
    const candidate = `${resolved}${suffix}`;
    if (!fs.existsSync(candidate)) {
      continue;
    }
    try {
      fs.unlinkSync(candidate);
      removed = true;
    } catch (error: unknown) {
      const code = error && typeof error === 'object' && 'code' in error
        ? String((error as { code?: unknown }).code)
        : '';
      if (code === 'EBUSY' || code === 'EPERM') {
        locked.push(candidate);
        continue;
      }
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[install:reset] Could not remove ${candidate}: ${message}`);
    }
  }
  if (removed) {
    console.log(`[install:reset] Removed SQLite files for ${label}: ${resolved}`);
  }
  return { removed, locked };
};

/** After the server is stopped, pending-install leftover SQLite files can be unlinked. */
export const removePendingInstallSqliteLeftovers = (options: {
  settingsPath: string;
  backupPath: string;
  defaultSqlitePath?: string;
}): string[] => {
  if (!isPendingInstallSettings(options.settingsPath)) {
    return [];
  }
  const locked: string[] = [];
  const previousUrl = readSqliteUrlFromSettingsFile(options.backupPath);
  if (previousUrl) {
    locked.push(...removeSqliteInstallFiles('previous install', previousUrl).locked);
  }
  locked.push(
    ...removeSqliteInstallFiles(
      'default path',
      options.defaultSqlitePath ?? DEFAULT_SQLITE_INSTALL_PATH,
    ).locked,
  );
  return locked;
};
