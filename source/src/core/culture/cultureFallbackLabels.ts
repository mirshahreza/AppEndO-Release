import { AUTH_PUBLIC_EN } from './translations/authPublicEn';
import { CULTURE_ACTION_FALLBACK_LABELS, CULTURE_SHELL_FALLBACK_LABELS } from './cultureShellKeys';

export const CULTURE_PUBLIC_FALLBACK_LABELS: Record<string, string> = {
  ...CULTURE_SHELL_FALLBACK_LABELS,
  ...CULTURE_ACTION_FALLBACK_LABELS,
  ...AUTH_PUBLIC_EN,
  'errors.retry': 'Retry',
  'errors.retrying': 'Retrying...',
  'errors.renderTitle': 'Something went wrong',
  'errors.renderMessage': 'An unexpected rendering error occurred.',
  'errors.renderReference': 'Reference: {id}',
  'errors.tryAgain': 'Try Again',
  'shell.desktopOnly.title': 'Desktop only',
  'shell.desktopOnly.message':
    'This workspace is available on desktop screens (1024px and wider). Open AppEndO on a larger display to continue.',
  'shell.desktopOnly.back': 'Back to Users',
  'shell.platformConfigUnavailable': 'Platform configuration unavailable',
  'errors.platformConfigLoadFailed': 'Failed to load platform runtime config.',
};
