import { describe, expect, it } from 'vitest';
import {
  applyGithubRemoteToForm,
  buildGithubHttpsUrl,
  buildGithubWebUrl,
  createDefaultGitConnectRepositoryState,
  inferConnectRepositoryStateFromForm,
  resolveGithubAccountLabel,
  resolveGithubOwner,
  resolveGitDisconnectTargetLabel,
  resolveExistingRepoSyncOverrideMessage,
} from '../gitConnectRepository';
import { createEmptyGitSettingsForm } from '../gitSettingsForm';

describe('gitConnectRepository', () => {
  it('builds github URLs from owner and repo', () => {
    expect(buildGithubHttpsUrl('org', 'repo')).toBe('https://github.com/org/repo.git');
    expect(buildGithubWebUrl('org', 'repo')).toBe('https://github.com/org/repo');
  });

  it('resolves owner from form fields', () => {
    const form = {
      ...createEmptyGitSettingsForm(),
      prOwner: 'my-org',
      authUsername: 'ignored-user',
    };
    expect(resolveGithubOwner(form)).toBe('my-org');
  });

  it('applies github remote to form when connect is enabled', () => {
    const form = {
      ...createEmptyGitSettingsForm(),
      prOwner: 'mirshahreza',
      prRepo: 'ConsoleApp1',
    };
    const next = applyGithubRemoteToForm(form, {
      ...createDefaultGitConnectRepositoryState(),
      connectToGithub: true,
    });
    expect(next.remoteUrl).toBe('https://github.com/mirshahreza/ConsoleApp1.git');
  });

  it('clears remote URL for local-only connect', () => {
    const form = {
      ...createEmptyGitSettingsForm(),
      remoteUrl: 'https://github.com/org/repo.git',
    };
    const next = applyGithubRemoteToForm(form, {
      ...createDefaultGitConnectRepositoryState(),
      connectToGithub: false,
    });
    expect(next.remoteUrl).toBe('');
  });

  it('resolves disconnect target label from account fields', () => {
    expect(resolveGitDisconnectTargetLabel(createEmptyGitSettingsForm())).toBe('GitHub');
    expect(resolveGitDisconnectTargetLabel({
      ...createEmptyGitSettingsForm(),
      authUsername: 'octocat',
    })).toBe('octocat');
    expect(resolveGitDisconnectTargetLabel({
      ...createEmptyGitSettingsForm(),
      prOwner: 'my-org',
    })).toBe('my-org');
  });

  it('describes existing repo sync override targets', () => {
    expect(resolveExistingRepoSyncOverrideMessage(
      'use_workspace',
      'owner/repo',
      '/workspace',
    )).toContain('owner/repo');
    expect(resolveExistingRepoSyncOverrideMessage(
      'use_remote',
      'owner/repo',
      '/workspace',
    )).toContain('/workspace');
  });

  it('infers github connect state from status-derived remote fields', () => {
    const form = {
      ...createEmptyGitSettingsForm(),
      remoteUrl: 'https://github.com/octocat/demo.git',
      prRepo: 'demo',
    };

    expect(inferConnectRepositoryStateFromForm(form)).toEqual({
      connectToGithub: true,
      repoDescription: '',
      repoVisibility: 'private',
      existingRepoSync: 'use_workspace',
    });
  });

  it('treats local-only connect when remote URL and repo name are empty', () => {
    const form = createEmptyGitSettingsForm();

    expect(inferConnectRepositoryStateFromForm(form).connectToGithub).toBe(false);
  });

  it('resolves github account label from auth username or owner', () => {
    expect(resolveGithubAccountLabel({
      ...createEmptyGitSettingsForm(),
      authUsername: 'octocat',
    })).toBe('octocat (GitHub)');

    expect(resolveGithubAccountLabel({
      ...createEmptyGitSettingsForm(),
      prOwner: 'my-org',
    })).toBe('my-org (GitHub)');

    expect(resolveGithubAccountLabel(createEmptyGitSettingsForm())).toBe('GitHub account');
  });
});
