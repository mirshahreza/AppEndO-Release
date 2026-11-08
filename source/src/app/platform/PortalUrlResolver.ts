import {
  STUDIO_PORTAL_SEGMENT,
  HOME_SHELL_KEY,
  ROOT_PORTAL_SEGMENT,
} from '../../shared/api/contracts/platform/mountConstants';
import type { PlatformRuntimeConfig } from '../../shared/api/contracts/platform/types';
import { getEnabledCulturePackIds } from '../../core/culture/CultureRegistry';
import { resolveCultureFromPathname } from '../../core/culture/CultureUrlResolver';
import {
  getShellByKey,
  isHawietyPortalPublishedInConfig,
  remainderMatchesStudioRoute,
  resolveShellRuleForPath,
} from './platformConfigHelpers';
import { HAWIETY_PORTAL_SEGMENT } from '../../core/packages/hawietyPackage';

export type ResolvedPortalPath = {
  portalSegment: string;
  shellKey: string;
  pageRemainderPath: string;
};

function buildRemainderPath(segments: string[]): string {
  if (segments.length === 0) {
    return '/';
  }

  return `/${segments.join('/')}`;
}

function normalizeRemainderPath(remainderPath: string): string[] {
  const trimmed = remainderPath.trim();
  if (!trimmed || trimmed === '/') {
    return [];
  }

  return trimmed.replace(/^\/+/, '').split('/').filter(Boolean);
}

export function resolvePortalFromRemainderPath(
  remainderPath: string,
  config: PlatformRuntimeConfig,
  mountId?: string,
): ResolvedPortalPath {
  const segments = normalizeRemainderPath(remainderPath);

  if (segments.length === 0) {
    return {
      portalSegment: ROOT_PORTAL_SEGMENT,
      shellKey: HOME_SHELL_KEY,
      pageRemainderPath: '/',
    };
  }

  const firstSegment = segments[0];

  if (firstSegment === STUDIO_PORTAL_SEGMENT) {
    return {
      portalSegment: STUDIO_PORTAL_SEGMENT,
      shellKey: STUDIO_PORTAL_SEGMENT,
      pageRemainderPath: buildRemainderPath(segments.slice(1)),
    };
  }

  if (firstSegment === HAWIETY_PORTAL_SEGMENT && !isHawietyPortalPublishedInConfig(config)) {
    return {
      portalSegment: firstSegment,
      shellKey: firstSegment,
      pageRemainderPath: buildRemainderPath(segments.slice(1)),
    };
  }

  const shell = getShellByKey(config, firstSegment);
  if (shell?.enabled) {
    return {
      portalSegment: firstSegment,
      shellKey: shell.shellKey,
      pageRemainderPath: buildRemainderPath(segments.slice(1)),
    };
  }

  const pageRemainderPath = buildRemainderPath(segments);
  if (remainderMatchesStudioRoute(config, pageRemainderPath, mountId)) {
    return {
      portalSegment: STUDIO_PORTAL_SEGMENT,
      shellKey: STUDIO_PORTAL_SEGMENT,
      pageRemainderPath,
    };
  }

  return {
    portalSegment: ROOT_PORTAL_SEGMENT,
    shellKey: HOME_SHELL_KEY,
    pageRemainderPath,
  };
}

export type ResolvedExperiencePortalPath = ResolvedPortalPath & {
  cultureId: string;
};

export function resolvePortalFromPathname(
  pathname: string,
  config: PlatformRuntimeConfig,
): ResolvedExperiencePortalPath {
  const { cultureId, remainderPath } = resolveCultureFromPathname(pathname);
  const application = resolvePortalFromRemainderPath(remainderPath, config, cultureId);

  return {
    cultureId,
    ...application,
  };
}

function portalUsesExplicitShellSegment(
  remainderPath: string,
  config: PlatformRuntimeConfig,
): boolean {
  const segments = normalizeRemainderPath(remainderPath);
  if (segments.length === 0) {
    return false;
  }

  const firstSegment = segments[0];
  if (firstSegment === STUDIO_PORTAL_SEGMENT) {
    return true;
  }

  return Boolean(getShellByKey(config, firstSegment)?.enabled);
}

function pathnameHasExplicitCulture(pathname: string): boolean {
  const segments = pathname.replace(/^\/+/, '').split('/').filter(Boolean);
  if (segments.length === 0) {
    return false;
  }

  return getEnabledCulturePackIds().includes(segments[0]);
}

function isEnabledDesignerShellRule(
  shellRule: ReturnType<typeof resolveShellRuleForPath>,
  config: PlatformRuntimeConfig,
): shellRule is NonNullable<typeof shellRule> {
  if (!shellRule) {
    return false;
  }

  const ruleShell = getShellByKey(config, shellRule.shellKey);
  return Boolean(ruleShell?.enabled && ruleShell.surface === 'designer');
}

/** URL portal segment first; designer shell-rule wins on `/studio/client-components` mount paths. */
export function resolvePortalShellFromPathname(
  pathname: string,
  config: PlatformRuntimeConfig,
  mountId: string,
): ResolvedExperiencePortalPath {
  const { cultureId, remainderPath } = resolveCultureFromPathname(pathname);
  const shellRule = resolveShellRuleForPath(config, mountId, pathname);
  const application = resolvePortalFromRemainderPath(remainderPath, config, mountId);

  if (isEnabledDesignerShellRule(shellRule, config)) {
    return {
      cultureId,
      portalSegment: pathnameHasExplicitCulture(pathname)
        ? application.portalSegment
        : shellRule.shellKey,
      shellKey: shellRule.shellKey,
      pageRemainderPath: pathnameHasExplicitCulture(pathname)
        ? application.pageRemainderPath
        : remainderPath,
    };
  }

  const resolved: ResolvedExperiencePortalPath = { cultureId, ...application };

  if (portalUsesExplicitShellSegment(remainderPath, config)) {
    return resolved;
  }

  if (!shellRule) {
    return resolved;
  }

  const ruleShell = getShellByKey(config, shellRule.shellKey);
  if (!ruleShell?.enabled || ruleShell.surface !== 'designer') {
    return resolved;
  }

  return {
    ...resolved,
    portalSegment: shellRule.shellKey,
    shellKey: shellRule.shellKey,
  };
}
