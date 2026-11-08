import React from 'react';
import { Badge } from '@heroui/react';
import { cn } from '../../lib/utils';

const HeroBadge = Badge as any;

export type UiBadgeColor = 'default' | 'accent' | 'success' | 'warning' | 'danger';
export type UiBadgePlacement = 'top-end' | 'top-start' | 'bottom-end' | 'bottom-start';

export type UiBadgeProps = {
  children: React.ReactNode;
  content?: React.ReactNode;
  color?: UiBadgeColor;
  placement?: UiBadgePlacement;
  /** Hide the numeric label and show a notification dot. */
  dot?: boolean;
  className?: string;
};

const PLACEMENT_CLASS: Record<UiBadgePlacement, string> = {
  'top-end': 'top-0 end-0 translate-x-1/3 -translate-y-1/3 rtl:-translate-x-1/3',
  'top-start': 'top-0 start-0 -translate-x-1/3 -translate-y-1/3 rtl:translate-x-1/3',
  'bottom-end': 'bottom-0 end-0 translate-x-1/3 translate-y-1/3 rtl:-translate-x-1/3',
  'bottom-start': 'bottom-0 start-0 -translate-x-1/3 translate-y-1/3 rtl:translate-x-1/3',
};

const COLOR_CLASS: Record<UiBadgeColor, string> = {
  default: 'bg-slate-600 text-white',
  accent: 'bg-indigo-600 text-white',
  success: 'bg-emerald-600 text-white',
  warning: 'bg-amber-500 text-white',
  danger: 'bg-rose-600 text-white',
};

/** Thin wrapper over HeroUI `Badge` — notification count or dot on an avatar/icon. */
export const UiBadge: React.FC<UiBadgeProps> = ({
  children,
  content,
  color = 'danger',
  placement = 'top-end',
  dot = false,
  className,
}) => {
  const label = dot ? '' : content;
  const show = dot || (label !== undefined && label !== null && label !== '');

  return (
    <HeroBadge className={cn('relative inline-flex', className)}>
      {HeroBadge.Anchor ? <HeroBadge.Anchor>{children}</HeroBadge.Anchor> : children}
      {show ? (
        <span
          className={cn(
            'absolute z-10 inline-flex items-center justify-center rounded-full border-2 border-white',
            COLOR_CLASS[color],
            PLACEMENT_CLASS[placement],
            dot ? 'h-2.5 w-2.5' : 'min-h-4 min-w-4 px-1 text-[10px] font-semibold leading-none',
          )}
          aria-hidden={dot || undefined}
        >
          {dot ? null : label}
        </span>
      ) : null}
    </HeroBadge>
  );
};
