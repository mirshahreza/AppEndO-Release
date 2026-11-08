import React from 'react';
import { cn } from '../../../lib/utils';
import { isAdminShellNavItemActive } from '../buildAdminShellNav';
import { NavItemLink } from './NavItemLink';
import type { NavRendererProps } from './navRendererTypes';
import { pageGuideNavItemProps } from '../../../shared/ui/shell/pageGuide/pageGuideChrome';

export const TopBarNav: React.FC<NavRendererProps> = ({
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
      className="flex flex-wrap items-center gap-1"
      data-nav-renderer="top-bar"
      aria-label="Top navigation"
    >
      {items.map((item, index) => {
        const isActive = isAdminShellNavItemActive(groups, item, pathname);
        return (
          <NavItemLink
            key={`${item.label}-${index}`}
            path={item.path!}
            onNavigate={onNavigate}
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
              isActive
                ? 'bg-primary-100 text-primary-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-primary-700',
            )}
            {...pageGuideNavItemProps(item.label ?? 'Page', item.description, 86, item.pageKey)}
          >
            {item.label}
          </NavItemLink>
        );
      })}
    </nav>
  );
};
