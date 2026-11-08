import { describe, expect, it } from 'vitest';
import { REDACTED_GIT_TOKEN } from '../../../shared/api/contracts/git/constants';
import { buildGitAuthSettingsPatch, buildGitAuthClearPatch, buildGitRemoteDisconnectPatch } from '../gitAuthSettingsPatch';
import { createEmptyGitSettingsForm } from '../gitSettingsForm';

describe('gitAuthSettingsPatch', () => {
  it('omits redacted token values from auth patch', () => {
    const patch = buildGitAuthSettingsPatch({
      ...createEmptyGitSettingsForm(),
      authKind: 'https_pat',
      authToken: REDACTED_GIT_TOKEN,
      authUsername: 'octocat',
    });

    expect(patch.token).toBeUndefined();
    expect(patch.username).toBe('octocat');
  });

  it('includes fresh token values in auth patch', () => {
    const patch = buildGitAuthSettingsPatch({
      ...createEmptyGitSettingsForm(),
      authKind: 'https_pat',
      authToken: 'ghp_live_token',
    });

    expect(patch.token).toBe('ghp_live_token');
  });

  it('clears auth credentials', () => {
    expect(buildGitAuthClearPatch()).toEqual({ kind: 'none' });
  });

  it('clears AppEndO integration flags on disconnect patch', () => {
    expect(buildGitRemoteDisconnectPatch()).toEqual({
      enabled: false,
      integrationSuppressed: true,
      pr: {
        provider: 'github',
        owner: undefined,
        repo: undefined,
      },
    });
  });
});
