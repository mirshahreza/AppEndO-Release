import type { OAuthIdentityProviderAdapter } from '../../shared/api/contracts/systemExtensions/types';
import type { IdentityProviderConfig } from '../../shared/api/contracts/auth/identityProviders';

export const exchangeOAuthToken = async (input: {
  adapter: OAuthIdentityProviderAdapter;
  provider: IdentityProviderConfig;
  code: string;
  codeVerifier: string;
}) => {
  const clientId = input.provider.clientId?.trim() ?? '';
  const clientSecret = input.provider.clientSecret?.trim() ?? '';
  const redirectUri = input.provider.redirectUri?.trim() ?? '';

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('OAUTH_PROVIDER');
  }

  return input.adapter.exchangeToken({
    providerId: input.provider.id,
    code: input.code,
    codeVerifier: input.codeVerifier,
    redirectUri,
    clientId,
    clientSecret,
    issuerUrl: input.provider.issuerUrl,
  });
};

export const fetchOAuthProfile = async (input: {
  adapter: OAuthIdentityProviderAdapter;
  provider: IdentityProviderConfig;
  accessToken: string;
  idToken?: string;
}) => input.adapter.fetchProfile({
  accessToken: input.accessToken,
  idToken: input.idToken,
  issuerUrl: input.provider.issuerUrl,
});
