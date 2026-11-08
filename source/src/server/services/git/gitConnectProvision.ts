import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type {
  GitConnectRequest,
  GitConnectResult,
  GitConnectStep,
  GitSettings,
} from '../../../shared/api/contracts/git/types';
import {
  mergeGitSettingsPatch,
  normalizeGitConnectRequest,
  normalizeGitSettings,
  redactGitSettings,
  resolveGitConnectRemoteUrl,
  validateGitConnectRequest,
  GitValidationError,
} from '../../../shared/api/contracts/git/validators';
import { DEFAULT_GIT_REMOTE_NAME, DEFAULT_GIT_SETTINGS } from '../../../shared/api/contracts/git/constants';
import { getRepoRoot } from '../../../core/ai/tools/pathAllowlist';
import { isDeniedPath } from '../../../core/ai/tools/pathAllowlist';
import {
  assertGitRepository,
  GIT_COMMAND_TIMEOUT_MS,
  validateGitBranchName,
} from '../../../core/ai/tools/native/git/gitRunner';
import { getGitSettingsFromFile, saveGitSettingsToFile } from '../../db/gitSettingsStore';
import { HttpError } from '../../errors/HttpError';
import { buildGitExecEnv, resolveGitToken } from './gitConnection';
import { writeGitCredentials } from './gitCredentialStore';
import { getGitChanges } from './gitWorkspace';
import {
  checkoutOrCreateBranch,
  ensureOriginRemote,
  ensureWorkspaceGitignore,
  initGitRepository,
  isGitRepository,
  setUpstreamTracking,
} from './gitNativeConfig';
import { resolveGitStatusSnapshot } from './gitConnection';
import { toGitAuthSettingsPublic } from './gitAuthPublic';
import { readGitCredentials } from './gitCredentialStore';

const execFileAsync = promisify(execFile);

const GITHUB_API_BASE = 'https://api.github.com';
const GITHUB_API_VERSION = '2022-11-28';

export type GitConnectProvisionDeps = {
  settingsPath: string;
};

type ProvisionContext = {
  request: GitConnectRequest;
  cwd: string;
  steps: GitConnectStep[];
  warnings: string[];
};

const pushStep = (
  ctx: ProvisionContext,
  step: GitConnectStep,
): void => {
  ctx.steps.push(step);
};

const githubFetch = async (url: string, token: string, init?: RequestInit): Promise<Response> => (
  fetch(url, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': GITHUB_API_VERSION,
      'User-Agent': 'AppEndO-Git-Integration',
      ...(init?.headers ?? {}),
    },
  })
);

const resolveGithubLogin = async (token: string): Promise<string | null> => {
  const response = await githubFetch(`${GITHUB_API_BASE}/user`, token);
  if (!response.ok) {
    return null;
  }
  const payload = await response.json() as { login?: string };
  return payload.login?.trim() || null;
};

const createGithubRepository = async (
  owner: string,
  repo: string,
  options: { description?: string; private: boolean },
  token: string,
): Promise<{ created: boolean; existed: boolean }> => {
  const login = await resolveGithubLogin(token);
  const body = {
    name: repo,
    description: options.description?.trim() || undefined,
    private: options.private,
  };

  const orgUrl = `${GITHUB_API_BASE}/orgs/${encodeURIComponent(owner)}/repos`;
  const userUrl = `${GITHUB_API_BASE}/user/repos`;

  const targetUrl = login && login.toLowerCase() === owner.toLowerCase()
    ? userUrl
    : orgUrl;

  const response = await githubFetch(targetUrl, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (response.status === 422) {
    return { created: false, existed: true };
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub repository create failed (${response.status}): ${text.slice(0, 200)}`);
  }

  return { created: true, existed: false };
};

const runGitCommand = async (
  args: readonly string[],
  cwd: string,
  env?: NodeJS.ProcessEnv,
): Promise<void> => {
  await execFileAsync('git', [...args], {
    cwd,
    timeout: GIT_COMMAND_TIMEOUT_MS,
    encoding: 'utf8',
    env,
  });
};

const hasAnyCommit = async (cwd: string): Promise<boolean> => {
  try {
    await runGitCommand(['rev-parse', 'HEAD'], cwd);
    return true;
  } catch {
    return false;
  }
};

const assertNoDeniedPathChanges = async (): Promise<void> => {
  const changes = await getGitChanges();
  const denied = changes.entries.filter((entry) => entry.denied || isDeniedPath(entry.path));
  if (denied.length > 0) {
    const paths = denied.map((entry) => entry.path).join(', ');
    throw new HttpError(
      400,
      `Cannot sync from remote: protected paths have local changes (${paths}).`,
    );
  }
};

const createInitialCommitIfNeeded = async (cwd: string): Promise<boolean> => {
  if (await hasAnyCommit(cwd)) {
    return false;
  }

  await runGitCommand(['add', '-A'], cwd);
  try {
    await runGitCommand(['commit', '-m', 'Initial commit'], cwd);
    return true;
  } catch {
    return false;
  }
};

const syncWorkspaceToRemote = async (
  ctx: ProvisionContext,
  branch: string,
  env: NodeJS.ProcessEnv,
  options: { force: boolean },
): Promise<void> => {
  const { cwd } = ctx;
  const created = await createInitialCommitIfNeeded(cwd);
  if (created) {
    pushStep(ctx, {
      id: 'initial_commit',
      label: 'Initial commit',
      status: 'success',
      message: 'Created an initial commit from the workspace.',
    });
  }

  const pushArgs = ['push'];
  if (options.force) {
    pushArgs.push('--force');
  } else {
    pushArgs.push('-u');
  }
  pushArgs.push(DEFAULT_GIT_REMOTE_NAME, `HEAD:refs/heads/${branch}`);

  await runGitCommand(pushArgs, cwd, env);
};

const syncRemoteToWorkspace = async (
  ctx: ProvisionContext,
  branch: string,
  env: NodeJS.ProcessEnv,
): Promise<void> => {
  await assertNoDeniedPathChanges();
  const { cwd } = ctx;

  await runGitCommand(['fetch', DEFAULT_GIT_REMOTE_NAME, branch], cwd, env);

  try {
    await runGitCommand(
      ['checkout', '-B', branch, `${DEFAULT_GIT_REMOTE_NAME}/${branch}`],
      cwd,
      env,
    );
  } catch {
    await runGitCommand(['reset', '--hard', `${DEFAULT_GIT_REMOTE_NAME}/${branch}`], cwd, env);
  }
};

const buildAppEndOSettingsPatch = (request: GitConnectRequest): Partial<GitSettings> => {
  const repository = request.repository;
  const owner = repository?.owner?.trim();
  const repo = repository?.repo?.trim()?.replace(/\.git$/i, '');

  const patch: Partial<GitSettings> = {
    enabled: true,
    integrationSuppressed: false,
  };

  if (request.commitMessage) {
    patch.commitMessage = request.commitMessage;
  }
  if (request.pr) {
    patch.pr = request.pr;
  } else if (owner && repo) {
    patch.pr = { provider: 'github', owner, repo };
  }

  return patch;
};

const remoteHasBranch = async (
  cwd: string,
  branch: string,
  env: NodeJS.ProcessEnv,
): Promise<boolean> => {
  try {
    const { stdout } = await execFileAsync('git', [
      'ls-remote',
      '--heads',
      DEFAULT_GIT_REMOTE_NAME,
      `refs/heads/${branch}`,
    ], {
      cwd,
      timeout: GIT_COMMAND_TIMEOUT_MS,
      encoding: 'utf8',
      env,
    });
    return Boolean(String(stdout ?? '').trim());
  } catch {
    return false;
  }
};

const toStatusPayload = async (settings: GitSettings) => {
  const snapshot = await resolveGitStatusSnapshot(settings);
  const auth = await readGitCredentials();

  let status: 'connected' | 'not_configured' | 'disabled' | 'no_repo' | 'error' = 'not_configured';
  if (!snapshot.isEnabled) {
    status = 'disabled';
  } else if (!snapshot.isRepository) {
    status = 'no_repo';
  } else if (!snapshot.isConfigured) {
    status = 'not_configured';
  } else if (snapshot.lastError) {
    status = 'error';
  } else {
    status = 'connected';
  }

  return {
    status,
    isEnabled: snapshot.isEnabled,
    isConfigured: snapshot.isConfigured,
    isRepository: snapshot.isRepository,
    integrationSuppressed: Boolean(settings.integrationSuppressed),
    currentBranch: snapshot.currentBranch,
    workspacePath: snapshot.workspacePath,
    lastError: snapshot.lastError,
    remoteUrl: snapshot.remoteUrl,
    remoteName: snapshot.remoteName,
    defaultBranch: snapshot.defaultBranch,
    hasCredential: snapshot.hasCredential,
    usesNativeAuth: snapshot.usesNativeAuth,
    auth: toGitAuthSettingsPublic(auth),
  };
};

export const provisionGitConnect = async (
  rawRequest: unknown,
  deps: GitConnectProvisionDeps,
): Promise<GitConnectResult> => {
  const request = normalizeGitConnectRequest(rawRequest);
  const ctx: ProvisionContext = {
    request,
    cwd: getRepoRoot(),
    steps: [],
    warnings: [],
  };

  try {
    validateGitConnectRequest(request);
  } catch (error: unknown) {
    if (error instanceof GitValidationError) {
      throw new HttpError(400, error.message);
    }
    throw error;
  }

  const isRemoteOnly = request.mode === 'remoteOnly';
  const repository = request.repository;
  const connectToGithub = repository?.connectToGithub === true;
  const defaultBranch = validateGitBranchName(repository?.defaultBranch ?? 'main') ?? 'main';
  const remoteUrl = resolveGitConnectRemoteUrl(request);

  if (isRemoteOnly && !isGitRepository(ctx.cwd)) {
    throw new HttpError(400, 'Remote-only connect requires an existing local git repository.');
  }

  if (isRemoteOnly && !connectToGithub) {
    throw new HttpError(400, 'Remote-only connect requires a GitHub remote configuration.');
  }

  await writeGitCredentials(request.auth);
  pushStep(ctx, {
    id: 'credentials',
    label: 'Credentials',
    status: 'success',
    message: 'Saved authentication credentials.',
  });

  if (!isRemoteOnly && !isGitRepository(ctx.cwd)) {
    await initGitRepository(defaultBranch, ctx.cwd);
    pushStep(ctx, {
      id: 'init',
      label: 'Initialize repository',
      status: 'success',
      message: `Initialized git repository with default branch ${defaultBranch}.`,
    });

    if (ensureWorkspaceGitignore(ctx.cwd)) {
      pushStep(ctx, {
        id: 'gitignore',
        label: 'Apply .gitignore',
        status: 'success',
        message: 'Created a standard workspace .gitignore file.',
      });
    } else {
      pushStep(ctx, {
        id: 'gitignore',
        label: 'Apply .gitignore',
        status: 'skipped',
        message: 'Workspace already has a .gitignore file.',
      });
    }
  } else if (!isRemoteOnly) {
    pushStep(ctx, {
      id: 'init',
      label: 'Initialize repository',
      status: 'skipped',
      message: 'Using existing local git repository.',
    });
  }

  const env = buildGitExecEnv(request.auth);
  const token = request.auth.kind === 'https_pat' ? resolveGitToken(request.auth) : '';

  if (connectToGithub && remoteUrl) {
    if (!isRemoteOnly && token) {
      const owner = repository?.owner?.trim() ?? '';
      const repo = repository?.repo?.trim()?.replace(/\.git$/i, '') ?? '';
      try {
        const createResult = await createGithubRepository(
          owner,
          repo,
          {
            description: repository?.repoDescription,
            private: repository?.repoVisibility !== 'public',
          },
          token,
        );

        if (createResult.created) {
          pushStep(ctx, {
            id: 'github_create',
            label: 'Create GitHub repository',
            status: 'success',
            message: `Created ${owner}/${repo} on GitHub.`,
          });
        } else if (createResult.existed) {
          pushStep(ctx, {
            id: 'github_create',
            label: 'Create GitHub repository',
            status: 'skipped',
            message: `Repository ${owner}/${repo} already exists on GitHub.`,
          });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'GitHub repository create failed.';
        pushStep(ctx, {
          id: 'github_create',
          label: 'Create GitHub repository',
          status: 'warning',
          message,
        });
        ctx.warnings.push(message);
      }
    } else if (!isRemoteOnly && !token) {
      pushStep(ctx, {
        id: 'github_create',
        label: 'Create GitHub repository',
        status: 'skipped',
        message: 'Skipped GitHub create — HTTPS token is required to create repositories.',
      });
    } else {
      pushStep(ctx, {
        id: 'github_create',
        label: 'Create GitHub repository',
        status: 'skipped',
        message: 'Remote-only mode skips GitHub repository creation.',
      });
    }

    const remoteResult = await ensureOriginRemote(remoteUrl, DEFAULT_GIT_REMOTE_NAME, ctx.cwd);
    if (remoteResult.action === 'added') {
      pushStep(ctx, {
        id: 'remote',
        label: 'Configure origin remote',
        status: 'success',
        message: `Added origin → ${remoteUrl}`,
      });
    } else if (remoteResult.action === 'updated') {
      const warning = `Origin URL changed from ${remoteResult.previousUrl} to ${remoteUrl}.`;
      ctx.warnings.push(warning);
      pushStep(ctx, {
        id: 'remote',
        label: 'Configure origin remote',
        status: 'warning',
        message: warning,
      });
    } else {
      pushStep(ctx, {
        id: 'remote',
        label: 'Configure origin remote',
        status: 'skipped',
        message: 'Origin remote is already configured.',
      });
    }

    const repoCheck = assertGitRepository();
    if (repoCheck.ok) {
      await checkoutOrCreateBranch(defaultBranch, ctx.cwd);

      const hadCommitsBeforeSync = await hasAnyCommit(ctx.cwd);
      const remoteExists = await remoteHasBranch(ctx.cwd, defaultBranch, env);

      const syncMode = repository?.existingRepoSync ?? 'use_workspace';

      try {
        if (remoteExists && hadCommitsBeforeSync && syncMode === 'use_remote') {
          await syncRemoteToWorkspace(ctx, defaultBranch, env);
          pushStep(ctx, {
            id: 'sync',
            label: 'Sync workspace',
            status: 'success',
            message: `Reset workspace to match origin/${defaultBranch}.`,
          });
        } else {
          const forcePush = remoteExists && hadCommitsBeforeSync && syncMode === 'use_workspace';
          if (forcePush) {
            ctx.warnings.push(
              `Force-pushed local ${defaultBranch} to origin — remote history may have been overwritten.`,
            );
          }
          await syncWorkspaceToRemote(ctx, defaultBranch, env, { force: forcePush });
          pushStep(ctx, {
            id: 'sync',
            label: 'Sync workspace',
            status: forcePush ? 'warning' : 'success',
            message: forcePush
              ? `Force-pushed ${defaultBranch} to origin.`
              : `Pushed ${defaultBranch} to origin.`,
          });
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to sync with remote.';
        pushStep(ctx, {
          id: 'sync',
          label: 'Sync workspace',
          status: 'error',
          message,
        });
        ctx.warnings.push(message);
      }

      try {
        await setUpstreamTracking(defaultBranch, DEFAULT_GIT_REMOTE_NAME, ctx.cwd);
        pushStep(ctx, {
          id: 'upstream',
          label: 'Set upstream',
          status: 'success',
          message: `Set upstream tracking for ${defaultBranch}.`,
        });
      } catch {
        pushStep(ctx, {
          id: 'upstream',
          label: 'Set upstream',
          status: 'skipped',
          message: 'Upstream tracking will be set on the next successful push.',
        });
      }
    }
  } else if (!connectToGithub) {
    pushStep(ctx, {
      id: 'remote',
      label: 'Configure origin remote',
      status: 'skipped',
      message: 'Local-only setup — no remote configured.',
    });
  }

  const current = getGitSettingsFromFile(deps.settingsPath);
  const settings = mergeGitSettingsPatch(
    normalizeGitSettings(current ?? DEFAULT_GIT_SETTINGS),
    buildAppEndOSettingsPatch(request),
  );
  const saved = saveGitSettingsToFile(deps.settingsPath, settings);
  pushStep(ctx, {
    id: 'settings',
    label: 'Save AppEndO preferences',
    status: 'success',
    message: 'Enabled Git integration and saved AppEndO preferences.',
  });

  const status = await toStatusPayload(saved);
  const hasErrorStep = ctx.steps.some((step) => step.status === 'error');

  return {
    success: !hasErrorStep && status.status !== 'error',
    message: hasErrorStep
      ? 'Git connect completed with errors.'
      : status.status === 'error'
        ? (status.lastError ?? 'Git connect completed but remote is not reachable.')
        : 'Git connect completed successfully.',
    mode: request.mode,
    settings: redactGitSettings(saved),
    status,
    steps: ctx.steps,
    warnings: ctx.warnings,
  };
};
