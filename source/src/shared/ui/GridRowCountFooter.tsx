import React from 'react';
import { cn } from '../../lib/utils';
import { useOptionalCulture } from '../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../core/culture/cultureShellKeys';
import { GRID_PAGING_FOOTER_CLASS } from './surfaceClasses';

export type GridRowCountFooterProps = {
  count: number;
};

function formatRowCountLabel(count: number, t?: (key: string) => string): string {
  const template = t?.('grid.rowCount') ?? CULTURE_ACTION_FALLBACK_LABELS['grid.rowCount'] ?? '{count} rows';
  return template.replace('{count}', String(count));
}

export function GridRowCountFooter({ count }: GridRowCountFooterProps) {
  const culture = useOptionalCulture();
  const label = culture?.ready
    ? formatRowCountLabel(count, culture.t)
    : formatRowCountLabel(count);

  return (
    <div className={cn(GRID_PAGING_FOOTER_CLASS, 'min-h-11 items-center')}>
      <span className="font-medium text-slate-600">{label}</span>
    </div>
  );
}
