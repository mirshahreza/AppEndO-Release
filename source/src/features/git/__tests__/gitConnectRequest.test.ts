import { describe, expect, it } from 'vitest';
import { buildGitConnectRequest } from '../gitConnectRequest';
import { createDefaultGitConnectRepositoryState } from '../gitConnectRepository';
import { createEmptyGitSettingsForm } from '../gitSettingsForm';

describe('buildGitConnectRequest', () => {
  it('builds a local-only full connect request', () => {
    const form = {
      ...createEmptyGitSettingsForm(),
      enabled: true,
      autoGenerateCommitMessage: true,
    };

    const request = buildGitConnectRequest(
      form,
      createDefaultGitConnectRepositoryState(),
      'full',
    );

    expect(request.mode).toBe('full');
    expect(request.auth.kind).toBe('none');
    expect(request.repository?.connectToGithub).toBe(false);
  });

  it('builds a github remote connect request', () => {
    const form = {
      ...createEmptyGitSettingsForm(),
      authKind: 'https_pat' as const,
      authToken: 'gho_test',
      authUsername: 'octocat',
      defaultBranch: 'main',
      prOwner: 'octocat',
      prRepo: 'demo',
    };

    const request = buildGitConnectRequest(
      form,
      {
        ...createDefaultGitConnectRepositoryState(),
        connectToGithub: true,
        repoVisibility: 'private',
        existingRepoSync: 'use_workspace',
      },
      'remoteOnly',
    );

    expect(request.mode).toBe('remoteOnly');
    expect(request.repository?.owner).toBe('octocat');
    expect(request.repository?.repo).toBe('demo');
    expect(request.repository?.defaultBranch).toBe('main');
    expect(request.pr).toEqual({ provider: 'github', owner: 'octocat', repo: 'demo' });
  });
});
