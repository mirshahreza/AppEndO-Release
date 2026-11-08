/** Compact badge label for shell attention counts (bell, chips). */
export function formatShellAttentionBadgeCount(count: number): string {
  const safe = Math.max(0, Math.floor(count));
  if (safe > 99) {
    return '99+';
  }
  return String(safe);
}
