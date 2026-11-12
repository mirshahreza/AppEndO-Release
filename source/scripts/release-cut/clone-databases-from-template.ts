#!/usr/bin/env tsx
/**
 * Clone control-plane databases from the operator template DB (default: AppEnd).
 * Uses BACKUP/RESTORE — no install wizard; works with Windows-integrated SQL auth.
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { RELEASE_CUT_CLONE_PROFILES, type ReleaseCutCloneProfileId } from './releaseCutCloneProfiles';

const MONOREPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WORK_DIR = path.join(MONOREPO_ROOT, '.appendo-clone-work');
const SQL_INSTANCE = process.env.APPENDO_CLONE_SQL_INSTANCE?.trim() || 'localhost\\SQL2025';
const TEMPLATE_DB = process.env.APPENDO_CLONE_TEMPLATE_DB?.trim() || 'AppEnd';

const TARGET_DBS: Record<ReleaseCutCloneProfileId, string> = {
  oss: RELEASE_CUT_CLONE_PROFILES.oss.recommendedControlPlaneDatabase,
  hawiety: RELEASE_CUT_CLONE_PROFILES.hawiety.recommendedControlPlaneDatabase,
};

function sqlcmd(args: string[], quiet = false): string {
  const child = spawnSync(
    'sqlcmd',
    ['-S', SQL_INSTANCE, '-E', '-b', ...args],
    { encoding: 'utf8', shell: false, maxBuffer: 8 * 1024 * 1024 },
  );
  if (child.status !== 0) {
    const err = (child.stderr || child.stdout || '').trim();
    throw new Error(`sqlcmd failed: ${err.slice(-2000)}`);
  }
  const out = (child.stdout || '').trim();
  if (!quiet && out) {
    console.log(out);
  }
  return out;
}

function fileListOnly(backupPath: string): Array<{ logical: string; physical: string; type: string }> {
  const quoted = backupPath.replace(/'/g, "''");
  const out = sqlcmd(['-Q', `RESTORE FILELISTONLY FROM DISK = N'${quoted}'`, '-s', '|', '-W'], true);
  const rows: Array<{ logical: string; physical: string; type: string }> = [];
  for (const line of out.split(/\r?\n/)) {
    if (!line.trim() || line.startsWith('-') || line.startsWith('LogicalName')) continue;
    const parts = line.split('|').map((p) => p.trim());
    if (parts.length >= 3) {
      rows.push({ logical: parts[0], physical: parts[1], type: parts[2] });
    }
  }
  return rows;
}

function restoreAs(targetDb: string, backupPath: string): void {
  const files = fileListOnly(backupPath);
  if (files.length === 0) {
    throw new Error(`RESTORE FILELISTONLY returned no rows for ${backupPath}`);
  }
  const dataDir = path.dirname(files[0].physical);
  const moves = files
    .map((f, index) => {
      const ext = f.type === 'L' ? '_log.ldf' : '.mdf';
      const suffix = f.type === 'L' ? '_log' : '';
      const dest = path.join(dataDir, `${targetDb}${suffix}${ext}`);
      return `MOVE N'${f.logical.replace(/'/g, "''")}' TO N'${dest.replace(/'/g, "''")}'`;
    })
    .join(', ');

  const bak = backupPath.replace(/'/g, "''");
  sqlcmd([
    '-Q',
    [
      `IF DB_ID(N'${targetDb}') IS NOT NULL ALTER DATABASE [${targetDb}] SET SINGLE_USER WITH ROLLBACK IMMEDIATE;`,
      `RESTORE DATABASE [${targetDb}] FROM DISK = N'${bak}' WITH REPLACE, ${moves};`,
    ].join(' '),
  ]);
  console.log(`[clone:db] Restored ${targetDb} from ${TEMPLATE_DB}`);
}

function markInstallComplete(profileId: ReleaseCutCloneProfileId): void {
  const repoName = profileId === 'oss' ? 'AppEndO-Release' : 'AppEndO-Hawiety';
  const settingsPath = path.join(MONOREPO_ROOT, '..', repoName, 'source', 'settings.json');
  if (!fs.existsSync(settingsPath)) return;

  const monorepoSettings = JSON.parse(fs.readFileSync(path.join(MONOREPO_ROOT, 'settings.json'), 'utf8')) as Record<
    string,
    unknown
  >;
  const clone = JSON.parse(fs.readFileSync(settingsPath, 'utf8')) as Record<string, unknown>;
  const profile = RELEASE_CUT_CLONE_PROFILES[profileId];

  clone.install = {
    ...(typeof monorepoSettings.install === 'object' ? monorepoSettings.install : {}),
    pending: false,
    databaseInitialized: true,
    completedAt: new Date().toISOString(),
  };
  const runtime = clone.runtime as Record<string, unknown> | undefined;
  if (runtime) {
    runtime.port = profile.recommendedDevPort;
    runtime.appUrl = `http://localhost:${profile.recommendedDevPort}`;
  }

  const body = `${JSON.stringify(clone, null, 2)}\n`;
  fs.writeFileSync(settingsPath, body, 'utf8');
  fs.writeFileSync(path.join(MONOREPO_ROOT, '..', repoName, 'settings.json'), body, 'utf8');
}

function parseTargets(argv: string[]): ReleaseCutCloneProfileId[] {
  if (argv.includes('--all')) {
    return ['oss', 'hawiety'];
  }
  const idx = argv.indexOf('--profile');
  const one = idx >= 0 ? argv[idx + 1] : argv.find((a) => a === 'oss' || a === 'hawiety');
  if (!one || !TARGET_DBS[one as ReleaseCutCloneProfileId]) {
    throw new Error('Usage: clone:db-from-template -- --all | --profile oss|hawiety');
  }
  return [one as ReleaseCutCloneProfileId];
}

function estimateBackupBytes(backupPath: string): number | null {
  try {
    const stat = fs.statSync(backupPath);
    return stat.size;
  } catch {
    return null;
  }
}

function main(): void {
  fs.mkdirSync(WORK_DIR, { recursive: true });
  const backupPath = path.join(WORK_DIR, `${TEMPLATE_DB}-template.bak`);
  const templateEsc = TEMPLATE_DB.replace(/]/g, ']]');
  const bakEsc = backupPath.replace(/'/g, "''");
  const skipBackup = process.argv.includes('--reuse-backup') && fs.existsSync(backupPath);

  if (!skipBackup) {
    console.log(`[clone:db] Backup ${TEMPLATE_DB} → ${backupPath}`);
    sqlcmd(['-Q', `BACKUP DATABASE [${templateEsc}] TO DISK = N'${bakEsc}' WITH INIT, FORMAT, COMPRESSION;`]);
  } else {
    console.log(`[clone:db] Reusing existing backup ${backupPath}`);
  }

  const backupSize = estimateBackupBytes(backupPath);
  if (backupSize && backupSize > 8 * 1024 * 1024 * 1024) {
    console.warn(
      '[clone:db] Template backup is large; RESTORE needs free disk roughly 3× backup size. Prefer clone:install-wizard + clone:provision for schema-only clones.',
    );
  }

  for (const profileId of parseTargets(process.argv.slice(2))) {
    const targetDb = TARGET_DBS[profileId];
    restoreAs(targetDb, backupPath);
    markInstallComplete(profileId);
  }
}

main();
