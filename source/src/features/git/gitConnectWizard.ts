import { REDACTED_GIT_TOKEN } from '../../shared/api/contracts/git/constants';
import type { GitAuthKind, GitAuthSettingsPublic, GitSettingsPublic, GitStatusPayload } from '../../shared/api/contracts/git/types';
import type { GitConnectRepositoryState } from './gitConnectRepository';
import { buildGithubHttpsUrl, resolveGithubOwner } from './gitConnectRepository';
import { createEmptyGitSettingsForm, type GitSettingsFormState } from './gitSettingsForm';

export type GitConnectAuthMethod = 'github_oauth' | 'https_pat' | 'ssh_key_path';

const GIT_CONNECT_AUTH_STEP_COUNT = 2;

export const GIT_CONNECT_WIZARD_STEPS = [
  {
    title: 'Sign-in method',
    description: 'Choose how AppEndO should authenticate with your Git remote.',
  },
  {
    title: 'Sign in',
    description: 'Complete sign-in or provide credentials for the method you selected.',
  },
  {
    title: 'Repository',
    description: 'Initialize a local repository and optionally create or connect a GitHub remote.',
  },
  {
    title: 'Finishing',
    description: 'Review your setup, then start to apply Git configuration.',
  },
] as const;

export const GIT_CONNECT_REPOSITORY_STEP_INDEX = GIT_CONNECT_AUTH_STEP_COUNT;

export const resolveInitialGitConnectStep = (hasStoredAuth: boolean): number => (
  hasStoredAuth ? GIT_CONNECT_REPOSITORY_STEP_INDEX : 0
);

export const buildGitConnectWizardSteps = (hasStoredAuth: boolean) => (
  GIT_CONNECT_WIZARD_STEPS.map((wizardStep, index) => ({
    ...wizardStep,
    disabled: hasStoredAuth && index < GIT_CONNECT_AUTH_STEP_COUNT,
  }))
);

export const resolveDefaultGitConnectAuthMethod = (): GitConnectAuthMethod => 'github_oauth';

export const authMethodToAuthKind = (method: GitConnectAuthMethod): GitAuthKind => (
  method === 'ssh_key_path' ? 'ssh_key_path' : 'https_pat'
);

export const inferAuthMethodFromForm = (
  form: GitSettingsFormState,
): GitConnectAuthMethod => {
  if (form.authKind === 'ssh_key_path') {
    return 'ssh_key_path';
  }

  if (form.authKind === 'https_pat' && form.authTokenEnvKey.trim()) {
    return 'https_pat';
  }

  if (form.authKind === 'https_pat' && form.authToken.trim()) {
    return 'github_oauth';
  }

  return resolveDefaultGitConnectAuthMethod();
};

export const applyAuthMethodToForm = (
  form: GitSettingsFormState,
  method: GitConnectAuthMethod,
): GitSettingsFormState => {
  const authKind = authMethodToAuthKind(method);
  const next: GitSettingsFormState = {
    ...form,
    authKind,
  };

  if (method === 'github_oauth') {
    next.authKind = 'https_pat';
  }

  if (authKind === 'ssh_key_path') {
    next.authToken = '';
    next.authTokenEnvKey = '';
  }

  if (authKind === 'https_pat' && method === 'https_pat') {
    next.authSshKeyPath = '';
  }

  return next;
};

export const hasStoredGitAuthFromServer = (
  auth: GitAuthSettingsPublic | undefined,
): boolean => {
  if (!auth) {
    return false;
  }

  if (auth.kind === 'ssh_key_path') {
    return Boolean(auth.sshKeyPath?.trim());
  }

  if (auth.kind === 'https_pat') {
    return Boolean(auth.hasToken || auth.tokenEnvKey?.trim());
  }

  return false;
};

export const hasFreshGitAuthInForm = (form: GitSettingsFormState): boolean => {
  if (form.authKind === 'ssh_key_path') {
    return Boolean(form.authSshKeyPath.trim());
  }

  if (form.authKind === 'https_pat') {
    const token = form.authToken.trim();
    return (
      Boolean(token && token !== REDACTED_GIT_TOKEN)
      || Boolean(form.authTokenEnvKey.trim())
    );
  }

  return false;
};

export const hasStoredGitAuth = (
  form: GitSettingsFormState,
  serverAuth?: GitAuthSettingsPublic,
): boolean => hasCompletedGitAuthForWizard(form, serverAuth);

export const hasCompletedGitAuthForWizard = (
  form: GitSettingsFormState,
  serverAuth?: GitAuthSettingsPublic,
): boolean => (
  hasStoredGitAuthFromServer(serverAuth) || hasFreshGitAuthInForm(form)
);

const hasHttpsCredentials = (
  form: GitSettingsFormState,
  serverAuth?: GitAuthSettingsPublic,
): boolean => hasCompletedGitAuthForWizard(form, serverAuth);

export const validateGitConnectWizardStep = (
  step: number,
  form: GitSettingsFormState,
  authMethod: GitConnectAuthMethod,
  githubOAuthAvailable: boolean,
  repository?: GitConnectRepositoryState,
  serverAuth?: GitAuthSettingsPublic,
): string | null => {
  if (step === 0) {
    return authMethod ? null : 'Choose a sign-in method to continue.';
  }

  if (step === 1) {
    if (authMethod === 'github_oauth') {
      if (!hasCompletedGitAuthForWizard(form, serverAuth)) {
        return 'Sign in with GitHub to continue.';
      }
      return null;
    }

    if (authMethod === 'https_pat' && !hasHttpsCredentials(form, serverAuth)) {
      return 'Enter a personal access token or token environment key.';
    }

    if (authMethod === 'ssh_key_path' && !form.authSshKeyPath.trim()) {
      return 'Enter the SSH key path on the server.';
    }

    return null;
  }

  if (step === 2) {
    const connectToGithub = repository?.connectToGithub ?? false;

    if (!connectToGithub) {
      return null;
    }

    if (!hasCompletedGitAuthForWizard(form, serverAuth)) {
      return 'Sign in with GitHub to continue.';
    }

    if (!form.defaultBranch.trim()) {
      return 'Default branch is required.';
    }

    const owner = resolveGithubOwner(form);
    if (!owner) {
      return 'GitHub owner is required.';
    }

    if (!form.prRepo.trim()) {
      return 'Repository name is required.';
    }

    if (!buildGithubHttpsUrl(owner, form.prRepo)) {
      return 'Enter a valid repository name.';
    }

    return null;
  }

  return null;
};

export type GitConnectWizardContext = {
  /** When true, always require sign-in steps even if credentials remain on disk. */
  requireFreshAuth?: boolean;
};

export const shouldSkipGitConnectAuthSteps = (
  form: GitSettingsFormState,
  serverAuth?: GitAuthSettingsPublic,
  context?: GitConnectWizardContext,
): boolean => {
  if (context?.requireFreshAuth === true) {
    return false;
  }

  return hasCompletedGitAuthForWizard(form, serverAuth);
};

export const buildGitConnectWizardForm = (
  settings: GitSettingsPublic | undefined,
  status?: GitStatusPayload,
): GitSettingsFormState => {
  const base = settings
    ? {
      enabled: settings.enabled,
      remoteUrl: status?.remoteUrl ?? '',
      defaultBranch: status?.defaultBranch ?? 'main',
      localBranch: status?.currentBranch ?? '',
      authKind: status?.auth.kind ?? 'none',
      authUsername: status?.auth.username ?? '',
      authToken: status?.auth.hasToken ? REDACTED_GIT_TOKEN : '',
      authTokenEnvKey: status?.auth.tokenEnvKey ?? '',
      authSshKeyPath: status?.auth.sshKeyPath ?? '',
      autoGenerateCommitMessage: settings.commitMessage?.autoGenerateEnabled ?? true,
      commitMessageTemplate: settings.commitMessage?.template ?? '',
      prOwner: settings.pr?.owner ?? '',
      prRepo: settings.pr?.repo ?? '',
    } satisfies GitSettingsFormState
    : createEmptyGitSettingsForm();

  const hasServerAuth = hasStoredGitAuthFromServer(status?.auth);
  const hasActiveRemote = Boolean(status?.remoteUrl?.trim());

  const next: GitSettingsFormState = {
    ...base,
    enabled: true,
  };

  if (!hasServerAuth) {
    next.authKind = 'none';
    next.authUsername = '';
    next.authToken = '';
    next.authTokenEnvKey = '';
    next.authSshKeyPath = '';
  }

  if (!hasActiveRemote) {
    next.remoteUrl = '';
    next.localBranch = '';
    next.prOwner = '';
    next.prRepo = '';
  }

  return next;
};
