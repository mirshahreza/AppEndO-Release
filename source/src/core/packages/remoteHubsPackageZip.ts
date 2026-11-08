import AdmZip from 'adm-zip';
import { computePackageArtifactHashFromZip } from './packageArtifactHash';
import { validateManifest } from './PackageManifestValidator';
import {
  buildRemoteHubsCultureKeys,
  buildRemoteHubsManifestDraft,
  buildRemoteHubsNavigationPatch,
  buildRemoteHubsUiSourceFiles,
  REMOTE_HUBS_CULTURE_KEYS_ENTRY,
  REMOTE_HUBS_NAV_PATCH_ENTRY,
} from './remoteHubsPackagePackRecipe';

export function buildRemoteHubsPackageZip(): Buffer {
  const zip = new AdmZip();
  zip.addFile(
    REMOTE_HUBS_NAV_PATCH_ENTRY,
    Buffer.from(`${JSON.stringify(buildRemoteHubsNavigationPatch(), null, 2)}\n`, 'utf8'),
  );
  zip.addFile(
    REMOTE_HUBS_CULTURE_KEYS_ENTRY,
    Buffer.from(`${JSON.stringify(buildRemoteHubsCultureKeys(), null, 2)}\n`, 'utf8'),
  );
  for (const file of buildRemoteHubsUiSourceFiles()) {
    zip.addFile(file.entry, Buffer.from(file.source, 'utf8'));
  }

  const manifest = buildRemoteHubsManifestDraft();
  const artifactHash = computePackageArtifactHashFromZip(zip);
  const integrity = manifest.integrity as { algorithm: string; artifactHash: string };
  integrity.artifactHash = artifactHash;

  const validated = validateManifest(manifest);
  if (!validated.valid || !validated.manifest) {
    throw new Error(`Remote Hubs package manifest is invalid: ${validated.errors.join(' ')}`);
  }

  zip.addFile('package.json', Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`, 'utf8'));
  return zip.toBuffer();
}
