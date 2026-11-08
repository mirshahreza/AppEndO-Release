import type { IdentityProviderConfig, IdentityProviderKind } from '../../../../shared/api/contracts/auth/identityProviders';

export type BuiltinIdentityProviderCatalogEntry = {
  kind: IdentityProviderKind;
  label: string;
  description: string;
  defaultId: string;
};

/** Built-in identity providers shipped with the platform (one row per adapter). */
export const BUILTIN_IDENTITY_PROVIDER_CATALOG: BuiltinIdentityProviderCatalogEntry[] = [
  {
    kind: 'google-oauth',
    label: 'Google',
    description: 'Sign in with Google OAuth 2.0 / OpenID Connect.',
    defaultId: 'google',
  },
  {
    kind: 'github-oauth',
    label: 'GitHub',
    description: 'Sign in with GitHub OAuth.',
    defaultId: 'github',
  },
  {
    kind: 'microsoft-oauth',
    label: 'Microsoft',
    description: 'Sign in with Microsoft Entra ID / Azure AD (OIDC).',
    defaultId: 'microsoft',
  },
  {
    kind: 'oidc-generic',
    label: 'OIDC (Generic)',
    description: 'Sign in with any standard OIDC provider (Keycloak, Auth0, Okta, Authentik, …).',
    defaultId: 'oidc',
  },
];

export const IDENTITY_PROVIDER_KIND_OPTIONS: Array<{ value: IdentityProviderKind; label: string }> =
  BUILTIN_IDENTITY_PROVIDER_CATALOG.map((entry) => ({
    value: entry.kind,
    label: entry.label,
  }));

export const buildDefaultIdentityProviderRedirectUri = (providerId: string): string => {
  if (typeof window === 'undefined') return '';
  return `${window.location.origin}/api/auth/oauth/${providerId}/callback`;
};

export const EMPTY_IDENTITY_PROVIDER_FORM: IdentityProviderConfig = {
  id: '',
  kind: 'google-oauth',
  label: '',
  enabled: false,
  autoProvision: true,
  defaultRoleId: 'role_user',
  clientId: '',
  clientSecret: '',
  redirectUri: '',
  issuerUrl: '',
};

export const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  oauth_denied: 'Sign-in was cancelled or denied by the identity provider.',
  oauth_state: 'Sign-in session expired. Please try again.',
  oauth_provider: 'Identity provider sign-in failed. Check server configuration.',
  oauth_no_account: 'No account is linked to this identity. Contact an administrator.',
  oauth_link_denied: 'Account linking was denied because the external email is not verified.',
};
