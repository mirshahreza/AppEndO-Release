import type { Options } from 'sequelize';
import { recordSequelizeQueryTiming } from './requestPerfAls';

export const createSequelizeProfilerLogging = (
  source: string,
): Options['logging'] => (
  sql: string,
  timingMs?: number,
) => {
  recordSequelizeQueryTiming(source, sql, timingMs);
};

export const appendoSequelizeProfilerOptions = (
  source: string,
): Pick<Options, 'logging' | 'benchmark'> => ({
  logging: createSequelizeProfilerLogging(source),
  benchmark: true,
});
