const DIRECT_MESSAGE_SESSION_KEY = 'appendo.directMessage.session';

export function getDirectMessageSessionKey(): string {
  if (typeof window === 'undefined') {
    return 'server';
  }
  const existing = window.localStorage.getItem(DIRECT_MESSAGE_SESSION_KEY);
  if (existing?.trim()) {
    return existing.trim();
  }
  const next = crypto.randomUUID();
  window.localStorage.setItem(DIRECT_MESSAGE_SESSION_KEY, next);
  return next;
}
