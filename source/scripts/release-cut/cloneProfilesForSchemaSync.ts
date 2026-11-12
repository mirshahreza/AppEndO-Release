import type { ReleaseCutCloneProfileId } from './releaseCutCloneProfiles';

/**
 * Maps publish package ids to clone-line control-plane databases (structure provision only).
 * Extend when a new package gets its own AppEndO-<Package> git line + clone profile.
 */
export const PUBLISH_PACKAGE_ID_TO_CLONE_PROFILE: Partial<Record<string, ReleaseCutCloneProfileId>> = {
  hawiety: 'hawiety',
};

export function cloneProfilesForSchemaSync(input: {
  skipOss: boolean;
  publishPackageIds: string[];
}): ReleaseCutCloneProfileId[] {
  const profiles = new Set<ReleaseCutCloneProfileId>();
  if (!input.skipOss) {
    profiles.add('oss');
  }
  for (const packageId of input.publishPackageIds) {
    const profile = PUBLISH_PACKAGE_ID_TO_CLONE_PROFILE[packageId];
    if (profile) {
      profiles.add(profile);
    }
  }
  return [...profiles];
}
