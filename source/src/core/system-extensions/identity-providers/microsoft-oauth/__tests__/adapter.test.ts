import { describe, expect, it, vi } from 'vitest';
import { __resetOidcDiscoveryCacheForTests, fetchOidcDiscovery } from '../../shared/oidcDiscovery';
import { mapMicrosoftClaims, mapOidcClaims } from '../../shared/mapOidcClaims';
import { microsoftOAuthAdapter } from '../adapter';
import { oidcGenericAdapter } from '../../oidc-generic/adapter';

describe('microsoft-oauth adapter', () => {
  it('registers as microsoft-oauth extension', () => {
    expect(microsoftOAuthAdapter.extension.id).toBe('microsoft-oauth');
    expect(microsoftOAuthAdapter.defaultScopes).toContain('openid');
  });

  it('maps Microsoft oid and email claims', () => {
    const claims = mapMicrosoftClaims({
      oid: 'ms-oid-1',
      email: 'user@contoso.com',
      email_verified: true,
      name: 'Contoso User',
    });

    expect(claims.subject).toBe('ms-oid-1');
    expect(claims.email).toBe('user@contoso.com');
    expect(claims.emailVerified).toBe(true);
  });
});

describe('oidc-generic adapter', () => {
  it('registers as oidc-generic extension', () => {
    expect(oidcGenericAdapter.extension.id).toBe('oidc-generic');
  });

  it('maps standard OIDC claims', () => {
    const claims = mapOidcClaims({
      sub: 'oidc-sub',
      email: 'user@example.com',
      email_verified: true,
      given_name: 'Test',
      family_name: 'User',
    });

    expect(claims.subject).toBe('oidc-sub');
    expect(claims.email).toBe('user@example.com');
    expect(claims.emailVerified).toBe(true);
    expect(claims.givenName).toBe('Test');
  });

  it('builds authorization URL from mocked discovery', async () => {
    __resetOidcDiscoveryCacheForTests();
    const originalFetch = global.fetch;
    global.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('.well-known/openid-configuration')) {
        return new Response(JSON.stringify({
          issuer: 'https://idp.example.com',
          authorization_endpoint: 'https://idp.example.com/oauth/authorize',
          token_endpoint: 'https://idp.example.com/oauth/token',
          userinfo_endpoint: 'https://idp.example.com/oauth/userinfo',
        }), { status: 200 });
      }
      return originalFetch(input);
    }) as typeof fetch;

    try {
      const url = await oidcGenericAdapter.buildAuthorizationUrl({
        providerId: 'oidc-dev',
        redirectUri: 'http://localhost:3000/api/auth/oauth/oidc-dev/callback',
        state: 'session.state',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        clientId: 'oidc-client',
        scopes: oidcGenericAdapter.defaultScopes,
        issuerUrl: 'https://idp.example.com',
      });

      expect(url).toContain('https://idp.example.com/oauth/authorize');
      expect(url).toContain('code_challenge=challenge');
      const discovery = await fetchOidcDiscovery('https://idp.example.com');
      expect(discovery.token_endpoint).toContain('/oauth/token');
    } finally {
      global.fetch = originalFetch;
      __resetOidcDiscoveryCacheForTests();
    }
  });
});
