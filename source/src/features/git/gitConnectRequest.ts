import type { GitConnectMode, GitConnectRequest } from '../../shared/api/contracts/git/types';
import { buildGitAuthSettingsPatch } from './gitAuthSettingsPatch';
import type { GitConnectRepositoryState } from './gitConnectRepository';
import { resolveGithubOwner } from './gitConnectRepository';
import type { GitSettingsFormState } from './gitSettingsForm';

export const buildGitConnectRequest = (
  form: GitSettingsFormState,
  repository: GitConnectRepositoryState,
  mode: GitConnectMode,
): GitConnectRequest => {
  const owner = resolveGithubOwner(form);
  const repo = form.prRepo.trim();

  return {
    mode,
    auth: buildGitAuthSettingsPatch(form),
    repository: {
      connectToGithub: repository.connectToGithub,
      repoDescription: repository.repoDescription.trim() || undefined,
      repoVisibility: repository.repoVisibility,
      existingRepoSync: repository.existingRepoSync,
      owner: owner || undefined,
      repo: repo || undefined,
      defaultBranch: form.defaultBranch.trim() || undefined,
    },
    commitMessage: {
      autoGenerateEnabled: form.autoGenerateCommitMessage,
      template: form.commitMessageTemplate.trim() || undefined,
    },
    pr: repository.connectToGithub && owner && repo
      ? { provider: 'github', owner, repo }
      : undefined,
  };
};
