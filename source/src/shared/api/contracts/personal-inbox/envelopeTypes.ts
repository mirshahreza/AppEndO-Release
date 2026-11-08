import type { PersonalInboxItem } from './types';

export type PersonalInboxEnvelopeMessageRole =
  | 'default'
  | 'system'
  | 'internal'
  | 'submitter'
  | 'staff';

export type PersonalInboxEnvelopeAttachment = {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
};

export type PersonalInboxEnvelopeMessage = {
  id: string;
  body: string;
  authorDisplayName: string | null;
  createdAt: string;
  role: PersonalInboxEnvelopeMessageRole;
  attachments: PersonalInboxEnvelopeAttachment[];
};

export type PersonalInboxEnvelopeCapabilities = {
  reply: boolean;
  forward: boolean;
  /** When true, UI may show “open related page” using `item.href`. */
  showRelatedHref: boolean;
};

/** MSGI send-log metadata when `item.kind === message_dispatch`. */
export type PersonalInboxDispatchLedgerMeta = {
  channel: string;
  deliveryStatus: string;
  eventType: string;
  createdAt: string;
  deliveredAt: string | null;
  errorSummary: string | null;
  href: string | null;
};

/** Logical detail for any inbox row — adapters map domain stores into this shape. */
export type PersonalInboxItemDetailEnvelope = {
  itemKey: string;
  item: PersonalInboxItem;
  threadId: string;
  messages: PersonalInboxEnvelopeMessage[];
  capabilities: PersonalInboxEnvelopeCapabilities;
  dispatchLedger?: PersonalInboxDispatchLedgerMeta;
};
