import fs from 'node:fs';
import path from 'node:path';

export function listInstallStateFiles(installedDir: string): string[] {
  if (!fs.existsSync(installedDir)) return [];
  return fs.readdirSync(installedDir).filter((name) => name.endsWith('.install-state.json'));
}

/** Move a shipped or foreign install-state directory aside so package install runs for real. */
export function quarantineInstallStateDir(storageRoot: string, now = Date.now()): string | null {
  const installedDir = path.join(storageRoot, 'installed');
  if (listInstallStateFiles(installedDir).length === 0) return null;
  const dest = path.join(storageRoot, `installed.stale-${now}`);
  fs.renameSync(installedDir, dest);
  return dest;
}
