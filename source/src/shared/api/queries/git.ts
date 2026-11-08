import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  GitBranchSummary,
  GitBranchesPayload,
  GitChangeEntry,
  GitChangeSection,
  GitChangesPayload,
  GitCheckoutRequest,
  GitCommitMessageSuggestRequest,
  GitCommitMessageSuggestResult,
  GitCommitRequest,
  GitConnectAuthInput,
  GitConnectRequest,
  GitConnectResult,
  GitDiffPayload,
  GitDiscardRequest,
  GitMutationResult,
  GitPrStatusPayload,
  GitSettings,
  GitSettingsPublic,
  GitSettingsTestResult,
  GitStatusPayload,
  GitWorkflowTemplateApplyRequest,
  GitWorkflowTemplateApplyResult,
  GitWorkflowTemplatesPayload,
  GitWorkflowTemplateSummary,
  GitWorkflowFilePayload,
  GitWorkflowFileSaveRequest,
} from '../contracts/git/types';
import type {
  GitGithubOAuthAvailability,
  GitGithubOAuthSessionStatus,
  GitGithubOAuthStartResult,
} from '../contracts/git/oauth';
import {
  apiGet,
  apiPost,
  apiPut,
  type ApiMutationResponse,
} from '../client';

export type {
  GitBranchSummary,
  GitBranchesPayload,
  GitChangesPayload,
  GitChangeEntry,
  GitChangeSection,
  GitCommitMessageSuggestRequest,
  GitCommitMessageSuggestResult,
  GitCommitRequest,
  GitDiffPayload,
  GitDiscardRequest,
  GitMutationResult,
  GitPrStatusPayload,
  GitSettings,
  GitSettingsPublic,
  GitSettingsTestResult,
  GitStatusPayload,
  GitWorkflowTemplateApplyRequest,
  GitWorkflowTemplateApplyResult,
  GitWorkflowTemplatesPayload,
  GitWorkflowTemplateSummary,
  GitWorkflowFilePayload,
  GitWorkflowFileSaveRequest,
};

export const gitQueryKeys = {
  all: ['git'] as const,
  settings: () => [...gitQueryKeys.all, 'settings'] as const,
  status: () => [...gitQueryKeys.all, 'status'] as const,
  changes: () => [...gitQueryKeys.all, 'changes'] as const,
  branches: () => [...gitQueryKeys.all, 'branches'] as const,
  diff: (path: string, staged: boolean) => [...gitQueryKeys.all, 'diff', path, staged] as const,
  prStatus: () => [...gitQueryKeys.all, 'pr-status'] as const,
  workflowTemplates: () => [...gitQueryKeys.all, 'workflow-templates'] as const,
  workflowFile: (path?: string) => [...gitQueryKeys.all, 'workflow-file', path ?? 'default'] as const,
  githubOAuthAvailability: () => [...gitQueryKeys.all, 'github-oauth-availability'] as const,
};

const getGitLoadErrorMessage = (data: unknown, fallback: string): string => {
  if (!data || typeof data !== 'object') {
    return fallback;
  }

  const payload = data as { error?: string };
  return typeof payload.error === 'string' && payload.error.trim() ? payload.error : fallback;
};

const getGitHttpErrorMessage = (status: number, data: unknown, resource: string): string => {
  if (status === 401) {
    return 'Authentication required. Please login again.';
  }
  if (status === 403) {
    return `You do not have permission to view ${resource}.`;
  }
  return getGitLoadErrorMessage(data, `Failed to load ${resource} (HTTP ${status}).`);
};

const normalizeGitBranchesPayload = (value: unknown): GitBranchesPayload => {
  if (Array.isArray(value)) {
    const branches = value as GitBranchSummary[];
    return {
      current: branches.find((branch) => branch.current)?.name ?? null,
      branches,
    };
  }

  if (value && typeof value === 'object' && Array.isArray((value as GitBranchesPayload).branches)) {
    return value as GitBranchesPayload;
  }

  return { current: null, branches: [] };
};

export async function fetchGitSettings(): Promise<GitSettingsPublic> {
  const { data, response } = await apiGet<ApiMutationResponse & { settings?: GitSettingsPublic }>('/api/git/settings');

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git settings'));
  }

  if (!data.success || !data.settings) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to load git settings.'));
  }

  return data.settings;
}

export async function updateGitSettings(payload: Partial<GitSettings>): Promise<GitSettingsPublic> {
  const { data, response } = await apiPut<ApiMutationResponse & { settings?: GitSettingsPublic }>(
    '/api/git/settings',
    payload,
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git settings'));
  }

  if (!data.success || !data.settings) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to save git settings.'));
  }

  return data.settings;
}

export async function connectGit(payload: GitConnectRequest): Promise<GitConnectResult> {
  const { data, response } = await apiPost<ApiMutationResponse & { result?: GitConnectResult }>(
    '/api/git/connect',
    payload,
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git connect'));
  }

  if (!data.success || !data.result) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to connect git.'));
  }

  return data.result;
}

export async function updateGitCredentials(payload: GitConnectAuthInput): Promise<GitStatusPayload> {
  const { data, response } = await apiPut<ApiMutationResponse & { status?: GitStatusPayload }>(
    '/api/git/credentials',
    payload,
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git credentials'));
  }

  if (!data.success || !data.status) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to save git credentials.'));
  }

  return data.status;
}

export async function testGitSettings(payload: Partial<GitSettings>): Promise<GitSettingsTestResult> {
  const { data, response } = await apiPost<ApiMutationResponse & { result?: GitSettingsTestResult }>(
    '/api/git/settings/test',
    payload,
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git settings test'));
  }

  if (!data.success || !data.result) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to test git settings.'));
  }

  return data.result;
}

export async function fetchGitGithubOAuthAvailability(): Promise<GitGithubOAuthAvailability> {
  const { data, response } = await apiGet<ApiMutationResponse & GitGithubOAuthAvailability>(
    '/api/git/oauth/github/availability',
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'GitHub OAuth availability'));
  }

  if (!data.success || typeof data.available !== 'boolean') {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to read GitHub OAuth availability.'));
  }

  return {
    available: data.available,
    redirectUri: data.redirectUri,
    setupHint: data.setupHint,
  };
}

export async function startGitGithubOAuth(): Promise<GitGithubOAuthStartResult> {
  const { data, response } = await apiPost<ApiMutationResponse & Partial<GitGithubOAuthStartResult>>(
    '/api/git/oauth/github/start',
    {},
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'GitHub OAuth start'));
  }

  if (!data.success || !data.authorizeUrl || !data.sessionId) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to start GitHub OAuth.'));
  }

  return {
    authorizeUrl: data.authorizeUrl,
    sessionId: data.sessionId,
  };
}

export async function fetchGitGithubOAuthSession(sessionId: string): Promise<GitGithubOAuthSessionStatus> {
  const { data, response } = await apiGet<ApiMutationResponse & { session?: GitGithubOAuthSessionStatus }>(
    `/api/git/oauth/github/session/${encodeURIComponent(sessionId)}`,
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'GitHub OAuth session'));
  }

  if (!data.success || !data.session) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to read GitHub OAuth session.'));
  }

  return data.session;
}

export async function fetchGitStatus(): Promise<GitStatusPayload> {
  const { data, response } = await apiGet<ApiMutationResponse & { status?: GitStatusPayload }>('/api/git/status');

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git status'));
  }

  if (!data.success || !data.status) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to load git status.'));
  }

  return data.status;
}

export async function fetchGitChanges(): Promise<GitChangesPayload> {
  const { data, response } = await apiGet<ApiMutationResponse & { changes?: GitChangesPayload }>('/api/git/changes');

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git changes'));
  }

  if (!data.success || !data.changes) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to load git changes.'));
  }

  return data.changes;
}

export async function fetchGitBranches(): Promise<GitBranchesPayload> {
  const { data, response } = await apiGet<ApiMutationResponse & { branches?: GitBranchesPayload }>('/api/git/branches');

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git branches'));
  }

  if (!data.success || !data.branches) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to load git branches.'));
  }

  return normalizeGitBranchesPayload(data.branches);
}

export async function checkoutGitBranch(request: GitCheckoutRequest): Promise<GitMutationResult> {
  return postGitMutation('/api/git/checkout', 'git checkout', request);
}

export async function fetchGitDiff(
  path: string,
  staged: boolean,
  section?: GitChangeSection,
): Promise<GitDiffPayload> {
  const query = new URLSearchParams({
    path,
    staged: staged ? 'true' : 'false',
  });
  if (section) {
    query.set('section', section);
  }
  const { data, response } = await apiGet<ApiMutationResponse & { diff?: GitDiffPayload }>(
    `/api/git/diff?${query.toString()}`,
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git diff'));
  }

  if (!data.success || !data.diff) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to load git diff.'));
  }

  return data.diff;
}

export async function stageGitPaths(paths: string[]): Promise<GitMutationResult> {
  const { data, response } = await apiPost<ApiMutationResponse & { result?: GitMutationResult }>(
    '/api/git/stage',
    { paths },
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git stage'));
  }

  if (!data.success || !data.result) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to stage git changes.'));
  }

  return data.result;
}

export async function unstageGitPaths(paths: string[]): Promise<GitMutationResult> {
  const { data, response } = await apiPost<ApiMutationResponse & { result?: GitMutationResult }>(
    '/api/git/unstage',
    { paths },
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git unstage'));
  }

  if (!data.success || !data.result) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to unstage git changes.'));
  }

  return data.result;
}

export async function discardGitChanges(request: GitDiscardRequest): Promise<GitMutationResult> {
  const { data, response } = await apiPost<ApiMutationResponse & { result?: GitMutationResult }>(
    '/api/git/discard',
    request,
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git discard'));
  }

  if (!data.success || !data.result) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to discard git changes.'));
  }

  return data.result;
}

const postGitMutation = async (path: string, resource: string, body?: unknown): Promise<GitMutationResult> => {
  const { data, response } = await apiPost<ApiMutationResponse & { result?: GitMutationResult }>(path, body);

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, resource));
  }

  if (!data.success || !data.result) {
    throw new Error(getGitLoadErrorMessage(data, `Failed to ${resource}.`));
  }

  return data.result;
};

export async function fetchGitRemote(): Promise<GitMutationResult> {
  return postGitMutation('/api/git/fetch', 'git fetch');
}

export async function pullGitRemote(): Promise<GitMutationResult> {
  return postGitMutation('/api/git/pull', 'git pull');
}

export async function pushGitRemote(): Promise<GitMutationResult> {
  return postGitMutation('/api/git/push', 'git push');
}

export async function syncGitRemote(): Promise<GitMutationResult> {
  return postGitMutation('/api/git/sync', 'git sync');
}

export async function commitGitChanges(request: GitCommitRequest): Promise<GitMutationResult> {
  return postGitMutation('/api/git/commit', 'git commit', request);
}

export async function suggestGitCommitMessage(
  request: GitCommitMessageSuggestRequest = {},
): Promise<GitCommitMessageSuggestResult> {
  const { data, response } = await apiPost<ApiMutationResponse & { suggestion?: GitCommitMessageSuggestResult }>(
    '/api/git/commit-message/suggest',
    request,
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git commit message suggest'));
  }

  if (!data.success || !data.suggestion) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to suggest commit message.'));
  }

  return data.suggestion;
}

export async function fetchGitPrStatus(): Promise<GitPrStatusPayload> {
  const { data, response } = await apiGet<ApiMutationResponse & { prStatus?: GitPrStatusPayload }>('/api/git/pr-status');

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git pr status'));
  }

  if (!data.success || !data.prStatus) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to load GitHub PR status.'));
  }

  return data.prStatus;
}

export async function fetchGitWorkflowTemplates(): Promise<GitWorkflowTemplatesPayload> {
  const { data, response } = await apiGet<ApiMutationResponse & { workflowTemplates?: GitWorkflowTemplatesPayload }>(
    '/api/git/workflow-templates',
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git workflow templates'));
  }

  if (!data.success || !data.workflowTemplates) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to load git workflow templates.'));
  }

  return data.workflowTemplates;
}

export async function applyGitWorkflowTemplate(
  request: GitWorkflowTemplateApplyRequest,
): Promise<GitWorkflowTemplateApplyResult> {
  const { data, response } = await apiPost<ApiMutationResponse & { result?: GitWorkflowTemplateApplyResult }>(
    '/api/git/workflow-templates/apply',
    request,
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git workflow template apply'));
  }

  if (!data.success || !data.result) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to apply git workflow template.'));
  }

  return data.result;
}

export async function fetchGitWorkflowFile(path?: string): Promise<GitWorkflowFilePayload> {
  const query = path?.trim() ? `?path=${encodeURIComponent(path.trim())}` : '';
  const { data, response } = await apiGet<ApiMutationResponse & { workflowFile?: GitWorkflowFilePayload }>(
    `/api/git/workflow-file${query}`,
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git workflow file'));
  }

  if (!data.success || !data.workflowFile) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to load git workflow file.'));
  }

  return data.workflowFile;
}

export async function saveGitWorkflowFile(request: GitWorkflowFileSaveRequest): Promise<GitMutationResult> {
  const { data, response } = await apiPut<ApiMutationResponse & { result?: GitMutationResult }>(
    '/api/git/workflow-file',
    request,
  );

  if (!response.ok) {
    throw new Error(getGitHttpErrorMessage(response.status, data, 'git workflow file save'));
  }

  if (!data.success || !data.result) {
    throw new Error(getGitLoadErrorMessage(data, 'Failed to save git workflow file.'));
  }

  return data.result;
}

export function useGitSettingsQuery() {
  return useQuery({
    queryKey: gitQueryKeys.settings(),
    queryFn: fetchGitSettings,
  });
}

export function useGitStatusQuery() {
  return useQuery({
    queryKey: gitQueryKeys.status(),
    queryFn: fetchGitStatus,
  });
}

export function useGitChangesQuery(enabled = true) {
  return useQuery({
    queryKey: gitQueryKeys.changes(),
    queryFn: fetchGitChanges,
    enabled,
    refetchOnMount: 'always',
  });
}

export function useGitBranchesQuery(enabled = true) {
  return useQuery({
    queryKey: gitQueryKeys.branches(),
    queryFn: fetchGitBranches,
    enabled,
    refetchOnMount: 'always',
  });
}

export function useGitPrStatusQuery(enabled = true) {
  return useQuery({
    queryKey: gitQueryKeys.prStatus(),
    queryFn: fetchGitPrStatus,
    enabled,
    staleTime: 60_000,
  });
}

export function useGitWorkflowTemplatesQuery(enabled = true) {
  return useQuery({
    queryKey: gitQueryKeys.workflowTemplates(),
    queryFn: fetchGitWorkflowTemplates,
    enabled,
  });
}

export function useGitWorkflowFileQuery(path: string | undefined, enabled = true) {
  return useQuery({
    queryKey: gitQueryKeys.workflowFile(path),
    queryFn: () => fetchGitWorkflowFile(path),
    enabled,
  });
}

export function useGitDiffQuery(path: string | null, staged: boolean, enabled = true) {
  return useQuery({
    queryKey: gitQueryKeys.diff(path ?? '', staged),
    queryFn: () => fetchGitDiff(path ?? '', staged),
    enabled: enabled && Boolean(path),
  });
}

export function useUpdateGitSettingsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateGitSettings,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gitQueryKeys.all });
    },
  });
}

export function useConnectGitMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: connectGit,
    onSuccess: (result) => {
      queryClient.setQueryData(gitQueryKeys.status(), result.status);
      void queryClient.invalidateQueries({ queryKey: gitQueryKeys.all });
    },
  });
}

export function useUpdateGitCredentialsMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateGitCredentials,
    onSuccess: (status) => {
      queryClient.setQueryData(gitQueryKeys.status(), status);
      void queryClient.invalidateQueries({ queryKey: gitQueryKeys.all });
    },
  });
}

export function useTestGitSettingsMutation() {
  return useMutation({
    mutationFn: testGitSettings,
  });
}

export function useStageGitPathsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: stageGitPaths,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gitQueryKeys.changes() });
      void queryClient.invalidateQueries({ queryKey: gitQueryKeys.all });
    },
  });
}

export function useUnstageGitPathsMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: unstageGitPaths,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gitQueryKeys.changes() });
      void queryClient.invalidateQueries({ queryKey: gitQueryKeys.all });
    },
  });
}

export function useDiscardGitChangesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: discardGitChanges,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gitQueryKeys.all });
    },
  });
}

const useGitWorkspaceMutation = (mutationFn: () => Promise<GitMutationResult>) => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gitQueryKeys.all });
    },
  });
};

export function useFetchGitRemoteMutation() {
  return useGitWorkspaceMutation(fetchGitRemote);
}

export function usePullGitRemoteMutation() {
  return useGitWorkspaceMutation(pullGitRemote);
}

export function usePushGitRemoteMutation() {
  return useGitWorkspaceMutation(pushGitRemote);
}

export function useSyncGitRemoteMutation() {
  return useGitWorkspaceMutation(syncGitRemote);
}

export function useCheckoutGitBranchMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: checkoutGitBranch,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gitQueryKeys.all });
    },
  });
}

export function useCommitGitChangesMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: commitGitChanges,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gitQueryKeys.all });
    },
  });
}

function useSuggestGitCommitMessageMutation() {
  return useMutation({
    mutationFn: suggestGitCommitMessage,
  });
}

export function useApplyGitWorkflowTemplateMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: applyGitWorkflowTemplate,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gitQueryKeys.all });
    },
  });
}

export function useSaveGitWorkflowFileMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: saveGitWorkflowFile,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: gitQueryKeys.all });
    },
  });
}

export function useGitGithubOAuthAvailabilityQuery(enabled = true) {
  return useQuery({
    queryKey: gitQueryKeys.githubOAuthAvailability(),
    queryFn: fetchGitGithubOAuthAvailability,
    enabled,
    staleTime: 60_000,
  });
}
