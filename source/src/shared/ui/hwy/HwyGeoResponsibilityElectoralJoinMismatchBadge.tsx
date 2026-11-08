import React from 'react';

export type HwyGeoResponsibilityElectoralJoinMismatchBadgeProps = {
  label: string;
};

export const HwyGeoResponsibilityElectoralJoinMismatchBadge: React.FC<
  HwyGeoResponsibilityElectoralJoinMismatchBadgeProps
> = ({ label }) => (
  <span className="inline-flex max-w-full truncate rounded px-1.5 py-0.5 text-[9px] font-semibold leading-none bg-amber-100/90 text-amber-900">
    {label}
  </span>
);
