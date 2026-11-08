import { prisma } from './prismaHelpers';
import type { BusinessHoursCalendarConfig } from './engine/businessHoursCalendar';

const SINGLETON_ID = 1;

/** HWF-2.2 — single global calendar (per user decision 2026-08-30). The table starts empty; reading always returns a usable config, creating the default row (Mon-Fri 09:00-17:00 UTC, no holidays) on first read. */
export async function getBusinessHoursCalendar(): Promise<BusinessHoursCalendarConfig> {
  const row = await prisma().workflowBusinessHoursCalendar.upsert({
    where: { id: SINGLETON_ID },
    update: {},
    create: { id: SINGLETON_ID },
  });
  return {
    workingDays: JSON.parse(row.workingDaysJson) as number[],
    startTime: row.startTime,
    endTime: row.endTime,
    holidays: JSON.parse(row.holidaysJson) as string[],
  };
}

export async function updateBusinessHoursCalendar(config: BusinessHoursCalendarConfig): Promise<BusinessHoursCalendarConfig> {
  const row = await prisma().workflowBusinessHoursCalendar.upsert({
    where: { id: SINGLETON_ID },
    update: {
      workingDaysJson: JSON.stringify(config.workingDays),
      startTime: config.startTime,
      endTime: config.endTime,
      holidaysJson: JSON.stringify(config.holidays),
    },
    create: {
      id: SINGLETON_ID,
      workingDaysJson: JSON.stringify(config.workingDays),
      startTime: config.startTime,
      endTime: config.endTime,
      holidaysJson: JSON.stringify(config.holidays),
    },
  });
  return {
    workingDays: JSON.parse(row.workingDaysJson) as number[],
    startTime: row.startTime,
    endTime: row.endTime,
    holidays: JSON.parse(row.holidaysJson) as string[],
  };
}
