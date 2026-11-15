#!/usr/bin/env tsx
/**
 * Private deploy snapshot: full source + dist + cms + remote-hubs + **promoted** vertical ZIP (no pack here).
 */
import fs from 'node:fs';
import path from 'node:path';
import { assertInternalDeployScope } from './assertInternalDeployScope';
import { appendoVerticalStagingDir, APPENDO_VERTICAL_REPO_NAME } from './appendoVerticalRepo';
import { copyFileEnsured, sha256File } from './artifacts';
import { renderInternalDeployReadme } from './renderInternalDeployReadme';
import { copyReleaseCutSourceSnapshot } from './releaseCutSourceSnapshot';
import { materializeDeployTargetArtifacts } from './materializeDeployTargetArtifacts';
import { readReleaseCutVersions, releaseCutRepoRoot } from './versionManifest';

const REPO_ROOT = releaseCutRepoRoot();

function copySourceSnapshot(destRoot: string): void {
  copyReleaseCutSourceSnapshot({
    repoRoot: REPO_ROOT,
    destRoot,
    mode: 'full',
    cloneProfileId: 'vertical',
    sourceReadmeLines: [
      'AppEndO private deploy source snapshot (includes Vertical).',
      'Vertical ZIP was promoted from runtime/package-artifacts — not re-packed during export.',
      'Isolated dev: see CLONE_PROFILE.md and settings.recommended.json (database AppEndOVertical).',
    ],
  });
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
  const vxVer = versions.packages.vertical;
  const verticalPath = path.join(REPO_ROOT, 'runtime', 'package-artifacts', 'vertical', `vertical-${vxVer}.zip`);
  const cmsPath = path.join(REPO_ROOT, 'packages-storage', 'tmp', `cms-${versions.packages.cms}.zip`);
  const rhPath = path.join(
    REPO_ROOT,
    'scripts',
    'remote-hubs-pack',
    `remote-hubs-${versions.packages['remote-hubs']}.zip`,
  );

  const out: Array<{ packageId: string; abs: string; fileName: string }> = [];
  if (!fs.existsSync(verticalPath)) {
    throw new Error(
      `Missing ${verticalPath} — run vertical:pack once (or release:cut P4) before export; deploy export does not pack`,
    );
  }
  out.push({ packageId: 'vertical', abs: verticalPath, fileName: path.basename(verticalPath) });
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
  const outDir = appendoVerticalStagingDir(REPO_ROOT, version);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const packagesDir = path.join(outDir, 'packages');
  fs.mkdirSync(packagesDir, { recursive: true });

  copyDistBuild(outDir);
  copySourceSnapshot(outDir);

  const manifest = {
    platformVersion: version,
    verticalVersion: versions.packages.vertical,
    bundledPackageIds: [] as string[],
    verticalPromoteMode: 'reuse-zip' as const,
    packageArtifacts: [] as Array<{ packageId: string; fileName: string; sha256: string }>,
    createdAt: new Date().toISOString(),
    contents: ['source/', 'dist/', 'packages/', 'MANIFEST.json', 'README.md'],
  };

  for (const zip of resolveDeployZips()) {
    const dest = path.join(packagesDir, zip.fileName);
    copyFileEnsured(zip.abs, dest);
    manifest.bundledPackageIds.push(zip.packageId);
    manifest.packageArtifacts.push({
      packageId: zip.packageId,
      fileName: zip.fileName,
      sha256: sha256File(dest),
    });
  }

  fs.writeFileSync(path.join(outDir, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  materializeDeployTargetArtifacts(outDir, 'vertical');
  assertInternalDeployScope(outDir);

  const readme = renderInternalDeployReadme(version, versions.packages.vertical ?? '', manifest.bundledPackageIds);
  fs.writeFileSync(path.join(outDir, 'README.md'), readme, 'utf8');

  console.log(`Vertical staging (push to ${APPENDO_VERTICAL_REPO_NAME}): ${outDir}`);
}

main();
