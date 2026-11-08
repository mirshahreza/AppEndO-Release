#!/usr/bin/env tsx
/**
 * Private deploy snapshot: full source + dist + cms + remote-hubs + **promoted** hawiety ZIP (no pack here).
 */
import fs from 'node:fs';
import path from 'node:path';
import { assertInternalDeployScope } from './assertInternalDeployScope';
import { appendoHawietyStagingDir, APPENDO_HAWIETY_REPO_NAME } from './appendoHawietyRepo';
import { copyFileEnsured, sha256File } from './artifacts';
import { renderInternalDeployReadme } from './renderInternalDeployReadme';
import { readReleaseCutVersions, releaseCutRepoRoot } from './versionManifest';

const REPO_ROOT = releaseCutRepoRoot();

const SOURCE_SKIP_DIR_NAMES = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  'agent-transcripts',
  '.cursor',
  '.claude',
  'terminals',
  'releases',
  'release',
  '.appendo-release-staging',
  '.appendo-hawiety-staging',
  '.appendo-deploy-staging',
]);

function walkRepoFiles(onFile: (absFile: string, relFile: string) => void, onDir: (absDir: string) => void): void {
  const walk = (absDir: string): void => {
    onDir(absDir);
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const full = path.join(absDir, entry.name);
      const rel = path.relative(REPO_ROOT, full);
      if (!rel) continue;
      if (SOURCE_SKIP_DIR_NAMES.has(entry.name)) continue;
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile()) {
        onFile(full, rel);
      }
    }
  };
  walk(REPO_ROOT);
}

function copySourceSnapshot(destRoot: string): void {
  const sourceRoot = path.join(destRoot, 'source');
  fs.mkdirSync(sourceRoot, { recursive: true });
  walkRepoFiles(
    (absFile, relFile) => {
      copyFileEnsured(absFile, path.join(sourceRoot, relFile));
    },
    (absDir) => {
      const rel = path.relative(REPO_ROOT, absDir);
      if (rel) {
        fs.mkdirSync(path.join(sourceRoot, rel), { recursive: true });
      }
    },
  );
  fs.writeFileSync(
    path.join(sourceRoot, 'DEPLOY_SOURCE_README.txt'),
    [
      'AppEndO private deploy source snapshot (includes Hawiety).',
      'Hawiety ZIP was promoted from runtime/package-artifacts — not re-packed during export.',
      '',
    ].join('\n'),
    'utf8',
  );
}

function copyDistBuild(destRoot: string): void {
  const srcDist = path.join(REPO_ROOT, 'dist');
  if (!fs.existsSync(path.join(srcDist, 'server.cjs'))) {
    throw new Error('Missing dist/server.cjs — run npm run build first');
  }
  fs.cpSync(srcDist, path.join(destRoot, 'dist'), { recursive: true });
}

function resolveDeployZips(): Array<{ packageId: string; abs: string; fileName: string }> {
  const versions = readReleaseCutVersions();
  const hwyVer = versions.packages.hawiety;
  const hawietyPath = path.join(REPO_ROOT, 'runtime', 'package-artifacts', 'hawiety', `hawiety-${hwyVer}.zip`);
  const cmsPath = path.join(REPO_ROOT, 'packages-storage', 'tmp', `cms-${versions.packages.cms}.zip`);
  const rhPath = path.join(
    REPO_ROOT,
    'scripts',
    'remote-hubs-pack',
    `remote-hubs-${versions.packages['remote-hubs']}.zip`,
  );

  const out: Array<{ packageId: string; abs: string; fileName: string }> = [];
  if (!fs.existsSync(hawietyPath)) {
    throw new Error(
      `Missing ${hawietyPath} — run hawiety:pack once (or release:cut P4) before export; deploy export does not pack`,
    );
  }
  out.push({ packageId: 'hawiety', abs: hawietyPath, fileName: path.basename(hawietyPath) });
  if (fs.existsSync(cmsPath)) {
    out.push({ packageId: 'cms', abs: cmsPath, fileName: path.basename(cmsPath) });
  } else {
    console.warn(`Deploy export: missing ${cmsPath} — run cms pack before deploy if needed`);
  }
  if (fs.existsSync(rhPath)) {
    out.push({ packageId: 'remote-hubs', abs: rhPath, fileName: path.basename(rhPath) });
  } else {
    console.warn(`Deploy export: missing ${rhPath}`);
  }
  return out;
}

function main(): void {
  const versions = readReleaseCutVersions();
  const version = versions.platform;
  const outDir = appendoHawietyStagingDir(REPO_ROOT, version);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const packagesDir = path.join(outDir, 'packages');
  fs.mkdirSync(packagesDir, { recursive: true });

  copyDistBuild(outDir);
  copySourceSnapshot(outDir);

  const manifest = {
    platformVersion: version,
    hawietyVersion: versions.packages.hawiety,
    bundledPackageIds: [] as string[],
    hawietyPromoteMode: 'reuse-zip' as const,
    packageArtifacts: [] as Array<{ packageId: string; fileName: string; sha256: string }>,
    createdAt: new Date().toISOString(),
    contents: ['source/', 'dist/', 'packages/', 'MANIFEST.json', 'README.md'],
  };

  for (const zip of resolveDeployZips()) {
    const dest = path.join(packagesDir, zip.fileName);
    copyFileEnsured(zip.abs, dest);
    copyFileEnsured(zip.abs, path.join(outDir, zip.fileName));
    manifest.bundledPackageIds.push(zip.packageId);
    manifest.packageArtifacts.push({
      packageId: zip.packageId,
      fileName: zip.fileName,
      sha256: sha256File(dest),
    });
  }

  fs.writeFileSync(path.join(outDir, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  assertInternalDeployScope(outDir);

  const readme = renderInternalDeployReadme(version, versions.packages.hawiety ?? '', manifest.bundledPackageIds);
  fs.writeFileSync(path.join(outDir, 'README.md'), readme, 'utf8');

  console.log(`Hawiety staging (push to ${APPENDO_HAWIETY_REPO_NAME}): ${outDir}`);
}

main();
