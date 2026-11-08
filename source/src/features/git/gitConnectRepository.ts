import type { GitSettingsFormState } from './gitSettingsForm';

export type GitRepoVisibility = 'private' | 'public';

export type GitExistingRepoSync = 'use_workspace' | 'use_remote';

export type GitConnectRepositoryState = {
  connectToGithub: boolean;
  repoDescription: string;
  repoVisibility: GitRepoVisibility;
  existingRepoSync: GitExistingRepoSync;
};

export const REPO_VISIBILITY_OPTIONS = [
  { value: 'private' as const, label: 'Private' },
  { value: 'public' as const, label: 'Public' },
] as const;

export const createDefaultGitConnectRepositoryState = (): GitConnectRepositoryState => ({
  connectToGithub: false,
  repoDescription: '',
  repoVisibility: 'private',
  existingRepoSync: 'use_workspace',
});

export const buildGithubHttpsUrl = (owner: string, repo: string): string => {
  const normalizedOwner = owner.trim();
  const normalizedRepo = repo.trim().replace(/\.git$/i, '');
  if (!normalizedOwner || !normalizedRepo) {
    return '';
  }
  return `https://github.com/${normalizedOwner}/${normalizedRepo}.git`;
};

export const buildGithubWebUrl = (owner: string, repo: string): string => {
  const normalizedOwner = owner.trim();
  const normalizedRepo = repo.trim().replace(/\.git$/i, '');
  if (!normalizedOwner || !normalizedRepo) {
    return '';
  }
  return `https://github.com/${normalizedOwner}/${normalizedRepo}`;
};

export const resolveGithubAccountLabel = (form: GitSettingsFormState): string => {
  const username = form.authUsername.trim();
  if (username && username !== 'x-access-token') {
    return `${username} (GitHub)`;
  }
  if (form.prOwner.trim()) {
    return `${form.prOwner.trim()} (GitHub)`;
  }
  return 'GitHub account';
};

export const resolveGitDisconnectTargetLabel = (form: GitSettingsFormState): string => {
  const accountLabel = resolveGithubAccountLabel(form);
  if (accountLabel === 'GitHub account') {
    return 'GitHub';
  }
  if (accountLabel.endsWith(' (GitHub)')) {
    return accountLabel.slice(0, -' (GitHub)'.length);
  }
  return accountLabel;
};

export const resolveGithubOwner = (form: GitSettingsFormState): string => {
  if (form.prOwner.trim()) {
    return form.prOwner.trim();
  }
  const username = form.authUsername.trim();
  if (username && username !== 'x-access-token') {
    return username;
  }
  return '';
};

export const applyGithubRemoteToForm = (
  form: GitSettingsFormState,
  repository: GitConnectRepositoryState,
): GitSettingsFormState => {
  if (!repository.connectToGithub) {
    return {
      ...form,
      remoteUrl: '',
    };
  }

  const owner = resolveGithubOwner(form);
  const repo = form.prRepo.trim();
  const remoteUrl = buildGithubHttpsUrl(owner, repo);

  return {
    ...form,
    remoteUrl,
    prOwner: owner || form.prOwner,
    prRepo: repo || form.prRepo,
  };
};

export const resolveExistingRepoSyncOverrideMessage = (
  sync: GitExistingRepoSync,
  githubRepoRef: string | null,
  workspacePath: string,
): string | null => {
  if (sync === 'use_workspace') {
    if (githubRepoRef) {
      return `Based on this selection, the GitHub repository ${githubRepoRef} will be overwritten — remote history and files are forced to match your workspace.`;
    }
    return 'Based on this selection, the GitHub remote will be overwritten — remote history and files are forced to match your workspace.';
  }

  if (githubRepoRef) {
    const target = workspacePath.trim() || 'your workspace root';
    return `Based on this selection, your workspace at ${target} will be overwritten — local files are forced to match ${githubRepoRef} on GitHub.`;
  }
  return 'Based on this selection, your local workspace will be overwritten — local files are forced to match the GitHub remote.';
};

export const inferConnectRepositoryStateFromForm = (
  form: GitSettingsFormState,
): GitConnectRepositoryState => {
  const base = createDefaultGitConnectRepositoryState();
  const hasRemote = Boolean(form.remoteUrl.trim() || form.prRepo.trim());

  return {
    ...base,
    connectToGithub: hasRemote,
    repoDescription: base.repoDescription,
  };
};
