import fs from 'node:fs';
import path from 'node:path';

export type PublicOssManifest = {
  platformVersion: string;
  bundledPackageIds: string[];
  packageArtifacts: Array<{ packageId: string; fileName: string; sha256: string }>;
  createdAt: string;
  gitSha?: string;
};

const ALLOWED_ZIP_PREFIXES = ['cms-', 'remote-hubs-'];

export function assertPublicOssReleaseScope(publicOssDir: string): void {
  const manifestPath = path.join(publicOssDir, 'MANIFEST.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`OSS gate: missing MANIFEST.json in ${publicOssDir}`);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as PublicOssManifest;
  const bundled = manifest.bundledPackageIds ?? [];
  const expected = ['cms', 'remote-hubs'];
  const sortedBundled = [...bundled].sort();
  const sortedExpected = [...expected].sort();
  if (sortedBundled.join(',') !== sortedExpected.join(',')) {
    throw new Error(
      `OSS gate: bundledPackageIds must be ${sortedExpected.join(', ')}; got ${bundled.join(', ')}`,
    );
  }

  const packagesDir = path.join(publicOssDir, 'packages');
  const zipRoots = fs.existsSync(packagesDir) ? [packagesDir] : [publicOssDir];
  const entries: string[] = [];
  for (const root of zipRoots) {
    for (const name of fs.readdirSync(root)) {
      if (name.toLowerCase().endsWith('.zip')) {
        entries.push(name);
      }
    }
  }
  for (const fileName of entries) {
    const allowed = ALLOWED_ZIP_PREFIXES.some((prefix) => fileName.startsWith(prefix));
    if (!allowed) {
      throw new Error(`OSS gate: forbidden zip in public-oss: ${fileName}`);
    }
    if (fileName.startsWith('vertical-')) {
      throw new Error(`OSS gate: vertical zip must not ship in public-oss: ${fileName}`);
    }
  }

  for (const artifact of manifest.packageArtifacts ?? []) {
    if (artifact.packageId === 'vertical') {
      throw new Error('OSS gate: manifest must not list vertical packageArtifacts');
    }
  }
}
