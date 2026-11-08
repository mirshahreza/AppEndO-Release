import fs from 'fs';
import path from 'path';
import { uploadPackageArtifact } from '../src/core/packages/PackageArtifactService.js';
import {
  appendPackageEvent,
  ensurePackageStorageDirs,
  packageDirs,
} from '../src/core/packages/PackageFileStore.js';

type LegacyPlugin = {
  id: string;
  name: string;
  zip_file_name: string;
  created_at: string;
};

type MigrationSummary = {
  totalLegacyItems: number;
  migrated: number;
  alreadyPresent: number;
  failed: number;
  remainingLegacyItems: number;
};

const SETTINGS_PATH = path.join(process.cwd(), 'settings.json');
const LEGACY_SETTINGS_KEY = 'plugins';
const MIGRATION_VERSION = 'phase10-settings-plugins-to-index-v1';

function toIsoSlug(d = new Date()): string {
  return d.toISOString().replace(/[:.]/g, '-');
}

function readJsonObject(filePath: string): Record<string, unknown> {
  if (!fs.existsSync(filePath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeJsonObject(filePath: string, value: Record<string, unknown>): void {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8');
}

function normalizeLegacyPlugin(input: unknown): LegacyPlugin | null {
  if (!input || typeof input !== 'object') return null;
  const item = input as Record<string, unknown>;
  const id = String(item.id ?? '').trim();
  const name = String(item.name ?? '').trim();
  const zip_file_name = String(item.zip_file_name ?? item.zipFileName ?? '').trim();
  const created_at = String(item.created_at ?? '').trim() || new Date().toISOString();

  if (!id || !name || !zip_file_name || !zip_file_name.toLowerCase().endsWith('.zip')) {
    return null;
  }

  return { id, name, zip_file_name, created_at };
}

function copyIfExists(sourcePath: string, targetPath: string): void {
  if (!fs.existsSync(sourcePath)) return;
  const stat = fs.statSync(sourcePath);
  if (stat.isDirectory()) {
    fs.mkdirSync(targetPath, { recursive: true });
    for (const child of fs.readdirSync(sourcePath)) {
      copyIfExists(path.join(sourcePath, child), path.join(targetPath, child));
    }
    return;
  }

  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function resolveLegacyZipPath(legacy: LegacyPlugin): string | null {
  const raw = legacy.zip_file_name;
  const candidates = [
    path.isAbsolute(raw) ? raw : path.join(process.cwd(), raw),
    path.join(process.cwd(), 'plugins', raw),
    path.join(process.cwd(), 'uploads', 'plugins', raw),
    path.join(process.cwd(), 'packages-storage', 'artifacts', legacy.id, raw),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function buildMigrationPaths() {
  const migrationDir = path.join(packageDirs.root, 'migrations');
  const markerPath = path.join(migrationDir, `${MIGRATION_VERSION}.done.json`);
  return { migrationDir, markerPath };
}

function createRollbackSnapshot(snapshotLabel: string): string {
  const snapshotRoot = path.join(packageDirs.snapshots, snapshotLabel);
  fs.mkdirSync(snapshotRoot, { recursive: true });

  copyIfExists(path.join(packageDirs.root, 'index.json'), path.join(snapshotRoot, 'index.json'));
  copyIfExists(packageDirs.installed, path.join(snapshotRoot, 'installed'));
  copyIfExists(packageDirs.objects, path.join(snapshotRoot, 'objects'));
  copyIfExists(path.join(packageDirs.dependencies, 'graph.json'), path.join(snapshotRoot, 'dependencies', 'graph.json'));

  return snapshotRoot;
}

async function run(): Promise<void> {
  ensurePackageStorageDirs();
  const { migrationDir, markerPath } = buildMigrationPaths();
  fs.mkdirSync(migrationDir, { recursive: true });

  const force = process.argv.includes('--force');
  if (fs.existsSync(markerPath) && !force) {
    const marker = readJsonObject(markerPath);
    console.log(`[migration] already executed (${MIGRATION_VERSION}).`);
    console.log(`[migration] marker: ${markerPath}`);
    console.log(`[migration] use --force to rerun.`);
    return;
  }

  const settings = readJsonObject(SETTINGS_PATH);
  const rawLegacy = Array.isArray(settings[LEGACY_SETTINGS_KEY]) ? settings[LEGACY_SETTINGS_KEY] : [];
  const legacyItems = rawLegacy
    .map((item) => normalizeLegacyPlugin(item))
    .filter((item): item is LegacyPlugin => Boolean(item));

  const snapshotName = `phase10-pre-migration-${toIsoSlug()}`;
  const snapshotPath = createRollbackSnapshot(snapshotName);

  const failedItems: LegacyPlugin[] = [];
  let migrated = 0;
  let alreadyPresent = 0;

  for (const legacy of legacyItems) {
    const artifactPath = resolveLegacyZipPath(legacy);
    if (!artifactPath) {
      failedItems.push(legacy);
      console.warn(`[migration] artifact not found for ${legacy.id}: ${legacy.zip_file_name}`);
      continue;
    }

    const buffer = fs.readFileSync(artifactPath);
    const result = await uploadPackageArtifact(
      buffer,
      path.basename(artifactPath),
      'migration.settings.plugins',
    );

    if (result.success) {
      migrated += 1;
      console.log(`[migration] migrated ${legacy.id}@${result.version}`);
      continue;
    }

    if ('error' in result) {
      const duplicate = result.error.includes('already exists');
      if (duplicate) {
        alreadyPresent += 1;
        console.log(`[migration] already present ${legacy.id}; removed from legacy settings.`);
        continue;
      }

      failedItems.push(legacy);
      console.warn(`[migration] failed ${legacy.id}: ${result.error}`);
    }
  }

  settings[LEGACY_SETTINGS_KEY] = failedItems;
  writeJsonObject(SETTINGS_PATH, settings);

  const summary: MigrationSummary = {
    totalLegacyItems: legacyItems.length,
    migrated,
    alreadyPresent,
    failed: failedItems.length,
    remainingLegacyItems: failedItems.length,
  };

  const marker = {
    migration: MIGRATION_VERSION,
    finishedAt: new Date().toISOString(),
    forced: force,
    settingsPath: SETTINGS_PATH,
    rollbackSnapshot: path.relative(process.cwd(), snapshotPath),
    summary,
  };

  fs.writeFileSync(markerPath, JSON.stringify(marker, null, 2), 'utf8');

  appendPackageEvent({
    type: 'plugin.rollout.migration.settings_plugins.completed',
    actor: 'migration-script',
    payload: {
      migration: MIGRATION_VERSION,
      summary,
      rollbackSnapshot: marker.rollbackSnapshot,
    },
  });

  console.log('[migration] completed.');
  console.log(`[migration] snapshot: ${marker.rollbackSnapshot}`);
  console.log(`[migration] marker: ${path.relative(process.cwd(), markerPath)}`);
  console.log(`[migration] summary: ${JSON.stringify(summary)}`);
}

run().catch((error: any) => {
  console.error('[migration] fatal error:', error?.message || error);
  process.exitCode = 1;
});
