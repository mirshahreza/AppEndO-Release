import { describe, expect, it } from 'vitest';
import { REDACTED_GIT_TOKEN } from '../../../shared/api/contracts/git/constants';
import {
  buildGitConnectWizardForm,
  buildGitConnectWizardSteps,
  GIT_CONNECT_REPOSITORY_STEP_INDEX,
  hasStoredGitAuth,
  hasStoredGitAuthFromServer,
  resolveInitialGitConnectStep,
  shouldSkipGitConnectAuthSteps,
  validateGitConnectWizardStep,
} from '../gitConnectWizard';
import { createDefaultGitConnectRepositoryState } from '../gitConnectRepository';
import { createEmptyGitSettingsForm } from '../gitSettingsForm';

describe('gitConnectWizard', () => {
  it('ignores redacted placeholder without server auth', () => {
    const form = {
      ...createEmptyGitSettingsForm(),
      authKind: 'https_pat' as const,
      authToken: REDACTED_GIT_TOKEN,
    };

    expect(hasStoredGitAuth(form)).toBe(false);
    expect(shouldSkipGitConnectAuthSteps(form)).toBe(false);
    expect(resolveInitialGitConnectStep(false)).toBe(0);
  });

  it('detects fresh oauth token auth from form', () => {
    const form = {
      ...createEmptyGitSettingsForm(),
      authKind: 'https_pat' as const,
      authToken: 'gho_live_token',
    };

    expect(hasStoredGitAuth(form)).toBe(true);
    expect(shouldSkipGitConnectAuthSteps(form)).toBe(true);
    expect(buildGitConnectWizardSteps(true)).toHaveLength(4);
    expect(buildGitConnectWizardSteps(true).slice(0, 2).every((step) => step.disabled)).toBe(true);
    expect(resolveInitialGitConnectStep(true)).toBe(GIT_CONNECT_REPOSITORY_STEP_INDEX);
  });

  it('detects stored HTTPS token auth from server snapshot', () => {
    const form = createEmptyGitSettingsForm();

    expect(hasStoredGitAuthFromServer({
      kind: 'https_pat',
      hasToken: true,
    })).toBe(true);
    expect(shouldSkipGitConnectAuthSteps(form, {
      kind: 'https_pat',
      hasToken: true,
    })).toBe(true);
  });

  it('detects stored SSH auth', () => {
    const form = {
      ...createEmptyGitSettingsForm(),
      authKind: 'ssh_key_path' as const,
      authSshKeyPath: '/home/deploy/.ssh/id_ed25519',
    };

    expect(hasStoredGitAuth(form)).toBe(true);
    expect(buildGitConnectWizardSteps(true).map((step) => step.title)).toEqual([
      'Sign-in method',
      'Sign in',
      'Repository',
      'Finishing',
    ]);
    expect(buildGitConnectWizardSteps(true).filter((step) => step.disabled)).toHaveLength(2);
  });

  it('keeps auth steps when credentials are missing', () => {
    const form = createEmptyGitSettingsForm();

    expect(hasStoredGitAuth(form)).toBe(false);
    expect(buildGitConnectWizardSteps(false)).toHaveLength(4);
    expect(buildGitConnectWizardSteps(false).every((step) => !step.disabled)).toBe(true);
    expect(resolveInitialGitConnectStep(false)).toBe(0);
  });

  it('accepts stored token on sign-in step validation when server auth exists', () => {
    const form = {
      ...createEmptyGitSettingsForm(),
      authKind: 'https_pat' as const,
      authToken: REDACTED_GIT_TOKEN,
    };
    const serverAuth = {
      kind: 'https_pat' as const,
      hasToken: true,
    };

    expect(
      validateGitConnectWizardStep(1, form, 'github_oauth', true, undefined, serverAuth),
    ).toBeNull();
  });

  it('requires github sign-in before advancing from sign-in step', () => {
    const form = createEmptyGitSettingsForm();

    expect(
      validateGitConnectWizardStep(1, form, 'github_oauth', true),
    ).toBe('Sign in with GitHub to continue.');
    expect(
      validateGitConnectWizardStep(1, form, 'github_oauth', false),
    ).toBe('Sign in with GitHub to continue.');
  });

  it('validates repository step with github owner and name when authenticated', () => {
    const form = {
      ...createEmptyGitSettingsForm(),
      authKind: 'https_pat' as const,
      authToken: 'gho_live_token',
      defaultBranch: 'main',
      prOwner: 'mirshahreza',
      prRepo: 'AppEndO',
    };
    const repository = {
      ...createDefaultGitConnectRepositoryState(),
      connectToGithub: true,
    };

    expect(
      validateGitConnectWizardStep(2, form, 'github_oauth', true, repository),
    ).toBeNull();
  });

  it('requires github auth when repository step enables github remote', () => {
    const form = {
      ...createEmptyGitSettingsForm(),
      defaultBranch: 'main',
      prOwner: 'mirshahreza',
      prRepo: 'AppEndO',
    };

    expect(
      validateGitConnectWizardStep(2, form, 'github_oauth', true, {
        ...createDefaultGitConnectRepositoryState(),
        connectToGithub: true,
      }),
    ).toBe('Sign in with GitHub to continue.');
  });

  it('requires default branch when github remote is enabled', () => {
    const form = {
      ...createEmptyGitSettingsForm(),
      authKind: 'https_pat' as const,
      authToken: 'gho_live_token',
      defaultBranch: '',
      prOwner: 'mirshahreza',
      prRepo: 'AppEndO',
    };

    expect(
      validateGitConnectWizardStep(2, form, 'github_oauth', true, {
        ...createDefaultGitConnectRepositoryState(),
        connectToGithub: true,
      }),
    ).toBe('Default branch is required.');
  });

  it('allows local-only repository step without github fields', () => {
    const form = createEmptyGitSettingsForm();

    expect(
      validateGitConnectWizardStep(2, form, 'github_oauth', true, {
        ...createDefaultGitConnectRepositoryState(),
        connectToGithub: false,
      }),
    ).toBeNull();
  });

  it('ignores stored server auth when fresh sign-in is required', () => {
    const form = createEmptyGitSettingsForm();

    expect(shouldSkipGitConnectAuthSteps(form, {
      kind: 'https_pat',
      hasToken: true,
    }, { requireFreshAuth: true })).toBe(false);
    expect(resolveInitialGitConnectStep(false)).toBe(0);
  });

  it('skips auth steps when server auth exists but git integration is not enabled yet', () => {
    const form = buildGitConnectWizardForm(
      {
        enabled: false,
        commitMessage: {
          autoGenerateEnabled: true,
        },
        pr: {
          provider: 'github',
        },
      },
      {
        status: 'not_configured',
        isEnabled: false,
        isConfigured: false,
        isRepository: false,
        integrationSuppressed: false,
        currentBranch: null,
        workspacePath: '/workspace',
        lastError: null,
        remoteUrl: null,
        remoteName: null,
        defaultBranch: null,
        hasCredential: true,
        usesNativeAuth: false,
        auth: {
          kind: 'https_pat',
          hasToken: true,
          username: 'octocat',
        },
      },
    );

    expect(form.authKind).toBe('https_pat');
    expect(form.authToken).toBe(REDACTED_GIT_TOKEN);
    expect(shouldSkipGitConnectAuthSteps(form, {
      kind: 'https_pat',
      hasToken: true,
    })).toBe(true);
    expect(resolveInitialGitConnectStep(true)).toBe(GIT_CONNECT_REPOSITORY_STEP_INDEX);
  });

  it('builds a fresh wizard form after disconnect', () => {
    const form = buildGitConnectWizardForm({
      enabled: false,
      commitMessage: {
        autoGenerateEnabled: true,
      },
      pr: {
        provider: 'github',
      },
    });

    expect(form.enabled).toBe(true);
    expect(form.authKind).toBe('none');
    expect(form.authUsername).toBe('');
    expect(form.authToken).toBe('');
    expect(form.prOwner).toBe('');
    expect(form.prRepo).toBe('');
    expect(form.remoteUrl).toBe('');
  });

  it('hydrates remote and branch fields from native status snapshot', () => {
    const form = buildGitConnectWizardForm(
      {
        enabled: true,
        commitMessage: { autoGenerateEnabled: true },
        pr: { provider: 'github', owner: 'octocat', repo: 'demo' },
      },
      {
        status: 'connected',
        isEnabled: true,
        isConfigured: true,
        isRepository: true,
        integrationSuppressed: false,
        currentBranch: 'develop',
        workspacePath: '/workspace',
        lastError: null,
        remoteUrl: 'https://github.com/octocat/demo.git',
        remoteName: 'origin',
        defaultBranch: 'main',
        hasCredential: true,
        usesNativeAuth: false,
        auth: {
          kind: 'https_pat',
          hasToken: true,
          username: 'octocat',
        },
      },
    );

    expect(form.remoteUrl).toBe('https://github.com/octocat/demo.git');
    expect(form.defaultBranch).toBe('main');
    expect(form.localBranch).toBe('develop');
    expect(form.prOwner).toBe('octocat');
    expect(form.prRepo).toBe('demo');
  });
});
