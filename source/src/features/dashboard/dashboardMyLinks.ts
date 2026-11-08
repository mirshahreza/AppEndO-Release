import type { LucideIcon } from 'lucide-react';
import {
  Braces,
  Inbox,
  KeyRound,
  LogOut,
  MonitorSmartphone,
  Table,
  Trash2,
} from 'lucide-react';
import type { AuthUserLike } from '../../app/guards/roleAccess';
import { canAccessRouteBinding } from '../../app/guards/roleAccess';
import {
  getBindingsForMount,
  normalizeRoutePatternForNavPath,
  withNavLandingPath,
} from '../../app/platform/platformConfigHelpers';
import { STUDIO_MOUNT_ID } from '../../shared/api/contracts/platform/mountConstants';
import type { PlatformRuntimeConfig } from '../../shared/api/contracts/platform/types';
import { resolveStudioRelativeHref } from '../../shared/lib/studioRelativeHref';

export type DashboardMyLinkKind = 'route' | 'sessions' | 'password' | 'delete' | 'logout';

export type DashboardMyLinkTone = 'default' | 'muted' | 'danger';

export type DashboardMyLinkDef = {
  id: string;
  kind: DashboardMyLinkKind;
  pageKey?: 'my-inbox' | 'my-apis' | 'my-workbooks';
  labelKey: string;
  descriptionKey: string;
  icon: LucideIcon;
  tone: DashboardMyLinkTone;
};

export type DashboardMyLink = DashboardMyLinkDef & {
  path?: string;
};

export const listDashboardMyLinkDefs = (canDeleteAccount: boolean): DashboardMyLinkDef[] => {
  const links: DashboardMyLinkDef[] = [
    {
      id: 'my-inbox',
      kind: 'route',
      pageKey: 'my-inbox',
      labelKey: 'nav.my-inbox',
      descriptionKey: 'nav.my-inbox.description',
      icon: Inbox,
      tone: 'default',
    },
    {
      id: 'my-apis',
      kind: 'route',
      pageKey: 'my-apis',
      labelKey: 'nav.my-apis',
      descriptionKey: 'nav.my-apis.description',
      icon: Braces,
      tone: 'default',
    },
    {
      id: 'my-workbooks',
      kind: 'route',
      pageKey: 'my-workbooks',
      labelKey: 'nav.my-workbooks',
      descriptionKey: 'nav.my-workbooks.description',
      icon: Table,
      tone: 'default',
    },
    {
      id: 'active-sessions',
      kind: 'sessions',
      labelKey: 'profile.sections.activeSessions',
      descriptionKey: 'dashboard.myLinks.activeSessions.description',
      icon: MonitorSmartphone,
      tone: 'default',
    },
    {
      id: 'change-password',
      kind: 'password',
      labelKey: 'profile.actions.changePassword',
      descriptionKey: 'dashboard.myLinks.changePassword.description',
      icon: KeyRound,
      tone: 'default',
    },
  ];

  if (canDeleteAccount) {
    links.push({
      id: 'delete-account',
      kind: 'delete',
      labelKey: 'dashboard.myLinks.deleteAccount',
      descriptionKey: 'dashboard.myLinks.deleteAccount.description',
      icon: Trash2,
      tone: 'muted',
    });
  }

  links.push({
    id: 'logout',
    kind: 'logout',
    labelKey: 'dashboard.myLinks.logout',
    descriptionKey: 'dashboard.myLinks.logout.description',
    icon: LogOut,
    tone: 'default',
  });

  return links;
};

export const resolveDashboardAccountPagePath = (
  config: PlatformRuntimeConfig,
  pathname: string,
  mountId: string,
  currentUser: AuthUserLike,
  pageKey: string,
): string => {
  const binding = getBindingsForMount(config, STUDIO_MOUNT_ID).find((item) => item.pageKey === pageKey);
  const routeTarget = binding?.enabled && canAccessRouteBinding(binding, currentUser)
    ? withNavLandingPath(normalizeRoutePatternForNavPath(binding.routePattern))
    : pageKey;

  return resolveStudioRelativeHref(pathname, routeTarget, { config, mountId });
};

export const buildDashboardMyLinks = (input: {
  config: PlatformRuntimeConfig;
  pathname: string;
  mountId: string;
  currentUser: AuthUserLike;
  canDeleteAccount: boolean;
}): DashboardMyLink[] => {
  return listDashboardMyLinkDefs(input.canDeleteAccount).map((def) => {
    if (def.kind !== 'route' || !def.pageKey) {
      return def;
    }

    return {
      ...def,
      path: resolveDashboardAccountPagePath(
        input.config,
        input.pathname,
        input.mountId,
        input.currentUser,
        def.pageKey,
      ),
    };
  });
};
