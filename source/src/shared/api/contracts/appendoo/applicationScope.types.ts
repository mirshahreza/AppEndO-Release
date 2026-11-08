/** Canonical application scope identity for AppEndoo V3 intelligence contracts. */
export type ApplicationScopeKind = 'platform' | 'package' | 'vertical_app';

export type ApplicationScopeRef = {
  kind: ApplicationScopeKind;
  /** Stable persistence key — canonical authority for V3 contracts. */
  scopeKey: string;
  mountId: string;
  cultureId?: string;
  portalSegment?: string;
  pageKey?: string;
  packageId?: string;
  ownerPackageId?: string;
};

export type ApplicationScopeResolveInput = {
  path?: string;
  pageKey?: string;
  packageId?: string | null;
  ownerPackageId?: string | null;
  scopeKindHint?: ApplicationScopeKind;
};

export const APPLICATION_SCOPE_RESOLVER_VERSION = '1.0.0';
