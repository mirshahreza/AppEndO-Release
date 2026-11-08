export type ReleaseCutPackageEntry = {
  packageId: string;
  /** npm script or phase runner key */
  packCommand: string;
  /** Full release pipeline (verify + tests); optional for oss-only packages */
  releasePipeline?: string;
  /** Copy zip from this glob relative to repo root after pack */
  zipArtifactGlobs: string[];
};

export const RELEASE_CUT_PACKAGE_REGISTRY: ReleaseCutPackageEntry[] = [
  {
    packageId: 'hawiety',
    packCommand: 'hawiety:pack',
    releasePipeline: 'hawiety:release',
    zipArtifactGlobs: ['runtime/package-artifacts/hawiety/hawiety-*.zip'],
  },
  {
    packageId: 'cms',
    packCommand: 'cms:pack',
    zipArtifactGlobs: ['packages-storage/tmp/cms-*.zip'],
  },
  {
    packageId: 'remote-hubs',
    packCommand: 'remote-hubs:pack',
    zipArtifactGlobs: ['scripts/remote-hubs-pack/remote-hubs-*.zip'],
  },
];

export function registryEntryFor(packageId: string): ReleaseCutPackageEntry | undefined {
  return RELEASE_CUT_PACKAGE_REGISTRY.find((e) => e.packageId === packageId);
}
