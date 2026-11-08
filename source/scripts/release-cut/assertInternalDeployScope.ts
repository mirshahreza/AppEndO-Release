import fs from 'node:fs';
import path from 'node:path';

export type InternalDeployManifest = {
  platformVersion: string;
  bundledPackageIds: string[];
  hawietyPromoteMode: 'reuse-zip';
  packageArtifacts: Array<{ packageId: string; fileName: string; sha256?: string }>;
};

export function assertInternalDeployScope(deployDir: string): void {
  const manifestPath = path.join(deployDir, 'MANIFEST.json');
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Deploy gate: missing MANIFEST.json in ${deployDir}`);
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as InternalDeployManifest;

  if (!manifest.bundledPackageIds.includes('hawiety')) {
    throw new Error('Deploy gate: manifest must bundle hawiety');
  }

  const names = fs.readdirSync(deployDir).filter((n) => n.endsWith('.zip'));
  const hawietyZips = names.filter((n) => n.startsWith('hawiety-'));
  if (hawietyZips.length === 0) {
    throw new Error('Deploy gate: missing hawiety-*.zip at deploy root');
  }

  if (manifest.hawietyPromoteMode !== 'reuse-zip') {
    throw new Error('Deploy gate: hawietyPromoteMode must be reuse-zip (no pack during export)');
  }
}
