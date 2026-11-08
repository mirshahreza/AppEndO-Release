import { REDACTED_GIT_TOKEN } from '../../shared/api/contracts/git/constants';
import type { GitAuthKind, GitSettings, GitSettingsPublic, GitStatusPayload } from '../../shared/api/contracts/git/types';

export type GitSettingsFormState = {
  enabled: boolean;
  remoteUrl: string;
  defaultBranch: string;
  localBranch: string;
  authKind: GitAuthKind;
  authUsername: string;
  authToken: string;
  authTokenEnvKey: string;
  authSshKeyPath: string;
  autoGenerateCommitMessage: boolean;
  commitMessageTemplate: string;
  prOwner: string;
  prRepo: string;
};

export const createEmptyGitSettingsForm = (): GitSettingsFormState => ({
  enabled: false,
  remoteUrl: '',
  defaultBranch: 'main',
  localBranch: '',
  authKind: 'none',
  authUsername: '',
  authToken: '',
  authTokenEnvKey: '',
  authSshKeyPath: '',
  autoGenerateCommitMessage: true,
  commitMessageTemplate: '',
  prOwner: '',
  prRepo: '',
});

export const toGitSettingsForm = (
  settings: GitSettingsPublic,
  status?: GitStatusPayload,
): GitSettingsFormState => ({
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
});

/** Validates AppEndO preference fields only — no remote/branch/auth requirements. */
export const validateGitPreferencesForm = (_form: GitSettingsFormState): string | null => null;

export const validateGitSettingsForm = (
  form: GitSettingsFormState,
  options?: { allowLocalOnly?: boolean },
): string | null => {
  if (!form.enabled) {
    return null;
  }

  const allowLocalOnly = options?.allowLocalOnly === true;
  const isLocalOnly = allowLocalOnly && !form.remoteUrl.trim();

  if (!allowLocalOnly && !form.remoteUrl.trim()) {
    return 'Remote URL is required when Git integration is enabled.';
  }

  if (!form.defaultBranch.trim()) {
    return 'Default branch is required when Git integration is enabled.';
  }

  if (isLocalOnly) {
    return null;
  }

  if (form.authKind === 'https_pat') {
    const hasToken = Boolean(form.authToken.trim() && form.authToken !== REDACTED_GIT_TOKEN);
    const hasEnvKey = Boolean(form.authTokenEnvKey.trim());
    if (!hasToken && !hasEnvKey) {
      return 'HTTPS PAT or token environment key is required for HTTPS authentication.';
    }
  }

  if (form.authKind === 'ssh_key_path' && !form.authSshKeyPath.trim()) {
    return 'SSH key path is required for SSH authentication.';
  }

  return null;
};

export const toGitSettingsPayload = (form: GitSettingsFormState): Partial<GitSettings> => ({
  enabled: form.enabled,
  commitMessage: {
    autoGenerateEnabled: form.autoGenerateCommitMessage,
    template: form.commitMessageTemplate.trim() || undefined,
  },
  pr: {
    provider: 'github',
    owner: form.prOwner.trim() || undefined,
    repo: form.prRepo.trim() || undefined,
  },
});

export const formatGitStatusLabel = (status: GitStatusPayload): string => {
  if (!status.isEnabled) {
    return 'Disabled';
  }
  if (!status.isRepository) {
    return 'No local repository';
  }
  if (!status.isConfigured) {
    return 'Not configured';
  }
  if (status.status === 'connected') {
    return 'Connected';
  }
  if (status.status === 'error') {
    return 'Error';
  }
  return 'Not configured';
};
