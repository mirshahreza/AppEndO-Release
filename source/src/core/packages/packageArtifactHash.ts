import crypto from 'crypto';
import type AdmZip from 'adm-zip';
import {
  encodePackageArtifactFile,
  type PackageArtifactFile,
} from '../../shared/packages/packageArtifactHash';

export type { PackageArtifactFile } from '../../shared/packages/packageArtifactHash';

/** SHA-256 of package zip contents (excludes package.json); streams to avoid huge string joins. */
export function digestPackageArtifactFiles(files: PackageArtifactFile[]): string {
  const hash = crypto.createHash('sha256');
  const sorted = files
    .filter((file) => file.entryName.replace(/\\/g, '/') !== 'package.json')
    .sort((left, right) => left.entryName.localeCompare(right.entryName));

  for (let index = 0; index < sorted.length; index += 1) {
    if (index > 0) {
      hash.update('\n');
    }
    const file = sorted[index]!;
    hash.update(encodePackageArtifactFile(file.entryName, file.data));
  }

  return hash.digest('hex');
}

export function computePackageArtifactHashFromZip(zip: AdmZip): string {
  const files: PackageArtifactFile[] = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory)
    .map((entry) => ({ entryName: entry.entryName, data: new Uint8Array(entry.getData()) }));

  return digestPackageArtifactFiles(files);
}
