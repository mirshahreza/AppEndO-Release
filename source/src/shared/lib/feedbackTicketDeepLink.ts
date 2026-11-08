export const FEEDBACK_TICKET_SEARCH_PARAM = 'ticket';

export const readFeedbackTicketId = (searchParams: URLSearchParams): string | null => {
  const value = searchParams.get(FEEDBACK_TICKET_SEARCH_PARAM)?.trim();
  return value || null;
};

export const buildFeedbackTicketHref = (path: string, ticketId: string): string => {
  const queryIndex = path.indexOf('?');
  const pathname = queryIndex >= 0 ? path.slice(0, queryIndex) : path;
  const params = new URLSearchParams(queryIndex >= 0 ? path.slice(queryIndex + 1) : '');
  params.set(FEEDBACK_TICKET_SEARCH_PARAM, ticketId);
  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
};

export const buildFeedbackInboxTicketPath = (ticketId: number | string): string =>
  `/studio/feedback?${FEEDBACK_TICKET_SEARCH_PARAM}=${encodeURIComponent(String(ticketId))}`;

export const buildMyFeedbackTicketPath = (ticketId: number | string): string =>
  `/studio/my-feedback?${FEEDBACK_TICKET_SEARCH_PARAM}=${encodeURIComponent(String(ticketId))}`;
