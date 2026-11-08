import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { formatQueryError } from '../../../shared/api/client';
import {
  fetchGitGithubOAuthSession,
  gitQueryKeys,
  startGitGithubOAuth,
  useConnectGitMutation,
  useGitGithubOAuthAvailabilityQuery,
  useGitStatusQuery,
  useTestGitSettingsMutation,
  useUpdateGitCredentialsMutation,
  useUpdateGitSettingsMutation,
} from '../../../shared/api/queries/git';
import {
  GIT_GITHUB_OAUTH_MESSAGE_TYPE,
  type GitGithubOAuthMessage,
} from '../../../shared/api/contracts/git/oauth';
import {
  createEmptyGitSettingsForm,
  toGitSettingsForm,
  toGitSettingsPayload,
  validateGitSettingsForm,
  type GitSettingsFormState,
} from '../gitSettingsForm';
import type { GitConnectStep, GitSettingsPublic } from '../../../shared/api/contracts/git/types';
import { buildGitAuthSettingsPatch, buildGitAuthClearPatch, buildGitRemoteDisconnectPatch } from '../gitAuthSettingsPatch';
import {
  buildGitConnectWizardForm,
  hasCompletedGitAuthForWizard,
  hasStoredGitAuthFromServer,
} from '../gitConnectWizard';
import {
  applyGithubRemoteToForm,
  createDefaultGitConnectRepositoryState,
  inferConnectRepositoryStateFromForm,
  resolveGitDisconnectTargetLabel,
  type GitConnectRepositoryState,
} from '../gitConnectRepository';
import { buildGitConnectRequest } from '../gitConnectRequest';

type UseGitConnectDialogOptions = {
  settings: GitSettingsPublic | undefined;
  onConnected?: () => void | Promise<void>;
  onDisconnected?: () => void | Promise<void>;
  onDisconnectFailed?: (message: string) => void;
  /** When true, opens the connect wizard automatically once (VS Code–style first-run flow). */
  autoOpen?: boolean;
};

const OAUTH_POLL_INTERVAL_MS = 1500;
const OAUTH_POLL_TIMEOUT_MS = 5 * 60 * 1000;

export function useGitConnectDialog({
  settings,
  onConnected,
  onDisconnected,
  onDisconnectFailed,
  autoOpen = false,
}: UseGitConnectDialogOptions) {
  const queryClient = useQueryClient();
  const updateMutation = useUpdateGitSettingsMutation();
  const connectMutation = useConnectGitMutation();
  const credentialsMutation = useUpdateGitCredentialsMutation();
  const testMutation = useTestGitSettingsMutation();
  const statusQuery = useGitStatusQuery();
  const oauthAvailabilityQuery = useGitGithubOAuthAvailabilityQuery();

  const [connectModalOpen, setConnectModalOpen] = useState(false);
  const [connectForm, setConnectForm] = useState<GitSettingsFormState>(createEmptyGitSettingsForm());
  const [connectRepository, setConnectRepository] = useState<GitConnectRepositoryState>(
    createDefaultGitConnectRepositoryState,
  );
  const [connectError, setConnectError] = useState<string | null>(null);
  const [isSavingConnect, setIsSavingConnect] = useState(false);
  const [isTestingConnect, setIsTestingConnect] = useState(false);
  const [isGithubOAuthPending, setIsGithubOAuthPending] = useState(false);
  const [isSavingGithubOAuthConfig, setIsSavingGithubOAuthConfig] = useState(false);
  const [isSigningOutGit, setIsSigningOutGit] = useState(false);
  const [isDisconnectingGit, setIsDisconnectingGit] = useState(false);
  const [disconnectConfirmOpen, setDisconnectConfirmOpen] = useState(false);
  const [connectRemoteOnly, setConnectRemoteOnly] = useState(false);
  const [requireFreshAuth, setRequireFreshAuth] = useState(false);
  const [connectSteps, setConnectSteps] = useState<GitConnectStep[]>([]);
  const [connectWarnings, setConnectWarnings] = useState<string[]>([]);
  const autoOpenedRef = useRef(false);

  const oauthSessionIdRef = useRef<string | null>(null);
  const oauthPollTimerRef = useRef<number | null>(null);

  const clearOauthPolling = useCallback(() => {
    if (oauthPollTimerRef.current != null) {
      window.clearInterval(oauthPollTimerRef.current);
      oauthPollTimerRef.current = null;
    }
    oauthSessionIdRef.current = null;
    setIsGithubOAuthPending(false);
  }, []);

  useEffect(() => () => {
    clearOauthPolling();
  }, [clearOauthPolling]);

  const persistConnectAuth = useCallback(async (form: GitSettingsFormState): Promise<void> => {
    setConnectError(null);
    try {
      const status = await credentialsMutation.mutateAsync(buildGitAuthSettingsPatch(form));
      setConnectForm((current) => ({
        ...toGitSettingsForm(settings ?? { enabled: true }, status),
        enabled: true,
        remoteUrl: current.remoteUrl,
        defaultBranch: current.defaultBranch,
        localBranch: current.localBranch,
        autoGenerateCommitMessage: current.autoGenerateCommitMessage,
        commitMessageTemplate: current.commitMessageTemplate,
        prOwner: current.prOwner,
        prRepo: current.prRepo,
      }));
    } catch (error) {
      setConnectError(formatQueryError(error, 'Failed to save git credentials.'));
      throw error;
    }
  }, [credentialsMutation, settings]);

  const applyGithubOAuthResult = useCallback((message: GitGithubOAuthMessage) => {
    if (message.status !== 'complete' || !message.accessToken) {
      setConnectError(message.error || 'GitHub sign-in failed.');
      clearOauthPolling();
      return;
    }

    setConnectForm((current) => {
      const username = message.username?.trim() || 'x-access-token';
      const next: GitSettingsFormState = {
        ...current,
        enabled: true,
        authKind: 'https_pat',
        authUsername: username,
        authToken: message.accessToken,
        authTokenEnvKey: '',
        prOwner: current.prOwner.trim() || (username !== 'x-access-token' ? username : current.prOwner),
      };
      void persistConnectAuth(next);
      return next;
    });
    setConnectError(null);
    clearOauthPolling();

    void queryClient.refetchQueries({ queryKey: gitQueryKeys.settings() });
  }, [clearOauthPolling, persistConnectAuth, queryClient]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) {
        return;
      }

      const payload = event.data as Partial<GitGithubOAuthMessage>;
      if (payload?.type !== GIT_GITHUB_OAUTH_MESSAGE_TYPE) {
        return;
      }

      if (oauthSessionIdRef.current && payload.sessionId !== oauthSessionIdRef.current) {
        return;
      }

      applyGithubOAuthResult(payload as GitGithubOAuthMessage);
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [applyGithubOAuthResult]);

  const pollGithubOAuthSession = useCallback((sessionId: string) => {
    const startedAt = Date.now();

    oauthPollTimerRef.current = window.setInterval(() => {
      void (async () => {
        if (Date.now() - startedAt > OAUTH_POLL_TIMEOUT_MS) {
          setConnectError('GitHub sign-in timed out. Please try again.');
          clearOauthPolling();
          return;
        }

        try {
          const session = await fetchGitGithubOAuthSession(sessionId);
          if (session.status === 'pending') {
            return;
          }

          applyGithubOAuthResult({
            type: GIT_GITHUB_OAUTH_MESSAGE_TYPE,
            sessionId,
            status: session.status === 'complete' ? 'complete' : 'error',
            username: session.username,
            accessToken: session.accessToken,
            error: session.error,
          });
        } catch (error) {
          setConnectError(formatQueryError(error, 'Failed to read GitHub sign-in status.'));
          clearOauthPolling();
        }
      })();
    }, OAUTH_POLL_INTERVAL_MS);
  }, [applyGithubOAuthResult, clearOauthPolling]);

  const openConnectModal = useCallback((options?: { focusRemote?: boolean; requireFreshAuth?: boolean }) => {
    const next = buildGitConnectWizardForm(settings, statusQuery.data);
    const repositoryState = inferConnectRepositoryStateFromForm(next);
    setConnectForm(next);
    setConnectRepository(options?.focusRemote
      ? { ...createDefaultGitConnectRepositoryState(), connectToGithub: true }
      : repositoryState);
    setConnectRemoteOnly(options?.focusRemote === true);
    setRequireFreshAuth(options?.requireFreshAuth === true);
    setConnectError(null);
    setConnectSteps([]);
    setConnectWarnings([]);
    setConnectModalOpen(true);
  }, [settings, statusQuery.data]);

  const closeConnectModal = useCallback(() => {
    clearOauthPolling();
    setConnectModalOpen(false);
    setConnectRemoteOnly(false);
    setRequireFreshAuth(false);
    setConnectError(null);
    setConnectSteps([]);
    setConnectWarnings([]);
  }, [clearOauthPolling]);

  useEffect(() => {
    if (!autoOpen || autoOpenedRef.current || connectModalOpen) {
      return;
    }

    autoOpenedRef.current = true;
    openConnectModal();
  }, [autoOpen, connectModalOpen, openConnectModal]);

  useEffect(() => {
    if (!connectModalOpen || !statusQuery.data) {
      return;
    }

    if (!hasStoredGitAuthFromServer(statusQuery.data.auth)) {
      return;
    }

    const fromStatus = toGitSettingsForm(settings ?? { enabled: true }, statusQuery.data);
    setConnectForm((current) => ({
      ...current,
      authKind: fromStatus.authKind,
      authUsername: fromStatus.authUsername,
      authToken: fromStatus.authToken,
      authTokenEnvKey: fromStatus.authTokenEnvKey,
      authSshKeyPath: fromStatus.authSshKeyPath,
    }));
  }, [connectModalOpen, settings, statusQuery.data]);

  const handleGithubOAuthStart = useCallback(async () => {
    setConnectError(null);
    setIsGithubOAuthPending(true);

    try {
      const started = await startGitGithubOAuth();
      oauthSessionIdRef.current = started.sessionId;
      window.open(started.authorizeUrl, 'appendo-git-github-oauth', 'width=720,height=780,noopener,noreferrer');
      pollGithubOAuthSession(started.sessionId);
    } catch (error) {
      setConnectError(formatQueryError(error, 'Failed to start GitHub sign-in.'));
      clearOauthPolling();
    }
  }, [clearOauthPolling, pollGithubOAuthSession]);

  const handleSaveGithubOAuthConfig = useCallback(async (clientId: string, clientSecret: string) => {
    setConnectError(null);
    setIsSavingGithubOAuthConfig(true);
    try {
      await updateMutation.mutateAsync({
        githubOAuth: {
          clientId: clientId.trim(),
          clientSecret: clientSecret.trim(),
        },
      });
      await oauthAvailabilityQuery.refetch();
    } catch (error) {
      setConnectError(formatQueryError(error, 'Failed to save GitHub OAuth credentials.'));
      throw error;
    } finally {
      setIsSavingGithubOAuthConfig(false);
    }
  }, [oauthAvailabilityQuery, updateMutation]);

  const handleGitSignOut = useCallback(async () => {
    setConnectError(null);
    setIsSigningOutGit(true);
    try {
      await credentialsMutation.mutateAsync(buildGitAuthClearPatch());
      setConnectForm((current) => ({
        ...current,
        authKind: 'none',
        authUsername: '',
        authToken: '',
        authTokenEnvKey: '',
        authSshKeyPath: '',
      }));
      await queryClient.refetchQueries({ queryKey: gitQueryKeys.settings() });
    } catch (error) {
      setConnectError(formatQueryError(error, 'Failed to sign out of GitHub.'));
    } finally {
      setIsSigningOutGit(false);
    }
  }, [credentialsMutation, queryClient]);

  const disconnectTargetLabel = resolveGitDisconnectTargetLabel(
    settings ? toGitSettingsForm(settings, statusQuery.data) : createEmptyGitSettingsForm(),
  );

  const requestGitDisconnect = useCallback(() => {
    setDisconnectConfirmOpen(true);
  }, []);

  const cancelGitDisconnect = useCallback(() => {
    if (isDisconnectingGit) {
      return;
    }
    setDisconnectConfirmOpen(false);
  }, [isDisconnectingGit]);

  const confirmGitDisconnect = useCallback(async () => {
    setConnectError(null);
    setIsDisconnectingGit(true);
    try {
      await updateMutation.mutateAsync(buildGitRemoteDisconnectPatch());
      clearOauthPolling();
      setConnectForm(createEmptyGitSettingsForm());
      setConnectRepository(createDefaultGitConnectRepositoryState());
      setConnectModalOpen(false);
      setConnectRemoteOnly(false);
      setRequireFreshAuth(false);
      autoOpenedRef.current = false;
      await queryClient.invalidateQueries({ queryKey: gitQueryKeys.settings() });
      await queryClient.refetchQueries({ queryKey: gitQueryKeys.settings() });
      await statusQuery.refetch();
      setDisconnectConfirmOpen(false);
      await onDisconnected?.();
    } catch (error) {
      const message = formatQueryError(error, 'Failed to disconnect from remote Git.');
      setConnectError(message);
      onDisconnectFailed?.(message);
    } finally {
      setIsDisconnectingGit(false);
    }
  }, [clearOauthPolling, onDisconnected, onDisconnectFailed, queryClient, statusQuery, updateMutation]);

  const handleConnectTest = useCallback(async () => {
    const payloadForm = applyGithubRemoteToForm(
      { ...connectForm, enabled: true },
      connectRepository,
    );
    const validationError = validateGitSettingsForm(
      payloadForm,
      { allowLocalOnly: !connectRepository.connectToGithub },
    );
    if (validationError) {
      setConnectError(validationError);
      return;
    }

    if (!connectRepository.connectToGithub) {
      setConnectError('Connection test requires a GitHub remote.');
      return;
    }

    setConnectError(null);
    setIsTestingConnect(true);
    try {
      const result = await testMutation.mutateAsync(toGitSettingsPayload(payloadForm));
      if (!result.success) {
        setConnectError(result.message);
      }
    } catch (error) {
      setConnectError(formatQueryError(error, 'Failed to test git settings.'));
    } finally {
      setIsTestingConnect(false);
    }
  }, [connectForm, connectRepository, testMutation]);

  const handleConnectSubmit = useCallback(async (): Promise<boolean> => {
    const payloadForm = applyGithubRemoteToForm(
      { ...connectForm, enabled: true },
      connectRepository,
    );
    const validationError = validateGitSettingsForm(
      payloadForm,
      { allowLocalOnly: !connectRepository.connectToGithub },
    );
    if (validationError) {
      setConnectError(validationError);
      return false;
    }

    setConnectError(null);
    setIsSavingConnect(true);
    try {
      const mode = connectRemoteOnly ? 'remoteOnly' : 'full';
      const result = await connectMutation.mutateAsync(
        buildGitConnectRequest(payloadForm, connectRepository, mode),
      );

      setConnectSteps(result.steps);
      setConnectWarnings(result.warnings);

      if (!result.success) {
        const stepError = result.steps.find((step) => step.status === 'error')?.message;
        setConnectError(stepError || result.message);
        return false;
      }

      await statusQuery.refetch();
      clearOauthPolling();
      await onConnected?.();
      return true;
    } catch (error) {
      setConnectError(formatQueryError(error, 'Failed to connect git.'));
      return false;
    } finally {
      setIsSavingConnect(false);
    }
  }, [clearOauthPolling, connectForm, connectMutation, connectRemoteOnly, connectRepository, onConnected, statusQuery]);

  return {
    connectModalOpen,
    connectForm,
    connectRepository,
    setConnectForm,
    setConnectRepository,
    connectError,
    isSavingConnect,
    isTestingConnect,
    isGithubOAuthPending,
    isSavingGithubOAuthConfig,
    isSigningOutGit,
    isDisconnectingGit,
    disconnectConfirmOpen,
    disconnectTargetLabel,
    connectRemoteOnly,
    requireFreshAuth,
    connectSteps,
    connectWarnings,
    githubOAuthAvailable: oauthAvailabilityQuery.data?.available === true,
    oauthAvailability: oauthAvailabilityQuery.data,
    storedServerAuth: statusQuery.data?.auth,
    workspacePath: statusQuery.data?.workspacePath ?? '',
    isRepository: statusQuery.data?.isRepository ?? false,
    openConnectModal,
    closeConnectModal,
    handleConnectTest,
    handleConnectSubmit,
    handleGithubOAuthStart,
    handleSaveGithubOAuthConfig,
    persistConnectAuth,
    handleGitSignOut,
    requestGitDisconnect,
    cancelGitDisconnect,
    confirmGitDisconnect,
  };
}

export type GitConnectDialogModel = ReturnType<typeof useGitConnectDialog>;
