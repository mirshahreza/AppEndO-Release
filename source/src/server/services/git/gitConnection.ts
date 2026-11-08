import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { assertGitRepository, getGitCurrentBranch, GIT_COMMAND_TIMEOUT_MS } from '../../../core/ai/tools/native/git/gitRunner';
import { getRepoRoot } from '../../../core/ai/tools/pathAllowlist';
import type { GitAuthSettings, GitSettings } from '../../../shared/api/contracts/git/types';
import { resolveGitRuntime, type GitRuntimeContext } from './gitRuntime';

const execFileAsync = promisify(execFile);

export const resolveGitToken = (auth: GitAuthSettings): string => {
  const envKey = auth.tokenEnvKey?.trim();
  if (envKey) {
    const fromEnv = String(process.env[envKey] ?? '').trim();
    if (fromEnv) {
      return fromEnv;
    }
  }
  return auth.token?.trim() ?? '';
};

const redactCredentialsInMessage = (message: string): string => (
  message
    .replace(/x-access-token:[^@\s]+@/gi, 'x-access-token:***@')
    .replace(/https?:\/\/[^@\s]+@/gi, 'https://***@')
);

export const buildAuthenticatedRemoteUrl = (
  remoteUrl: string,
  auth: GitAuthSettings,
): string => {
  if (!remoteUrl.startsWith('https://') || auth.kind !== 'https_pat') {
    return remoteUrl;
  }

  const token = resolveGitToken(auth);
  if (!token) {
    return remoteUrl;
  }

  const url = new URL(remoteUrl);
  url.username = auth.username?.trim() || 'x-access-token';
  url.password = token;
  return url.toString();
};

export const buildGitExecEnv = (auth: GitAuthSettings): NodeJS.ProcessEnv => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    GIT_TERMINAL_PROMPT: '0',
  };

  if (auth.kind === 'ssh_key_path' && auth.sshKeyPath?.trim()) {
    const keyPath = path.isAbsolute(auth.sshKeyPath)
      ? auth.sshKeyPath
      : path.join(process.cwd(), auth.sshKeyPath);
    env.GIT_SSH_COMMAND = `ssh -i "${keyPath}" -o BatchMode=yes -o StrictHostKeyChecking=accept-new`;
  }

  return env;
};

export const execGitLsRemote = async (
  remoteName: string,
  auth: GitAuthSettings = { kind: 'none' },
): Promise<{ success: boolean; message: string }> => {
  const repoCheck = assertGitRepository();
  if (repoCheck.ok === false) {
    return { success: false, message: repoCheck.error };
  }

  const env = buildGitExecEnv(auth);

  try {
    await execFileAsync('git', ['ls-remote', '--heads', remoteName, 'HEAD'], {
      cwd: repoCheck.repoRoot,
      timeout: GIT_COMMAND_TIMEOUT_MS,
      env,
      encoding: 'utf8',
    });
    return { success: true, message: 'Remote repository is reachable.' };
  } catch (error: unknown) {
    const execError = error as { stderr?: string; message?: string };
    const raw = String(execError.stderr ?? execError.message ?? 'Git ls-remote failed.').trim();
    return {
      success: false,
      message: redactCredentialsInMessage(raw || 'Git ls-remote failed.'),
    };
  }
};

export type GitNativeIntegrationReadiness = {
  isRepository: boolean;
  hasRemote: boolean;
  nativeRemoteReachable: boolean;
  shouldAutoEnable: boolean;
};

export const evaluateNativeGitIntegrationReadiness = async (): Promise<GitNativeIntegrationReadiness> => {
  const repoCheck = assertGitRepository();
  if (repoCheck.ok === false) {
    return {
      isRepository: false,
      hasRemote: false,
      nativeRemoteReachable: false,
      shouldAutoEnable: false,
    };
  }

  const runtime = await resolveGitRuntime({ enabled: false });
  const hasRemote = Boolean(runtime.remoteUrl.trim());
  if (!hasRemote) {
    return {
      isRepository: true,
      hasRemote: false,
      nativeRemoteReachable: false,
      shouldAutoEnable: true,
    };
  }

  const probe = await execGitLsRemote(runtime.remoteName, { kind: 'none' });
  return {
    isRepository: true,
    hasRemote: true,
    nativeRemoteReachable: probe.success,
    shouldAutoEnable: probe.success,
  };
};

export const shouldAutoEnableGitFromNative = (
  settings: GitSettings,
  readiness: GitNativeIntegrationReadiness,
): boolean => (
  !settings.enabled
  && !settings.integrationSuppressed
  && readiness.shouldAutoEnable
);

export const runGitLsRemote = async (
  settings: GitSettings,
): Promise<{ success: boolean; message: string }> => {
  if (!settings.enabled) {
    return { success: true, message: 'Git integration is disabled.' };
  }

  const runtime = await resolveGitRuntime(settings);
  if (!runtime.remoteUrl.trim()) {
    return { success: false, message: 'Remote URL is not configured.' };
  }

  const auth = runtime.hasCredential ? runtime.auth : { kind: 'none' as const };
  return execGitLsRemote(runtime.remoteName, auth);
};

export const resolveGitStatusSnapshot = async (
  settings: GitSettings,
): Promise<{
  isEnabled: boolean;
  isConfigured: boolean;
  isRepository: boolean;
  currentBranch: string | null;
  workspacePath: string;
  lastError: string | null;
  remoteUrl: string | null;
  remoteName: string | null;
  defaultBranch: string | null;
  hasCredential: boolean;
  usesNativeAuth: boolean;
}> => {
  const runtime = await resolveGitRuntime(settings);
  const isEnabled = settings.enabled;
  const hasRemote = Boolean(runtime.remoteUrl.trim());
  const repoCheck = assertGitRepository();
  const isRepository = repoCheck.ok;
  const workspacePath = repoCheck.ok ? repoCheck.repoRoot : getRepoRoot();

  let usesNativeAuth = false;
  if (isEnabled && isRepository && hasRemote && !runtime.hasCredential) {
    const probe = await execGitLsRemote(runtime.remoteName, { kind: 'none' });
    usesNativeAuth = probe.success;
  }

  const remoteAuthReady = !hasRemote || runtime.hasCredential || usesNativeAuth;
  const isConfigured = isEnabled && remoteAuthReady;

  let currentBranch: string | null = null;
  if (repoCheck.ok) {
    const branch = await getGitCurrentBranch();
    currentBranch = branch === 'HEAD' ? null : branch;
  }

  const nativeFields = {
    remoteUrl: hasRemote ? runtime.remoteUrl : null,
    remoteName: hasRemote ? runtime.remoteName : null,
    defaultBranch: hasRemote ? runtime.defaultBranch : null,
    hasCredential: runtime.hasCredential,
    usesNativeAuth,
  };

  if (!isEnabled) {
    return {
      isEnabled,
      isConfigured: false,
      isRepository,
      currentBranch,
      workspacePath,
      lastError: null,
      ...nativeFields,
    };
  }

  if (!isRepository) {
    return {
      isEnabled,
      isConfigured,
      isRepository,
      currentBranch,
      workspacePath,
      lastError: 'Workspace is not a git repository.',
      ...nativeFields,
    };
  }

  if (!hasRemote) {
    return {
      isEnabled,
      isConfigured,
      isRepository,
      currentBranch,
      workspacePath,
      lastError: null,
      ...nativeFields,
    };
  }

  const test = await runGitLsRemote(settings);
  return {
    isEnabled,
    isConfigured,
    isRepository,
    currentBranch,
    workspacePath,
    lastError: test.success ? null : test.message,
    ...nativeFields,
  };
};

export { type GitRuntimeContext };

export const sshKeyPathExists = (sshKeyPath: string | undefined): boolean => {
  if (!sshKeyPath?.trim()) {
    return false;
  }
  const resolved = path.isAbsolute(sshKeyPath)
    ? sshKeyPath
    : path.join(process.cwd(), sshKeyPath);
  return fs.existsSync(resolved);
};

export const formatGitAuthSummary = (auth: GitAuthSettings): string => {
  if (auth.kind === 'https_pat') {
    if (resolveGitToken(auth)) {
      return 'HTTPS · token configured';
    }
    if (auth.tokenEnvKey?.trim()) {
      return `HTTPS · env ${auth.tokenEnvKey.trim()}`;
    }
    return 'HTTPS · token missing';
  }
  if (auth.kind === 'ssh_key_path') {
    return sshKeyPathExists(auth.sshKeyPath)
      ? `SSH · ${auth.sshKeyPath}`
      : 'SSH · key path missing';
  }
  return 'No authentication';
};
