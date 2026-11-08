import React, { useMemo } from 'react';
import { sanitizeDesignerHtml } from '../../../domain/component-designer/sanitizeDesignerHtml';
import { cn } from '../../../lib/utils';
import { BaseInfoUiIcon, resolveLucideIconNameFromUiHtml } from '../../lib/baseInfoUiIcon';
import { isLucideOnlyUiHtml } from './uiHtmlLucide';

export type TrustedHtmlVisualPaneProps = {
  html: string;
  className?: string;
  emptyLabel?: string;
};

export const TrustedHtmlVisualPane: React.FC<TrustedHtmlVisualPaneProps> = ({
  html,
  className,
  emptyLabel = 'Nothing to preview yet',
}) => {
  const trimmed = html.trim();
  const safeHtml = useMemo(() => sanitizeDesignerHtml(trimmed), [trimmed]);
  const lucideName = resolveLucideIconNameFromUiHtml(trimmed);

  if (!trimmed) {
    return (
      <div
        className={cn(
          'flex h-full min-h-[80px] items-center justify-center px-3 text-[11px] text-slate-400',
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  if (isLucideOnlyUiHtml(trimmed)) {
    return (
      <div
        className={cn(
          'flex h-full min-h-[80px] flex-col items-center justify-center gap-2 p-3',
          className,
        )}
      >
        <BaseInfoUiIcon uiHtml={trimmed} className="h-8 w-8 text-slate-700" />
        <code className="max-w-full truncate font-mono text-[11px] text-slate-500">{trimmed}</code>
      </div>
    );
  }

  return (
    <div
      className={cn('h-full min-h-[80px] overflow-auto p-3 text-slate-800', className)}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
};
