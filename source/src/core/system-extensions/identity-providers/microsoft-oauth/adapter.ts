import { createOidcOAuthAdapter } from '../shared/createOidcOAuthAdapter';
import { mapMicrosoftClaims } from '../shared/mapOidcClaims';
import { testOidcDiscoveryReachability } from '../shared/oidcDiscovery';

export const microsoftOAuthAdapter = createOidcOAuthAdapter({
  extensionId: 'microsoft-oauth',
  label: 'Microsoft',
  defaultScopes: ['openid', 'email', 'profile'],
  mapClaims: mapMicrosoftClaims,
});

export const testMicrosoftOAuthReachability = async (
  issuerUrl: string,
  clientId: string,
): Promise<{ ok: boolean; message: string }> => testOidcDiscoveryReachability(
  issuerUrl,
  clientId,
  'Microsoft',
);
