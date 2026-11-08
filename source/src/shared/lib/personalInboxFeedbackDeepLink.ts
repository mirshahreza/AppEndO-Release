export type PersonalInboxFeedbackScope = 'mine' | 'staff';

export const PERSONAL_INBOX_FEEDBACK_TICKET_PARAM = 'feedbackTicketId';
export const PERSONAL_INBOX_FEEDBACK_SCOPE_PARAM = 'feedbackScope';

export function buildPersonalInboxFeedbackFocusHref(
  ticketId: number,
  scope: PersonalInboxFeedbackScope,
): string {
  const params = new URLSearchParams();
  params.set(PERSONAL_INBOX_FEEDBACK_TICKET_PARAM, String(ticketId));
  params.set(PERSONAL_INBOX_FEEDBACK_SCOPE_PARAM, scope);
  return `my-inbox?${params.toString()}`;
}

export function parsePersonalInboxFeedbackTicketId(params: URLSearchParams): number | null {
  const raw = params.get(PERSONAL_INBOX_FEEDBACK_TICKET_PARAM)?.trim();
  if (!raw) {
    return null;
  }
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function parsePersonalInboxFeedbackScope(params: URLSearchParams): PersonalInboxFeedbackScope {
  const raw = params.get(PERSONAL_INBOX_FEEDBACK_SCOPE_PARAM)?.trim().toLowerCase();
  return raw === 'staff' ? 'staff' : 'mine';
}

export function clearPersonalInboxFeedbackFocusParams(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);
  next.delete(PERSONAL_INBOX_FEEDBACK_TICKET_PARAM);
  next.delete(PERSONAL_INBOX_FEEDBACK_SCOPE_PARAM);
  return next;
}
