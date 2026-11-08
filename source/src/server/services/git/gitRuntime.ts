import type { GitAuthSettings, GitSettings } from '../../../shared/api/contracts/git/types';
import { DEFAULT_GIT_REMOTE_NAME } from '../../../shared/api/contracts/git/constants';
import { hasGitCredential, readGitCredentials } from './gitCredentialStore';
import { readGitDefaultBranch, readGitRemoteOrigin } from './gitNativeConfig';

export type GitRuntimeContext = {
  settings: GitSettings;
  remoteUrl: string;
  remoteName: string;
  defaultBranch: string;
  auth: GitAuthSettings;
  hasCredential: boolean;
};

export const resolveGitRuntime = async (settings: GitSettings): Promise<GitRuntimeContext> => {
  const auth = await readGitCredentials();
  const origin = await readGitRemoteOrigin(DEFAULT_GIT_REMOTE_NAME);
  const defaultBranch = (await readGitDefaultBranch(DEFAULT_GIT_REMOTE_NAME)) ?? 'main';

  return {
    settings,
    remoteUrl: origin?.remoteUrl ?? '',
    remoteName: origin?.remoteName ?? DEFAULT_GIT_REMOTE_NAME,
    defaultBranch,
    auth,
    hasCredential: hasGitCredential(),
  };
};
