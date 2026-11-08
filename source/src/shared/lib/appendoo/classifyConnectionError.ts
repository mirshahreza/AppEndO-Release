export type ConnectionErrorCategory =
  | 'network'
  | 'timeout'
  | 'rejected'
  | 'quota'
  | 'rateLimit'
  | 'unavailable'
  | 'unknown';

export type ClassifiedConnectionError = {
  category: ConnectionErrorCategory;
  friendlyMessage: string;
  /** Original raw error text, shown to technical users via the detail dialog. */
  detail: string;
};

const CATEGORY_RULES: Array<{ category: ConnectionErrorCategory; pattern: RegExp; friendlyMessage: string }> = [
  {
    category: 'network',
    pattern: /failed to fetch|networkerror|enotfound|econnrefused|net::err|dns|no internet|network error/i,
    friendlyMessage: "Couldn't reach the network. Check your internet connection and try again.",
  },
  {
    category: 'timeout',
    pattern: /timed out|timeout|aborterror|econnaborted/i,
    friendlyMessage: 'The request took too long and timed out. Try again in a moment.',
  },
  {
    category: 'quota',
    pattern: /insufficient_quota|exceeded.*quota|billing|payment required|\b402\b|insufficient funds|out of credit/i,
    friendlyMessage: 'The AI provider account is out of credit or has reached its usage quota. Please top up or check the billing plan.',
  },
  {
    category: 'rejected',
    pattern: /\b401\b|unauthorized|invalid api key|incorrect api key|authentication|\bforbidden\b|\b403\b/i,
    friendlyMessage: 'The connection was rejected — the API key or credentials for this provider look invalid.',
  },
  {
    category: 'rateLimit',
    pattern: /\b429\b|rate limit|too many requests/i,
    friendlyMessage: 'Too many requests right now. Please wait a minute and try again.',
  },
  {
    category: 'unavailable',
    pattern: /\b502\b|\b503\b|\b504\b|bad gateway|service unavailable|overloaded|not configured/i,
    friendlyMessage: 'The AI service is temporarily unavailable or not set up. Please try again shortly or contact an administrator.',
  },
];

export const classifyConnectionError = (raw: string): ClassifiedConnectionError => {
  const detail = raw?.trim() || 'Unknown error.';
  const rule = CATEGORY_RULES.find(({ pattern }) => pattern.test(detail));

  return {
    category: rule?.category ?? 'unknown',
    friendlyMessage: rule?.friendlyMessage ?? 'Something went wrong while contacting the AI provider.',
    detail,
  };
};
