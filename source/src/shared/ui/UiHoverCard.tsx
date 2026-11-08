import React, { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/utils';
import {
  ShellResponsivePopover,
  type ShellResponsivePopoverPlacement,
} from './shell-foundation/ShellResponsivePopover';

export type UiHoverCardPlacement = ShellResponsivePopoverPlacement;

export type UiHoverCardProps = {
  trigger: React.ReactNode;
  title: string;
  description?: string;
  placement?: UiHoverCardPlacement;
  openDelay?: number;
  className?: string;
};

const CLOSE_DELAY_MS = 120;

/** Rich hover preview — title and description, not a plain-text tooltip. */
export const UiHoverCard: React.FC<UiHoverCardProps> = ({
  trigger,
  title,
  description,
  placement = 'bottom-start',
  openDelay = 180,
  className,
}) => {
  const [open, setOpen] = useState(false);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
    }
  }, []);

  const cancelTimers = () => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current !== null) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const scheduleOpen = () => {
    cancelTimers();
    openTimerRef.current = window.setTimeout(() => {
      setOpen(true);
      openTimerRef.current = null;
    }, Math.max(0, openDelay));
  };

  const scheduleClose = () => {
    if (openTimerRef.current !== null) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    closeTimerRef.current = window.setTimeout(() => {
      setOpen(false);
      closeTimerRef.current = null;
    }, CLOSE_DELAY_MS);
  };

  return (
    <ShellResponsivePopover
      open={open}
      onOpenChange={setOpen}
      placement={placement}
      fallbackPlacement={placement.startsWith('top') ? 'bottom-start' : 'top-start'}
      dismissOnOutside
      dismissOnEscape
      ariaLabel={title}
      className={cn('min-w-56 max-w-xs p-3', className)}
      trigger={(
        <span
          className="inline-flex cursor-default"
          onMouseEnter={scheduleOpen}
          onMouseLeave={scheduleClose}
          onFocus={scheduleOpen}
          onBlur={scheduleClose}
        >
          {trigger}
        </span>
      )}
    >
      <div
        onMouseEnter={cancelTimers}
        onMouseLeave={scheduleClose}
      >
        <p className="text-sm font-medium text-slate-800">{title}</p>
        {description ? <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p> : null}
      </div>
    </ShellResponsivePopover>
  );
};
