import { useCallback, useEffect, useMemo, useState } from 'react';
import { mapRecordHistoryField } from './recordEventHistoryFields';

export type RecordSubjectHistoryConfig = {
  subjectKind: string;
  subjectId?: string | number | null;
  fieldMap?: Record<string, string>;
  trackedFields?: readonly string[];
  enabled?: boolean;
};

export { mapRecordHistoryField } from './recordEventHistoryFields';

export const restoreRecordEventValue = (fromValue: unknown): unknown => {
  if (!fromValue || typeof fromValue !== 'object') return undefined;
  const row = fromValue as { value?: unknown; id?: unknown; redacted?: unknown };
  if ('redacted' in row) return undefined;
  return row.value ?? row.id;
};

export function useRecordSubjectHistory(config: RecordSubjectHistoryConfig) {
  const subjectId = config.subjectId == null || config.subjectId === ''
    ? ''
    : String(config.subjectId);
  const available = config.enabled !== false && Boolean(config.subjectKind && subjectId);
  const [dialogField, setDialogField] = useState<string | null | undefined>(undefined);
  const [fieldIconsVisible, setFieldIconsVisible] = useState(false);

  const tracked = useMemo(() => new Set(
    (config.trackedFields ?? []).map((field) => mapRecordHistoryField(field, config.fieldMap)),
  ), [config.fieldMap, config.trackedFields]);

  useEffect(() => {
    setFieldIconsVisible(false);
  }, [available, subjectId]);

  const openHistory = useCallback((field?: string) => {
    setDialogField(field ?? null);
  }, []);

  const closeHistory = useCallback(() => {
    setDialogField(undefined);
  }, []);

  const toggleFieldIcons = useCallback(() => {
    if (!available) return;
    setFieldIconsVisible((current) => !current);
  }, [available]);

  const isTracked = useCallback((formField: string): boolean => {
    if (!available) return false;
    const eventField = mapRecordHistoryField(formField, config.fieldMap);
    if (tracked.size === 0) return true;
    return tracked.has(formField) || tracked.has(eventField);
  }, [available, config.fieldMap, tracked]);

  const soleTrackedField = tracked.size === 1 ? [...tracked][0] : null;

  return {
    available,
    dialogOpen: dialogField !== undefined,
    dialogField,
    fieldIconsVisible: available && fieldIconsVisible && soleTrackedField == null,
    openHistory,
    closeHistory,
    toggleFieldIcons,
    isTracked,
    soleTrackedField,
    subjectKind: config.subjectKind,
    subjectId,
  };
}
