import React from 'react';
import { cn } from '../../lib/utils';

export type DestructiveConfirmBodyProps = {
  question: React.ReactNode;
  warning?: React.ReactNode;
  entityName?: React.ReactNode;
  entityDetail?: React.ReactNode;
  extra?: React.ReactNode;
  /** English copy in RTL locales; defaults to `ltr`. */
  dir?: 'ltr' | 'rtl' | 'auto';
  className?: string;
};

const DEFAULT_WARNING = 'This action cannot be undone.';

export const DestructiveConfirmBody: React.FC<DestructiveConfirmBodyProps> = ({
  question,
  warning = DEFAULT_WARNING,
  entityName,
  entityDetail,
  extra,
  dir = 'ltr',
  className,
}) => (
  <div className={cn('flex flex-col gap-2 text-sm text-slate-700', className)} dir={dir}>
    <p className="text-start font-semibold text-slate-800">{question}</p>
    {warning ? (
      <p className="text-start text-xs text-slate-600">{warning}</p>
    ) : null}
    {entityName ? (
      <p className="text-start font-mono text-xs font-semibold text-slate-700">{entityName}</p>
    ) : null}
    {entityDetail ? (
      <p className="text-start font-mono text-[11px] text-slate-500">{entityDetail}</p>
    ) : null}
    {extra}
  </div>
);
