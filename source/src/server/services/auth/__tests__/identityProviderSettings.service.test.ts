import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Sequelize } from 'sequelize';
import * as githubAdapter from '../../../../core/system-extensions/identity-providers/github-oauth/adapter';
import * as googleAdapter from '../../../../core/system-extensions/identity-providers/google-oauth/adapter';
import * as microsoftAdapter from '../../../../core/system-extensions/identity-providers/microsoft-oauth/adapter';
import * as oidcAdapter from '../../../../core/system-extensions/identity-providers/oidc-generic/adapter';
import { IdentityProviderSettingsService } from '../identityProviderSettings.service';
import {
  startGitCredentialVaultForTests,
  stopGitCredentialVaultForTests,
} from '../../git/__tests__/gitCredentialVaultHarness';

describe('IdentityProviderSettingsService', () => {
  let tempDir = '';
  let settingsPath = '';
  let sequelize: Sequelize;

  afterEach(async () => {
    if (tempDir && fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
    if (sequelize) {
      await stopGitCredentialVaultForTests(sequelize);
    }
    vi.restoreAllMocks();
  });

  const createService = () => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-idp-service-'));
    settingsPath = path.join(tempDir, 'settings.json');
    fs.writeFileSync(settingsPath, JSON.stringify({ auth: { identityProviders: [] } }));
    return new IdentityProviderSettingsService(settingsPath);
  };

  const baseProvider = {
    id: 'google-dev',
    kind: 'google-oauth' as const,
    label: 'Google',
    enabled: true,
    autoProvision: true,
    clientId: 'client-id',
    clientSecret: 'client-secret',
    redirectUri: 'http://localhost:3000/api/auth/oauth/google-dev/callback',
  };

  beforeEach(async () => {
    sequelize = await startGitCredentialVaultForTests();
    vi.spyOn(googleAdapter, 'testGoogleOAuthReachability').mockResolvedValue({ ok: true, message: 'Google OK' });
    vi.spyOn(githubAdapter, 'testGithubOAuthReachability').mockResolvedValue({ ok: true, message: 'GitHub OK' });
    vi.spyOn(microsoftAdapter, 'testMicrosoftOAuthReachability').mockResolvedValue({ ok: true, message: 'Microsoft OK' });
    vi.spyOn(oidcAdapter, 'testOidcGenericReachability').mockResolvedValue({ ok: true, message: 'OIDC OK' });
  });

  it('redacts secrets when listing providers', async () => {
    const service = createService();
    await service.createProvider(baseProvider);

    const listed = (await service.listProviders()).body.identityProviders;
    expect(listed[0]?.hasClientSecret).toBe(true);
    expect(listed[0]?.clientSecret).toBe('••••••••');
  });

  it('tests google provider reachability', async () => {
    const service = createService();
    await service.createProvider(baseProvider);

    const result = await service.testProvider('google-dev');
    expect(result.body.success).toBe(true);
    expect(googleAdapter.testGoogleOAuthReachability).toHaveBeenCalled();
  });

  it('rejects redirect URI path mismatch before reachability test', async () => {
    const service = createService();
    await service.createProvider({
      ...baseProvider,
      redirectUri: 'http://localhost:3000/api/auth/oauth/wrong-id/callback',
    });

    await expect(service.testProvider('google-dev')).rejects.toThrow(
      '/api/auth/oauth/google-dev/callback',
    );
    expect(googleAdapter.testGoogleOAuthReachability).not.toHaveBeenCalled();
  });

  it('tests microsoft provider with issuerUrl', async () => {
    const service = createService();
    await service.createProvider({
      ...baseProvider,
      id: 'microsoft-dev',
      kind: 'microsoft-oauth',
      label: 'Microsoft',
      redirectUri: 'http://localhost:3000/api/auth/oauth/microsoft-dev/callback',
      issuerUrl: 'https://login.microsoftonline.com/common/v2.0',
    });

    const result = await service.testProvider('microsoft-dev');
    expect(result.body.success).toBe(true);
    expect(microsoftAdapter.testMicrosoftOAuthReachability).toHaveBeenCalledWith(
      'https://login.microsoftonline.com/common/v2.0',
      'client-id',
    );
  });

  it('returns failure message from reachability probe', async () => {
    vi.spyOn(githubAdapter, 'testGithubOAuthReachability').mockResolvedValueOnce({ ok: false, message: 'GitHub down' });
    const service = createService();
    await service.createProvider({
      ...baseProvider,
      id: 'github-dev',
      kind: 'github-oauth',
      label: 'GitHub',
      redirectUri: 'http://localhost:3000/api/auth/oauth/github-dev/callback',
    });

    const result = await service.testProvider('github-dev');
    expect(result.body.success).toBe(false);
    expect(result.body.message).toBe('GitHub down');
  });
});
