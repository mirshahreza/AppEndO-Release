export type IdentityProviderKind =
  | 'google-oauth'
  | 'github-oauth'
  | 'microsoft-oauth'
  | 'oidc-generic'
  | 'saml';

/**
 * Operator config for identity providers (settings.json → auth.identityProviders[]).
 * Runtime adapters are System Extensions (`type: identity-provider`) — see
 * docs/architecture/identity-engine.md and systemExtensions/types.ts.
 * `kind` maps 1:1 to builtin extension id during incremental rollout.
 */
export type IdentityProviderConfig = {
  id: string;
  kind: IdentityProviderKind;
  label: string;
  enabled: boolean;
  autoProvision: boolean;
  defaultRoleId?: string;
  clientId?: string;
  clientSecret?: string;
  hasClientSecret?: boolean;
  redirectUri?: string;
  issuerUrl?: string;
  metadataUrl?: string;
  entryPoint?: string;
  certificate?: string;
};

export type IdentityProviderPublicConfig = IdentityProviderConfig & {
  hasClientSecret: boolean;
  hasCertificate: boolean;
};

export type AuthIdentitySettings = {
  identityProviders: IdentityProviderConfig[];
};
