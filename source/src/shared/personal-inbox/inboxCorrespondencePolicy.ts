import type { PersonalInboxItemKind } from '../api/contracts/personal-inbox/types';

export type InboxCorrespondenceAction = 'reply' | 'forward';

export type InboxCorrespondenceCapabilities = {
  reply: boolean;
  forward: boolean;
};

const CAPABILITIES: Record<PersonalInboxItemKind, InboxCorrespondenceCapabilities> = {
  feedback: { reply: true, forward: true },
  direct_message: { reply: true, forward: true },
  alert: { reply: false, forward: false },
  work_item: { reply: false, forward: true },
  message_dispatch: { reply: false, forward: false },
};

export const inboxCorrespondenceCapabilities = (
  kind: PersonalInboxItemKind,
): InboxCorrespondenceCapabilities => CAPABILITIES[kind];

export const inboxSupportsCorrespondenceAction = (
  kind: PersonalInboxItemKind,
  action: InboxCorrespondenceAction,
): boolean => CAPABILITIES[kind][action];
