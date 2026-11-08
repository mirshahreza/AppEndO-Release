import React from 'react';
import { AlertTriangle, CheckCircle2, Circle, Loader2, XCircle } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AppButton, CreateEditModalShell } from '../../shared/ui';
import { useCultureT } from '../../core/culture/CultureContext';
import { installKey } from '../../core/culture/translations/cultureKeyHelpers';

export type InstallProgressStepStatus = 'pending' | 'running' | 'done' | 'warning' | 'error';

export type InstallProgressStep = {
  id: string;
  label: string;
  status: InstallProgressStepStatus;
};

export type InstallProgressState = {
  open: boolean;
  steps: InstallProgressStep[];
  finished: boolean;
  error?: string;
  warnings?: string[];
};

type InstallProgressDialogProps = {
  progress: InstallProgressState | null;
  onClose: () => void;
  onGoHome: () => void;
};

export const InstallProgressDialog: React.FC<InstallProgressDialogProps> = ({
  progress,
  onClose,
  onGoHome,
}) => {
  const t = useCultureT();

  if (!progress?.open) {
    return null;
  }

  const isRunning = progress.steps.some((step) => step.status === 'running');
  const canDismiss = Boolean(progress.error) && !isRunning;

  return (
    <CreateEditModalShell
      title={progress.finished ? t(installKey('progress.completeTitle')) : t(installKey('progress.installingTitle'))}
      backdrop="adminLight"
      size="sm"
      showCloseButton={false}
      closeOnEscape={canDismiss}
      onClose={canDismiss ? onClose : () => undefined}
      onBackdropClick={canDismiss ? onClose : () => undefined}
      backdropClassName="install-wizard-progress-backdrop-enter"
      shellClassName="install-wizard-progress-enter max-w-[484px]"
      bodyClassName="!p-4"
    >
      <div className="flex flex-col items-center gap-4">
        {!progress.finished && !progress.error ? (
          <Loader2 className="h-8 w-8 animate-spin text-indigo-500" aria-hidden />
        ) : progress.finished ? (
          <CheckCircle2 className="h-10 w-10 text-emerald-500" aria-hidden />
        ) : (
          <XCircle className="h-10 w-10 text-rose-500" aria-hidden />
        )}

        {progress.finished ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-slate-600 leading-relaxed">
              {t(installKey('progress.ready'))}
            </p>
            {progress.warnings?.length ? (
              <p className="text-sm text-amber-700 leading-relaxed">
                {progress.warnings.join(' ')}
              </p>
            ) : null}
            <AppButton intent="primary" onClick={onGoHome}>
              {t(installKey('progress.goHome'))}
            </AppButton>
          </div>
        ) : progress.error ? (
          <div className="space-y-3 text-center">
            <p className="text-sm text-rose-700 leading-relaxed">{progress.error}</p>
            <AppButton intent="secondary" onClick={onClose}>
              {t(installKey('progress.close'))}
            </AppButton>
          </div>
        ) : (
          <p className="text-center text-sm text-slate-500 leading-relaxed">
            {t(installKey('progress.applying'))}
          </p>
        )}

        <ul className="w-full space-y-2 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2.5">
          {progress.steps.map((step) => (
            <li key={step.id} className="flex items-center gap-2.5 text-xs leading-snug">
              <StepStatusIcon status={step.status} />
              <span
                className={cn(
                  step.status === 'done' && 'text-slate-700',
                  step.status === 'running' && 'font-medium text-indigo-700',
                  step.status === 'warning' && 'text-amber-700',
                  step.status === 'error' && 'text-rose-700',
                  step.status === 'pending' && 'text-slate-400',
                )}
              >
                {step.label}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </CreateEditModalShell>
  );
};

const StepStatusIcon: React.FC<{ status: InstallProgressStepStatus }> = ({ status }) => {
  if (status === 'done') {
    return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" aria-hidden />;
  }
  if (status === 'warning') {
    return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" aria-hidden />;
  }
  if (status === 'running') {
    return <Loader2 className="h-4 w-4 shrink-0 animate-spin text-indigo-500" aria-hidden />;
  }
  if (status === 'error') {
    return <XCircle className="h-4 w-4 shrink-0 text-rose-500" aria-hidden />;
  }
  return <Circle className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />;
};
