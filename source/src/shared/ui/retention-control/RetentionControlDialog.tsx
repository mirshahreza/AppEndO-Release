import React, { useEffect, useMemo, useState } from 'react';
import { Check, FlaskConical, Loader2, Play, SlidersHorizontal, Trash2 } from 'lucide-react';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import type { RetentionFamily } from '../../api/contracts/settings/retention';
import { useClearLogsMutation, useLogViewerSettingsQuery } from '../../api/queries/logs';
import { useClearRecordEventsMutation } from '../../api/queries/recordEvents';
import {
  FAMILY_LABEL,
  postRetentionDryRun,
  postRetentionRun,
  retentionActionErrorMessage,
  useRetentionDestinationsQuery,
  type RetentionDryRunResult,
  type RetentionJobScope,
} from '../../api/queries/retention';
import { AppButton } from '../AppButton';
import { ConfirmDialogShell } from '../ConfirmDialogShell';
import { CreateEditModalShell } from '../CreateEditModalShell';
import { DialogFooter } from '../dialog';
import { useViewportTier } from '../../lib/useViewportTier';
import { isCompactChromeTier } from '../../lib/viewportTokens';
import { DestructiveConfirmBody } from '../DestructiveConfirmBody';
import { FormSection } from '../FormSection';
import {
  buildRetentionFamilySnapshot,
  formatRetentionBytes,
  LOGS_CONTROL_FAMILIES,
  RECORD_EVENTS_CONTROL_FAMILIES,
  type RetentionFamilySnapshot,
} from './retentionControlSnapshot';

export type RetentionControlScope = RetentionJobScope;

export type RetentionControlDialogProps = {
  open: boolean;
  onClose: () => void;
  scope: RetentionControlScope;
  onCleared?: () => void;
};

type ControlAction = 'dryRun' | 'runNow' | 'clear';
type ConfirmPhase = 'confirm' | 'working' | 'done';

const CONTROL_ACTION_BUTTON_CLASS = 'w-32 justify-center';

function familiesForScope(scope: RetentionControlScope): RetentionFamily[] {
  return scope === 'logs' ? LOGS_CONTROL_FAMILIES : RECORD_EVENTS_CONTROL_FAMILIES;
}

const RetentionPolicySnapshot: React.FC<{
  loading: boolean;
  failed: boolean;
  snapshots: RetentionFamilySnapshot[];
}> = ({ loading, failed, snapshots }) => {
  const t = useCultureT();

  if (loading) {
    return (
      <p className="text-xs text-slate-500">
        {t(operationsKey('retention.control.loadingSettings'))}
      </p>
    );
  }

  if (failed) {
    return (
      <p className="text-xs font-medium text-rose-600">
        {t(operationsKey('retention.control.loadSettingsFailed'))}
      </p>
    );
  }

  const sharedDestination = snapshots.find((item) => item.destination.kind !== 'none')?.destination;
  const sharedAge = snapshots[0]?.age;

  return (
    <div className="space-y-2">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {t(operationsKey('retention.control.savedSettings'))}
      </p>
      <p className="text-xs text-slate-600">
        <span className="font-medium text-slate-700">
          {t('settings.forms.logs.retention.olderThan')}
          {': '}
        </span>
        {sharedAge?.days
          ? `${sharedAge.days} days`
          : t('settings.forms.logs.retention.notUsed')}
      </p>
      <p className="text-xs text-slate-600">
        <span className="font-medium text-slate-700">
          {t('settings.forms.logs.retention.destination')}
          {': '}
        </span>
        {!sharedDestination || sharedDestination.kind === 'none'
          ? t('settings.forms.logs.retention.notUsed')
          : sharedDestination.kind === 'json-files'
            ? t('settings.forms.logs.retention.file')
            : sharedDestination.connectionName
              || t(operationsKey('retention.control.connectionUnset'))}
      </p>
    </div>
  );
};

function DryRunResultBody({ result }: { result: RetentionDryRunResult }) {
  const t = useCultureT();
  const entries = Object.entries(result.families);
  return (
    <div className="flex flex-col gap-3 text-sm text-slate-700" dir="ltr">
      <p className="font-semibold text-slate-800">
        {t(operationsKey('retention.control.dryRunResultLead'))}
      </p>
      {entries.length === 0 ? (
        <p className="text-xs text-slate-600">{t(operationsKey('retention.control.noMatchingRows'))}</p>
      ) : (
        <ul className="space-y-2 text-xs text-slate-600">
          {entries.map(([name, family]) => (
            <li key={name}>
              <p className="font-semibold text-slate-800">{FAMILY_LABEL[name] ?? name}</p>
              <p>
                {t(operationsKey('retention.control.matched'))}
                {': '}
                {family.matched}
                {' · '}
                {t(operationsKey('retention.control.skippedHold'))}
                {': '}
                {family.skippedHold}
                {family.bytesEstimate > 0
                  ? ` · ${t(operationsKey('retention.control.bytesEstimate'))}: ${formatRetentionBytes(family.bytesEstimate)}`
                  : ''}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export const RetentionControlDialog: React.FC<RetentionControlDialogProps> = ({
  open,
  onClose,
  scope,
  onCleared,
}) => {
  const t = useCultureT();
  const compactChrome = isCompactChromeTier(useViewportTier());
  const [pendingAction, setPendingAction] = useState<ControlAction | null>(null);
  const [phase, setPhase] = useState<ConfirmPhase>('confirm');
  const [error, setError] = useState<string | null>(null);
  const [dryRunResult, setDryRunResult] = useState<RetentionDryRunResult | null>(null);
  const [runJobIds, setRunJobIds] = useState<number[]>([]);
  const [clearDeleted, setClearDeleted] = useState<number | null>(null);
  const [clearSkipped, setClearSkipped] = useState<number | null>(null);

  const settingsQuery = useLogViewerSettingsQuery();
  const destinationsQuery = useRetentionDestinationsQuery(open);
  const clearLogsMutation = useClearLogsMutation();
  const clearEventsMutation = useClearRecordEventsMutation();

  useEffect(() => {
    if (!open) {
      setPendingAction(null);
      setPhase('confirm');
      setError(null);
      setDryRunResult(null);
      setRunJobIds([]);
      setClearDeleted(null);
      setClearSkipped(null);
      return;
    }
    void settingsQuery.refetch();
    void destinationsQuery.refetch();
    // Open-only refresh; query objects are stable enough for this dialog.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const retention = settingsQuery.data?.logRetention;
  const destinations = destinationsQuery.data ?? [];
  const policyLoading = settingsQuery.isFetching || destinationsQuery.isFetching;
  const policyFailed = Boolean(settingsQuery.isError || (!settingsQuery.isFetching && !retention));
  const policyReady = Boolean(retention) && !settingsQuery.isFetching && !policyFailed;

  const snapshots = useMemo(() => {
    if (!retention) return [];
    return familiesForScope(scope).map((family) => (
      buildRetentionFamilySnapshot(
        family,
        retention[family],
        destinations,
        retention.appLogs.olderThanDays,
      )
    ));
  }, [destinations, retention, scope]);

  const resetConfirm = () => {
    setPendingAction(null);
    setPhase('confirm');
    setError(null);
    setDryRunResult(null);
    setRunJobIds([]);
    setClearDeleted(null);
    setClearSkipped(null);
  };

  const finishAndReturn = () => {
    const cleared = pendingAction === 'clear' && phase === 'done';
    resetConfirm();
    onClose();
    if (cleared) onCleared?.();
  };

  const closeConfirm = () => {
    if (phase === 'working') return;
    if (phase === 'done') {
      finishAndReturn();
      return;
    }
    resetConfirm();
  };

  const startAction = async () => {
    if (!pendingAction || phase === 'working') return;
    setPhase('working');
    setError(null);
    try {
      if (pendingAction === 'dryRun') {
        setDryRunResult(await postRetentionDryRun(scope));
      } else if (pendingAction === 'runNow') {
        const result = await postRetentionRun(scope);
        setRunJobIds(result.jobIds);
      } else if (scope === 'logs') {
        await clearLogsMutation.mutateAsync();
        setClearDeleted(null);
        setClearSkipped(null);
      } else {
        const result = await clearEventsMutation.mutateAsync();
        setClearDeleted(result.deleted);
        setClearSkipped(result.skipped);
      }
      setPhase('done');
    } catch (caught) {
      const fallback = pendingAction === 'dryRun'
        ? 'Dry-run failed.'
        : pendingAction === 'runNow'
          ? 'Failed to enqueue retention.'
          : 'Failed to clear.';
      setError(retentionActionErrorMessage(caught, fallback));
      setPhase('confirm');
    }
  };

  if (!open) {
    return null;
  }

  const isLogs = scope === 'logs';
  const title = isLogs
    ? t(operationsKey('logs.control'))
    : t(operationsKey('recordEvents.control'));
  const dryRunLabel = t(operationsKey('retention.dryRun'));
  const runNowLabel = t(operationsKey('retention.runNow'));
  const clearLabel = t(operationsKey('common.clear'));
  const startLabel = t(operationsKey('common.start'));
  const doneLabel = t(operationsKey('common.done'));
  const working = phase === 'working';

  const confirmTitle = pendingAction === 'dryRun'
    ? dryRunLabel
    : pendingAction === 'runNow'
      ? runNowLabel
      : isLogs
        ? t(operationsKey('logs.clearTitle'))
        : t(operationsKey('recordEvents.clearTitle'));

  const workingLabel = pendingAction === 'dryRun'
    ? t(operationsKey('retention.control.dryRunWorking'))
    : pendingAction === 'runNow'
      ? t(operationsKey('retention.control.runNowWorking'))
      : isLogs
        ? t(operationsKey('logs.clearWorking'))
        : t(operationsKey('recordEvents.clearWorking'));

  const confirmIntent = pendingAction === 'clear'
    ? 'destructive'
    : pendingAction === 'runNow'
      ? 'primary'
      : 'utility';

  const confirmIcon = pendingAction === 'dryRun'
    ? <FlaskConical className="h-3.5 w-3.5" />
    : pendingAction === 'runNow'
      ? <Play className="h-3.5 w-3.5" />
      : <Trash2 className="h-3.5 w-3.5" />;

  const headerIcon = pendingAction === 'dryRun'
    ? <FlaskConical className="h-4 w-4" />
    : pendingAction === 'runNow'
      ? <Play className="h-4 w-4" />
      : <Trash2 className="h-4 w-4" />;

  return (
    <>
      <CreateEditModalShell
        size="auto"
        title={(
          <span className="inline-flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            {title}
          </span>
        )}
        ariaLabel={title}
        subtitle={isLogs
          ? t(operationsKey('logs.control.subtitle'))
          : t(operationsKey('recordEvents.control.subtitle'))}
        gradient={false}
        bodyClassName="overflow-y-auto"
        closeOnEscape={!pendingAction}
        showCloseButton={!pendingAction}
        onClose={onClose}
        footer={compactChrome && !pendingAction ? (
          <DialogFooter>
            <AppButton intent="utility" onClick={onClose}>
              {t('actions.close')}
            </AppButton>
          </DialogFooter>
        ) : undefined}
      >
        <div className="flex w-[min(36rem,calc(100vw-4rem))] flex-col gap-6">
          <RetentionPolicySnapshot
            loading={policyLoading}
            failed={policyFailed}
            snapshots={snapshots}
          />

          <FormSection
            title={dryRunLabel}
            tone="cyan"
            description={isLogs
              ? t(operationsKey('logs.retention.dryRunInfo'))
              : t(operationsKey('recordEvents.retention.dryRunInfo'))}
          >
            <div>
              <AppButton
                intent="destructive-soft"
                size="sm"
                className={CONTROL_ACTION_BUTTON_CLASS}
                disabled={!policyReady || Boolean(pendingAction)}
                onClick={() => setPendingAction('dryRun')}
              >
                <FlaskConical className="h-3.5 w-3.5" />
                {dryRunLabel}
              </AppButton>
            </div>
          </FormSection>

          <FormSection
            title={runNowLabel}
            tone="indigo"
            divided
            description={isLogs
              ? t(operationsKey('logs.retention.runNowInfo'))
              : t(operationsKey('recordEvents.retention.runNowInfo'))}
          >
            <div>
              <AppButton
                intent="destructive-soft"
                size="sm"
                className={CONTROL_ACTION_BUTTON_CLASS}
                disabled={!policyReady || Boolean(pendingAction)}
                onClick={() => setPendingAction('runNow')}
              >
                <Play className="h-3.5 w-3.5" />
                {runNowLabel}
              </AppButton>
            </div>
          </FormSection>

          <FormSection
            title={clearLabel}
            tone="rose"
            divided
            description={isLogs
              ? t(operationsKey('logs.clearInfo'))
              : t(operationsKey('recordEvents.clearInfo'))}
          >
            <div>
              <AppButton
                intent="destructive-soft"
                size="sm"
                className={CONTROL_ACTION_BUTTON_CLASS}
                disabled={Boolean(pendingAction)}
                onClick={() => setPendingAction('clear')}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {clearLabel}
              </AppButton>
            </div>
          </FormSection>
        </div>
      </CreateEditModalShell>

      <ConfirmDialogShell
        open={pendingAction !== null}
        size="lg"
        title={confirmTitle}
        icon={headerIcon}
        tone={pendingAction === 'clear' ? 'danger' : 'default'}
        iconToneClassName={pendingAction === 'clear' ? 'text-rose-600' : 'text-slate-700'}
        confirmIntent={confirmIntent}
        confirmLabel={startLabel}
        confirmIcon={confirmIcon}
        confirmingLabel={workingLabel}
        isConfirming={working}
        hideConfirm={phase === 'done'}
        hideCancel={phase === 'done'}
        closeOnEscape={!working}
        onClose={closeConfirm}
        onConfirm={phase === 'done' ? undefined : () => void startAction()}
        error={error}
        footer={phase === 'done' ? (
          <AppButton intent="confirm" size="sm" onClick={finishAndReturn}>
            <Check className="h-3.5 w-3.5" />
            {doneLabel}
          </AppButton>
        ) : undefined}
      >
        {working ? (
          <div className="flex items-center gap-2 text-sm text-slate-700">
            <Loader2 className="h-4 w-4 animate-spin" />
            {workingLabel}
          </div>
        ) : phase === 'done' && pendingAction === 'dryRun' && dryRunResult ? (
          <DryRunResultBody result={dryRunResult} />
        ) : phase === 'done' && pendingAction === 'runNow' ? (
          <div className="flex flex-col gap-2 text-sm text-slate-700" dir="ltr">
            <p className="font-semibold text-slate-800">
              {t(operationsKey('retention.control.runNowResultLead'))}
            </p>
            <p className="text-xs text-slate-600">
              {t(operationsKey('retention.control.watchJobs'))}
            </p>
            <p className="font-mono text-xs text-slate-600">
              {t(operationsKey('retention.control.jobIds'))}
              {': '}
              {runJobIds.length > 0 ? runJobIds.join(', ') : '—'}
            </p>
          </div>
        ) : phase === 'done' && pendingAction === 'clear' ? (
          <div className="flex flex-col gap-2 text-sm text-slate-700" dir="ltr">
            <p className="font-semibold text-slate-800">
              {isLogs
                ? t(operationsKey('logs.clearResult'))
                : t(operationsKey('recordEvents.clearResult'))}
            </p>
            {!isLogs && clearDeleted != null ? (
              <p className="text-xs text-slate-600">
                {t(operationsKey('retention.control.deleted'))}
                {': '}
                {clearDeleted}
                {' · '}
                {t(operationsKey('retention.control.skippedHold'))}
                {': '}
                {clearSkipped ?? 0}
              </p>
            ) : null}
          </div>
        ) : pendingAction === 'clear' ? (
          <DestructiveConfirmBody
            question={isLogs
              ? t(operationsKey('logs.clearConfirm'))
              : t(operationsKey('recordEvents.clearConfirm'))}
            warning={isLogs
              ? t(operationsKey('logs.clearConfirmWarning'))
              : t(operationsKey('recordEvents.clearConfirmWarning'))}
          />
        ) : (
          <div className="flex flex-col gap-2 text-sm text-slate-700" dir="ltr">
            <p className="font-semibold text-slate-800">
              {pendingAction === 'dryRun'
                ? (isLogs
                    ? t(operationsKey('retention.dryRunConfirmQuestion.logs'))
                    : t(operationsKey('retention.dryRunConfirmQuestion.recordEvents')))
                : (isLogs
                    ? t(operationsKey('retention.runNowConfirmQuestion.logs'))
                    : t(operationsKey('retention.runNowConfirmQuestion.recordEvents')))}
            </p>
            <p className="text-xs text-slate-600">
              {pendingAction === 'dryRun'
                ? t(operationsKey('retention.dryRunConfirmWarning'))
                : t(operationsKey('retention.runNowConfirmWarning'))}
            </p>
          </div>
        )}
      </ConfirmDialogShell>
    </>
  );
};
