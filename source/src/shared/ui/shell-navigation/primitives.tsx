import * as React from 'react';
import { cn } from '../../../lib/utils';
import { NativeButton } from '../NativeButton';

export type ShellNavRootProps = React.ComponentPropsWithoutRef<'nav'>;
export const ShellNavRoot = React.forwardRef<HTMLElement, ShellNavRootProps>(
  ({ className, ...props }, ref) => (
    <nav ref={ref} className={cn('min-w-0', className)} {...props} />
  ),
);
ShellNavRoot.displayName = 'ShellNavRoot';

export type ShellNavListProps = React.ComponentPropsWithoutRef<'ul'>;
export const ShellNavList = React.forwardRef<HTMLUListElement, ShellNavListProps>(
  ({ className, ...props }, ref) => (
    <ul ref={ref} className={cn('m-0 list-none p-0', className)} {...props} />
  ),
);
ShellNavList.displayName = 'ShellNavList';

export type ShellNavGroupProps = React.ComponentPropsWithoutRef<'section'>;
export const ShellNavGroup = React.forwardRef<HTMLElement, ShellNavGroupProps>(
  ({ className, ...props }, ref) => (
    <section ref={ref} data-shell-nav-group="" className={cn('min-w-0', className)} {...props} />
  ),
);
ShellNavGroup.displayName = 'ShellNavGroup';

export type ShellNavItemProps = React.ComponentPropsWithoutRef<'li'>;
export const ShellNavItem = React.forwardRef<HTMLLIElement, ShellNavItemProps>(
  ({ className, ...props }, ref) => (
    <li ref={ref} className={cn('min-w-0', className)} {...props} />
  ),
);
ShellNavItem.displayName = 'ShellNavItem';

export type ShellNavLinkProps = Omit<React.ComponentPropsWithoutRef<'a'>, 'onNavigate'> & {
  active?: boolean;
  onNavigate?: (href: string) => void;
};
export const ShellNavLink = React.forwardRef<HTMLAnchorElement, ShellNavLinkProps>(
  ({ active = false, className, href, onClick, onNavigate, ...props }, ref) => (
    <a
      ref={ref}
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'min-w-0 rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500',
        className,
      )}
      onClick={(event) => {
        onClick?.(event);
        if (
          event.defaultPrevented
          || !href
          || !onNavigate
          || event.button !== 0
          || event.metaKey
          || event.ctrlKey
          || event.shiftKey
          || event.altKey
        ) return;
        event.preventDefault();
        onNavigate(href);
      }}
      {...props}
    />
  ),
);
ShellNavLink.displayName = 'ShellNavLink';

export type ShellNavTriggerProps = React.ComponentPropsWithoutRef<'button'> & {
  expanded: boolean;
  controls: string;
};
export const ShellNavTrigger = React.forwardRef<HTMLButtonElement, ShellNavTriggerProps>(
  ({ expanded, controls, className, type = 'button', ...props }, ref) => (
    <NativeButton
      ref={ref}
      type={type}
      aria-expanded={expanded}
      aria-controls={controls}
      className={cn(
        'rounded-md outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500',
        className,
      )}
      {...props}
    />
  ),
);
ShellNavTrigger.displayName = 'ShellNavTrigger';

export type ShellNavIconProps = React.ComponentPropsWithoutRef<'span'>;
export const ShellNavIcon = React.forwardRef<HTMLSpanElement, ShellNavIconProps>(
  ({ className, ...props }, ref) => (
    <span ref={ref} aria-hidden className={cn('inline-flex shrink-0', className)} {...props} />
  ),
);
ShellNavIcon.displayName = 'ShellNavIcon';

export type ShellNavBadgeProps = React.ComponentPropsWithoutRef<'span'>;
export const ShellNavBadge = React.forwardRef<HTMLSpanElement, ShellNavBadgeProps>(
  ({ className, ...props }, ref) => (
    <span
      ref={ref}
      className={cn(
        'inline-flex max-w-24 shrink-0 truncate rounded-full bg-primary-50 px-1.5 py-0.5 text-[10px] font-bold text-primary-700',
        className,
      )}
      {...props}
    />
  ),
);
ShellNavBadge.displayName = 'ShellNavBadge';

export type ShellNavDescriptionProps = React.ComponentPropsWithoutRef<'span'>;
export const ShellNavDescription = React.forwardRef<HTMLSpanElement, ShellNavDescriptionProps>(
  ({ className, ...props }, ref) => (
    <span ref={ref} data-shell-nav-description="" className={cn('block text-xs text-slate-500', className)} {...props} />
  ),
);
ShellNavDescription.displayName = 'ShellNavDescription';

export type ShellNavDividerProps = React.ComponentPropsWithoutRef<'li'>;
export const ShellNavDivider = React.forwardRef<HTMLLIElement, ShellNavDividerProps>(
  ({ className, ...props }, ref) => (
    <li
      ref={ref}
      role="separator"
      aria-orientation="horizontal"
      className={cn('my-1 border-t border-divider', className)}
      {...props}
    />
  ),
);
ShellNavDivider.displayName = 'ShellNavDivider';
