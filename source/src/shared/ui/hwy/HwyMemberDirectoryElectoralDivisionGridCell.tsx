import React from 'react';

import type { CatalogInteractionPreviewProps } from '../catalog/catalogInteractionState';

import { HwyElectoralProvinceFallbackCell, resolveHwyElectoralDivisionCellDisplay } from '../../lib/hwyMemberDirectoryPathDisplay';
import { HwyElectoralDivisionPathLinks } from './HwyElectoralDivisionPathLinks';

/**
 * Hawiety member-directory grids: المركز الانتخابي column (path links → geo officials inline list).
 * Use this everywhere instead of ad-hoc `HwyElectoralDivisionPathCell` + resolve calls.
 */
export type HwyMemberDirectoryElectoralDivisionGridCellProps = CatalogInteractionPreviewProps & {
  row: Record<string, unknown>;
  /** When electoral path is empty, show province from this row field (default `addrProvinceTitle`). */
  electoralFallbackField?: string;
  className?: string;
};

export const HwyMemberDirectoryElectoralDivisionGridCell: React.FC<
  HwyMemberDirectoryElectoralDivisionGridCellProps
> = ({ row, electoralFallbackField, className, catalogPreviewState }) => {
  const display = resolveHwyElectoralDivisionCellDisplay(row, electoralFallbackField);
  if (display.kind === 'province') {
    return <HwyElectoralProvinceFallbackCell value={display.value} className={className} />;
  }
  return (
    <HwyElectoralDivisionPathLinks
      value={display.value}
      layout="twoLine"
      className={className}
      catalogPreviewState={catalogPreviewState}
    />
  );
};
