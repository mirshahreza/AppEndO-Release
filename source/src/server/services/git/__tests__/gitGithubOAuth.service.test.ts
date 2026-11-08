import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  __resetGithubOAuthSessionsForTests,
  getGithubOAuthSessionStatus,
  isGithubOAuthAvailable,
  resolveGithubOAuthConfig,
  startGithubOAuth,
} from '../gitGithubOAuth.service';

describe('gitGithubOAuth.service', () => {
  beforeEach(() => {
    __resetGithubOAuthSessionsForTests();
    vi.unstubAllEnvs();
  });

  it('reports unavailable when oauth env is missing', async () => {
    expect(await isGithubOAuthAvailable()).toBe(false);
    expect((await resolveGithubOAuthConfig()).available).toBe(false);
  });

  it('starts an oauth session when credentials are configured', async () => {
    vi.stubEnv('GIT_GITHUB_OAUTH_CLIENT_ID', 'client-id');
    vi.stubEnv('GIT_GITHUB_OAUTH_CLIENT_SECRET', 'client-secret');
    vi.stubEnv('APP_URL', 'http://localhost:3000');

    const started = await startGithubOAuth(7);

    expect(started.sessionId).toBeTruthy();
    expect(started.authorizeUrl).toContain('https://github.com/login/oauth/authorize');
    expect(started.authorizeUrl).toContain('client_id=client-id');
    expect(getGithubOAuthSessionStatus(started.sessionId).status).toBe('pending');
  });
});
