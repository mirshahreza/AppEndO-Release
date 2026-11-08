import crypto from 'crypto';
import type AdmZip from 'adm-zip';
import {
  buildPackageArtifactHashPayload,
  type PackageArtifactFile,
} from '../../shared/packages/packageArtifactHash';

export type { PackageArtifactFile } from '../../shared/packages/packageArtifactHash';

export function computePackageArtifactHashFromZip(zip: AdmZip): string {
  const files: PackageArtifactFile[] = zip
    .getEntries()
    .filter((entry) => !entry.isDirectory)
    .map((entry) => ({ entryName: entry.entryName, data: new Uint8Array(entry.getData()) }));

  return crypto.createHash('sha256').update(buildPackageArtifactHashPayload(files)).digest('hex');
}
