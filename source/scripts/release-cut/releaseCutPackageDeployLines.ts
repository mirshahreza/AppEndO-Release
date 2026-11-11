import type { ReleaseCutCloneProfileId } from './releaseCutCloneProfiles';

/**
 * Private full-source deploy git lines (one row per vertical / package family).
 * Wire new rows when RCUT adds export/push for another AppEndO-<Name> repo.
 */
export type ReleaseCutPackageDeployLine = {
  lineId: string;
  packageIds: string[];
  cloneProfileId: ReleaseCutCloneProfileId;
  privateRepoName: string;
  repoPathEnvVar: string;
  exportNpmScript: string;
  pushNpmScript: string;
};

export const RELEASE_CUT_PACKAGE_DEPLOY_LINES: ReleaseCutPackageDeployLine[] = [
  {
    lineId: 'hawiety',
    packageIds: ['hawiety'],
    cloneProfileId: 'hawiety',
    privateRepoName: 'AppEndO-Hawiety',
    repoPathEnvVar: 'APPENDO_HAWIETY_REPO_PATH',
    exportNpmScript: 'release:export-appendo-hawiety',
    pushNpmScript: 'release:push-appendo-hawiety',
  },
];

export function deployLineForPackageId(packageId: string): ReleaseCutPackageDeployLine | undefined {
  return RELEASE_CUT_PACKAGE_DEPLOY_LINES.find((line) => line.packageIds.includes(packageId));
}
