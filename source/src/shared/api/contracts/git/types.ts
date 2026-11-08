export type GitAuthKind = 'none' | 'https_pat' | 'ssh_key_path';

export type GitAuthSettings = {
  kind: GitAuthKind;
  username?: string;
  token?: string;
  tokenEnvKey?: string;
  sshKeyPath?: string;
};

export type GitAuthSettingsPublic = {
  kind: GitAuthKind;
  username?: string;
  token?: string;
  hasToken?: boolean;
  tokenEnvKey?: string;
  sshKeyPath?: string;
};

export type GitCommitMessageSettings = {
  autoGenerateEnabled: boolean;
  template?: string;
};

export type GitPrProvider = 'github';

export type GitPrSettings = {
  provider: GitPrProvider;
  owner?: string;
  repo?: string;
};

export type GitGithubOAuthSettings = {
  clientId?: string;
  clientSecret?: string;
  hasClientSecret?: boolean;
};

/** Persisted AppEndO preferences only — remote/branch/auth live in native `.git` + credential store. */
export type GitSettings = {
  enabled: boolean;
  /** When true, native workspace detection must not re-enable Git integration after disconnect. */
  integrationSuppressed?: boolean;
  commitMessage?: GitCommitMessageSettings;
  pr?: GitPrSettings;
  githubOAuth?: GitGithubOAuthSettings;
};

export type GitSettingsPublic = GitSettings;

export type GitConnectivityStatus =
  | 'connected'
  | 'not_configured'
  | 'disabled'
  | 'no_repo'
  | 'error';

export type GitStatusPayload = {
  status: GitConnectivityStatus;
  isEnabled: boolean;
  isConfigured: boolean;
  isRepository: boolean;
  integrationSuppressed: boolean;
  currentBranch: string | null;
  workspacePath: string;
  lastError: string | null;
  /** Derived from native `.git` / `origin`. */
  remoteUrl: string | null;
  remoteName: string | null;
  defaultBranch: string | null;
  hasCredential: boolean;
  /** Remote auth works via OS / Git credential helper without AppEndO credential store. */
  usesNativeAuth: boolean;
  /** Public credential summary from gitignored credential store. */
  auth: GitAuthSettingsPublic;
};

export type GitConnectMode = 'full' | 'remoteOnly';

export type GitRepoVisibility = 'private' | 'public';

export type GitExistingRepoSync = 'use_workspace' | 'use_remote';

export type GitConnectAuthInput = GitAuthSettings;

export type GitConnectRepositoryInput = {
  connectToGithub: boolean;
  repoDescription?: string;
  repoVisibility?: GitRepoVisibility;
  existingRepoSync?: GitExistingRepoSync;
  owner?: string;
  repo?: string;
  defaultBranch?: string;
};

export type GitConnectRequest = {
  mode: GitConnectMode;
  auth: GitConnectAuthInput;
  repository?: GitConnectRepositoryInput;
  commitMessage?: GitCommitMessageSettings;
  pr?: GitPrSettings;
};

export type GitConnectStepStatus = 'success' | 'skipped' | 'warning' | 'error';

export type GitConnectStep = {
  id: string;
  label: string;
  status: GitConnectStepStatus;
  message?: string;
};

export type GitConnectResult = {
  success: boolean;
  message: string;
  mode: GitConnectMode;
  settings: GitSettingsPublic;
  status: GitStatusPayload;
  steps: GitConnectStep[];
  warnings: string[];
};

export type GitSettingsTestResult = {
  success: boolean;
  message: string;
};

export type GitChangeSection = 'unstaged' | 'staged' | 'untracked';

export type GitChangeEntry = {
  path: string;
  section: GitChangeSection;
  statusCode: string;
  denied: boolean;
};

export type GitChangesPayload = {
  branch: string | null;
  ahead: number;
  behind: number;
  isClean: boolean;
  entries: GitChangeEntry[];
};

export type GitDiffPayload = {
  path: string;
  staged: boolean;
  section: GitChangeSection;
  diff: string;
  truncated: boolean;
  baseline: string;
  current: string;
};

export type GitPathsRequest = {
  paths: string[];
};

export type GitDiscardRequest = {
  paths?: string[];
  all?: boolean;
  untracked?: boolean;
};

export type GitMutationResult = {
  success: boolean;
  message: string;
};

export type GitBranchSummary = {
  name: string;
  current: boolean;
};

export type GitBranchesPayload = {
  current: string | null;
  branches: GitBranchSummary[];
};

export type GitCheckoutRequest = {
  branch: string;
};

export type GitCommitRequest = {
  message: string;
};

export type GitCommitMessageSuggestRequest = {
  paths?: string[];
};

export type GitCommitMessageSuggestResult = {
  message: string;
};

export type GitPrCheckSummaryState = 'success' | 'failure' | 'pending' | 'neutral' | 'unknown';

export type GitPrCheckSummary = {
  total: number;
  success: number;
  failure: number;
  pending: number;
  state: GitPrCheckSummaryState;
};

export type GitPullRequestSummary = {
  number: number;
  title: string;
  state: 'open' | 'closed';
  htmlUrl: string;
  checks: GitPrCheckSummary;
};

export type GitPrStatusPayload = {
  available: boolean;
  reason?: string;
  branch?: string | null;
  pullRequest?: GitPullRequestSummary | null;
};

export type GitWorkflowTemplateSummary = {
  id: string;
  name: string;
  description: string;
  defaultTargetPath: string;
  exists: boolean;
};

export type GitWorkflowTemplatesPayload = {
  templates: GitWorkflowTemplateSummary[];
};

export type GitWorkflowTemplateApplyRequest = {
  templateId: string;
  targetPath?: string;
  overwrite?: boolean;
};

export type GitWorkflowTemplateApplyResult = {
  success: boolean;
  message: string;
  path: string;
  templateId: string;
  created: boolean;
};

export type GitWorkflowFilePayload = {
  path: string;
  content: string;
  exists: boolean;
};

export type GitWorkflowFileSaveRequest = {
  path: string;
  content: string;
};
