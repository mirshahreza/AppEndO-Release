import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { bumpSemver, type SemverBump } from './semver';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MANIFEST_PATH = path.join(REPO_ROOT, 'scripts/release-cut/releaseCutVersions.json');

export type ReleaseCutVersionsFile = {
  platform: string;
  packages: Record<string, string>;
  publicOssPackageIds: string[];
  defaultPublishPackageIds: string[];
};

export function releaseCutRepoRoot(): string {
  return REPO_ROOT;
}

export function releaseCutVersionsPath(): string {
  return MANIFEST_PATH;
}

export function readReleaseCutVersions(): ReleaseCutVersionsFile {
  const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
  return JSON.parse(raw) as ReleaseCutVersionsFile;
}

export function writeReleaseCutVersions(data: ReleaseCutVersionsFile): void {
  fs.writeFileSync(MANIFEST_PATH, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

export type VersionBumpPlan = {
  before: ReleaseCutVersionsFile;
  after: ReleaseCutVersionsFile;
  bump: SemverBump;
};

export function planVersionBump(options: {
  bump: SemverBump;
  publishPackageIds: string[];
  bumpPlatform?: boolean;
}): VersionBumpPlan {
  const before = readReleaseCutVersions();
  const after: ReleaseCutVersionsFile = structuredClone(before);
  const ids = new Set(options.publishPackageIds);

  if (options.bumpPlatform !== false) {
    after.platform = bumpSemver(before.platform, options.bump);
  }

  for (const packageId of ids) {
    const current = before.packages[packageId];
    if (!current) {
      throw new Error(`Unknown packageId in bump plan: ${packageId}`);
    }
    after.packages[packageId] = bumpSemver(current, options.bump);
  }

  return { before, after, bump: options.bump };
}

function replaceConstVersion(filePath: string, constName: string, version: string): void {
  const abs = path.join(REPO_ROOT, filePath);
  let text = fs.readFileSync(abs, 'utf8');
  const re = new RegExp(
    `(export\\s+const\\s+${constName}\\s*=\\s*['"\`])([^'"\`]+)(['"\`];)`,
  );
  if (!re.test(text)) {
    throw new Error(`Could not find ${constName} in ${filePath}`);
  }
  text = text.replace(re, `$1${version}$3`);
  fs.writeFileSync(abs, text, 'utf8');
}

function syncPackageJsonPlatformVersion(version: string): void {
  const pkgPath = path.join(REPO_ROOT, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8')) as { version?: string };
  pkg.version = version;
  fs.writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, 'utf8');
}

function syncCmsPackScriptVersion(version: string): void {
  const abs = path.join(REPO_ROOT, 'scripts/cms-phase1/pack-cms-package.ts');
  let text = fs.readFileSync(abs, 'utf8');
  const re = /(const PACKAGE_VERSION = ['"])([^'"]+)(['"];)/;
  if (!re.test(text)) {
    throw new Error('Could not find PACKAGE_VERSION in pack-cms-package.ts');
  }
  text = text.replace(re, `$1${version}$3`);
  fs.writeFileSync(abs, text, 'utf8');
}

/** Writes canonical manifest and syncs tracked version constants in the repo. */
export function applyReleaseCutVersions(data: ReleaseCutVersionsFile): void {
  writeReleaseCutVersions(data);
  syncPackageJsonPlatformVersion(data.platform);
  syncCmsPackScriptVersion(data.packages.cms ?? '');
  replaceConstVersion('src/core/packages/remoteHubsPackage.ts', 'REMOTE_HUBS_PACKAGE_VERSION', data.packages['remote-hubs'] ?? '');
  replaceConstVersion('src/core/packages/hawietyPackage.ts', 'HAWIETY_PACKAGE_VERSION', data.packages.hawiety ?? '');
}

export function platformReleaseTagName(platformVersion: string): string {
  return `release/v${platformVersion}`;
}
