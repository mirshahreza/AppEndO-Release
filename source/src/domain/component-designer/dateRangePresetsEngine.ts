/**
 * Date-range preset helpers (phase 40): compute ISO day ranges for dashboard filter shortcuts.
 */

export type DesignerDateRangePresetFn =
  | 'today'
  | 'last7Days'
  | 'thisMonth'
  | 'lastMonth'
  | 'custom';

export type DesignerDateRangePreset = {
  label: string;
  rangeFn: DesignerDateRangePresetFn;
};

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

export const formatIsoDay = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parsePresetRecords = (raw: unknown): DesignerDateRangePreset[] => {
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((entry) => {
      if (!entry || typeof entry !== 'object') {
        return [];
      }
      const record = entry as Record<string, unknown>;
      const label = typeof record.label === 'string' ? record.label.trim() : '';
      const rangeFn = typeof record.rangeFn === 'string' ? record.rangeFn.trim() : '';
      if (!label || !rangeFn) {
        return [];
      }
      if (
        rangeFn === 'today'
        || rangeFn === 'last7Days'
        || rangeFn === 'thisMonth'
        || rangeFn === 'lastMonth'
        || rangeFn === 'custom'
      ) {
        return [{ label, rangeFn }];
      }
      return [];
    });
  } catch {
    return [];
  }
};

export const parseDesignerDateRangePresets = (raw: unknown): DesignerDateRangePreset[] =>
  parsePresetRecords(raw).filter((preset) => preset.rangeFn !== 'custom');

/** Resolve "today" in local time (timeZone prop reserved for future TZ-aware calendar wiring). */
export const computeDesignerDateRangePreset = (
  rangeFn: DesignerDateRangePresetFn,
  referenceDate: Date = new Date(),
): { start: string; end: string } | null => {
  if (rangeFn === 'custom') {
    return null;
  }

  const today = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  switch (rangeFn) {
    case 'today':
      return { start: formatIsoDay(today), end: formatIsoDay(today) };
    case 'last7Days': {
      const start = new Date(today);
      start.setDate(start.getDate() - 6);
      return { start: formatIsoDay(start), end: formatIsoDay(today) };
    }
    case 'thisMonth': {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      return { start: formatIsoDay(start), end: formatIsoDay(end) };
    }
    case 'lastMonth': {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const end = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: formatIsoDay(start), end: formatIsoDay(end) };
    }
    default:
      return null;
  }
};

export const isIsoDayString = (value: string): boolean => ISO_DAY.test(value.trim().slice(0, 10));
