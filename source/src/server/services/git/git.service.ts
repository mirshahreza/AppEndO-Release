import {
  getGitSettings,
  saveGitSettings,
  GitValidationError,
} from '../../db/gitSettingsStore';
import { HttpError } from '../../errors/HttpError';
import {
  mergeGitSettingsPatch,
  normalizeGitAuthSettings,
  redactGitSettings,
  validateGitConnectAuth,
} from '../../../shared/api/contracts/git/validators';
import type { GitChangeSection, GitConnectAuthInput, GitDiscardRequest, GitConnectRequest, GitSettings, GitStatusPayload } from '../../../shared/api/contracts/git/types';
import { resolveGitStatusSnapshot, runGitLsRemote, evaluateNativeGitIntegrationReadiness, shouldAutoEnableGitFromNative } from './gitConnection';
import { toGitAuthSettingsPublic } from './gitAuthPublic';
import { clearGitCredentials, readGitCredentials, writeGitCredentials } from './gitCredentialStore';
import { resolveGitRuntime } from './gitRuntime';
import { revokeGithubAccessToken } from './gitGithubOAuth.service';
import { resolveGitToken } from './gitConnection';
import {
  discardGitChanges,
  getGitChanges,
  getGitDiff,
  listGitBranches,
  checkoutGitBranch,
  stageGitPaths,
  unstageGitPaths,
} from './gitWorkspace';
import {
  commitGitChanges,
  fetchGitRemote,
  pullGitRemote,
  pushGitRemote,
  suggestGitCommitMessage,
  syncGitRemote,
} from './gitRemoteOps';
import { resolveGitPrStatus } from './gitPrStatus';
import { applyGitWorkflowTemplate, listGitWorkflowTemplates, readGitWorkflowFile, saveGitWorkflowFile } from './gitWorkflowTemplates';
import type { GitWorkflowTemplateApplyRequest } from '../../../shared/api/contracts/git/types';
import { provisionGitConnect } from './gitConnectProvision';

export type GitServiceDeps = {
  settingsPath: string;
};

const toStatusPayload = async (settings: GitSettings): Promise<GitStatusPayload> => {
  const snapshot = await resolveGitStatusSnapshot(settings);
  const runtime = await resolveGitRuntime(settings);

  let status: GitStatusPayload['status'] = 'not_configured';
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
    auth: toGitAuthSettingsPublic(runtime.auth),
  };
};

const resolveGitSettingsForStatus = async (settingsPath: string): Promise<GitSettings> => {
  const settings = getGitSettings(settingsPath);
  const readiness = await evaluateNativeGitIntegrationReadiness();

  if (!shouldAutoEnableGitFromNative(settings, readiness)) {
    return settings;
  }

  return saveGitSettings(settingsPath, {
    ...settings,
    enabled: true,
    integrationSuppressed: false,
  });
};

export class GitService {
  constructor(private readonly deps: GitServiceDeps) {}

  getSettings() {
    const settings = getGitSettings(this.deps.settingsPath);
    return { body: { success: true as const, settings: redactGitSettings(settings) } };
  }

  async updateSettings(payload: Partial<GitSettings>) {
    try {
      const current = getGitSettings(this.deps.settingsPath);
      if (payload.enabled === false && current.enabled) {
        await this.clearStoredCredentials();
      }

      const merged = mergeGitSettingsPatch(current, payload);
      const saved = await saveGitSettings(this.deps.settingsPath, merged);
      return { body: { success: true as const, settings: redactGitSettings(saved) } };
    } catch (error: unknown) {
      if (error instanceof GitValidationError) {
        throw new HttpError(400, error.message);
      }
      const message = error instanceof Error ? error.message : 'Failed to update git settings.';
      throw new HttpError(400, message);
    }
  }

  async testSettings(_payload: Partial<GitSettings>) {
    try {
      const current = getGitSettings(this.deps.settingsPath);
      const result = await runGitLsRemote(current);
      return { body: { success: true as const, result } };
    } catch (error: unknown) {
      if (error instanceof GitValidationError) {
        throw new HttpError(400, error.message);
      }
      const message = error instanceof Error ? error.message : 'Failed to test git settings.';
      throw new HttpError(400, message);
    }
  }

  async getStatus() {
    const settings = await resolveGitSettingsForStatus(this.deps.settingsPath);
    const status = await toStatusPayload(settings);
    return { body: { success: true as const, status } };
  }

  private async clearStoredCredentials(): Promise<void> {
    const auth = await readGitCredentials();
    if (auth.kind === 'https_pat') {
      const token = resolveGitToken(auth);
      if (token) {
        await revokeGithubAccessToken(token);
      }
    }
    await clearGitCredentials();
  }

  async updateCredentials(payload: GitConnectAuthInput) {
    try {
      const auth = normalizeGitAuthSettings(payload);
      validateGitConnectAuth(auth);

      if (auth.kind === 'none') {
        await this.clearStoredCredentials();
      } else {
        await writeGitCredentials(auth);
      }

      const settings = getGitSettings(this.deps.settingsPath);
      const status = await toStatusPayload(settings);
      return { body: { success: true as const, status } };
    } catch (error: unknown) {
      if (error instanceof GitValidationError) {
        throw new HttpError(400, error.message);
      }
      const message = error instanceof Error ? error.message : 'Failed to update git credentials.';
      throw new HttpError(400, message);
    }
  }

  async connect(payload: GitConnectRequest) {
    try {
      const result = await provisionGitConnect(payload, { settingsPath: this.deps.settingsPath });
      return { body: { success: true as const, result } };
    } catch (error: unknown) {
      if (error instanceof HttpError) {
        throw error;
      }
      if (error instanceof GitValidationError) {
        throw new HttpError(400, error.message);
      }
      const message = error instanceof Error ? error.message : 'Failed to connect git.';
      throw new HttpError(400, message);
    }
  }

  async getChanges() {
    const changes = await getGitChanges();
    return { body: { success: true as const, changes } };
  }

  async getBranches() {
    const branches = await listGitBranches();
    return { body: { success: true as const, branches } };
  }

  async checkout(payload: { branch: string }) {
    const result = await checkoutGitBranch(payload.branch);
    return { body: { success: true as const, result } };
  }

  async getDiff(path: string, staged: boolean, section?: GitChangeSection) {
    const diff = await getGitDiff(path, staged, section);
    return { body: { success: true as const, diff } };
  }

  async stage(paths: string[]) {
    const result = await stageGitPaths(paths);
    return { body: { success: true as const, result } };
  }

  async unstage(paths: string[]) {
    const result = await unstageGitPaths(paths);
    return { body: { success: true as const, result } };
  }

  async discard(request: GitDiscardRequest) {
    const result = await discardGitChanges(request);
    return { body: { success: true as const, result } };
  }

  async fetch() {
    const settings = getGitSettings(this.deps.settingsPath);
    const result = await fetchGitRemote(settings);
    return { body: { success: true as const, result } };
  }

  async pull() {
    const settings = getGitSettings(this.deps.settingsPath);
    const result = await pullGitRemote(settings);
    return { body: { success: true as const, result } };
  }

  async push() {
    const settings = getGitSettings(this.deps.settingsPath);
    const result = await pushGitRemote(settings);
    return { body: { success: true as const, result } };
  }

  async sync() {
    const settings = getGitSettings(this.deps.settingsPath);
    const result = await syncGitRemote(settings);
    return { body: { success: true as const, result } };
  }

  async commit(message: string) {
    const result = await commitGitChanges(message);
    return { body: { success: true as const, result } };
  }

  async suggestCommitMessage(paths?: string[]) {
    const settings = getGitSettings(this.deps.settingsPath);
    const suggestion = await suggestGitCommitMessage(settings, paths);
    return { body: { success: true as const, suggestion } };
  }

  async getPrStatus() {
    const settings = getGitSettings(this.deps.settingsPath);
    const prStatus = await resolveGitPrStatus(settings);
    return { body: { success: true as const, prStatus } };
  }

  getWorkflowTemplates() {
    const workflowTemplates = listGitWorkflowTemplates();
    return { body: { success: true as const, workflowTemplates } };
  }

  applyWorkflowTemplate(input: GitWorkflowTemplateApplyRequest) {
    const result = applyGitWorkflowTemplate(input);
    return { body: { success: true as const, result } };
  }

  getWorkflowFile(path?: string) {
    const workflowFile = readGitWorkflowFile(path);
    return { body: { success: true as const, workflowFile } };
  }

  saveWorkflowFile(path: string, content: string) {
    const result = saveGitWorkflowFile(path, content);
    return { body: { success: true as const, result } };
  }
}
