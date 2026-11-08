import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, GitBranch, Github, KeyRound, Play } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { StepWizardShell } from '../../../shared/ui/StepWizardShell';
import type { GitGithubOAuthAvailability } from '../../../shared/api/contracts/git/oauth';
import type { GitAuthSettingsPublic, GitConnectStep } from '../../../shared/api/contracts/git/types';
import {
  applyAuthMethodToForm,
  buildGitConnectWizardSteps,
  GIT_CONNECT_REPOSITORY_STEP_INDEX,
  inferAuthMethodFromForm,
  resolveDefaultGitConnectAuthMethod,
  resolveInitialGitConnectStep,
  shouldSkipGitConnectAuthSteps,
  validateGitConnectWizardStep,
  hasCompletedGitAuthForWizard,
  type GitConnectAuthMethod,
} from '../gitConnectWizard';
import type { GitSettingsFormState } from '../gitSettingsForm';
import { GitConnectAuthMethodStep } from './GitConnectAuthMethodStep';
import { GitConnectAuthenticateStep } from './GitConnectAuthenticateStep';
import { GitConnectFinishingStep } from './GitConnectFinishingStep';
import { GitConnectRepositoryStep } from './GitConnectRepositoryStep';
import {
  applyGithubRemoteToForm,
  type GitConnectRepositoryState,
} from '../gitConnectRepository';

type GitConnectModalProps = {
  open: boolean;
  form: GitSettingsFormState;
  repository: GitConnectRepositoryState;
  storedServerAuth?: GitAuthSettingsPublic;
  requireFreshAuth?: boolean;
  workspacePath: string;
  isRepository: boolean;
  formError: string | null;
  isSaving: boolean;
  isTesting: boolean;
  githubOAuthAvailable: boolean;
  oauthAvailability: GitGithubOAuthAvailability | undefined;
  isGithubOAuthPending: boolean;
  onClose: () => void;
  onSubmit: () => Promise<boolean>;
  onTest: () => void;
  onFormChange: (next: GitSettingsFormState) => void;
  onRepositoryChange: (next: GitConnectRepositoryState) => void;
  onGithubOAuthStart: () => void;
  onPersistAuth?: (form: GitSettingsFormState) => Promise<void>;
  onSaveGithubOAuthConfig?: (clientId: string, clientSecret: string) => Promise<void>;
  isSavingGithubOAuthConfig?: boolean;
  onGitSignOut?: () => void;
  isSigningOutGit?: boolean;
  remoteOnly?: boolean;
  provisioningSteps?: GitConnectStep[];
  provisioningWarnings?: string[];
};

const AUTH_METHOD_LABEL_KEYS: Record<GitConnectAuthMethod, string> = {
  github_oauth: 'git.authMethod.githubOauth',
  https_pat: 'git.authMethod.httpsPat',
  ssh_key_path: 'git.authMethod.sshKeyPath',
};

const WIZARD_STEP_ICONS = [KeyRound, Github, GitBranch, Check] as const;

const GIT_WIZARD_STEP_KEYS = [
  { title: 'git.wizard.signInMethod', description: 'git.wizard.signInMethodDescription' },
  { title: 'git.wizard.signIn', description: 'git.wizard.signInDescription' },
  { title: 'git.wizard.repository', description: 'git.wizard.repositoryDescription' },
  { title: 'git.wizard.finishing', description: 'git.wizard.finishingDescription' },
] as const;

type FinishingPhase = 'idle' | 'running' | 'complete' | 'failed';

const FINISHING_CLOSE_DELAY_MS = 1600;

export const GitConnectModal: React.FC<GitConnectModalProps> = ({
  open,
  form,
  repository,
  storedServerAuth,
  requireFreshAuth = false,
  workspacePath,
  isRepository,
  formError,
  isSaving,
  isTesting: _isTesting,
  githubOAuthAvailable,
  oauthAvailability,
  isGithubOAuthPending,
  onClose,
  onSubmit,
  onTest: _onTest,
  onFormChange,
  onRepositoryChange,
  onGithubOAuthStart,
  onPersistAuth,
  onSaveGithubOAuthConfig,
  isSavingGithubOAuthConfig = false,
  onGitSignOut,
  isSigningOutGit = false,
  remoteOnly = false,
  provisioningSteps = [],
  provisioningWarnings = [],
}) => {
  const t = useCultureT();
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  const [finishingPhase, setFinishingPhase] = useState<FinishingPhase>('idle');
  const [authMethod, setAuthMethod] = useState<GitConnectAuthMethod>(
    resolveDefaultGitConnectAuthMethod(),
  );
  const wasOpenRef = useRef(false);

  const connectForm: GitSettingsFormState = applyGithubRemoteToForm(
    { ...form, enabled: true },
    repository,
  );
  const wizardContext = useMemo(
    () => ({ requireFreshAuth }),
    [requireFreshAuth],
  );
  const hasStoredAuth = shouldSkipGitConnectAuthSteps(
    connectForm,
    storedServerAuth,
    wizardContext,
  );
  const initialStep = resolveInitialGitConnectStep(hasStoredAuth);
  const fullStep = step;

  useEffect(() => {
    const justOpened = open && !wasOpenRef.current;
    wasOpenRef.current = open;

    if (!justOpened) {
      return;
    }

    const storedAuth = shouldSkipGitConnectAuthSteps(
      { ...form, enabled: true },
      storedServerAuth,
      wizardContext,
    );
    setStep(resolveInitialGitConnectStep(storedAuth));
    setStepError(null);
    setFinishingPhase('idle');
    setAuthMethod(inferAuthMethodFromForm(form));
  }, [form, open, requireFreshAuth, storedServerAuth, wizardContext]);

  useEffect(() => {
    if (hasStoredAuth) {
      setStep((current) => (
        current < GIT_CONNECT_REPOSITORY_STEP_INDEX
          ? GIT_CONNECT_REPOSITORY_STEP_INDEX
          : current
      ));
      setStepError(null);
      return;
    }

    setStep((current) => (
      current >= GIT_CONNECT_REPOSITORY_STEP_INDEX
        ? 0
        : current
    ));
  }, [hasStoredAuth]);

  useEffect(() => {
    if (
      hasStoredAuth
      || !repository.connectToGithub
      || step !== GIT_CONNECT_REPOSITORY_STEP_INDEX
    ) {
      return;
    }

    onRepositoryChange({ ...repository, connectToGithub: false });
  }, [hasStoredAuth, onRepositoryChange, repository, step]);

  const handleFormChange = (next: GitSettingsFormState) => {
    onFormChange({ ...next, enabled: true });
  };

  const handleAuthMethodChange = (method: GitConnectAuthMethod) => {
    setAuthMethod(method);
    setStepError(null);
    handleFormChange(applyAuthMethodToForm(connectForm, method));
  };

  const handleSkipToLocalOnly = () => {
    onRepositoryChange({ ...repository, connectToGithub: false });
    setStep(GIT_CONNECT_REPOSITORY_STEP_INDEX);
    setStepError(null);
  };

  const wizardSteps = useMemo(
    () => buildGitConnectWizardSteps(hasStoredAuth).map((wizardStep, index) => ({
      ...wizardStep,
      title: t(GIT_WIZARD_STEP_KEYS[index].title),
      description: t(GIT_WIZARD_STEP_KEYS[index].description),
      icon: WIZARD_STEP_ICONS[index],
    })),
    [hasStoredAuth, t],
  );

  const activeError = stepError || ((finishingPhase === 'idle' || finishingPhase === 'failed') ? formError : null);
  const isFinishingStep = step === wizardSteps.length - 1;
  const isFinishingBusy = finishingPhase === 'running' || finishingPhase === 'complete';

  const handleStart = async () => {
    if (finishingPhase !== 'idle' && finishingPhase !== 'failed') {
      return;
    }

    setStepError(null);
    setFinishingPhase('running');

    try {
      const success = await onSubmit();
      if (!success) {
        setFinishingPhase('failed');
        return;
      }

      setFinishingPhase('complete');
      window.setTimeout(() => {
        onClose();
      }, FINISHING_CLOSE_DELAY_MS);
    } catch {
      setFinishingPhase('failed');
    }
  };

  const handleNext = async (): Promise<boolean> => {
    const validationError = validateGitConnectWizardStep(
      fullStep,
      connectForm,
      authMethod,
      githubOAuthAvailable,
      repository,
      storedServerAuth,
    );
    if (validationError) {
      setStepError(validationError);
      return false;
    }

    if (fullStep === 1 && onPersistAuth && hasCompletedGitAuthForWizard(connectForm, storedServerAuth)) {
      try {
        await onPersistAuth(connectForm);
      } catch {
        return false;
      }
    }

    setStepError(null);
    return true;
  };

  if (!open) {
    return null;
  }

  return (
    <StepWizardShell
      title={t('git.connect.title')}
      subtitle={remoteOnly
        ? t('git.connect.subtitleRemoteOnly')
        : hasStoredAuth
          ? t('git.connect.subtitleStoredAuth')
          : t('git.connect.subtitleDefault')}
      titleIcon={GitBranch}
      steps={wizardSteps}
      step={step}
      onStepChange={(nextStep) => {
        setStepError(null);
        setStep(Math.max(0, Math.min(nextStep, wizardSteps.length - 1)));
      }}
      onClose={onClose}
      onBackdropClick={isFinishingBusy ? undefined : onClose}
      size="5xl"
      canMovePrev={step > initialStep && finishingPhase !== 'running' && finishingPhase !== 'complete'}
      onNext={handleNext}
      finalStepAction={isFinishingStep ? {
        label: finishingPhase === 'running'
          ? t('git.connect.starting')
          : finishingPhase === 'failed'
            ? t('git.connect.retry')
            : t('git.connect.start'),
        icon: finishingPhase === 'running'
          ? undefined
          : <Play className="w-3.5 h-3.5" />,
        disabled: isSaving || isGithubOAuthPending || finishingPhase === 'running' || finishingPhase === 'complete',
        onClick: handleStart,
      } : undefined}
    >
      {activeError ? (
        <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
          {activeError}
        </div>
      ) : null}

      {fullStep === 0 ? (
        <GitConnectAuthMethodStep
          value={authMethod}
          githubOAuthAvailable={githubOAuthAvailable}
          onChange={handleAuthMethodChange}
          onLocalOnly={remoteOnly ? undefined : handleSkipToLocalOnly}
        />
      ) : null}

      {fullStep === 1 ? (
        <GitConnectAuthenticateStep
          authMethod={authMethod}
          form={connectForm}
          oauthAvailability={oauthAvailability}
          isGithubOAuthPending={isGithubOAuthPending}
          onFormChange={handleFormChange}
          onGithubOAuthStart={onGithubOAuthStart}
          onSaveGithubOAuthConfig={onSaveGithubOAuthConfig}
          isSavingGithubOAuthConfig={isSavingGithubOAuthConfig}
          onLocalOnly={remoteOnly ? undefined : handleSkipToLocalOnly}
          onGitSignOut={onGitSignOut}
          isSigningOutGit={isSigningOutGit}
        />
      ) : null}

      {fullStep === 2 ? (
        <GitConnectRepositoryStep
          form={connectForm}
          repository={repository}
          workspacePath={workspacePath}
          isRepository={isRepository}
          onFormChange={handleFormChange}
          onRepositoryChange={onRepositoryChange}
          hasStoredAuth={hasStoredAuth}
        />
      ) : null}

      {fullStep === 3 ? (
        <GitConnectFinishingStep
          form={connectForm}
          repository={repository}
          workspacePath={workspacePath}
          isRepository={isRepository}
          authMethod={authMethod}
          authMethodLabel={t(AUTH_METHOD_LABEL_KEYS[authMethod])}
          finishingPhase={finishingPhase}
          provisioningSteps={provisioningSteps}
          provisioningWarnings={provisioningWarnings}
        />
      ) : null}
    </StepWizardShell>
  );
};
