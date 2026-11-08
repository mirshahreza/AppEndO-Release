/** Max age before list/summary re-runs the Phase A collector and rewrites projection rows. */
export const PERSONAL_INBOX_PROJECTION_TTL_MS = 30_000;

export type PersonalInboxReadMode = 'projection' | 'live';

export const resolvePersonalInboxReadMode = (): PersonalInboxReadMode => {
  const raw = process.env.PERSONAL_INBOX_READ_MODE?.trim().toLowerCase();
  if (raw === 'live') {
    return 'live';
  }
  return 'projection';
};
