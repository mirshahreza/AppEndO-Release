export type CronPresetId =
  | 'every-minute'
  | 'every-5-minutes'
  | 'every-15-minutes'
  | 'every-30-minutes'
  | 'hourly'
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'custom';

export type CronDesignerState = {
  preset: CronPresetId;
  minute: number;
  hour: number;
  dayOfMonth: number;
  weekday: number;
  customExpression: string;
};

export const CRON_WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

export const CRON_PRESET_OPTIONS: Array<{ id: CronPresetId; label: string }> = [
  { id: 'every-minute', label: 'Every minute' },
  { id: 'every-5-minutes', label: 'Every 5 minutes' },
  { id: 'every-15-minutes', label: 'Every 15 minutes' },
  { id: 'every-30-minutes', label: 'Every 30 minutes' },
  { id: 'hourly', label: 'Every hour (at :00)' },
  { id: 'daily', label: 'Daily at a specific time' },
  { id: 'weekly', label: 'Weekly on a day' },
  { id: 'monthly', label: 'Monthly on a day' },
  { id: 'custom', label: 'Custom expression' },
];

export const DEFAULT_CRON_DESIGNER_STATE: CronDesignerState = {
  preset: 'every-minute',
  minute: 0,
  hour: 9,
  dayOfMonth: 1,
  weekday: 1,
  customExpression: '* * * * *',
};

export const buildCronExpression = (state: CronDesignerState): string => {
  switch (state.preset) {
    case 'every-minute':
      return '* * * * *';
    case 'every-5-minutes':
      return '*/5 * * * *';
    case 'every-15-minutes':
      return '*/15 * * * *';
    case 'every-30-minutes':
      return '*/30 * * * *';
    case 'hourly':
      return '0 * * * *';
    case 'daily':
      return `${state.minute} ${state.hour} * * *`;
    case 'weekly':
      return `${state.minute} ${state.hour} * * ${state.weekday}`;
    case 'monthly':
      return `${state.minute} ${state.hour} ${state.dayOfMonth} * *`;
    case 'custom':
      return state.customExpression.trim() || '* * * * *';
    default:
      return '* * * * *';
  }
};

const normalizeCron = (cron: string) => cron.trim().replace(/\s+/g, ' ');

export const inferCronDesignerState = (cron: string): CronDesignerState => {
  const expression = normalizeCron(cron);
  const match = (pattern: string) => expression === pattern;

  if (match('* * * * *')) return { ...DEFAULT_CRON_DESIGNER_STATE, preset: 'every-minute' };
  if (match('*/5 * * * *')) return { ...DEFAULT_CRON_DESIGNER_STATE, preset: 'every-5-minutes' };
  if (match('*/15 * * * *')) return { ...DEFAULT_CRON_DESIGNER_STATE, preset: 'every-15-minutes' };
  if (match('*/30 * * * *')) return { ...DEFAULT_CRON_DESIGNER_STATE, preset: 'every-30-minutes' };
  if (match('0 * * * *')) return { ...DEFAULT_CRON_DESIGNER_STATE, preset: 'hourly' };

  const dailyMatch = /^(\d{1,2}) (\d{1,2}) \* \* \*$/.exec(expression);
  if (dailyMatch) {
    return {
      ...DEFAULT_CRON_DESIGNER_STATE,
      preset: 'daily',
      minute: Number(dailyMatch[1]),
      hour: Number(dailyMatch[2]),
    };
  }

  const weeklyMatch = /^(\d{1,2}) (\d{1,2}) \* \* (\d)$/.exec(expression);
  if (weeklyMatch) {
    return {
      ...DEFAULT_CRON_DESIGNER_STATE,
      preset: 'weekly',
      minute: Number(weeklyMatch[1]),
      hour: Number(weeklyMatch[2]),
      weekday: Number(weeklyMatch[3]),
    };
  }

  const monthlyMatch = /^(\d{1,2}) (\d{1,2}) (\d{1,2}) \* \*$/.exec(expression);
  if (monthlyMatch) {
    return {
      ...DEFAULT_CRON_DESIGNER_STATE,
      preset: 'monthly',
      minute: Number(monthlyMatch[1]),
      hour: Number(monthlyMatch[2]),
      dayOfMonth: Number(monthlyMatch[3]),
    };
  }

  return {
    ...DEFAULT_CRON_DESIGNER_STATE,
    preset: 'custom',
    customExpression: expression || '* * * * *',
  };
};
