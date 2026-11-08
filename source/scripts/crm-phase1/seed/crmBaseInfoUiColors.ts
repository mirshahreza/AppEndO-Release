/**
 * Semantic UI colors for CRM Base Info items (stored in `base_info.ui_color`) — v2.
 * Gentle concept-matched hues — lifecycle, pipeline, ticket triage.
 */

/** Hex colors aligned with Studio semantic maps (text/icon accents, not large fills). */
export const CRM_BASE_INFO_ITEM_UI_COLORS: Record<string, string> = {
  // Lifecycle Stages
  lead: '#94a3b8',
  qualified: '#6366f1',
  customer: '#10b981',
  // lost shared with pipeline — greenfield ok; same shortName under different parents
  lost: '#64748b',

  // Lead Sources
  website: '#0ea5e9',
  referral: '#8b5cf6',
  cold_call: '#f59e0b',
  event: '#14b8a6',
  advertising: '#f97316',
  import: '#64748b',
  other: '#94a3b8',

  // Pipeline Stages
  new: '#0ea5e9',
  qualifying: '#6366f1',
  proposal: '#8b5cf6',
  negotiation: '#f59e0b',
  won: '#10b981',

  // Activity Types
  call: '#0ea5e9',
  email: '#6366f1',
  meeting: '#8b5cf6',
  note: '#94a3b8',
  task: '#f59e0b',

  // Ticket Status (new/lost collide with pipeline shortNames — color map is global by shortName)
  open: '#0ea5e9',
  pending: '#f59e0b',
  resolved: '#10b981',
  closed: '#64748b',

  // Ticket Priority
  low: '#94a3b8',
  normal: '#0ea5e9',
  high: '#f59e0b',
  urgent: '#ef4444',

  // Ticket Channel
  phone: '#10b981',
  web_form: '#6366f1',
  chat: '#8b5cf6',
  social: '#ec4899',

  // Customer Tags
  vip: '#eab308',
  cold: '#38bdf8',
  newsletter_subscriber: '#6366f1',
  partner: '#14b8a6',
  reseller: '#0ea5e9',
  high_value: '#a855f7',
  at_risk: '#ef4444',
  do_not_contact: '#64748b',
};

export const crmBaseInfoUiColor = (shortName: string): string | null => (
  CRM_BASE_INFO_ITEM_UI_COLORS[shortName] ?? null
);
