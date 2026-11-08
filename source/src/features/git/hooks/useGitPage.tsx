import { useCallback, useEffect, useMemo, useState } from 'react';
import { formatQueryError } from '../../../shared/api/client';
import {
  useApplyGitWorkflowTemplateMutation,
  useCheckoutGitBranchMutation,
  useCommitGitChangesMutation,
  useDiscardGitChangesMutation,
  useFetchGitRemoteMutation,
  useGitBranchesQuery,
  useGitChangesQuery,
  useGitDiffQuery,
  useGitPrStatusQuery,
  useGitSettingsQuery,
  useGitStatusQuery,
  useGitWorkflowFileQuery,
  useGitWorkflowTemplatesQuery,
  usePullGitRemoteMutation,
  usePushGitRemoteMutation,
  useSaveGitWorkflowFileMutation,
  useStageGitPathsMutation,
  suggestGitCommitMessage,
  useSyncGitRemoteMutation,
  useUnstageGitPathsMutation,
  type GitChangeEntry,
  type GitWorkflowTemplateSummary,
} from '../../../shared/api/queries/git';
import {
  createEmptyGitSettingsForm,
  formatGitStatusLabel,
  toGitSettingsForm,
} from '../gitSettingsForm';
import { shouldShowConnectRemotePrompt, shouldShowGitConnectPrompt, shouldShowGitDisconnect } from '../gitConnectionState';
import { resolveGitDisconnectTargetLabel } from '../gitConnectRepository';
import { useGitConnectDialog } from './useGitConnectDialog';
import { useGitPreferences } from './useGitPreferences';

export type GitDiscardConfirmState =
  | { kind: 'paths'; paths: string[]; untracked: boolean; label: string }
  | { kind: 'all'; label: string }
  | null;

export type GitProtectedBranchConfirmState =
  | { action: 'push' | 'sync'; branch: string }
  | null;

export type GitWorkflowTemplateApplyConfirmState = {
  template: GitWorkflowTemplateSummary;
} | null;

const PROTECTED_BRANCH_NAMES = new Set(['main', 'master']);

const isProtectedBranchName = (branch: string | null | undefined): boolean => {
  if (!branch) {
    return false;
  }
  return PROTECTED_BRANCH_NAMES.has(branch.trim().toLowerCase());
};

export function useGitPage() {
  const settingsQuery = useGitSettingsQuery();
  const statusQuery = useGitStatusQuery();
  const isRepository = statusQuery.data?.isRepository === true;
  const workspaceQueriesEnabled = statusQuery.isSuccess && isRepository;
  const changesQuery = useGitChangesQuery(workspaceQueriesEnabled);
  const branchesQuery = useGitBranchesQuery(workspaceQueriesEnabled);
  const stageMutation = useStageGitPathsMutation();
  const unstageMutation = useUnstageGitPathsMutation();
  const discardMutation = useDiscardGitChangesMutation();
  const fetchMutation = useFetchGitRemoteMutation();
  const pullMutation = usePullGitRemoteMutation();
  const pushMutation = usePushGitRemoteMutation();
  const syncMutation = useSyncGitRemoteMutation();
  const commitMutation = useCommitGitChangesMutation();
  const applyWorkflowTemplateMutation = useApplyGitWorkflowTemplateMutation();
  const saveWorkflowFileMutation = useSaveGitWorkflowFileMutation();
  const checkoutBranchMutation = useCheckoutGitBranchMutation();

  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [selectedDiff, setSelectedDiff] = useState<{ path: string; staged: boolean } | null>(null);
  const [discardConfirm, setDiscardConfirm] = useState<GitDiscardConfirmState>(null);
  const [protectedBranchConfirm, setProtectedBranchConfirm] = useState<GitProtectedBranchConfirmState>(null);
  const [commitModalOpen, setCommitModalOpen] = useState(false);
  const [preferencesModalOpen, setPreferencesModalOpen] = useState(false);
  const [workflowEditorModalOpen, setWorkflowEditorModalOpen] = useState(false);
  const [workflowTemplateApplyConfirm, setWorkflowTemplateApplyConfirm] = useState<GitWorkflowTemplateApplyConfirmState>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const preferences = useGitPreferences(settingsQuery.data);

  const diffQuery = useGitDiffQuery(
    selectedDiff?.path ?? null,
    selectedDiff?.staged ?? false,
    Boolean(selectedDiff),
  );

  useEffect(() => {
    if (!selectedDiff) {
      return;
    }

    const entries = changesQuery.data?.entries ?? [];
    if (entries.length === 0) {
      setSelectedDiff(null);
      return;
    }

    const selectionStillExists = entries.some((entry) => (
      entry.path === selectedDiff.path
      && (entry.section === 'staged') === selectedDiff.staged
    ));

    if (!selectionStillExists) {
      setSelectedDiff(null);
    }
  }, [changesQuery.data?.entries, selectedDiff]);

  const showToast = useCallback((type: 'success' | 'error', text: string) => {
    setToast({ type, text });
    window.setTimeout(() => setToast(null), 3200);
  }, []);

  const showConnectPrompt = shouldShowGitConnectPrompt(statusQuery.data);
  const showConnectRemotePrompt = shouldShowConnectRemotePrompt(
    statusQuery.data,
    settingsQuery.data,
  );
  const showDisconnect = shouldShowGitDisconnect(
    statusQuery.data,
    statusQuery.data?.auth,
  );
  const disconnectLabel = resolveGitDisconnectTargetLabel(
    settingsQuery.data
      ? toGitSettingsForm(settingsQuery.data, statusQuery.data)
      : createEmptyGitSettingsForm(),
  );

  const connectDialog = useGitConnectDialog({
    settings: settingsQuery.data,
    autoOpen: false,
    onConnected: async () => {
      await statusQuery.refetch();
      showToast('success', 'Git connected successfully.');
    },
    onDisconnected: async () => {
      await Promise.all([statusQuery.refetch(), settingsQuery.refetch(), changesQuery.refetch()]);
      showToast('success', `Disconnected from ${disconnectLabel}.`);
    },
    onDisconnectFailed: (message) => {
      showToast('error', message);
    },
  });

  const statusLabel = statusQuery.data
    ? formatGitStatusLabel(statusQuery.data)
    : 'Loading status…';

  const sectionCounts = useMemo(() => {
    const entries = changesQuery.data?.entries ?? [];
    return {
      unstaged: entries.filter((entry) => entry.section === 'unstaged').length,
      staged: entries.filter((entry) => entry.section === 'staged').length,
      untracked: entries.filter((entry) => entry.section === 'untracked').length,
    };
  }, [changesQuery.data?.entries]);

  const hasCommittableChanges = useMemo(
    () => (changesQuery.data?.entries ?? []).some((entry) => !entry.denied),
    [changesQuery.data?.entries],
  );

  const currentBranch = changesQuery.data?.branch
    ?? branchesQuery.data?.current
    ?? statusQuery.data?.currentBranch
    ?? null;

  useEffect(() => {
    if (!workspaceQueriesEnabled) {
      return;
    }

    void changesQuery.refetch();
    void branchesQuery.refetch();
  }, [workspaceQueriesEnabled]);

  const canRunRemoteActions = Boolean(
    statusQuery.data?.isEnabled
    && statusQuery.data?.isRepository
    && statusQuery.data?.isConfigured
    && statusQuery.data?.status === 'connected',
  );

  const prStatusQuery = useGitPrStatusQuery(
    Boolean(statusQuery.data?.isRepository && statusQuery.data?.isEnabled),
  );
  const workflowTemplatesQuery = useGitWorkflowTemplatesQuery(statusQuery.data?.isRepository === true);
  const workflowFileQuery = useGitWorkflowFileQuery(
    undefined,
    workflowEditorModalOpen && statusQuery.data?.isRepository === true,
  );

  const isSyncActionPending = fetchMutation.isPending
    || pullMutation.isPending
    || pushMutation.isPending
    || syncMutation.isPending;

  const isCommitting = commitMutation.isPending;
  const isApplyingWorkflowTemplate = applyWorkflowTemplateMutation.isPending;
  const isSavingWorkflowFile = saveWorkflowFileMutation.isPending;

  const refreshWorkspace = useCallback(async () => {
    await Promise.all([
      statusQuery.refetch(),
      changesQuery.refetch(),
      branchesQuery.refetch(),
      prStatusQuery.refetch(),
      workflowTemplatesQuery.refetch(),
    ]);
    if (selectedDiff) {
      await diffQuery.refetch();
    }
  }, [branchesQuery, changesQuery, diffQuery, prStatusQuery, selectedDiff, statusQuery, workflowTemplatesQuery]);

  const togglePathSelection = useCallback((path: string) => {
    setSelectedPaths((current) => {
      const next = new Set(current);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const selectAllChanges = useCallback(() => {
    const entries = changesQuery.data?.entries ?? [];
    setSelectedPaths(new Set(entries.filter((entry) => !entry.denied).map((entry) => entry.path)));
  }, [changesQuery.data?.entries]);

  const clearSelection = useCallback(() => {
    setSelectedPaths(new Set());
  }, []);

  const openDiff = useCallback((entry: GitChangeEntry) => {
    setSelectedDiff({
      path: entry.path,
      staged: entry.section === 'staged',
    });
  }, []);

  const clearDiff = useCallback(() => {
    setSelectedDiff(null);
  }, []);

  const stagePaths = useCallback(async (paths: string[]) => {
    if (paths.length === 0) {
      return;
    }
    try {
      const result = await stageMutation.mutateAsync(paths);
      showToast('success', result.message);
      clearSelection();
      await refreshWorkspace();
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to stage changes.'));
    }
  }, [clearSelection, refreshWorkspace, showToast, stageMutation]);

  const unstagePaths = useCallback(async (paths: string[]) => {
    if (paths.length === 0) {
      return;
    }
    try {
      const result = await unstageMutation.mutateAsync(paths);
      showToast('success', result.message);
      clearSelection();
      await refreshWorkspace();
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to unstage changes.'));
    }
  }, [clearSelection, refreshWorkspace, showToast, unstageMutation]);

  const confirmDiscardPaths = useCallback((paths: string[], untracked: boolean) => {
    const label = paths.length === 1
      ? paths[0]
      : `${paths.length} selected paths`;
    setDiscardConfirm({ kind: 'paths', paths, untracked, label });
  }, []);

  const confirmDiscardAll = useCallback(() => {
    setDiscardConfirm({ kind: 'all', label: 'all unstaged changes' });
  }, []);

  const closeDiscardConfirm = useCallback(() => {
    setDiscardConfirm(null);
  }, []);

  const executeDiscard = useCallback(async () => {
    if (!discardConfirm) {
      return;
    }

    try {
      if (discardConfirm.kind === 'all') {
        const result = await discardMutation.mutateAsync({ all: true });
        showToast('success', result.message);
      } else {
        const result = await discardMutation.mutateAsync({
          paths: discardConfirm.paths,
          untracked: discardConfirm.untracked,
        });
        showToast('success', result.message);
      }
      setDiscardConfirm(null);
      clearSelection();
      setSelectedDiff(null);
      await refreshWorkspace();
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to discard changes.'));
    }
  }, [clearSelection, discardConfirm, discardMutation, refreshWorkspace, showToast]);

  const runFetch = useCallback(async () => {
    try {
      const result = await fetchMutation.mutateAsync();
      showToast('success', result.message);
      await refreshWorkspace();
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to fetch from remote.'));
    }
  }, [fetchMutation, refreshWorkspace, showToast]);

  const runPull = useCallback(async () => {
    try {
      const result = await pullMutation.mutateAsync();
      showToast('success', result.message);
      await refreshWorkspace();
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to pull from remote.'));
    }
  }, [pullMutation, refreshWorkspace, showToast]);

  const runPush = useCallback(async () => {
    try {
      const result = await pushMutation.mutateAsync();
      showToast('success', result.message);
      await refreshWorkspace();
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to push to remote.'));
    }
  }, [pushMutation, refreshWorkspace, showToast]);

  const runSync = useCallback(async () => {
    try {
      const result = await syncMutation.mutateAsync();
      showToast('success', result.message);
      await refreshWorkspace();
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to sync with remote.'));
    }
  }, [refreshWorkspace, showToast, syncMutation]);

  const closeProtectedBranchConfirm = useCallback(() => {
    setProtectedBranchConfirm(null);
  }, []);

  const requestPush = useCallback(() => {
    if (isProtectedBranchName(currentBranch)) {
      setProtectedBranchConfirm({ action: 'push', branch: currentBranch! });
      return;
    }
    void runPush();
  }, [currentBranch, runPush]);

  const requestSync = useCallback(() => {
    if (isProtectedBranchName(currentBranch)) {
      setProtectedBranchConfirm({ action: 'sync', branch: currentBranch! });
      return;
    }
    void runSync();
  }, [currentBranch, runSync]);

  const executeProtectedBranchAction = useCallback(async () => {
    if (!protectedBranchConfirm) {
      return;
    }

    const action = protectedBranchConfirm.action;
    setProtectedBranchConfirm(null);

    if (action === 'push') {
      await runPush();
      return;
    }

    await runSync();
  }, [protectedBranchConfirm, runPush, runSync]);

  const openCommitModal = useCallback(() => {
    if (!hasCommittableChanges) {
      showToast('error', 'No changes to commit.');
      return;
    }
    setCommitModalOpen(true);
  }, [hasCommittableChanges, showToast]);

  const closeCommitModal = useCallback(() => {
    setCommitModalOpen(false);
  }, []);

  const suggestCommitMessage = useCallback(async () => {
    if (settingsQuery.data?.commitMessage?.autoGenerateEnabled === false) {
      return { message: '' };
    }

    const paths = [...new Set(
      (changesQuery.data?.entries ?? [])
        .filter((entry) => !entry.denied)
        .map((entry) => entry.path),
    )];
    return suggestGitCommitMessage(paths.length > 0 ? { paths } : {});
  }, [changesQuery.data?.entries, settingsQuery.data?.commitMessage?.autoGenerateEnabled]);

  const executeCommit = useCallback(async (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) {
      showToast('error', 'Commit message is required.');
      return;
    }

    try {
      const result = await commitMutation.mutateAsync({ message: trimmed });
      showToast('success', result.message);
      setCommitModalOpen(false);
      await refreshWorkspace();
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to commit changes.'));
    }
  }, [commitMutation, refreshWorkspace, showToast]);

  const closeWorkflowTemplateApplyConfirm = useCallback(() => {
    setWorkflowTemplateApplyConfirm(null);
  }, []);

  const executeWorkflowTemplateApply = useCallback(async (overwrite = false) => {
    const template = workflowTemplateApplyConfirm?.template;
    if (!template) {
      return;
    }

    try {
      const result = await applyWorkflowTemplateMutation.mutateAsync({
        templateId: template.id,
        targetPath: template.defaultTargetPath,
        overwrite,
      });
      showToast('success', result.message);
      setWorkflowTemplateApplyConfirm(null);
      await refreshWorkspace();
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to apply workflow template.'));
    }
  }, [applyWorkflowTemplateMutation, refreshWorkspace, showToast, workflowTemplateApplyConfirm]);

  const requestWorkflowTemplateApply = useCallback((template: GitWorkflowTemplateSummary) => {
    if (template.exists) {
      setWorkflowTemplateApplyConfirm({ template });
      return;
    }

    void (async () => {
      try {
        const result = await applyWorkflowTemplateMutation.mutateAsync({
          templateId: template.id,
          targetPath: template.defaultTargetPath,
        });
        showToast('success', result.message);
        await refreshWorkspace();
      } catch (error) {
        showToast('error', formatQueryError(error, 'Failed to apply workflow template.'));
      }
    })();
  }, [applyWorkflowTemplateMutation, refreshWorkspace, showToast]);

  const openPreferencesModal = useCallback(() => {
    preferences.resetFromSettings();
    setPreferencesModalOpen(true);
  }, [preferences]);

  const closePreferencesModal = useCallback(() => {
    setPreferencesModalOpen(false);
  }, []);

  const handlePreferencesSaved = useCallback(() => {
    setPreferencesModalOpen(false);
    showToast('success', 'Git preferences saved.');
    void settingsQuery.refetch();
  }, [settingsQuery, showToast]);

  const openWorkflowEditorModal = useCallback(() => {
    setWorkflowEditorModalOpen(true);
  }, []);

  const closeWorkflowEditorModal = useCallback(() => {
    setWorkflowEditorModalOpen(false);
  }, []);

  const saveWorkflowFile = useCallback(async (content: string) => {
    const path = workflowFileQuery.data?.path;
    if (!path) {
      showToast('error', 'Workflow file path is not available.');
      return;
    }

    try {
      const result = await saveWorkflowFileMutation.mutateAsync({ path, content });
      showToast('success', result.message);
      setWorkflowEditorModalOpen(false);
      await refreshWorkspace();
    } catch (error) {
      showToast('error', formatQueryError(error, 'Failed to save workflow file.'));
    }
  }, [refreshWorkspace, saveWorkflowFileMutation, showToast, workflowFileQuery.data?.path]);

  const requestCheckoutBranch = useCallback((branch: string) => {
    void (async () => {
      try {
        const result = await checkoutBranchMutation.mutateAsync({ branch });
        showToast('success', result.message);
        await refreshWorkspace();
      } catch (error) {
        showToast('error', formatQueryError(error, 'Failed to switch branch.'));
      }
    })();
  }, [checkoutBranchMutation, refreshWorkspace, showToast]);

    return {
    settingsQuery,
    preferences,
    preferencesModalOpen,
    openPreferencesModal,
    closePreferencesModal,
    handlePreferencesSaved,
    statusQuery,
    changesQuery,
    branchesQuery,
    diffQuery,
    prStatusQuery,
    workflowTemplatesQuery,
    workflowFileQuery,
    workflowEditorModalOpen,
    openWorkflowEditorModal,
    closeWorkflowEditorModal,
    saveWorkflowFile,
    isSavingWorkflowFile,
    connectDialog,
    showConnectPrompt,
    showConnectRemotePrompt,
    showDisconnect,
    disconnectLabel,
    statusLabel,
    currentBranch,
    requestCheckoutBranch,
    isCheckingOutBranch: checkoutBranchMutation.isPending,
    sectionCounts,
    hasCommittableChanges,
    selectedPaths,
    togglePathSelection,
    selectAllChanges,
    clearSelection,
    selectedDiff,
    openDiff,
    clearDiff,
    stagePaths,
    unstagePaths,
    confirmDiscardPaths,
    confirmDiscardAll,
    discardConfirm,
    closeDiscardConfirm,
    executeDiscard,
    refreshWorkspace,
    toast,
    canRunRemoteActions,
    isSyncActionPending,
    runFetch,
    runPull,
    requestPush,
    requestSync,
    protectedBranchConfirm,
    closeProtectedBranchConfirm,
    executeProtectedBranchAction,
    commitModalOpen,
    openCommitModal,
    closeCommitModal,
    executeCommit,
    suggestCommitMessage,
    isCommitting,
    workflowTemplateApplyConfirm,
    closeWorkflowTemplateApplyConfirm,
    requestWorkflowTemplateApply,
    executeWorkflowTemplateApply,
    isApplyingWorkflowTemplate,
  };
}

export type GitPageModel = ReturnType<typeof useGitPage>;
