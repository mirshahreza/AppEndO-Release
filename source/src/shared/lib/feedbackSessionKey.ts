const FEEDBACK_SESSION_KEY = 'appendo.feedback.session';

export function getFeedbackSessionKey(): string {
  if (typeof window === 'undefined') {
    return 'server';
  }
  const existing = window.localStorage.getItem(FEEDBACK_SESSION_KEY);
  if (existing?.trim()) {
    return existing.trim();
  }
  const next = crypto.randomUUID();
  window.localStorage.setItem(FEEDBACK_SESSION_KEY, next);
  return next;
}
