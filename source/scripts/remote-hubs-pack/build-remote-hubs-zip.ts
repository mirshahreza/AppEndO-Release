import fs from 'node:fs';
import path from 'node:path';
import { REMOTE_HUBS_PACKAGE_ID, REMOTE_HUBS_PACKAGE_VERSION } from '../../src/core/packages/remoteHubsPackage';
import { buildRemoteHubsPackageZip } from '../../src/core/packages/remoteHubsPackageZip';

export const REMOTE_HUBS_PACK_DIR = path.join(process.cwd(), 'scripts', 'remote-hubs-pack');

export function remoteHubsZipFileName(): string {
  return `${REMOTE_HUBS_PACKAGE_ID}-${REMOTE_HUBS_PACKAGE_VERSION}.zip`;
}

export function writeRemoteHubsPackageZip(outDir = REMOTE_HUBS_PACK_DIR): string {
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, remoteHubsZipFileName());
  fs.writeFileSync(outPath, buildRemoteHubsPackageZip());
  return outPath;
}

if (process.argv[1] && path.basename(process.argv[1]).includes('build-remote-hubs-zip')) {
  const outPath = writeRemoteHubsPackageZip();
  console.log(`Wrote ${outPath}`);
}
