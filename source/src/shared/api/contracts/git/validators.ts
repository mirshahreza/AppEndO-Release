import {
  DEFAULT_GIT_REMOTE_NAME,
  DEFAULT_GIT_SETTINGS,
  GIT_CONNECT_MODES,
  REDACTED_GIT_TOKEN,
} from './constants';
import type {
  GitAuthKind,
  GitAuthSettings,
  GitCommitMessageSettings,
  GitConnectAuthInput,
  GitConnectMode,
  GitConnectRepositoryInput,
  GitConnectRequest,
  GitGithubOAuthSettings,
  GitPrSettings,
  GitSettings,
  GitSettingsPublic,
} from './types';

export class GitValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'GitValidationError';
  }
}

const GIT_AUTH_KINDS = new Set<GitAuthKind>(['none', 'https_pat', 'ssh_key_path']);

const normalizeAuthKind = (value: unknown): GitAuthKind => {
  const kind = String(value ?? 'none').trim() as GitAuthKind;
  return GIT_AUTH_KINDS.has(kind) ? kind : 'none';
};

const normalizeOptionalString = (value: unknown): string | undefined => {
  if (value === undefined || value === null) return undefined;
  const trimmed = String(value).trim();
  return trimmed || undefined;
};

export const normalizeGitAuthSettings = (
  raw: unknown,
  fallback: GitAuthSettings = { kind: 'none' },
): GitAuthSettings => {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const kind = normalizeAuthKind(input.kind ?? fallback.kind);

  return {
    kind,
    username: normalizeOptionalString(input.username ?? fallback.username),
    token: normalizeOptionalString(input.token ?? fallback.token),
    tokenEnvKey: normalizeOptionalString(input.tokenEnvKey ?? fallback.tokenEnvKey),
    sshKeyPath: normalizeOptionalString(input.sshKeyPath ?? fallback.sshKeyPath),
  };
};

const normalizeCommitMessageSettings = (
  raw: unknown,
  fallback: GitCommitMessageSettings,
): GitCommitMessageSettings => {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  return {
    autoGenerateEnabled: input.autoGenerateEnabled === undefined
      ? fallback.autoGenerateEnabled
      : Boolean(input.autoGenerateEnabled),
    template: normalizeOptionalString(input.template ?? fallback.template),
  };
};

const normalizePrSettings = (raw: unknown, fallback: GitPrSettings): GitPrSettings => {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const provider = input.provider === 'github' ? 'github' : fallback.provider;
  return {
    provider,
    owner: normalizeOptionalString(input.owner ?? fallback.owner),
    repo: normalizeOptionalString(input.repo ?? fallback.repo),
  };
};

const normalizeGithubOAuthSettings = (
  raw: unknown,
  fallback?: GitGithubOAuthSettings,
): GitGithubOAuthSettings | undefined => {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const clientId = normalizeOptionalString(input.clientId ?? fallback?.clientId);
  const clientSecret = normalizeOptionalString(input.clientSecret ?? fallback?.clientSecret);
  const hasClientSecret = Boolean(input.hasClientSecret)
    || Boolean(fallback?.hasClientSecret)
    || Boolean(clientSecret);

  if (!clientId && !clientSecret && !hasClientSecret) {
    return undefined;
  }

  return { clientId, clientSecret, hasClientSecret };
};

export const parseGitRemoteOwnerRepo = (remoteUrl: string): { owner?: string; repo?: string } => {
  const trimmed = remoteUrl.trim();
  if (!trimmed) return {};

  const sshMatch = trimmed.match(/^git@[^:]+:([^/]+)\/(.+?)(?:\.git)?$/);
  if (sshMatch) {
    return { owner: sshMatch[1], repo: sshMatch[2].replace(/\.git$/, '') };
  }

  try {
    const url = new URL(trimmed);
    const parts = url.pathname.replace(/^\//, '').replace(/\.git$/, '').split('/');
    if (parts.length >= 2) {
      return { owner: parts[0], repo: parts[1] };
    }
  } catch {
    return {};
  }

  return {};
};

/** Strips legacy persisted fields (`remoteUrl`, `defaultBranch`, `localBranch`, `auth`) on read. */
export const normalizeGitSettings = (raw: unknown): GitSettings => {
  const defaults = DEFAULT_GIT_SETTINGS;
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};

  return {
    enabled: input.enabled === undefined ? defaults.enabled : Boolean(input.enabled),
    integrationSuppressed: input.integrationSuppressed === undefined
      ? defaults.integrationSuppressed
      : Boolean(input.integrationSuppressed),
    commitMessage: normalizeCommitMessageSettings(input.commitMessage, defaults.commitMessage!),
    pr: normalizePrSettings(input.pr, defaults.pr!),
    githubOAuth: normalizeGithubOAuthSettings(input.githubOAuth, defaults.githubOAuth),
  };
};

export const validateGitSettings = (_settings: GitSettings): void => {
  // Native git + credential store own remote/auth validation at connect/runtime boundaries.
};

export const redactGitSettings = (settings: GitSettings): GitSettingsPublic => {
  const { githubOAuth, ...publicSettings } = settings;
  const hasClientSecret = Boolean(githubOAuth?.hasClientSecret) || Boolean(githubOAuth?.clientSecret?.trim());

  if (!hasClientSecret && !githubOAuth?.clientId?.trim()) {
    return publicSettings;
  }

  return {
    ...publicSettings,
    githubOAuth: {
      clientId: githubOAuth?.clientId,
      clientSecret: hasClientSecret ? REDACTED_GIT_TOKEN : undefined,
      hasClientSecret,
    },
  };
};

export const mergeGitSettingsPatch = (
  current: GitSettings,
  patch: Partial<GitSettings>,
): GitSettings => {
  const merged = normalizeGitSettings({
    ...current,
    ...patch,
    commitMessage: {
      ...current.commitMessage,
      ...(patch.commitMessage || {}),
    },
    pr: {
      ...current.pr,
      ...(patch.pr || {}),
    },
    githubOAuth: patch.githubOAuth === undefined
      ? current.githubOAuth
      : normalizeGithubOAuthSettings(patch.githubOAuth, current.githubOAuth),
  });

  if (patch.githubOAuth?.clientSecret !== undefined) {
    const incoming = String(patch.githubOAuth.clientSecret ?? '').trim();
    if (!incoming || incoming === REDACTED_GIT_TOKEN) {
      merged.githubOAuth = {
        clientId: merged.githubOAuth?.clientId,
        clientSecret: current.githubOAuth?.clientSecret,
        hasClientSecret: Boolean(current.githubOAuth?.hasClientSecret)
          || Boolean(current.githubOAuth?.clientSecret?.trim()),
      };
      if (!merged.githubOAuth?.clientId && !merged.githubOAuth?.clientSecret && !merged.githubOAuth?.hasClientSecret) {
        merged.githubOAuth = undefined;
      }
    } else {
      merged.githubOAuth = {
        ...merged.githubOAuth,
        clientSecret: incoming,
        hasClientSecret: true,
      };
    }
  }

  validateGitSettings(merged);
  return merged;
};

const normalizeConnectMode = (value: unknown): GitConnectMode => {
  const mode = String(value ?? 'full').trim() as GitConnectMode;
  return GIT_CONNECT_MODES.includes(mode) ? mode : 'full';
};

const normalizeConnectRepositoryInput = (raw: unknown): GitConnectRepositoryInput | undefined => {
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const input = raw as Record<string, unknown>;
  const connectToGithub = Boolean(input.connectToGithub);
  const visibility = input.repoVisibility === 'public' ? 'public' : 'private';
  const sync = input.existingRepoSync === 'use_remote' ? 'use_remote' : 'use_workspace';

  return {
    connectToGithub,
    repoDescription: normalizeOptionalString(input.repoDescription),
    repoVisibility: visibility,
    existingRepoSync: sync,
    owner: normalizeOptionalString(input.owner),
    repo: normalizeOptionalString(input.repo),
    defaultBranch: normalizeOptionalString(input.defaultBranch),
  };
};

export const normalizeGitConnectRequest = (raw: unknown): GitConnectRequest => {
  const input = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
  const defaults = DEFAULT_GIT_SETTINGS;

  return {
    mode: normalizeConnectMode(input.mode),
    auth: normalizeGitAuthSettings(input.auth),
    repository: normalizeConnectRepositoryInput(input.repository),
    commitMessage: input.commitMessage === undefined
      ? undefined
      : normalizeCommitMessageSettings(input.commitMessage, defaults.commitMessage!),
    pr: input.pr === undefined
      ? undefined
      : normalizePrSettings(input.pr, defaults.pr!),
  };
};

export const validateGitConnectAuth = (auth: GitConnectAuthInput): void => {
  if (auth.kind === 'none') {
    return;
  }

  if (auth.kind === 'https_pat') {
    const hasToken = Boolean(auth.token?.trim() || auth.tokenEnvKey?.trim());
    if (!hasToken) {
      throw new GitValidationError('HTTPS PAT or token environment key is required for HTTPS authentication.');
    }
  }

  if (auth.kind === 'ssh_key_path' && !auth.sshKeyPath?.trim()) {
    throw new GitValidationError('SSH key path is required for SSH authentication.');
  }
};

export const validateGitConnectRequest = (request: GitConnectRequest): void => {
  validateGitConnectAuth(request.auth);

  if (request.mode === 'remoteOnly') {
    return;
  }

  const repository = request.repository;
  if (!repository?.connectToGithub) {
    return;
  }

  if (!repository.defaultBranch?.trim()) {
    throw new GitValidationError('Default branch is required when connecting to GitHub.');
  }

  if (!repository.owner?.trim()) {
    throw new GitValidationError('GitHub owner is required.');
  }

  if (!repository.repo?.trim()) {
    throw new GitValidationError('Repository name is required.');
  }
};

export const resolveGitConnectRemoteUrl = (request: GitConnectRequest): string | undefined => {
  const repository = request.repository;
  if (!repository?.connectToGithub) {
    return undefined;
  }

  const owner = repository.owner?.trim();
  const repo = repository.repo?.trim()?.replace(/\.git$/i, '');
  if (!owner || !repo) {
    return undefined;
  }

  return `https://github.com/${owner}/${repo}.git`;
};

export { DEFAULT_GIT_REMOTE_NAME };
