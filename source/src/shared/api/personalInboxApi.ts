import { apiFetch } from './authSession';
import type {
  PersonalInboxItem,
  PersonalInboxKindFilter,
  PersonalInboxListResult,
  PersonalInboxSummary,
  PersonalInboxUserFolder,
  PersonalInboxViewFilter,
  PersonalInboxCorrespondenceVocab,
} from './contracts/personal-inbox/types';

/** Matches `PersonalInboxService` bell preview slice size. */
export const PERSONAL_INBOX_BELL_PREVIEW_TAKE = 8;
import type { PersonalInboxItemDetailEnvelope } from './contracts/personal-inbox/envelopeTypes';

export const personalInboxApi = {
  list: async (options?: {
    kind?: PersonalInboxKindFilter;
    folder?: string;
    view?: PersonalInboxViewFilter;
    take?: number;
    dispatchChannel?: string;
    dispatchStatus?: string;
  }): Promise<PersonalInboxListResult> => {
    const params = new URLSearchParams();
    if (options?.kind && options.kind !== 'all') params.set('kind', options.kind);
    if (options?.folder?.trim()) params.set('folder', options.folder.trim());
    if (!options?.folder && options?.view === 'archived') params.set('view', 'archived');
    if (!options?.folder && options?.view === 'all') params.set('view', 'all');
    if (options?.take !== undefined) params.set('take', String(options.take));
    if (options?.dispatchChannel) params.set('dispatchChannel', options.dispatchChannel);
    if (options?.dispatchStatus) params.set('dispatchStatus', options.dispatchStatus);
    const qs = params.toString();
    const response = await apiFetch(`/api/personal-inbox${qs ? `?${qs}` : ''}`);
    const payload = await response.json() as {
      success?: boolean;
      items?: PersonalInboxItem[];
      total?: number;
      unreadTotal?: number;
      inboxAttentionCount?: number;
      error?: string;
    };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Failed to load inbox.');
    }
    const items = payload.items ?? [];
    const unreadFromPayload = payload.unreadTotal;
    const unreadTotal = typeof unreadFromPayload === 'number' && Number.isFinite(unreadFromPayload)
      ? unreadFromPayload
      : items.filter((item) => item.attention === 'action_required' || item.attention === 'unread').length;
    const inboxFromPayload = payload.inboxAttentionCount;
    const inboxAttentionCount = typeof inboxFromPayload === 'number' && Number.isFinite(inboxFromPayload)
      ? inboxFromPayload
      : unreadTotal;
    return { items, total: payload.total ?? 0, unreadTotal, inboxAttentionCount };
  },

  summary: async (): Promise<PersonalInboxSummary> => {
    const response = await apiFetch('/api/personal-inbox/summary');
    const payload = await response.json() as { success?: boolean; summary?: PersonalInboxSummary; error?: string };
    if (!response.ok || !payload.success || !payload.summary) {
      throw new Error(payload.error ?? 'Failed to load inbox summary.');
    }
    return payload.summary;
  },

  listFolders: async (): Promise<PersonalInboxUserFolder[]> => {
    const response = await apiFetch('/api/personal-inbox/folders');
    const payload = await response.json() as {
      success?: boolean;
      userFolders?: PersonalInboxUserFolder[];
      error?: string;
    };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Failed to load inbox folders.');
    }
    return payload.userFolders ?? [];
  },

  createFolder: async (name: string): Promise<PersonalInboxUserFolder> => {
    const response = await apiFetch('/api/personal-inbox/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const payload = await response.json() as {
      success?: boolean;
      folder?: PersonalInboxUserFolder;
      error?: string;
    };
    if (!response.ok || !payload.success || !payload.folder) {
      throw new Error(payload.error ?? 'Failed to create inbox folder.');
    }
    return payload.folder;
  },

  renameFolder: async (folderId: number, name: string): Promise<PersonalInboxUserFolder> => {
    const response = await apiFetch(`/api/personal-inbox/folders/${folderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });
    const payload = await response.json() as {
      success?: boolean;
      folder?: PersonalInboxUserFolder;
      error?: string;
    };
    if (!response.ok || !payload.success || !payload.folder) {
      throw new Error(payload.error ?? 'Failed to rename inbox folder.');
    }
    return payload.folder;
  },

  deleteFolder: async (folderId: number): Promise<{ deleted: boolean }> => {
    const response = await apiFetch(`/api/personal-inbox/folders/${folderId}`, {
      method: 'DELETE',
    });
    const payload = await response.json() as {
      success?: boolean;
      deleted?: boolean;
      error?: string;
    };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Failed to delete inbox folder.');
    }
    return { deleted: Boolean(payload.deleted) };
  },

  setItemFolderRefs: async (
    itemKey: string,
    folderRefs: string[],
  ): Promise<{ folderRefs: string[]; summary?: PersonalInboxSummary }> => {
    const response = await apiFetch('/api/personal-inbox/items/folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemKey, folderRefs }),
    });
    const payload = await response.json() as {
      success?: boolean;
      folderRefs?: string[];
      summary?: PersonalInboxSummary;
      error?: string;
    };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Failed to update item folders.');
    }
    return { folderRefs: payload.folderRefs ?? [], summary: payload.summary };
  },

  markUnread: async (itemKey: string): Promise<{ updated: boolean; summary?: PersonalInboxSummary }> => {
    const response = await apiFetch('/api/personal-inbox/mark-unread', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemKey }),
    });
    const payload = await response.json() as {
      success?: boolean;
      updated?: boolean;
      summary?: PersonalInboxSummary;
      error?: string;
    };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Failed to mark inbox item unread.');
    }
    return { updated: Boolean(payload.updated), summary: payload.summary };
  },

  permanentDeleteItem: async (itemKey: string): Promise<{ deleted: boolean; summary?: PersonalInboxSummary }> => {
    const response = await apiFetch('/api/personal-inbox/items/permanent-delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemKey }),
    });
    const payload = await response.json() as {
      success?: boolean;
      deleted?: boolean;
      summary?: PersonalInboxSummary;
      error?: string;
    };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Failed to permanently delete inbox item.');
    }
    return { deleted: Boolean(payload.deleted), summary: payload.summary };
  },

  dismissAttention: async (itemKey: string): Promise<{ dismissed: boolean; summary?: PersonalInboxSummary }> => {
    const response = await apiFetch('/api/personal-inbox/dismiss-attention', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemKey }),
    });
    const payload = await response.json() as {
      success?: boolean;
      dismissed?: boolean;
      summary?: PersonalInboxSummary;
      error?: string;
    };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Failed to dismiss inbox attention.');
    }
    return { dismissed: Boolean(payload.dismissed), summary: payload.summary };
  },

  getItemDetail: async (itemKey: string): Promise<PersonalInboxItemDetailEnvelope> => {
    const params = new URLSearchParams({ itemKey: itemKey.trim() });
    const response = await apiFetch(`/api/personal-inbox/items/detail?${params.toString()}`);
    const payload = await response.json() as {
      success?: boolean;
      detail?: PersonalInboxItemDetailEnvelope;
      error?: string;
    };
    if (!response.ok || !payload.success || !payload.detail) {
      throw new Error(payload.error ?? 'Failed to load inbox item detail.');
    }
    return payload.detail;
  },

  correspondenceVocab: async (): Promise<PersonalInboxCorrespondenceVocab> => {
    const response = await apiFetch('/api/personal-inbox/correspondence-vocab');
    const payload = await response.json() as {
      success?: boolean;
      presetTitles?: PersonalInboxCorrespondenceVocab['presetTitles'];
      tags?: PersonalInboxCorrespondenceVocab['tags'];
      error?: string;
    };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Failed to load inbox presets.');
    }
    return {
      presetTitles: payload.presetTitles ?? [],
      tags: payload.tags ?? [],
    };
  },

  replyToItem: async (
    itemKey: string,
    body: string,
    options?: { stagedSessionKey?: string; attachmentIds?: string[] },
  ): Promise<{ itemKey: string; summary?: PersonalInboxSummary }> => {
    const stagedSessionKey = options?.stagedSessionKey ?? '';
    const attachmentIds = options?.attachmentIds ?? [];
    const response = await apiFetch('/api/personal-inbox/items/reply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemKey, body, stagedSessionKey, attachmentIds }),
    });
    const payload = await response.json() as {
      success?: boolean;
      itemKey?: string;
      summary?: PersonalInboxSummary;
      error?: string;
    };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Failed to send reply.');
    }
    return { itemKey: payload.itemKey ?? itemKey, summary: payload.summary };
  },

  forwardItem: async (
    itemKey: string,
    recipientUserId: number,
    note?: string,
    options?: { stagedSessionKey?: string; attachmentIds?: string[] },
  ): Promise<{ itemKey: string; recipientUserId: number; summary?: PersonalInboxSummary }> => {
    const stagedSessionKey = options?.stagedSessionKey ?? '';
    const attachmentIds = options?.attachmentIds ?? [];
    const response = await apiFetch('/api/personal-inbox/items/forward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemKey,
        recipientUserId,
        note: note?.trim() || undefined,
        stagedSessionKey,
        attachmentIds,
      }),
    });
    const payload = await response.json() as {
      success?: boolean;
      itemKey?: string;
      recipientUserId?: number;
      summary?: PersonalInboxSummary;
      error?: string;
    };
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? 'Failed to forward inbox item.');
    }
    return {
      itemKey: payload.itemKey ?? itemKey,
      recipientUserId: payload.recipientUserId ?? recipientUserId,
      summary: payload.summary,
    };
  },
};

export const PERSONAL_INBOX_CHANGED_EVENT = 'appendo:personal-inbox-changed';

export const notifyPersonalInboxChanged = (summary?: PersonalInboxSummary): void => {
  window.dispatchEvent(new CustomEvent(PERSONAL_INBOX_CHANGED_EVENT, { detail: summary ?? null }));
};

export const notifyPersonalInboxChangedWithFallback = async (
  summary?: PersonalInboxSummary,
): Promise<void> => {
  if (summary) {
    notifyPersonalInboxChanged(summary);
    return;
  }
  try {
    notifyPersonalInboxChanged(await personalInboxApi.summary());
  } catch {
    notifyPersonalInboxChanged();
  }
};
