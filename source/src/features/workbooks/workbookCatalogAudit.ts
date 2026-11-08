export const formatWorkbookCatalogDate = (value?: string | null): string => {
  const trimmed = value?.trim() ?? '';
  return trimmed ? trimmed.slice(0, 10) : '—';
};

export const formatWorkbookCatalogActor = (username?: string | null): string => {
  const label = username?.trim();
  return label || '—';
};
