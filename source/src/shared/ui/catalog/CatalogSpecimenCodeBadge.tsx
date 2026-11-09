import React, { useCallback, useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { TYPE_IDENTIFIER_CLASS, TYPE_MICRO_CLASS } from '../typographyRoles';

type CatalogSpecimenCodeBadgeProps = {
  code: string;
  className?: string;
};

export const CatalogSpecimenCodeBadge: React.FC<CatalogSpecimenCodeBadgeProps> = ({ code, className }) => {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be unavailable in embedded contexts.
    }
  }, [code]);

  return (
    <button
      type="button"
      onClick={() => void onCopy()}
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-md border border-slate-200/80 bg-white px-2 py-1 text-start transition hover:border-sky-300 hover:bg-sky-50/80',
        className,
      )}
      title="Copy reference code"
      aria-label={`Copy reference code ${code}`}
    >
      <span dir="ltr" className={cn(TYPE_IDENTIFIER_CLASS, TYPE_MICRO_CLASS, 'truncate font-mono text-sky-900')}>
        {code}
      </span>
      {copied ? (
        <Check className="h-3 w-3 shrink-0 text-emerald-600" aria-hidden />
      ) : (
        <Copy className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
      )}
    </button>
  );
};
