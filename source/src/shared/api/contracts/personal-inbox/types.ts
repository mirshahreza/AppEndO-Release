export type PersonalInboxItemKind =
  | 'work_item'
  | 'feedback'
  | 'alert'
  | 'message_dispatch'
  | 'direct_message';

export type PersonalInboxAttention = 'action_required' | 'unread' | 'none';

export type PersonalInboxEntityRef = {
  type: 'work_item' | 'feedback' | 'notification' | 'message_dispatch' | 'direct_message';
  id: number;
};

export type PersonalInboxItem = {
  /** Stable key for React lists, e.g. `work_item:42`. */
  id: string;
  kind: PersonalInboxItemKind;
  /** Short label for the source domain (UI badge). */
  origin: string;
  /** Finer grain: work item type, feedback role, notification source/event. */
  originDetail: string | null;
  title: string;
  summary: string | null;
  surfacedAt: string;
  attention: PersonalInboxAttention;
  href: string;
  ref: PersonalInboxEntityRef;
  /** Folder tags on this item (`system:archived`, `user:12`, …). */
  folderRefs?: string[];
  /** Work-item or feedback attachments linked to this inbox row (0 when none). */
  attachmentCount?: number;
  /** Reply / forward markers for this user (original row is kept in inbox). */
  correspondence?: {
    replied: boolean;
    forwarded: boolean;
  };
};

export type PersonalInboxUserFolder = {
  id: number;
  name: string;
  folderRef: string;
};

export type PersonalInboxFoldersResult = {
  systemFolders: Array<{ slug: PersonalInboxSystemFolderSlug; labelKey: string }>;
  userFolders: PersonalInboxUserFolder[];
};

export type PersonalInboxSystemFolderSlug = 'inbox' | 'archived' | 'deleted' | 'all';

export type PersonalInboxKindFilter = PersonalInboxItemKind | 'all';

/** @deprecated Use `folder` query — kept for URL compat during transition. */
export type PersonalInboxViewFilter = 'active' | 'archived' | 'all';

export type PersonalInboxListQuery = {
  kind?: PersonalInboxKindFilter;
  /** System slug or `u:{folderId}` for a user folder. Default inbox. */
  folder?: string;
  view?: PersonalInboxViewFilter;
  take?: number;
  /** MSGI ledger filters — only when `kind=message_dispatch`. */
  dispatchChannel?: string;
  dispatchStatus?: string;
};

export type PersonalInboxSummary = {
  attentionCount: number;
  breakdown: {
    workItems: number;
    feedback: number;
    alerts: number;
  };
  preview: PersonalInboxItem[];
};

export type PersonalInboxListResult = {
  items: PersonalInboxItem[];
  total: number;
  /** Rows with `action_required` or `unread` in the current list scope (before `take` slice). */
  unreadTotal: number;
  /** Unread/action rows in inbox folder across all kinds (matches bell `summary.attentionCount`). */
  inboxAttentionCount: number;
};

/** Base Info child under `100.7` — preset title for inbox reply/forward. */
export type PersonalInboxPresetTitleOption = {
  id: string;
  label: string;
  defaultBody: string | null;
  /** Base Info tag ids (`100.8.*`) linked to this preset. */
  tagIds: string[];
};

/** Base Info child under `100.8` — tag for inbox preset titles. */
export type PersonalInboxTagOption = {
  id: string;
  label: string;
  color: string | null;
};

export type PersonalInboxCorrespondenceVocab = {
  presetTitles: PersonalInboxPresetTitleOption[];
  tags: PersonalInboxTagOption[];
};
