import { describe, expect, it } from 'vitest';
import { githubOAuthAdapter } from '../adapter';

describe('github-oauth adapter', () => {
  it('builds an authorization URL with PKCE and scopes', () => {
    const url = githubOAuthAdapter.buildAuthorizationUrl({
      providerId: 'github-dev',
      redirectUri: 'http://localhost:3000/api/auth/oauth/github-dev/callback',
      state: 'session.state',
      codeChallenge: 'challenge',
      codeChallengeMethod: 'S256',
      clientId: 'gh-client',
      scopes: githubOAuthAdapter.defaultScopes,
    });

    const parsed = new URL(url);
    expect(parsed.origin).toBe('https://github.com');
    expect(parsed.pathname).toBe('/login/oauth/authorize');
    expect(parsed.searchParams.get('client_id')).toBe('gh-client');
    expect(parsed.searchParams.get('code_challenge')).toBe('challenge');
    expect(parsed.searchParams.get('scope')).toContain('user:email');
  });

  it('maps claims from profile and emails array', () => {
    const claims = githubOAuthAdapter.mapClaims({
      id: 42,
      login: 'octocat',
      name: 'The Octocat',
      primary_email: 'octocat@example.com',
      emails: [
        { email: 'octocat@example.com', primary: true, verified: true },
        { email: 'other@example.com', primary: false, verified: false },
      ],
    });

    expect(claims.subject).toBe('42');
    expect(claims.email).toBe('octocat@example.com');
    expect(claims.emailVerified).toBe(true);
    expect(claims.displayName).toBe('octocat');
  });

  it('falls back to verified email from emails array when primary_email is absent', () => {
    const claims = githubOAuthAdapter.mapClaims({
      id: '99',
      login: 'dev',
      emails: [
        { email: 'verified@example.com', primary: false, verified: true },
      ],
    });

    expect(claims.email).toBe('verified@example.com');
    expect(claims.emailVerified).toBe(true);
  });

  it('rejects profiles without id', () => {
    expect(() => githubOAuthAdapter.mapClaims({ login: 'ghost' })).toThrow('missing id');
  });
});
