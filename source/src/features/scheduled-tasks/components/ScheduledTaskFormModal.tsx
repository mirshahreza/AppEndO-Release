import React, { useEffect, useMemo, useState } from 'react';
import { CalendarClock, Check, Search, X } from 'lucide-react';
import { UiCheckboxChoice, UiInput, UiTextarea } from '../../../shared/ui';
import { AppButton } from '../../../shared/ui/AppButton';
import { CreateEditModalShell } from '../../../shared/ui/CreateEditModalShell';
import {
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_VIEW_CLASS,
} from '../../../shared/ui/surfaceClasses';
import type { ScheduledTaskEntry } from '../../../shared/api/contracts/scheduler/types';
import { useCronPreviewQuery } from '../../../shared/api/queries/scheduler';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { CronDesignerDialog } from './CronDesignerDialog';
import { ServerFunctionPickerDialog, type ServerFunctionPickerItem } from './ServerFunctionPickerDialog';

export type ScheduledTaskFormModalProps = {
  open: boolean;
  mode: 'create' | 'edit';
  form: ScheduledTaskEntry;
  functionCatalog: ServerFunctionPickerItem[];
  schedulerTimezone: string;
  formError: string | null;
  isSaving: boolean;
  onClose: () => void;
  onSubmit: () => void;
  onFormChange: (next: ScheduledTaskEntry) => void;
};

export const ScheduledTaskFormModal: React.FC<ScheduledTaskFormModalProps> = ({
  open,
  mode,
  form,
  functionCatalog,
  schedulerTimezone,
  formError,
  isSaving,
  onClose,
  onSubmit,
  onFormChange,
}) => {
  const t = useCultureT();
  const [payloadText, setPayloadText] = useState('{}');
  const [payloadError, setPayloadError] = useState<string | null>(null);
  const [functionPickerOpen, setFunctionPickerOpen] = useState(false);
  const [cronDesignerOpen, setCronDesignerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPayloadText(JSON.stringify(form.payload ?? {}, null, 2));
    setPayloadError(null);
    setFunctionPickerOpen(false);
    setCronDesignerOpen(false);
  }, [open, form.payload]);

  const cronPreview = useCronPreviewQuery(form.cron, schedulerTimezone, open);

  const previewLines = useMemo(
    () => cronPreview.data?.nextRuns?.map((run) => run.slice(0, 19).replace('T', ' ')) ?? [],
    [cronPreview.data?.nextRuns],
  );

  const selectedFunctionLabel = useMemo(() => {
    if (!form.functionId) return '';
    const match = functionCatalog.find((item) => item.id === form.functionId);
    if (!match) return form.functionId;
    return `${match.id} (${match.method} ${match.path})`;
  }, [form.functionId, functionCatalog]);

  if (!open) return null;

  const updateField = <K extends keyof ScheduledTaskEntry>(key: K, value: ScheduledTaskEntry[K]) => {
    onFormChange({ ...form, [key]: value });
  };

  const handlePayloadBlur = (raw = payloadText) => {
    try {
      const parsed = JSON.parse(raw || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setPayloadError(t(operationsKey('common.payloadJsonObject')));
        return;
      }
      setPayloadError(null);
      updateField('payload', parsed as Record<string, unknown>);
    } catch {
      setPayloadError(t(operationsKey('common.invalidJsonPayload')));
    }
  };

  return (
    <>
      <CreateEditModalShell
        size="maximized"
        title={mode === 'create' ? t(operationsKey('scheduler.createTitle')) : t(operationsKey('scheduler.editTitle'))}
        onClose={onClose}
        footer={(
          <>
            <AppButton intent="cancel" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
              {t('actions.cancel')}
            </AppButton>
            <AppButton intent="primary" disabled={isSaving} onClick={onSubmit}>
              <Check className="h-3.5 w-3.5" />
              {isSaving ? t('actions.saving') : t('actions.save')}
            </AppButton>
          </>
        )}
      >
        <div className="flex flex-col gap-4">
          {formError ? <p className="text-sm text-rose-600">{formError}</p> : null}

          {mode === 'create' ? (
            <div className="flex flex-col gap-[2px]">
              <label className="ps-[4px] text-sm text-slate-600">{t(operationsKey('scheduler.taskId'))}</label>
              <UiInput
                value={form.id}
                onChange={(event) => updateField('id', event.target.value)}
                placeholder={t(operationsKey('scheduler.taskIdPlaceholder'))}
              />
            </div>
          ) : (
            <UiCheckboxChoice
              id="scheduled-task-enabled"
              checked={form.enabled}
              onChange={(checked) => updateField('enabled', checked)}
            >
              {t(operationsKey('common.enabled'))}
            </UiCheckboxChoice>
          )}

          <div className="flex flex-col gap-[2px]">
            <label className="ps-[4px] text-sm text-slate-600">{t(operationsKey('common.name'))}</label>
            <UiInput
              value={form.name}
              onChange={(event) => updateField('name', event.target.value)}
            />
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className="ps-[4px] text-sm text-slate-600">{t(operationsKey('common.serverFunction'))}</label>
            <div className="relative w-full">
              <UiInput
                readOnly
                value={selectedFunctionLabel}
                placeholder={t(operationsKey('common.selectFunction'))}
                className="!pr-9"
                ariaLabel={t(operationsKey('common.selectedServerFunction'))}
              />
              <button
                type="button"
                title={t(operationsKey('common.pickServerFunction'))}
                aria-label={t(operationsKey('common.pickServerFunctionAria'))}
                onClick={() => setFunctionPickerOpen(true)}
                className={`absolute right-2 top-1/2 -translate-y-1/2 ${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_VIEW_CLASS}`}
              >
                <Search className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className="ps-[4px] text-sm text-slate-600">{t(operationsKey('scheduler.cronLabel'))}</label>
            <div className="relative w-full">
              <UiInput
                className="font-mono !pr-9"
                value={form.cron}
                onChange={(event) => updateField('cron', event.target.value)}
                placeholder="* * * * *"
                ariaLabel={t(operationsKey('scheduler.cronAria'))}
              />
              <button
                type="button"
                title={t(operationsKey('scheduler.openCronDesigner'))}
                aria-label={t(operationsKey('scheduler.openCronDesignerAria'))}
                onClick={() => setCronDesignerOpen(true)}
                className={`absolute right-2 top-1/2 -translate-y-1/2 ${ICON_ACTION_BUTTON_SM_CLASS} ${ICON_ACTION_VIEW_CLASS}`}
              >
                <CalendarClock className="h-4 w-4" />
              </button>
            </div>
            <p className="ps-[4px] text-xs text-slate-500">{t(operationsKey('scheduler.cronHint'))}</p>
            {previewLines.length > 0 ? (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
                <p className="mb-1 font-medium text-slate-700">{t(operationsKey('common.nextRuns'))}</p>
                {previewLines.map((line) => <p key={line}>{line}</p>)}
              </div>
            ) : null}
          </div>

          {mode === 'create' ? (
            <UiCheckboxChoice
              id="scheduled-task-enabled"
              checked={form.enabled}
              onChange={(checked) => updateField('enabled', checked)}
            >
              {t(operationsKey('common.enabled'))}
            </UiCheckboxChoice>
          ) : null}

          <div className="flex flex-col gap-[2px]">
            <label className="ps-[4px] text-sm text-slate-600">{t(operationsKey('common.payloadJson'))}</label>
            <UiTextarea
              value={payloadText}
              onChange={(event) => {
                setPayloadText(event.target.value);
                handlePayloadBlur(event.target.value);
              }}
              className="font-mono text-xs"
              rows={4}
              autoDir={false}
              isInvalid={Boolean(payloadError)}
              errorMessage={payloadError ?? undefined}
              ariaLabel={t(operationsKey('common.payloadJson'))}
            />
          </div>

          <div className="flex flex-col gap-[2px]">
            <label className="ps-[4px] text-sm text-slate-600">{t(operationsKey('common.note'))}</label>
            <UiTextarea
              value={form.note || ''}
              onChange={(event) => updateField('note', event.target.value)}
              rows={2}
            />
          </div>
        </div>
      </CreateEditModalShell>

      <ServerFunctionPickerDialog
        open={functionPickerOpen}
        functions={functionCatalog}
        selectedId={form.functionId}
        onClose={() => setFunctionPickerOpen(false)}
        onSelect={(functionId) => updateField('functionId', functionId)}
      />

      <CronDesignerDialog
        open={cronDesignerOpen}
        value={form.cron}
        onClose={() => setCronDesignerOpen(false)}
        onApply={(cron) => updateField('cron', cron)}
      />
    </>
  );
};
