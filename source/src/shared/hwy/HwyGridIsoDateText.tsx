import React from 'react';
import { formatHwyIsoDateDisplay } from '../../domain/hwy/hwyIsoDateDisplay';
import { cn } from '../../lib/utils';

type HwyGridIsoDateTextProps = {
  value?: string | null;
  className?: string;
  empty?: string;
};

/** Grid cell date — Western `YYYY-MM-DD`, LTR digits. */
export const HwyGridIsoDateText: React.FC<HwyGridIsoDateTextProps> = ({
  value,
  className,
  empty,
}) => (
  <span dir="ltr" className={cn('text-sm tabular-nums', className)}>
    {formatHwyIsoDateDisplay(value, empty !== undefined ? { empty } : undefined)}
  </span>
);
