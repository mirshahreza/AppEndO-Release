import type { ReactNode } from 'react';
import type {
  NavigationManifestGroup,
  NavigationManifestItem,
} from '../../api/contracts/platform/navigation';

export type ShellNavigationItemPresentation = {
  featured?: boolean;
  imageAssetRef?: string;
  badge?: string;
};

/**
 * Render-ready projection of the platform navigation manifest contract.
 * `path` and `active` are optional runtime enrichments supplied by shell adapters.
 */
export type ShellNavigationItem = Pick<
  NavigationManifestItem,
  | 'type'
  | 'label'
  | 'icon'
  | 'description'
  | 'labelColor'
  | 'iconColor'
  | 'pageKey'
  | 'routePattern'
> & {
  path?: string;
  active?: boolean;
  presentation?: ShellNavigationItemPresentation;
  children?: ShellNavigationItem[];
};

export type ShellNavigationGroup = Pick<NavigationManifestGroup, 'heading' | 'icon'> & {
  items: ShellNavigationItem[];
};

export type ShellNavigationCommonProps = {
  groups: readonly ShellNavigationGroup[];
  ariaLabel?: string;
  className?: string;
  currentPath?: string;
  onNavigate?: (path: string, item: ShellNavigationItem) => void;
  getItemHref?: (item: ShellNavigationItem) => string | undefined;
  isItemActive?: (item: ShellNavigationItem, currentPath: string) => boolean;
  renderIcon?: (icon: string, item?: ShellNavigationItem) => ReactNode;
  density?: 'compact' | 'default' | 'relaxed';
  alignment?: 'start' | 'center' | 'end' | 'space-between';
  presentation?: {
    showIcons?: boolean;
    labelMode?: 'label' | 'icon-and-label' | 'icon-only';
    activeIndicator?: 'bar' | 'pill' | 'underline' | 'surface';
    groupDefault?: 'collapsed' | 'expanded-active' | 'expanded-all';
    groupExpansion?: 'accordion' | 'multiple';
    groupStyle?: 'plain' | 'divided' | 'cards';
    showBadges?: boolean;
    utilities?: Array<'search' | 'profile' | 'notifications'>;
  };
};

export const getShellNavigationItemHref = (item: ShellNavigationItem): string | undefined => {
  const path = item.path?.trim();
  return path?.startsWith('/') ? path : undefined;
};

export const isShellNavigationItemActive = (
  item: ShellNavigationItem,
  currentPath: string,
): boolean => {
  if (item.active != null) return item.active;
  const href = getShellNavigationItemHref(item);
  if (!href) return false;
  return currentPath === href || (href !== '/' && currentPath.startsWith(`${href}/`));
};

export const countShellNavigationItems = (groups: readonly ShellNavigationGroup[]): number => {
  const count = (items: readonly ShellNavigationItem[]): number =>
    items.reduce(
      (total, item) =>
        total
        + (item.type === 'separator' ? 0 : 1)
        + (item.children ? count(item.children) : 0),
      0,
    );
  return groups.reduce((total, group) => total + count(group.items), 0);
};
