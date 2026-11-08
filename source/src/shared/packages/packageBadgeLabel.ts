export type PackageSourceIdentity = {
  packageId?: string;
  packageDisplayName?: string;
};

export function resolvePackageBadgeLabel(source: PackageSourceIdentity): string {
  const displayName = source.packageDisplayName?.trim();
  if (displayName) {
    return displayName;
  }

  const packageId = source.packageId?.trim();
  if (packageId) {
    return packageId;
  }

  return 'Package';
}
