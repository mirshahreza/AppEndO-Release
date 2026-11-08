import type { IdentityProviderConfig } from '../../shared/api/contracts/auth/identityProviders';
import type { OAuthIdentityProviderAdapter } from '../../shared/api/contracts/systemExtensions/types';
import { githubOAuthAdapter } from '../system-extensions/identity-providers/github-oauth/adapter';
import { googleOAuthAdapter } from '../system-extensions/identity-providers/google-oauth/adapter';
import { microsoftOAuthAdapter } from '../system-extensions/identity-providers/microsoft-oauth/adapter';
import { oidcGenericAdapter } from '../system-extensions/identity-providers/oidc-generic/adapter';

export { assertMarketplaceCannotRegisterIdentityProvider } from './marketplaceIdentityProviderPolicy';

const BUILTIN_ADAPTERS: OAuthIdentityProviderAdapter[] = [
  googleOAuthAdapter,
  githubOAuthAdapter,
  microsoftOAuthAdapter,
  oidcGenericAdapter,
];

const adapterByKind = new Map<string, OAuthIdentityProviderAdapter>(
  BUILTIN_ADAPTERS.map((adapter) => [adapter.extension.id, adapter]),
);

let enabledProviders: IdentityProviderConfig[] = [];

export const bootstrapProviderRegistry = (providers: IdentityProviderConfig[]): void => {
  enabledProviders = providers.filter((item) => item.enabled);
};

export const listBuiltinOAuthAdapters = (): OAuthIdentityProviderAdapter[] => [...BUILTIN_ADAPTERS];

export const resolveOAuthAdapter = (kind: string): OAuthIdentityProviderAdapter | undefined => (
  adapterByKind.get(kind)
);

export const getEnabledIdentityProviders = (): IdentityProviderConfig[] => [...enabledProviders];

export const getEnabledIdentityProvider = (id: string): IdentityProviderConfig | undefined => (
  enabledProviders.find((item) => item.id === id)
);
