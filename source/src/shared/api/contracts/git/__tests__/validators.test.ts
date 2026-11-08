import { describe, expect, it } from 'vitest';
import { REDACTED_GIT_TOKEN } from '../constants';
import {
  mergeGitSettingsPatch,
  normalizeGitConnectRequest,
  normalizeGitSettings,
  parseGitRemoteOwnerRepo,
  redactGitSettings,
  validateGitConnectRequest,
  validateGitSettings,
  GitValidationError,
} from '../validators';

describe('git validators', () => {
  it('normalizes slim persisted defaults', () => {
    const settings = normalizeGitSettings(undefined);
    expect(settings.enabled).toBe(false);
    expect(settings.commitMessage?.autoGenerateEnabled).toBe(true);
    expect(settings.pr?.provider).toBe('github');
  });

  it('strips legacy remote/auth fields on normalize', () => {
    const settings = normalizeGitSettings({
      enabled: true,
      remoteUrl: 'https://github.com/org/repo.git',
      defaultBranch: 'main',
      localBranch: 'feature',
      auth: { kind: 'https_pat', token: 'secret' },
      commitMessage: { autoGenerateEnabled: false },
    });
    expect(settings.enabled).toBe(true);
    expect(settings).not.toHaveProperty('remoteUrl');
    expect(settings).not.toHaveProperty('defaultBranch');
    expect(settings).not.toHaveProperty('localBranch');
    expect(settings).not.toHaveProperty('auth');
    expect(settings.commitMessage?.autoGenerateEnabled).toBe(false);
  });

  it('parses github owner/repo from remote URL', () => {
    expect(parseGitRemoteOwnerRepo('https://github.com/org/repo.git')).toEqual({
      owner: 'org',
      repo: 'repo',
    });
    expect(parseGitRemoteOwnerRepo('git@github.com:org/repo.git')).toEqual({
      owner: 'org',
      repo: 'repo',
    });
  });

  it('redacts github oauth client secret on public settings', () => {
    const settings = normalizeGitSettings({
      enabled: true,
      githubOAuth: { clientId: 'id', clientSecret: 'secret' },
    });
    const publicSettings = redactGitSettings(settings);
    expect(publicSettings.githubOAuth?.clientId).toBe('id');
    expect(publicSettings.githubOAuth?.clientSecret).toBe(REDACTED_GIT_TOKEN);
  });

  it('merges patch without overwriting oauth secret when redacted placeholder is sent', () => {
    const current = normalizeGitSettings({
      enabled: true,
      githubOAuth: { clientId: 'id', clientSecret: 'stored-secret' },
    });
    const merged = mergeGitSettingsPatch(current, {
      githubOAuth: { clientId: 'id', clientSecret: REDACTED_GIT_TOKEN },
    });
    expect(merged.githubOAuth?.clientSecret).toBe('stored-secret');
  });

  it('disconnect patch only clears AppEndO integration flags', () => {
    const current = normalizeGitSettings({
      enabled: true,
      pr: { provider: 'github', owner: 'org', repo: 'repo' },
    });
    const merged = mergeGitSettingsPatch(current, {
      enabled: false,
      pr: {
        provider: 'github',
        owner: undefined,
        repo: undefined,
      },
    });
    expect(merged.enabled).toBe(false);
    expect(merged.pr?.owner).toBeUndefined();
    expect(merged.pr?.repo).toBeUndefined();
  });

  it('allows enabled settings without legacy remote fields', () => {
    const settings = normalizeGitSettings({ enabled: true });
    expect(() => validateGitSettings(settings)).not.toThrow();
  });

  it('normalizes git connect request', () => {
    const request = normalizeGitConnectRequest({
      mode: 'full',
      auth: { kind: 'https_pat', token: 'ghp_test' },
      repository: {
        connectToGithub: true,
        owner: 'org',
        repo: 'repo',
        defaultBranch: 'main',
        repoVisibility: 'private',
        existingRepoSync: 'use_workspace',
      },
    });
    expect(request.mode).toBe('full');
    expect(request.auth.kind).toBe('https_pat');
    expect(request.repository?.owner).toBe('org');
    expect(request.repository?.repo).toBe('repo');
  });

  it('validates connect request github fields', () => {
    const request = normalizeGitConnectRequest({
      mode: 'full',
      auth: { kind: 'https_pat', token: 'ghp_test' },
      repository: {
        connectToGithub: true,
        owner: 'org',
        repo: 'repo',
        defaultBranch: 'main',
      },
    });
    expect(() => validateGitConnectRequest(request)).not.toThrow();
  });

  it('requires auth for connect request', () => {
    const request = normalizeGitConnectRequest({
      mode: 'remoteOnly',
      auth: { kind: 'https_pat' },
    });
    expect(() => validateGitConnectRequest(request)).toThrow(GitValidationError);
  });
});
