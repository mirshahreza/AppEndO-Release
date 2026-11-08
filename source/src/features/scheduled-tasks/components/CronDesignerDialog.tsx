import React, { useEffect, useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { AppButton } from '../../../shared/ui/AppButton';
import { CreateEditModalShell } from '../../../shared/ui/CreateEditModalShell';
import { UiInput, UiSelect } from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import { getCronPresetOptions, getCronWeekdayOptions } from '../../operations/operationsI18n';
import {
  buildCronExpression,
  type CronDesignerState,
  inferCronDesignerState,
} from '../../../shared/lib/cronBuilder';

export type CronDesignerDialogProps = {
  open: boolean;
  value: string;
  onClose: () => void;
  onApply: (cron: string) => void;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toNumberInput = (value: string, fallback: number, min: number, max: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return clamp(Math.floor(parsed), min, max);
};

export const CronDesignerDialog: React.FC<CronDesignerDialogProps> = ({
  open,
  value,
  onClose,
  onApply,
}) => {
  const t = useCultureT();
  const [state, setState] = useState<CronDesignerState>(() => inferCronDesignerState(value));
  const presetOptions = useMemo(() => getCronPresetOptions(t), [t]);
  const weekdayOptions = useMemo(() => getCronWeekdayOptions(t), [t]);

  useEffect(() => {
    if (!open) return;
    setState(inferCronDesignerState(value));
  }, [open, value]);

  const previewExpression = useMemo(() => buildCronExpression(state), [state]);

  if (!open) return null;

  const updateState = (patch: Partial<CronDesignerState>) => {
    setState((current) => ({ ...current, ...patch }));
  };

  const handleApply = () => {
    onApply(previewExpression);
    onClose();
  };

  const showTimeFields = state.preset === 'daily' || state.preset === 'weekly' || state.preset === 'monthly';
  const showWeekdayField = state.preset === 'weekly';
  const showDayOfMonthField = state.preset === 'monthly';
  const showCustomField = state.preset === 'custom';

  return (
    <CreateEditModalShell
      size="lg"
      title={t(operationsKey('scheduler.cronDesignerTitle'))}
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <>
          <AppButton intent="cancel" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            {t('actions.cancel')}
          </AppButton>
          <AppButton intent="primary" onClick={handleApply}>
            <Check className="h-3.5 w-3.5" />
            {t(operationsKey('common.apply'))}
          </AppButton>
        </>
      )}
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-[2px]">
          <label className="ps-[4px] text-sm text-slate-600">{t(operationsKey('scheduler.schedulePreset'))}</label>
          <UiSelect
            value={state.preset}
            onChange={(event) => updateState({ preset: event.target.value as CronDesignerState['preset'] })}
          >
            {presetOptions.map((option) => (
              <option key={option.id} value={option.id}>{option.label}</option>
            ))}
          </UiSelect>
        </div>

        {showTimeFields ? (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-[2px]">
              <label className="ps-[4px] text-sm text-slate-600">{t(operationsKey('scheduler.hour'))}</label>
              <UiInput
                type="number"
                value={state.hour}
                onChange={(event) => updateState({ hour: toNumberInput(event.target.value, state.hour, 0, 23) })}
              />
            </div>
            <div className="flex flex-col gap-[2px]">
              <label className="ps-[4px] text-sm text-slate-600">{t(operationsKey('scheduler.minute'))}</label>
              <UiInput
                type="number"
                value={state.minute}
                onChange={(event) => updateState({ minute: toNumberInput(event.target.value, state.minute, 0, 59) })}
              />
            </div>
          </div>
        ) : null}

        {showWeekdayField ? (
          <div className="flex flex-col gap-[2px]">
            <label className="ps-[4px] text-sm text-slate-600">{t(operationsKey('scheduler.dayOfWeek'))}</label>
            <UiSelect
              value={String(state.weekday)}
              onChange={(event) => updateState({ weekday: Number(event.target.value) })}
            >
              {weekdayOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </UiSelect>
          </div>
        ) : null}

        {showDayOfMonthField ? (
          <div className="flex flex-col gap-[2px]">
            <label className="ps-[4px] text-sm text-slate-600">{t(operationsKey('scheduler.dayOfMonth'))}</label>
            <UiInput
              type="number"
              value={state.dayOfMonth}
              onChange={(event) => updateState({ dayOfMonth: toNumberInput(event.target.value, state.dayOfMonth, 1, 31) })}
            />
          </div>
        ) : null}

        {showCustomField ? (
          <div className="flex flex-col gap-[2px]">
            <label className="ps-[4px] text-sm text-slate-600">{t(operationsKey('scheduler.customExpression'))}</label>
            <UiInput
              className="font-mono"
              autoDir={false}
              value={state.customExpression}
              onChange={(event) => updateState({ customExpression: event.target.value })}
              placeholder="* * * * *"
            />
            <p className="ps-[4px] text-xs text-slate-500">{t(operationsKey('scheduler.cronFieldHint'))}</p>
          </div>
        ) : null}

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-1 text-xs font-medium text-slate-700">{t(operationsKey('common.preview'))}</p>
          <p className="font-mono text-sm text-slate-800">{previewExpression}</p>
        </div>
      </div>
    </CreateEditModalShell>
  );
};
