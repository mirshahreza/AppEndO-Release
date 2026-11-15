import type { ReleaseCutCloneProfileId } from './releaseCutCloneProfiles';
import type { ReleaseCutServerDeployTargetId } from './releaseCutServerDeployTargets';

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
  /** RCUT-9 server deploy target (separate deploy root + URL). */
  serverDeployTargetId: ReleaseCutServerDeployTargetId;
};

export const RELEASE_CUT_PACKAGE_DEPLOY_LINES: ReleaseCutPackageDeployLine[] = [
  {
    lineId: 'vertical',
    packageIds: ['vertical'],
    cloneProfileId: 'vertical',
    privateRepoName: 'AppEndO-Vertical',
    repoPathEnvVar: 'APPENDO_VERTICAL_REPO_PATH',
    exportNpmScript: 'release:export-appendo-vertical',
    pushNpmScript: 'release:push-appendo-vertical',
    serverDeployTargetId: 'vertical',
  },
];

export function deployLineForPackageId(packageId: string): ReleaseCutPackageDeployLine | undefined {
  return RELEASE_CUT_PACKAGE_DEPLOY_LINES.find((line) => line.packageIds.includes(packageId));
}
