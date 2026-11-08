import type { ServerFunctionItem } from '../types';

export const formatServerFunctionAuditDateTime = (value: string | undefined): string => {
  if (!value?.trim()) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatServerFunctionAuditActor = (value: string | null | undefined): string =>
  value?.trim() || '—';

export const SERVER_FUNCTION_AUDIT_METADATA_KEYS = [
  'created_at',
  'created_by',
  'updated_at',
  'updated_by',
] as const;

export type ServerFunctionAuditMetadata = Pick<
  ServerFunctionItem,
  typeof SERVER_FUNCTION_AUDIT_METADATA_KEYS[number]
>;
