import { CronExpressionParser } from 'cron-parser';

export type CronIterator = ReturnType<typeof CronExpressionParser.parse>;

export const parseCronIterator = (
  expression: string,
  options: { tz: string; currentDate?: Date },
): CronIterator => (
  CronExpressionParser.parse(expression, {
    currentDate: options.currentDate ?? new Date(),
    tz: options.tz || 'UTC',
  })
);

export const previewCronRunTimes = (
  cron: string,
  timezone: string,
  count = 5,
  fromDate = new Date(),
): string[] => {
  const iterator = parseCronIterator(cron, { tz: timezone, currentDate: fromDate });
  const runs: string[] = [];
  for (let index = 0; index < count; index += 1) {
    runs.push(iterator.next().toDate().toISOString());
  }
  return runs;
};
