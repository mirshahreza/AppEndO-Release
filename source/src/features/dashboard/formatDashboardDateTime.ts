/** Dashboard-friendly timestamp: `YYYY-MM-DD HH:mm` in local-neutral slice form. */
export function formatDashboardDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return value.slice(0, 19).replace('T', ' ');
}
