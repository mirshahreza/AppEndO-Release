import fs from 'node:fs';
import path from 'node:path';

export type InternalDeployManifest = {
  platformVersion: string;
  bundledPackageIds: string[];
  verticalPromoteMode: 'reuse-zip';
  packageArtifacts: Array<{ packageId: string; fileName: string; sha256?: string }>;
};

export function assertInternalDeployScope(deployDir: string): void {
  const manifestPath = path.join(deployDir, 'MANIFEST.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Deploy gate: missing MANIFEST.json in ${deployDir}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as InternalDeployManifest;

  if (!manifest.bundledPackageIds.includes('vertical')) {
    throw new Error('Deploy gate: manifest must bundle vertical');
  }

  const packagesDir = path.join(deployDir, 'packages');
  if (!fs.existsSync(packagesDir)) {
    throw new Error('Deploy gate: missing packages/ directory');
  }
  const verticalZips = fs
    .readdirSync(packagesDir)
    .filter((n) => n.startsWith('vertical-') && n.endsWith('.zip'));
  if (verticalZips.length === 0) {
    throw new Error('Deploy gate: missing vertical-*.zip under packages/');
  }

  if (manifest.verticalPromoteMode !== 'reuse-zip') {
    throw new Error('Deploy gate: verticalPromoteMode must be reuse-zip (no pack during export)');
  }
}
