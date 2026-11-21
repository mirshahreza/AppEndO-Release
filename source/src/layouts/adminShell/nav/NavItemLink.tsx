import React from 'react';
import { cn } from '../../../lib/utils';

export type NavItemLinkProps = {
  path: string;
  onNavigate: (path: string) => void;
  /** Pointer/focus warmup (e.g. route chunk prefetch) — does not navigate. */
  onWarmPointer?: () => void;
  className?: string;
  title?: string;
  'aria-current'?: React.AriaAttributes['aria-current'];
  draggable?: boolean;
  onDragStart?: React.DragEventHandler<HTMLAnchorElement>;
  children: React.ReactNode;
} & Record<string, string | undefined>;

/** SPA nav link: renders a standard `<a href>`; client-routes on primary click. */
export const NavItemLink: React.FC<NavItemLinkProps> = ({
  path,
  onNavigate,
  onWarmPointer,
  className,
  title,
  'aria-current': ariaCurrent,
  draggable,
  onDragStart,
  children,
  ...rest
}) => (
  <a
    {...rest}
    href={path}
    title={title}
    aria-current={ariaCurrent}
    draggable={draggable}
    onDragStart={onDragStart}
    className={cn(className)}
    onPointerEnter={onWarmPointer}
    onFocus={onWarmPointer}
    onClick={(event) => {
      if (
        event.defaultPrevented
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
        || event.button !== 0
      ) {
        return;
      }

      event.preventDefault();
      onNavigate(path);
    }}
  >
    {children}
  </a>
);
