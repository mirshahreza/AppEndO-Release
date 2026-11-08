export type GitGithubOAuthAvailability = {
  available: boolean;
  redirectUri?: string;
  setupHint?: string;
};

export type GitGithubOAuthStartResult = {
  authorizeUrl: string;
  sessionId: string;
};

export type GitGithubOAuthSessionStatus = {
  status: 'pending' | 'complete' | 'error';
  username?: string;
  accessToken?: string;
  error?: string;
};

export const GIT_GITHUB_OAUTH_MESSAGE_TYPE = 'appendo-git-github-oauth';

export type GitGithubOAuthMessage = {
  type: typeof GIT_GITHUB_OAUTH_MESSAGE_TYPE;
  sessionId: string;
  status: 'complete' | 'error';
  username?: string;
  accessToken?: string;
  error?: string;
};
