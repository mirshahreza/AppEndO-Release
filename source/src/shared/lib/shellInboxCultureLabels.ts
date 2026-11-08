import type { TranslationFn } from '../../core/culture/TranslationRuntime';
import { resolveCultureLabel } from '../../core/culture/cultureShellKeys';
import type { PersonalInboxItem } from '../api/contracts/personal-inbox/types';
const formatDispatchChannel = (t: TranslationFn | undefined, channel: string): string => {
  if (channel === 'IN_APP') {
    return resolveCultureLabel(t, 'shell.inbox.messagesLedger.channel.inApp', 'In-app');
  }
  if (channel === 'EMAIL') {
    return resolveCultureLabel(t, 'shell.inbox.messagesLedger.channel.email', 'Email');
  }
  return channel;
};

const formatDispatchStatus = (t: TranslationFn | undefined, status: string): string => {
  const map: Record<string, [string, string]> = {
    sent: ['shell.inbox.messagesLedger.status.sent', 'Sent'],
    digest_pending: ['shell.inbox.messagesLedger.status.digestPending', 'Digest pending'],
    failed: ['shell.inbox.messagesLedger.status.failed', 'Failed'],
    fallback_in_app: ['shell.inbox.messagesLedger.status.fallbackInApp', 'Fallback in-app'],
  };
  const entry = map[status];
  return entry ? resolveCultureLabel(t, entry[0], entry[1]) : status;
};

export function resolveInboxOriginLabel(t: TranslationFn | undefined, item: PersonalInboxItem): string {
  if (item.kind === 'work_item') {
    return resolveCultureLabel(t, 'shell.inbox.origin.workflow', 'Workflow');
  }
  if (item.kind === 'feedback') {
    return resolveCultureLabel(t, 'shell.inbox.origin.feedback', 'Feedback');
  }
  if (item.kind === 'message_dispatch') {
    return resolveCultureLabel(t, 'shell.inbox.origin.dispatchLedger', 'Send log');
  }
  if (item.kind === 'direct_message') {
    return resolveCultureLabel(t, 'shell.inbox.origin.directMessage', 'Direct message');
  }
  return resolveCultureLabel(t, 'shell.inbox.origin.alert', 'Alert');
}

const NOTIFICATION_SOURCE_LABELS: Record<string, { key: string; fallback: string }> = {
  workflow: { key: 'shell.inbox.sourceDetail.workflow', fallback: 'Workflow' },
  agent: { key: 'shell.inbox.sourceDetail.agent', fallback: 'Agent' },
  agent_task: { key: 'shell.inbox.sourceDetail.agent_task', fallback: 'Agent task' },
  'workflow.escalation': { key: 'shell.inbox.sourceDetail.workflow.escalation', fallback: 'Workflow escalation' },
  'workflow.comment': { key: 'shell.inbox.sourceDetail.workflow.comment', fallback: 'Workflow comment' },
};

/** MSGI demo seed titles (scripts/seed-msgi-demo-notifications.ts) — stored in English, shown via culture. */
const DEMO_INBOX_TITLE_KEYS: Record<string, string> = {
  'Welcome to Messages': 'shell.inbox.demo.welcome.title',
  'Workflow escalation (demo)': 'shell.inbox.demo.workflowEscalation.title',
  'Comment mention (demo)': 'shell.inbox.demo.commentMention.title',
  'Platform notice': 'shell.inbox.demo.platformNotice.title',
};

const DEMO_INBOX_BODY_KEYS: Record<string, string> = {
  'This is a sample in-app notification. Open the bell or visit Studio → Messages to see the dispatch ledger.':
    'shell.inbox.demo.welcome.body',
  'MSGI records outbound delivery per channel. This row simulates a workflow escalation notice.':
    'shell.inbox.demo.workflowEscalation.body',
  'A teammate mentioned you. In production this comes from workflow comment notify.':
    'shell.inbox.demo.commentMention.body',
  'User Message Inbox v1 is live: ledger, retention, and unseen bell badge.':
    'shell.inbox.demo.platformNotice.body',
};

export function resolveInboxItemTitle(t: TranslationFn | undefined, rawTitle: string): string {
  const trimmed = rawTitle.trim();
  const key = DEMO_INBOX_TITLE_KEYS[trimmed];
  if (key) {
    return resolveCultureLabel(t, key, trimmed);
  }
  return rawTitle;
}

export function resolveInboxItemSummary(t: TranslationFn | undefined, rawSummary: string | null | undefined): string {
  const trimmed = rawSummary?.trim() ?? '';
  if (!trimmed) {
    return '';
  }
  const key = DEMO_INBOX_BODY_KEYS[trimmed];
  if (key) {
    return resolveCultureLabel(t, key, trimmed);
  }
  return rawSummary ?? '';
}

const resolveNotificationSourceLabel = (
  t: TranslationFn | undefined,
  raw: string,
): string | null => {
  const normalized = raw.trim().toLowerCase();
  const mapped = NOTIFICATION_SOURCE_LABELS[normalized];
  if (mapped) {
    return resolveCultureLabel(t, mapped.key, mapped.fallback);
  }
  return null;
};

const resolveFeedbackOriginDetailLabel = (
  t: TranslationFn | undefined,
  detail: string,
): string | null => {
  if (detail === 'My submission') {
    return resolveCultureLabel(t, 'shell.inbox.sourceDetail.feedback.mySubmission', 'My submission');
  }
  if (detail === 'Assigned to me') {
    return resolveCultureLabel(t, 'shell.inbox.sourceDetail.feedback.assignedToMe', 'Assigned to me');
  }
  if (detail === 'Feedback') {
    return resolveCultureLabel(t, 'shell.inbox.origin.feedback', 'Feedback');
  }
  const rolePrefix = 'Role: ';
  if (detail.startsWith(rolePrefix)) {
    const role = detail.slice(rolePrefix.length).trim();
    return resolveCultureLabel(t, 'shell.inbox.sourceDetail.feedback.role', 'Role: {role}')
      .replace('{role}', role);
  }
  return null;
};

/** Grid «Source» / المصدر — translated origin detail (work item type, feedback role, notification source). */
export function resolveInboxSourceDetailLabel(t: TranslationFn | undefined, item: PersonalInboxItem): string {
  const detail = item.originDetail?.trim() ?? '';
  if (!detail) {
    return resolveInboxOriginLabel(t, item);
  }

  if (item.kind === 'message_dispatch' && detail.includes('|')) {
    const [channel, status] = detail.split('|');
    const channelLabel = formatDispatchChannel(t, channel ?? '');
    const statusLabel = formatDispatchStatus(t, status ?? '');
    return `${channelLabel} · ${statusLabel}`;
  }

  if (item.kind === 'feedback') {
    const feedbackLabel = resolveFeedbackOriginDetailLabel(t, detail);
    if (feedbackLabel) {
      return feedbackLabel;
    }
  }

  const notificationLabel = resolveNotificationSourceLabel(t, detail);
  if (notificationLabel) {
    return notificationLabel;
  }

  if (item.kind === 'work_item') {
    const typeKey = `shell.inbox.sourceDetail.workItemType.${detail.toUpperCase()}`;
    const typeLabel = resolveCultureLabel(t, typeKey, detail);
    if (typeLabel !== detail) {
      return typeLabel;
    }
  }

  if (detail.toLowerCase() === item.origin.toLowerCase()) {
    return resolveInboxOriginLabel(t, item);
  }

  return resolveCultureLabel(
    t,
    `shell.inbox.sourceDetail.${detail.toLowerCase().replace(/\s+/g, '_')}`,
    detail,
  );
}
