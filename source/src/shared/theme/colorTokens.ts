/**
 * Neutral + semantic tokens — independent of the operator accent.
 * Surfaces follow Tailwind slate / Material 3; status hues never remap with theme.
 */

/** Page body, cards, muted wells, dark shell. */
export const NEUTRAL_SURFACE = {
  page: '#F8FAFC',
  card: '#FFFFFF',
  muted: '#F1F5F9',
  dark: '#111827',
  border: '#E2E8F0',
  divider: '#E2E8F0',
} as const;

/** Body/ink on light paper — WCAG AA on white and slate-50. */
export const NEUTRAL_TEXT = {
  ink: '#0F172A',
  body: '#334155',
  nav: '#334155',
  navIcon: '#64748B',
} as const;

/** Fixed status — never overridden by Cranberry, Gray, or any accent. */
export const SEMANTIC_STATUS = {
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
} as const;

export const SEMANTIC_STATUS_RGB = {
  success: '16 185 129',
  warning: '245 158 11',
  danger: '239 68 68',
} as const;

export const WCAG_AA_CONTRAST = 4.5;
