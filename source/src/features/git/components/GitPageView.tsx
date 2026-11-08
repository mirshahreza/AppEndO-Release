import React from 'react';

import { AppToast, LoadingSpinner } from '../../../shared/ui';
import { cn } from '../../../lib/utils';

import type { GitPageModel } from '../hooks/useGitPage';

import { GitConnectModal } from './GitConnectModal';

import { GitDisconnectConfirmModal } from './GitDisconnectConfirmModal';

import { GitDisconnectedPrompt } from './GitDisconnectedPrompt';

import { GitChangesPanel } from './GitChangesPanel';

import { GitCommitModal } from './GitCommitModal';

import { GitDiscardConfirmModal } from './GitDiscardConfirmModal';

import { GitProtectedBranchConfirmModal } from './GitProtectedBranchConfirmModal';

import { GitWorkflowEditorModal } from './GitWorkflowEditorModal';

import { GitWorkflowTemplateApplyConfirmModal } from './GitWorkflowTemplateApplyConfirmModal';

import { GitPreferencesModal } from './GitPreferencesModal';
import { GitPageFooter } from './GitPageFooter';
import { GitToolbar } from './GitToolbar';



type GitPageViewProps = {

  page: GitPageModel;

};



const gitConnectModalProps = (page: GitPageModel) => ({
  open: page.connectDialog.connectModalOpen,
  form: page.connectDialog.connectForm,
  repository: page.connectDialog.connectRepository,
  storedServerAuth: page.connectDialog.storedServerAuth,
  requireFreshAuth: page.connectDialog.requireFreshAuth,
  workspacePath: page.connectDialog.workspacePath,
  isRepository: page.connectDialog.isRepository,
  formError: page.connectDialog.connectError,
  isSaving: page.connectDialog.isSavingConnect,
  isTesting: page.connectDialog.isTestingConnect,
  githubOAuthAvailable: page.connectDialog.githubOAuthAvailable,
  oauthAvailability: page.connectDialog.oauthAvailability,
  isGithubOAuthPending: page.connectDialog.isGithubOAuthPending,
  onClose: page.connectDialog.closeConnectModal,
  onSubmit: () => page.connectDialog.handleConnectSubmit(),
  onTest: () => { void page.connectDialog.handleConnectTest(); },
  onFormChange: page.connectDialog.setConnectForm,
  onRepositoryChange: page.connectDialog.setConnectRepository,
  onGithubOAuthStart: () => { void page.connectDialog.handleGithubOAuthStart(); },
  onPersistAuth: page.connectDialog.persistConnectAuth,
  onSaveGithubOAuthConfig: page.connectDialog.handleSaveGithubOAuthConfig,
  isSavingGithubOAuthConfig: page.connectDialog.isSavingGithubOAuthConfig,
  onGitSignOut: () => { void page.connectDialog.handleGitSignOut(); },
  isSigningOutGit: page.connectDialog.isSigningOutGit,
  remoteOnly: page.connectDialog.connectRemoteOnly,
  provisioningSteps: page.connectDialog.connectSteps,
  provisioningWarnings: page.connectDialog.connectWarnings,
});

export const GitPageView: React.FC<GitPageViewProps> = ({ page }) => {
  const showDiffPane = Boolean(page.selectedDiff);

  if (page.statusQuery.isLoading || page.settingsQuery.isLoading) {
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-white">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <>
      {page.showConnectPrompt ? (
        <div className="flex h-full min-h-0 w-full flex-col bg-white" id="git-page-wrapper">
          <GitDisconnectedPrompt
            onConnect={page.connectDialog.openConnectModal}
            showDisconnect={page.showDisconnect}
            disconnectLabel={page.disconnectLabel}
            onDisconnect={page.connectDialog.requestGitDisconnect}
            isDisconnecting={page.connectDialog.isDisconnectingGit}
          />
        </div>
      ) : (
        <div className="w-full h-full flex flex-col bg-white min-h-0" id="git-page-wrapper">
          <GitToolbar page={page} />

          <div
            className={cn(
              'flex flex-1 min-h-0 flex-col overflow-hidden pt-0',
              showDiffPane ? 'pl-2.5 pr-0' : 'px-2.5',
            )}
          >
            <GitChangesPanel page={page} />
          </div>

          <GitPageFooter page={page} />

          <GitDiscardConfirmModal page={page} />
          <GitWorkflowTemplateApplyConfirmModal page={page} />
          <GitProtectedBranchConfirmModal page={page} />
          <GitCommitModal page={page} />
          <GitWorkflowEditorModal page={page} />
          <GitPreferencesModal
            open={page.preferencesModalOpen}
            preferences={page.preferences}
            onClose={page.closePreferencesModal}
            onSaved={page.handlePreferencesSaved}
            showDisconnect={page.showDisconnect}
            disconnectLabel={page.disconnectLabel}
            onDisconnect={page.connectDialog.requestGitDisconnect}
            isDisconnecting={page.connectDialog.isDisconnectingGit}
            showConnectRemotePrompt={page.showConnectRemotePrompt}
            onConnectRemote={() => page.connectDialog.openConnectModal({ focusRemote: true })}
          />
        </div>
      )}

      <GitConnectModal {...gitConnectModalProps(page)} />

      {page.connectDialog.disconnectConfirmOpen ? (
        <GitDisconnectConfirmModal
          targetLabel={page.disconnectLabel}
          isDisconnecting={page.connectDialog.isDisconnectingGit}
          onCancel={page.connectDialog.cancelGitDisconnect}
          onConfirm={() => { void page.connectDialog.confirmGitDisconnect(); }}
        />
      ) : null}

      {page.toast ? (
        <AppToast type={page.toast.type} text={page.toast.text} />
      ) : null}
    </>
  );
};
