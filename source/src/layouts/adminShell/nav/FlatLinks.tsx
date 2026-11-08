import React from 'react';
import { cn } from '../../../lib/utils';
import { isAdminShellNavItemActive } from '../buildAdminShellNav';
import { NavItemLink } from './NavItemLink';
import type { NavRendererProps } from './navRendererTypes';

export const FlatLinks: React.FC<NavRendererProps> = ({
  groups,
  pathname,
  onNavigate,
}) => {
  const items = groups.flatMap((group) => group.items).filter(
    (item) => item.type !== 'separator' && Boolean(item.path),
  );

  if (items.length === 0) {
    return null;
  }

  return (
    <nav
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs"
      data-nav-renderer="flat-links"
      aria-label="Footer navigation"
    >
      {items.map((item, index) => {
        const isActive = isAdminShellNavItemActive(groups, item, pathname);
        return (
          <NavItemLink
            key={`${item.label}-${index}`}
            path={item.path!}
            onNavigate={onNavigate}
            className={cn(
              'font-medium transition-colors',
              isActive ? 'text-primary-700' : 'text-slate-500 hover:text-primary-700',
            )}
          >
            {item.label}
          </NavItemLink>
        );
      })}
    </nav>
  );
};
