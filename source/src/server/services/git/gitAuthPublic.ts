import type { GitAuthSettings, GitAuthSettingsPublic } from '../../../shared/api/contracts/git/types';
import { REDACTED_GIT_TOKEN } from '../../../shared/api/contracts/git/constants';
import { resolveGitToken } from './gitConnection';

export const toGitAuthSettingsPublic = (auth: GitAuthSettings): GitAuthSettingsPublic => {
  const hasToken = Boolean(resolveGitToken(auth));
  return {
    kind: auth.kind,
    username: auth.username,
    token: hasToken ? REDACTED_GIT_TOKEN : undefined,
    hasToken,
    tokenEnvKey: auth.tokenEnvKey,
    sshKeyPath: auth.sshKeyPath,
  };
};
