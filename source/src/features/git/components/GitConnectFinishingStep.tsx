import React from 'react';
import { Check, Loader2 } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { columnCommonKey } from '../../../core/culture/translations/cultureKeyHelpers';
import type { GitConnectStep } from '../../../shared/api/contracts/git/types';
import type { GitConnectAuthMethod } from '../gitConnectWizard';
import type { GitSettingsFormState } from '../gitSettingsForm';
import {
  buildGithubWebUrl,
  resolveExistingRepoSyncOverrideMessage,
  resolveGithubAccountLabel,
  resolveGithubOwner,
  type GitConnectRepositoryState,
} from '../gitConnectRepository';
import { GitConnectProvisioningSteps } from './GitConnectProvisioningSteps';

type GitConnectFinishingStepProps = {
  form: GitSettingsFormState;
  repository: GitConnectRepositoryState;
  workspacePath: string;
  isRepository: boolean;
  authMethod: GitConnectAuthMethod;
  authMethodLabel: string;
  finishingPhase: 'idle' | 'running' | 'complete' | 'failed';
  provisioningSteps: GitConnectStep[];
  provisioningWarnings: string[];
};

const SummaryRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="px-4 py-3">
    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</div>
    <div className="mt-1 text-sm font-medium text-slate-800 break-all">{children}</div>
  </div>
);

export const GitConnectFinishingStep: React.FC<GitConnectFinishingStepProps> = ({
  form,
  repository,
  workspacePath,
  isRepository,
  authMethod,
  authMethodLabel,
  finishingPhase,
  provisioningSteps,
  provisioningWarnings,
}) => {
  const t = useCultureT();
  const owner = resolveGithubOwner(form);
  const repoName = form.prRepo.trim();
  const githubRepoRef = owner && repoName ? `${owner}/${repoName}` : null;
  const syncOverrideMessage = repository.connectToGithub
    ? resolveExistingRepoSyncOverrideMessage(
      repository.existingRepoSync,
      githubRepoRef,
      workspacePath,
    )
    : null;

  if (finishingPhase === 'complete') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 py-4 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Check className="size-6" aria-hidden />
          </div>
          <p className="text-base font-semibold text-slate-800">{t('git.finishing.completeTitle')}</p>
          <p className="max-w-md text-sm text-slate-600">
            {repository.connectToGithub
              ? t('git.finishing.completeGithub')
              : t('git.finishing.completeLocal')}
          </p>
        </div>

        <GitConnectProvisioningSteps
          steps={provisioningSteps}
          warnings={provisioningWarnings}
        />
      </div>
    );
  }

  if (finishingPhase === 'running') {
    return (
      <div className="space-y-4">
        <div className="flex flex-col items-center justify-center gap-3 py-6 text-center">
          <Loader2 className="size-8 animate-spin text-indigo-600" aria-hidden />
          <p className="text-base font-semibold text-slate-800">{t('git.finishing.applyingTitle')}</p>
          <p className="max-w-md text-sm text-slate-600">
            {t('git.finishing.applyingBody')}
          </p>
        </div>
      </div>
    );
  }

  if (finishingPhase === 'failed') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-rose-700">
          {t('git.finishing.failedBody')}
        </p>

        <GitConnectProvisioningSteps
          steps={provisioningSteps}
          warnings={provisioningWarnings}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        {t('git.finishing.reviewIntroPrefix')}{' '}
        <span className="font-semibold text-slate-800">{t('git.connect.start')}</span>{' '}
        {t('git.finishing.reviewIntroSuffix')}
      </p>

      <div className="rounded-lg border border-slate-200 bg-slate-50/80 divide-y divide-slate-200">
        <SummaryRow label={t('git.finishing.localWorkspace')}>
          <span className="font-mono text-xs">{workspacePath || '—'}</span>
        </SummaryRow>

        <SummaryRow label={t('git.finishing.localRepository')}>
          {isRepository ? t('git.finishing.existingRepository') : t('git.finishing.newRepository')}
        </SummaryRow>

        {repository.connectToGithub ? (
          <>
            <SummaryRow label={t('git.finishing.githubAccount')}>
              {resolveGithubAccountLabel(form)}
            </SummaryRow>

            <SummaryRow label={t('git.finishing.signInMethod')}>
              {authMethodLabel}
            </SummaryRow>

            <SummaryRow label={t('git.finishing.githubRemote')}>
              {buildGithubWebUrl(owner, repoName) || '—'}
            </SummaryRow>

            <div className="grid grid-cols-1 gap-0 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
              <SummaryRow label={t('git.finishing.defaultBranch')}>
                {form.defaultBranch.trim() || '—'}
              </SummaryRow>
              <SummaryRow label={t('git.finishing.visibility')}>
                <span className="capitalize">{repository.repoVisibility}</span>
              </SummaryRow>
            </div>

            {repository.repoDescription.trim() ? (
              <SummaryRow label={t('git.finishing.description')}>
                {repository.repoDescription.trim()}
              </SummaryRow>
            ) : null}

            {syncOverrideMessage ? (
              <div className="px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t('git.finishing.existingRepoHandling')}
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {repository.existingRepoSync === 'use_workspace'
                    ? t('git.finishing.syncUseWorkspace')
                    : t('git.finishing.syncUseGithub')}
                </p>
                <p className="mt-2 text-sm font-bold text-rose-700">
                  {syncOverrideMessage}
                </p>
              </div>
            ) : null}
          </>
        ) : (
          <SummaryRow label={t(columnCommonKey('connection'))}>
            {t('git.finishing.remoteLocalOnly')}
          </SummaryRow>
        )}

        {!repository.connectToGithub && authMethod !== 'github_oauth' ? (
          <SummaryRow label={t('git.finishing.signInMethod')}>
            {authMethodLabel}
          </SummaryRow>
        ) : null}
      </div>
    </div>
  );
};
