import React from 'react';
import { ArrowLeftRight } from 'lucide-react';
import { cn } from '../../../lib/utils';

type RelationsConvertHeaderActionProps = {
  label: string;
  onClick: () => void;
  className?: string;
};

/**
 * Quiet header-2 action: plain text at rest, button chrome on hover.
 */
export const RelationsConvertHeaderAction: React.FC<RelationsConvertHeaderActionProps> = ({
  label,
  onClick,
  className,
}) => (
  <button
    type="button"
    onClick={onClick}
    className={cn(
      'group inline-flex shrink-0 items-center gap-1.5 rounded-md border border-transparent',
      'px-2 py-1 text-[11px] font-semibold text-indigo-600/75',
      'transition-[color,background-color,border-color,box-shadow] duration-150',
      'hover:border-indigo-200 hover:bg-white hover:text-indigo-700 hover:shadow-sm',
      'focus-visible:border-indigo-200 focus-visible:bg-white focus-visible:text-indigo-700',
      'focus-visible:shadow-sm focus-visible:outline-none',
      className,
    )}
  >
    <ArrowLeftRight
      className="h-3.5 w-3.5 opacity-60 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
      aria-hidden
    />
    {label}
  </button>
);
