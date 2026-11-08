/**
 * System Extensions — canonical taxonomy and identity-provider contract.
 * Design source: docs/architecture/system-extensions.md · identity-engine.md
 *
 * Incremental rollout: builtins register in ProviderRegistry at boot.
 * Operator config remains settings.json → auth.identityProviders[] (see identityProviders.ts).
 */

export type SystemExtensionType =
  | 'feature'
  | 'integration'
  | 'identity-provider'
  | 'culture-pack'
  | 'storage-adapter'
  | 'deployment-adapter';

/** Capabilities grantable to System Extensions (host-enforced). */
export type SystemExtensionCapability =
  | 'auth.read'
  | 'auth.callback'
  | 'profile.map'
  | 'claims.map'
  | 'culture.read'
  | 'culture.bundle'
  | 'culture.calendar';

/** Capabilities extensions must never receive by default. */
export const FORBIDDEN_SYSTEM_EXTENSION_CAPABILITIES = [
  'db.write',
  'filesystem.full',
  'runtime.override',
] as const;

export type IdentityProviderKind = 'oauth' | 'saml';

export type IdentityProviderExtension = {
  type: 'identity-provider';
  providerKind: IdentityProviderKind;
  id: string;
  label: string;
  enabled: boolean;
  trusted: true;
  signed: true;
  capabilities: SystemExtensionCapability[];
};

/** Normalized claims Core uses for link / provision — provider maps into this shape. */
export type NormalizedIdentityClaims = {
  subject: string;
  email?: string;
  emailVerified: boolean;
  givenName?: string;
  familyName?: string;
  displayName?: string;
  rawClaims?: Record<string, unknown>;
};

export type OAuthAuthorizationContext = {
  providerId: string;
  redirectUri: string;
  state: string;
  codeChallenge: string;
  codeChallengeMethod: 'S256';
  clientId: string;
  scopes: string[];
  /** OIDC issuer URL — required for microsoft-oauth and oidc-generic adapters. */
  issuerUrl?: string;
};

export type OAuthTokenExchangeContext = {
  providerId: string;
  code: string;
  codeVerifier: string;
  redirectUri: string;
  clientId: string;
  clientSecret: string;
  /** OIDC issuer URL — required for microsoft-oauth and oidc-generic adapters. */
  issuerUrl?: string;
};

export type OAuthProfileFetchContext = {
  accessToken: string;
  idToken?: string;
  issuerUrl?: string;
};

export type OAuthTokenExchangeResult = {
  accessToken: string;
  idToken?: string;
  tokenType?: string;
  expiresIn?: number;
  refreshToken?: string;
};

/**
 * OAuth / OIDC identity-provider adapter — implemented by System Extensions only.
 * Core Identity Engine orchestrates flow; adapter supplies IdP-specific details.
 */
export type OAuthIdentityProviderAdapter = {
  extension: IdentityProviderExtension;
  defaultScopes: string[];
  buildAuthorizationUrl: (ctx: OAuthAuthorizationContext) => string | Promise<string>;
  exchangeToken: (ctx: OAuthTokenExchangeContext) => Promise<OAuthTokenExchangeResult>;
  fetchProfile: (ctx: OAuthProfileFetchContext) => Promise<NormalizedIdentityClaims>;
  mapClaims: (raw: Record<string, unknown>) => NormalizedIdentityClaims;
};

/**
 * SAML identity-provider adapter — p-23.
 * Assertion validation orchestrated by Core; adapter supplies IdP metadata mapping.
 */
export type SamlIdentityProviderAdapter = {
  extension: IdentityProviderExtension;
  buildLoginRedirectUrl: (ctx: { providerId: string; relayState: string }) => string;
  validateAssertion: (ctx: {
    samlResponse: string;
    entryPoint: string;
    certificate: string;
    issuer: string;
  }) => Promise<NormalizedIdentityClaims>;
  mapAttributes: (attributes: Record<string, string | string[]>) => NormalizedIdentityClaims;
};

export type IdentityProviderAdapter = OAuthIdentityProviderAdapter | SamlIdentityProviderAdapter;

export const isOAuthIdentityProviderAdapter = (
  adapter: IdentityProviderAdapter,
): adapter is OAuthIdentityProviderAdapter => adapter.extension.providerKind === 'oauth';

export const isSamlIdentityProviderAdapter = (
  adapter: IdentityProviderAdapter,
): adapter is SamlIdentityProviderAdapter => adapter.extension.providerKind === 'saml';

export type CultureCalendarId = 'gregorian' | 'jalali' | 'hijri' | 'hebrew';

export type CulturePackCapability = 'culture.read' | 'culture.bundle' | 'culture.calendar';

export type CultureFontDefinition = {
  id: string;
  label: string;
  family: string;
  /** Present for uploaded platform web fonts. */
  url?: string;
  format?: 'woff2' | 'woff' | 'ttf' | 'otf';
};

export type CultureTypography = {
  fonts: CultureFontDefinition[];
  defaultFontId: string;
};

export type CulturePackExtension = {
  type: 'culture-pack';
  id: string;
  label: string;
  language: string;
  locale: string;
  calendar: CultureCalendarId;
  direction: 'ltr' | 'rtl';
  translationBundleId: string;
  defaultTimezone?: string;
  typography?: CultureTypography;
  enabled: boolean;
  trusted: true;
  signed: true;
  capabilities: CulturePackCapability[];
};

/** Culture-pack adapter — implemented by System Extensions only. Core owns calendar algorithms. */
export type CulturePackAdapter = {
  extension: CulturePackExtension;
  loadTranslationBundle: () => Promise<Record<string, string>>;
};

export const isCulturePackAdapter = (
  adapter: unknown,
): adapter is CulturePackAdapter => {
  if (!adapter || typeof adapter !== 'object') {
    return false;
  }

  const extension = (adapter as CulturePackAdapter).extension;
  return extension?.type === 'culture-pack';
};
