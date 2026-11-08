export const formatWorkflowAuditDateTime = (value: string | null | undefined): string => {
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

export const formatWorkflowAuditActor = (value: string | null | undefined): string =>
  value?.trim() || '—';
