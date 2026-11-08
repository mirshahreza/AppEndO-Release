#!/usr/bin/env tsx
/**
 * Assembles a publishable public tree: scrubbed source + dist build + cms/remote-hubs zips only.
 */
import fs from 'node:fs';
import path from 'node:path';
import { assertPublicOssReleaseScope } from './assertPublicOssReleaseScope';
import { copyFileEnsured, sha256File } from './artifacts';
import { appendoReleaseStagingDir, APPENDO_RELEASE_REPO_NAME } from './appendoReleaseRepo';
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
  '.appendo-release-staging',
]);

const SOURCE_EXCLUDE_SEGMENTS = [
  `${path.sep}src${path.sep}server${path.sep}domain${path.sep}hwy${path.sep}`,
  `${path.sep}src${path.sep}domain${path.sep}hwy${path.sep}`,
  `${path.sep}src${path.sep}features${path.sep}hwy-`,
  `${path.sep}scripts${path.sep}hawiety-pack${path.sep}`,
  `${path.sep}scripts${path.sep}hwy-`,
  `${path.sep}runtime${path.sep}package-artifacts${path.sep}hawiety${path.sep}`,
  `${path.sep}dist${path.sep}release-cut${path.sep}`,
  `${path.sep}plans${path.sep}packages${path.sep}todo${path.sep}hawiety-package${path.sep}`,
];

function shouldExcludeSourcePath(absPath: string): boolean {
  const norm = absPath.replace(/\//g, path.sep);
  if (norm.includes(`${path.sep}hawiety-`) && norm.endsWith('.zip')) return true;
  return SOURCE_EXCLUDE_SEGMENTS.some((seg) => norm.includes(seg));
}

function walkRepoFiles(onFile: (absFile: string, relFile: string) => void, onDir: (absDir: string) => void): void {
  const walk = (absDir: string): void => {
    if (shouldExcludeSourcePath(absDir)) return;
    onDir(absDir);
    for (const entry of fs.readdirSync(absDir, { withFileTypes: true })) {
      const full = path.join(absDir, entry.name);
      const rel = path.relative(REPO_ROOT, full);
      if (!rel) continue;
      if (SOURCE_SKIP_DIR_NAMES.has(entry.name)) continue;
      if (shouldExcludeSourcePath(full)) continue;
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
    path.join(sourceRoot, 'PUBLIC_SOURCE_README.txt'),
    [
      'AppEndO public source snapshot.',
      'Hawiety vertical paths and pack tooling are excluded.',
      'Bundled packages for this release: cms, remote-hubs (see ../packages/).',
      'Install: npm ci && npm run build',
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
  const version = readReleaseCutVersions().platform;
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

  fs.writeFileSync(
    path.join(outDir, 'README-PUBLISH.md'),
    [
      `# AppEndO public release v${version}`,
      '',
      '- `source/` — platform source (Hawiety paths excluded)',
      '- `dist/` — production build (`server.cjs` + client assets)',
      '- `packages/` — CMS and Remote Hubs ZIPs only',
      '- Root `cms-*.zip` / `remote-hubs-*.zip` — duplicates for simple hosting',
      '',
      'Do not redistribute Hawiety artifacts from the private monorepo.',
      '',
      `Next: npm run release:push-appendo-release (clone **${APPENDO_RELEASE_REPO_NAME}** public repo first).`,
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Release staging (push to ${APPENDO_RELEASE_REPO_NAME}): ${outDir}`);
}

main();
