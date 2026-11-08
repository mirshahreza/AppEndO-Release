import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { lookupEmbeddedEnglish } from '../../core/culture/embeddedTranslationBundles';
import { operationsKey } from '../../core/culture/translations/cultureKeyHelpers';
import type { CronPresetId } from '../../shared/lib/cronBuilder';
import type { MissedRunPolicy } from '../../shared/api/contracts/scheduler/types';

export function operationsText(suffix: string, t?: TranslationFn): string {
  const key = operationsKey(suffix);
  return t ? t(key) : lookupEmbeddedEnglish(key);
}

export function interpolateOperationsTemplate(
  template: string,
  params: Record<string, string | number>,
): string {
  return Object.entries(params).reduce(
    (result, [key, value]) => result.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

const JOB_STATUS_VALUES = ['pending', 'running', 'completed', 'failed', 'cancelled'] as const;

export function getJobStatusOptions(t: TranslationFn): Array<{ value: string; label: string }> {
  return JOB_STATUS_VALUES.map((value) => ({
    value,
    label: t(operationsKey(`jobs.status.${value}`)),
  }));
}

const JOB_SORT_SUFFIXES = ['created', 'started', 'status', 'progress'] as const;

export function getJobSortOptions(t: TranslationFn): Array<{ value: string; label: string }> {
  return [
    { value: 'created_at', label: t(operationsKey('jobs.sort.created')) },
    { value: 'started_at', label: t(operationsKey('jobs.sort.started')) },
    { value: 'status', label: t(operationsKey('jobs.sort.status')) },
    { value: 'progress', label: t(operationsKey('jobs.sort.progress')) },
  ];
}

export function formatJobStatusLabel(t: TranslationFn, status: string): string {
  const key = operationsKey(`jobs.status.${status}`);
  const translated = t(key);
  return translated === key ? status : translated;
}

export function getMissedRunPolicyOptions(t: TranslationFn): Array<{ value: MissedRunPolicy; label: string }> {
  return [
    { value: 'skip', label: t(operationsKey('scheduler.missedRunSkip')) },
    { value: 'catch_up_once', label: t(operationsKey('scheduler.missedRunCatchUp')) },
  ];
}

const CRON_PRESET_IDS: CronPresetId[] = [
  'every-minute',
  'every-5-minutes',
  'every-15-minutes',
  'every-30-minutes',
  'hourly',
  'daily',
  'weekly',
  'monthly',
  'custom',
];

const CRON_PRESET_KEY_SUFFIX: Record<CronPresetId, string> = {
  'every-minute': 'cron.preset.everyMinute',
  'every-5-minutes': 'cron.preset.every5Minutes',
  'every-15-minutes': 'cron.preset.every15Minutes',
  'every-30-minutes': 'cron.preset.every30Minutes',
  hourly: 'cron.preset.hourly',
  daily: 'cron.preset.daily',
  weekly: 'cron.preset.weekly',
  monthly: 'cron.preset.monthly',
  custom: 'cron.preset.custom',
};

export function getCronPresetOptions(t: TranslationFn): Array<{ id: CronPresetId; label: string }> {
  return CRON_PRESET_IDS.map((id) => ({
    id,
    label: t(operationsKey(CRON_PRESET_KEY_SUFFIX[id])),
  }));
}

const CRON_WEEKDAY_SUFFIXES = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
] as const;

export function getCronWeekdayOptions(t: TranslationFn): Array<{ value: number; label: string }> {
  return CRON_WEEKDAY_SUFFIXES.map((suffix, value) => ({
    value,
    label: t(operationsKey(`cron.weekday.${suffix}`)),
  }));
}
