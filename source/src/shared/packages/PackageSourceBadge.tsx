import * as React from 'react';
import { cn } from '../../lib/utils';
import { resolvePackageBadgeLabel, type PackageSourceIdentity } from './packageBadgeLabel';

export const PACKAGE_SOURCE_BADGE_CLASS =
  'shrink-0 rounded border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide leading-none text-violet-800';

export type PackageSourceBadgeProps = PackageSourceIdentity & {
  className?: string;
};

export const PackageSourceBadge: React.FC<PackageSourceBadgeProps> = ({
  packageId,
  packageDisplayName,
  className,
}) => {
  const trimmedPackageId = packageId?.trim();
  if (!trimmedPackageId) {
    return null;
  }

  const label = resolvePackageBadgeLabel({ packageId: trimmedPackageId, packageDisplayName });

  return (
    <span
      className={cn(PACKAGE_SOURCE_BADGE_CLASS, 'max-w-[45%] truncate normal-case', className)}
      title={label}
    >
      {label}
    </span>
  );
};
