import { resolveCultureLabel } from '../../core/culture/cultureShellKeys';
import type { useCultureT } from '../../core/culture/CultureContext';

export const messagesLedgerChannelOptions = (t: ReturnType<typeof useCultureT>) => [
  { value: 'IN_APP', label: resolveCultureLabel(t, 'shell.inbox.messagesLedger.channel.inApp', 'In-app') },
  { value: 'EMAIL', label: resolveCultureLabel(t, 'shell.inbox.messagesLedger.channel.email', 'Email') },
];

export const messagesLedgerStatusOptions = (t: ReturnType<typeof useCultureT>) => [
  { value: 'sent', label: resolveCultureLabel(t, 'shell.inbox.messagesLedger.status.sent', 'Sent') },
  { value: 'digest_pending', label: resolveCultureLabel(t, 'shell.inbox.messagesLedger.status.digestPending', 'Digest pending') },
  { value: 'failed', label: resolveCultureLabel(t, 'shell.inbox.messagesLedger.status.failed', 'Failed') },
  { value: 'fallback_in_app', label: resolveCultureLabel(t, 'shell.inbox.messagesLedger.status.fallbackInApp', 'Fallback in-app') },
];

export const formatMessagesLedgerChannel = (
  t: ReturnType<typeof useCultureT>,
  channel: string,
): string => {
  if (channel === 'IN_APP') {
    return resolveCultureLabel(t, 'shell.inbox.messagesLedger.channel.inApp', 'In-app');
  }
  if (channel === 'EMAIL') {
    return resolveCultureLabel(t, 'shell.inbox.messagesLedger.channel.email', 'Email');
  }
  return channel;
};

export const formatMessagesLedgerStatus = (
  t: ReturnType<typeof useCultureT>,
  status: string,
): string => {
  const map: Record<string, string> = {
    sent: resolveCultureLabel(t, 'shell.inbox.messagesLedger.status.sent', 'Sent'),
    digest_pending: resolveCultureLabel(t, 'shell.inbox.messagesLedger.status.digestPending', 'Digest pending'),
    failed: resolveCultureLabel(t, 'shell.inbox.messagesLedger.status.failed', 'Failed'),
    fallback_in_app: resolveCultureLabel(t, 'shell.inbox.messagesLedger.status.fallbackInApp', 'Fallback in-app'),
  };
  return map[status] ?? status;
};
