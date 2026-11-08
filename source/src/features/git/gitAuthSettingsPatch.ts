import { REDACTED_GIT_TOKEN } from '../../shared/api/contracts/git/constants';
import type { GitAuthSettings, GitConnectAuthInput, GitSettings } from '../../shared/api/contracts/git/types';
import type { GitSettingsFormState } from './gitSettingsForm';

export const buildGitAuthSettingsPatch = (
  form: GitSettingsFormState,
): GitConnectAuthInput => ({
  kind: form.authKind,
  username: form.authUsername.trim() || undefined,
  token: form.authToken.trim() && form.authToken !== REDACTED_GIT_TOKEN
    ? form.authToken.trim()
    : undefined,
  tokenEnvKey: form.authTokenEnvKey.trim() || undefined,
  sshKeyPath: form.authSshKeyPath.trim() || undefined,
});

export const buildGitAuthClearPatch = (): GitAuthSettings => ({ kind: 'none' });

export const buildGitRemoteDisconnectPatch = (): Partial<GitSettings> => ({
  enabled: false,
  integrationSuppressed: true,
  pr: {
    provider: 'github',
    owner: undefined,
    repo: undefined,
  },
});
