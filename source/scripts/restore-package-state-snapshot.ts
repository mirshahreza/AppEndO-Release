import fs from 'fs';
import path from 'path';
import {
  appendPackageEvent,
  ensurePackageStorageDirs,
  packageDirs,
} from '../src/core/packages/PackageFileStore.js';

function toIsoSlug(d = new Date()): string {
  return d.toISOString().replace(/[:.]/g, '-');
}

function copyRecursive(sourcePath: string, targetPath: string): void {
  if (!fs.existsSync(sourcePath)) return;

  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });
    for (const child of fs.readdirSync(sourcePath)) {
      copyRecursive(path.join(sourcePath, child), path.join(targetPath, child));
    }
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function removeIfExists(targetPath: string): void {
  if (!fs.existsSync(targetPath)) return;
  fs.rmSync(targetPath, { recursive: true, force: true });
}

function listSnapshots(): string[] {
  if (!fs.existsSync(packageDirs.snapshots)) return [];
  return fs
    .readdirSync(packageDirs.snapshots)
    .map((name) => path.join(packageDirs.snapshots, name))
    .filter((fullPath) => fs.statSync(fullPath).isDirectory())
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
}

function resolveSnapshotFromArgs(): string {
  const snapshots = listSnapshots();
  if (snapshots.length === 0) {
    throw new Error('No snapshot found under packages-storage/snapshots.');
  }

  const arg = process.argv.find((value) => value.startsWith('--snapshot='));
  if (!arg) {
    return snapshots[0];
  }

  const requested = arg.slice('--snapshot='.length).trim();
  if (!requested) return snapshots[0];

  const absoluteCandidate = path.isAbsolute(requested)
    ? requested
    : path.join(packageDirs.snapshots, requested);

  if (!fs.existsSync(absoluteCandidate) || !fs.statSync(absoluteCandidate).isDirectory()) {
    throw new Error(`Snapshot not found: ${requested}`);
  }

  return absoluteCandidate;
}

function backupCurrentState(): string {
  const backupRoot = path.join(packageDirs.snapshots, `pre-rollback-${toIsoSlug()}`);
  fs.mkdirSync(backupRoot, { recursive: true });

  copyRecursive(path.join(packageDirs.root, 'index.json'), path.join(backupRoot, 'index.json'));
  copyRecursive(packageDirs.installed, path.join(backupRoot, 'installed'));
  copyRecursive(packageDirs.objects, path.join(backupRoot, 'objects'));
  copyRecursive(path.join(packageDirs.dependencies, 'graph.json'), path.join(backupRoot, 'dependencies', 'graph.json'));

  return backupRoot;
}

function restoreSnapshot(snapshotPath: string): void {
  removeIfExists(path.join(packageDirs.root, 'index.json'));
  removeIfExists(packageDirs.installed);
  removeIfExists(packageDirs.objects);
  removeIfExists(path.join(packageDirs.dependencies, 'graph.json'));

  copyRecursive(path.join(snapshotPath, 'index.json'), path.join(packageDirs.root, 'index.json'));
  copyRecursive(path.join(snapshotPath, 'installed'), packageDirs.installed);
  copyRecursive(path.join(snapshotPath, 'objects'), packageDirs.objects);
  copyRecursive(path.join(snapshotPath, 'dependencies', 'graph.json'), path.join(packageDirs.dependencies, 'graph.json'));
}

function run(): void {
  ensurePackageStorageDirs();

  const snapshotPath = resolveSnapshotFromArgs();
  const backupPath = backupCurrentState();

  restoreSnapshot(snapshotPath);

  appendPackageEvent({
    type: 'plugin.rollout.rollback.restored',
    actor: 'rollback-script',
    payload: {
      restoredSnapshot: path.relative(process.cwd(), snapshotPath),
      backupSnapshot: path.relative(process.cwd(), backupPath),
    },
  });

  console.log(`[rollback] restored snapshot: ${path.relative(process.cwd(), snapshotPath)}`);
  console.log(`[rollback] backup created: ${path.relative(process.cwd(), backupPath)}`);
}

try {
  run();
} catch (error: any) {
  console.error('[rollback] failed:', error?.message || error);
  process.exitCode = 1;
}
