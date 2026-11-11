/**
 * Clone-line profiles for release-cut exports (OSS + per-package private deploy repos).
 * Add a profile when a new package gets its own AppEndO-<Package> git line.
 */
export type ReleaseCutCloneProfileId = 'oss' | 'hawiety';

export type ReleaseCutCloneProfile = {
  id: ReleaseCutCloneProfileId;
  /** Human label for README / CLONE_PROFILE */
  title: string;
  /** Default SQL Server control-plane database name — isolate from monorepo `AppEnd` */
  recommendedControlPlaneDatabase: string;
  /** Dev server port when running beside the main monorepo */
  recommendedDevPort: number;
  /** Template under scripts/release-cut/templates/ */
  settingsRecommendedTemplate: string;
  cloneProfileDocTemplate: string;
  /** Extra path segments excluded from source snapshot (in addition to oss hwy scrub) */
  sourcePathExcludeSegments?: string[];
};

export const RELEASE_CUT_CLONE_PROFILES: Record<ReleaseCutCloneProfileId, ReleaseCutCloneProfile> = {
  oss: {
    id: 'oss',
    title: 'AppEndO public OSS (AppEndO-Release)',
    recommendedControlPlaneDatabase: 'AppEndORelease',
    recommendedDevPort: 3000,
    settingsRecommendedTemplate: 'settings.recommended.oss.json',
    cloneProfileDocTemplate: 'CLONE_PROFILE.oss.md',
  },
  hawiety: {
    id: 'hawiety',
    title: 'AppEndO Hawiety private deploy (AppEndO-Hawiety)',
    recommendedControlPlaneDatabase: 'AppEndOHawiety',
    recommendedDevPort: 3001,
    settingsRecommendedTemplate: 'settings.recommended.hawiety.json',
    cloneProfileDocTemplate: 'CLONE_PROFILE.hawiety.md',
  },
};

export function cloneProfileFor(id: ReleaseCutCloneProfileId): ReleaseCutCloneProfile {
  const profile = RELEASE_CUT_CLONE_PROFILES[id];
  if (!profile) {
    throw new Error(`Unknown release-cut clone profile: ${id}`);
  }
  return profile;
}
