import React from 'react';
import { cn } from '../../lib/utils';
import {
  FIELD_NUMERIC_DATE_DISPLAY_GRID_CENTER_CLASS,
  FIELD_NUMERIC_DATE_DISPLAY_START_CLASS,
} from '../../shared/lib/fieldNumericDateAlign';
import { useMountGridDateFormat } from './useMountGridDate';

type MountGridDateTextProps = {
  value?: string | null;
  className?: string;
  /** `center` for audit-style grids; `start` for culture-aligned dossier/read-only cells. */
  align?: 'center' | 'start';
};

export const MountGridDateText: React.FC<MountGridDateTextProps> = ({
  value,
  className,
  align = 'center',
}) => {
  const formatGridDate = useMountGridDateFormat();

  const glyphClass =
    align === 'start'
      ? FIELD_NUMERIC_DATE_DISPLAY_START_CLASS
      : FIELD_NUMERIC_DATE_DISPLAY_GRID_CENTER_CLASS;

  return (
    <span
      className={cn(
        'inline-flex min-w-0',
        align === 'center' ? 'w-full justify-center' : 'justify-start',
        className,
      )}
    >
      <span dir="ltr" className={cn(glyphClass, 'isolate')}>
        {formatGridDate(value)}
      </span>
    </span>
  );
};
