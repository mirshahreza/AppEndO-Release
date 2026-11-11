#!/usr/bin/env tsx
/**
 * Assembles a publishable public tree: scrubbed source + dist build + cms/remote-hubs zips only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { assertPublicOssReleaseScope } from './assertPublicOssReleaseScope';
import { copyFileEnsured, sha256File } from './artifacts';
import { appendoReleaseStagingDir, APPENDO_RELEASE_REPO_NAME } from './appendoReleaseRepo';
import { renderPublicReleaseReadme } from './renderPublicReleaseReadme';
import { copyReleaseCutSourceSnapshot } from './releaseCutSourceSnapshot';
import { readReleaseCutVersions, releaseCutRepoRoot } from './versionManifest';

const REPO_ROOT = releaseCutRepoRoot();

function copySourceSnapshot(destRoot: string): void {
  copyReleaseCutSourceSnapshot({
    repoRoot: REPO_ROOT,
    destRoot,
    mode: 'oss',
    cloneProfileId: 'oss',
    sourceReadmeLines: [
      'AppEndO public source snapshot.',
      'Hawiety vertical paths and pack tooling are excluded.',
      'Bundled packages for this release: cms, remote-hubs (see ../packages/).',
      'Isolated dev: see CLONE_PROFILE.md and settings.recommended.json (database AppEndORelease).',
      'Install: npm ci && npm run build',
    ],
  });
}

function copyDistBuild(destRoot: string): void {
  const srcDist = path.join(REPO_ROOT, 'dist');
  if (!fs.existsSync(path.join(srcDist, 'server.cjs'))) {
    throw new Error('Missing dist/server.cjs — run npm run build first');
  }
  const destDist = path.join(destRoot, 'dist');
  fs.cpSync(srcDist, destDist, { recursive: true });
}

function resolveOssZips(): Array<{ packageId: string; abs: string; fileName: string }> {
  const versions = readReleaseCutVersions();
  const cmsPath = path.join(
    REPO_ROOT,
    'packages-storage',
    'tmp',
    `cms-${versions.packages.cms}.zip`,
  );
  const rhPath = path.join(
    REPO_ROOT,
    'scripts',
    'remote-hubs-pack',
    `remote-hubs-${versions.packages['remote-hubs']}.zip`,
  );
  const out: Array<{ packageId: string; abs: string; fileName: string }> = [];
  if (fs.existsSync(cmsPath)) {
    out.push({ packageId: 'cms', abs: cmsPath, fileName: path.basename(cmsPath) });
  }
  if (fs.existsSync(rhPath)) {
    out.push({ packageId: 'remote-hubs', abs: rhPath, fileName: path.basename(rhPath) });
  }
  if (out.length !== 2) {
    throw new Error('Could not resolve cms and remote-hubs zips — run cms:pack and remote-hubs:pack');
  }
  return out;
}

function main(): void {
  const cutVersions = readReleaseCutVersions();
  const version = cutVersions.platform;
  const outDir = appendoReleaseStagingDir(REPO_ROOT, version);
  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });

  const packagesDir = path.join(outDir, 'packages');
  fs.mkdirSync(packagesDir, { recursive: true });

  copyDistBuild(outDir);
  copySourceSnapshot(outDir);

  const manifest = {
    platformVersion: version,
    bundledPackageIds: ['cms', 'remote-hubs'],
    packageArtifacts: [] as Array<{ packageId: string; fileName: string; sha256: string }>,
    createdAt: new Date().toISOString(),
    contents: ['source/', 'dist/', 'packages/', 'MANIFEST.json', 'README-PUBLISH.md'],
  };

  for (const zip of resolveOssZips()) {
    const dest = path.join(packagesDir, zip.fileName);
    copyFileEnsured(zip.abs, dest);
    copyFileEnsured(zip.abs, path.join(outDir, zip.fileName));
    manifest.packageArtifacts.push({
      packageId: zip.packageId,
      fileName: zip.fileName,
      sha256: sha256File(dest),
    });
  }

  fs.writeFileSync(path.join(outDir, 'MANIFEST.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  assertPublicOssReleaseScope(outDir);

  const readme = renderPublicReleaseReadme(version, cutVersions.publicOssPackageIds);
  fs.writeFileSync(path.join(outDir, 'README.md'), readme, 'utf8');
  fs.writeFileSync(
    path.join(outDir, 'README-PUBLISH.md'),
    [
      `# AppEndO public release v${version}`,
      '',
      'See **README.md** for the full public distribution guide.',
      '',
      `Push target: **${APPENDO_RELEASE_REPO_NAME}** on GitHub.`,
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Release staging (push to ${APPENDO_RELEASE_REPO_NAME}): ${outDir}`);
}

main();
