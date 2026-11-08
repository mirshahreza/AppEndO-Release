import { createOidcOAuthAdapter } from '../shared/createOidcOAuthAdapter';
import { mapOidcClaims } from '../shared/mapOidcClaims';
import { testOidcDiscoveryReachability } from '../shared/oidcDiscovery';

export const oidcGenericAdapter = createOidcOAuthAdapter({
  extensionId: 'oidc-generic',
  label: 'OIDC (Generic)',
  defaultScopes: ['openid', 'email', 'profile'],
  mapClaims: mapOidcClaims,
});

export const testOidcGenericReachability = async (
  issuerUrl: string,
  clientId: string,
): Promise<{ ok: boolean; message: string }> => testOidcDiscoveryReachability(
  issuerUrl,
  clientId,
  'OIDC',
);
