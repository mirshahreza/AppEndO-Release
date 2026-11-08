import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertGitRepository, getGitCurrentBranch } from '../../../core/ai/tools/native/git/gitRunner';
import { parseGitRemoteOwnerRepo } from '../../../shared/api/contracts/git/validators';
import type {
  GitPrCheckSummary,
  GitPrCheckSummaryState,
  GitPrStatusPayload,
  GitPullRequestSummary,
  GitSettings,
} from '../../../shared/api/contracts/git/types';
import { resolveGitToken } from './gitConnection';
import { readGitCredentials } from './gitCredentialStore';
import { resolveGitRuntime } from './gitRuntime';

const execFileAsync = promisify(execFile);

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';

type GitHubPullRequest = {
  number: number;
  title: string;
  state: string;
  html_url: string;
  head: { sha: string };
};

type GitHubCombinedStatus = {
  state: string;
  total_count: number;
  statuses: Array<{ state: string }>;
};

const mapCombinedStatusState = (state: string): GitPrCheckSummaryState => {
  switch (state) {
    case 'success':
      return 'success';
    case 'failure':
    case 'error':
      return 'failure';
    case 'pending':
      return 'pending';
    default:
      return 'unknown';
  }
};

const summarizeChecks = (combined: GitHubCombinedStatus): GitPrCheckSummary => {
  let success = 0;
  let failure = 0;
  let pending = 0;

  for (const status of combined.statuses) {
    if (status.state === 'success') {
      success += 1;
    } else if (status.state === 'failure' || status.state === 'error') {
      failure += 1;
    } else {
      pending += 1;
    }
  }

  const total = combined.total_count || combined.statuses.length;
  return {
    total,
    success,
    failure,
    pending,
    state: mapCombinedStatusState(combined.state),
  };
};

const resolveOwnerRepo = async (settings: GitSettings): Promise<{ owner?: string; repo?: string }> => {
  const owner = settings.pr?.owner?.trim();
  const repo = settings.pr?.repo?.trim();
  if (owner && repo) {
    return { owner, repo };
  }

  const runtime = await resolveGitRuntime(settings);
  return parseGitRemoteOwnerRepo(runtime.remoteUrl);
};

const readGithubTokenFromCredentialHelper = async (): Promise<string | null> => {
  const repoCheck = assertGitRepository();
  if (repoCheck.ok === false) {
    return null;
  }

  try {
    const input = 'protocol=https\nhost=github.com\n\n';
    const { stdout } = await execFileAsync('git', ['credential', 'fill'], {
      cwd: repoCheck.repoRoot,
      input,
      encoding: 'utf8',
      timeout: 5_000,
    });
    const passwordMatch = stdout.match(/^password=(.+)$/m);
    const token = passwordMatch?.[1]?.trim();
    return token || null;
  } catch {
    return null;
  }
};

export const resolveGithubApiToken = async (): Promise<string | null> => {
  const auth = await readGitCredentials();
  if (auth.kind === 'https_pat') {
    const token = resolveGitToken(auth);
    if (token) {
      return token;
    }
  }

  const envToken = String(process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN ?? '').trim();
  if (envToken) {
    return envToken;
  }

  return readGithubTokenFromCredentialHelper();
};

const githubFetch = async (url: string, token: string): Promise<Response> => (
  fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      'User-Agent': 'AppEndO-Git-Integration',
    },
  })
);

const fetchOpenPullRequest = async (
  owner: string,
  repo: string,
  branch: string,
  token: string,
): Promise<GitHubPullRequest | null> => {
  const head = `${owner}:${branch}`;
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/pulls?state=open&head=${encodeURIComponent(head)}&per_page=1`;
  const response = await githubFetch(url, token);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub pull request lookup failed (${response.status}): ${body.slice(0, 200)}`);
  }

  const pulls = await response.json() as GitHubPullRequest[];
  return pulls[0] ?? null;
};

const fetchCombinedStatus = async (
  owner: string,
  repo: string,
  ref: string,
  token: string,
): Promise<GitHubCombinedStatus> => {
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}/status`;
  const response = await githubFetch(url, token);

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`GitHub commit status lookup failed (${response.status}): ${body.slice(0, 200)}`);
  }

  return response.json() as Promise<GitHubCombinedStatus>;
};

export const resolveGitPrStatus = async (settings: GitSettings): Promise<GitPrStatusPayload> => {
  if (!settings.enabled) {
    return { available: false, reason: 'Git integration is disabled.' };
  }

  const token = await resolveGithubApiToken();
  if (!token) {
    return { available: false, reason: 'GitHub token is not configured. Sign in with GitHub or set GITHUB_TOKEN.' };
  }

  const { owner, repo } = await resolveOwnerRepo(settings);
  if (!owner || !repo) {
    return { available: false, reason: 'GitHub owner and repository could not be resolved.' };
  }

  const branch = await getGitCurrentBranch();
  if (!branch || branch === 'HEAD') {
    return { available: false, reason: 'Current branch is not available.' };
  }

  try {
    const pullRequest = await fetchOpenPullRequest(owner, repo, branch, token);
    if (!pullRequest) {
      return {
        available: true,
        branch,
        pullRequest: null,
      };
    }

    const combined = await fetchCombinedStatus(owner, repo, pullRequest.head.sha, token);
    const summary: GitPullRequestSummary = {
      number: pullRequest.number,
      title: pullRequest.title,
      state: pullRequest.state === 'open' ? 'open' : 'closed',
      htmlUrl: pullRequest.html_url,
      checks: summarizeChecks(combined),
    };

    return {
      available: true,
      branch,
      pullRequest: summary,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to load GitHub PR status.';
    return {
      available: false,
      branch,
      reason: message,
    };
  }
};
