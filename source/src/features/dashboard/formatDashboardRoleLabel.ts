/** Human-readable role label for dashboard copy (ADMIN → Admin). */
export function formatDashboardRoleLabel(role: string | null | undefined): string {
  const normalized = role?.trim();
  if (!normalized) return 'User';
  if (normalized.length <= 3) {
    return normalized.toUpperCase();
  }
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase();
}
