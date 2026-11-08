import { resolveCultureFromPathname } from '../../../core/culture/CultureUrlResolver';
import {
  ROOT_PORTAL_SEGMENT,
  STUDIO_MOUNT_ID,
  STUDIO_PORTAL_SEGMENT,
} from '../../../shared/api/contracts/platform/mountConstants';
import type {
  ApplicationScopeKind,
  ApplicationScopeRef,
  ApplicationScopeResolveInput,
} from '../../../shared/api/contracts/appendoo/applicationScope.types';
import { APPLICATION_SCOPE_RESOLVER_VERSION } from '../../../shared/api/contracts/appendoo/applicationScope.types';

export { APPLICATION_SCOPE_RESOLVER_VERSION };

const normalizePathSegments = (remainderPath: string): string[] => {
  const trimmed = remainderPath.trim();
  if (!trimmed || trimmed === '/') return [];
  return trimmed.replace(/^\/+/, '').split('/').filter(Boolean);
};

const parsePortalFromRemainder = (remainderPath: string): {
  portalSegment: string;
  pageSegments: string[];
} => {
  const segments = normalizePathSegments(remainderPath);
  if (segments.length === 0) {
    return { portalSegment: ROOT_PORTAL_SEGMENT, pageSegments: [] };
  }

  if (segments[0] === STUDIO_PORTAL_SEGMENT) {
    return {
      portalSegment: STUDIO_PORTAL_SEGMENT,
      pageSegments: segments.slice(1),
    };
  }

  return {
    portalSegment: segments[0],
    pageSegments: segments.slice(1),
  };
};

const inferPageKey = (explicitPageKey: string | undefined, pageSegments: string[]): string | undefined => {
  if (explicitPageKey?.trim()) return explicitPageKey.trim();
  if (pageSegments.length === 0) return undefined;
  return pageSegments.join('-').toLowerCase();
};

const resolveMountId = (portalSegment: string): string => (
  portalSegment === STUDIO_PORTAL_SEGMENT ? STUDIO_MOUNT_ID : portalSegment
);

const buildScopeKey = (parts: {
  kind: ApplicationScopeKind;
  mountId: string;
  pageKey?: string;
  packageId?: string;
}): string => {
  if (parts.kind === 'vertical_app') {
    return `vertical:${parts.packageId}`;
  }
  if (parts.kind === 'package') {
    return `package:${parts.packageId}`;
  }
  if (parts.pageKey) {
    return `platform:${parts.mountId}:page:${parts.pageKey}`;
  }
  return `platform:${parts.mountId}`;
};

/**
 * Resolve canonical ApplicationScopeRef from route path and optional hints.
 * Does not invent a parallel application registry — composes existing mount/package IDs.
 */
export const resolveApplicationScope = (
  input: ApplicationScopeResolveInput,
): ApplicationScopeRef | null => {
  const packageId = input.packageId?.trim() || input.ownerPackageId?.trim() || undefined;
  const kindHint = input.scopeKindHint;

  if (packageId && (kindHint === 'vertical_app' || kindHint === 'package')) {
    const kind = kindHint;
    return {
      kind,
      scopeKey: buildScopeKey({ kind, mountId: STUDIO_MOUNT_ID, packageId }),
      mountId: STUDIO_MOUNT_ID,
      packageId,
      ownerPackageId: input.ownerPackageId?.trim() || packageId,
    };
  }

  if (packageId && !input.path?.trim()) {
    return {
      kind: 'package',
      scopeKey: buildScopeKey({ kind: 'package', mountId: STUDIO_MOUNT_ID, packageId }),
      mountId: STUDIO_MOUNT_ID,
      packageId,
      ownerPackageId: input.ownerPackageId?.trim() || packageId,
    };
  }

  const path = input.path?.trim();
  if (!path) return null;

  const { cultureId, remainderPath } = resolveCultureFromPathname(path);
  const { portalSegment, pageSegments } = parsePortalFromRemainder(remainderPath);
  const mountId = resolveMountId(portalSegment);
  const pageKey = inferPageKey(input.pageKey, pageSegments);

  if (packageId) {
    const kind: ApplicationScopeKind = kindHint === 'vertical_app' ? 'vertical_app' : 'package';
    return {
      kind,
      scopeKey: buildScopeKey({ kind, mountId, packageId, pageKey }),
      mountId,
      cultureId,
      portalSegment,
      pageKey,
      packageId,
      ownerPackageId: input.ownerPackageId?.trim() || packageId,
    };
  }

  return {
    kind: 'platform',
    scopeKey: buildScopeKey({ kind: 'platform', mountId, pageKey }),
    mountId,
    cultureId,
    portalSegment,
    pageKey,
  };
};
