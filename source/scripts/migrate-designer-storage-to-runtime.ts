import fs from 'fs';
import path from 'path';

const LEGACY_ROOT = path.join(process.cwd(), 'packages-storage', 'designer');
const TARGET_ROOT = path.join(process.cwd(), 'runtime', 'designer');

type MigrationSummary = {
  migratedFiles: number;
  skippedFiles: number;
  migratedDirs: string[];
};

function copyFileIfMissing(source: string, target: string): boolean {
  if (!fs.existsSync(source)) return false;
  if (fs.existsSync(target)) return false;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return true;
}

function copyDirContents(sourceDir: string, targetDir: string): { migrated: number; skipped: number } {
  if (!fs.existsSync(sourceDir)) {
    return { migrated: 0, skipped: 0 };
  }

  fs.mkdirSync(targetDir, { recursive: true });
  let migrated = 0;
  let skipped = 0;

  for (const entry of fs.readdirSync(sourceDir, { withFileTypes: true })) {
    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      const nested = copyDirContents(sourcePath, targetPath);
      migrated += nested.migrated;
      skipped += nested.skipped;
      continue;
    }

    if (copyFileIfMissing(sourcePath, targetPath)) {
      migrated += 1;
    } else {
      skipped += 1;
    }
  }

  return { migrated, skipped };
}

const main = () => {
  const summary: MigrationSummary = {
    migratedFiles: 0,
    skippedFiles: 0,
    migratedDirs: [],
  };

  if (!fs.existsSync(LEGACY_ROOT)) {
    console.log('[designer:migrate-storage] Legacy path not found — nothing to migrate.');
    return;
  }

  const subdirs = ['drafts', 'snapshots', 'preview-logs'] as const;
  for (const subdir of subdirs) {
    const source = path.join(LEGACY_ROOT, subdir);
    const target = path.join(TARGET_ROOT, subdir);
    const result = copyDirContents(source, target);
    if (result.migrated > 0) {
      summary.migratedDirs.push(subdir);
    }
    summary.migratedFiles += result.migrated;
    summary.skippedFiles += result.skipped;
  }

  const legacyIndex = path.join(LEGACY_ROOT, 'index.json');
  const targetIndex = path.join(TARGET_ROOT, 'index.json');
  if (copyFileIfMissing(legacyIndex, targetIndex)) {
    summary.migratedFiles += 1;
  } else if (fs.existsSync(legacyIndex)) {
    summary.skippedFiles += 1;
  }

  console.log('[designer:migrate-storage] Migration complete:', summary);
};

main();
