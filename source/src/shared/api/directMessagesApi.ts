import { apiFetch } from './authSession';

export type DirectMessageRecipient = {
  id: number;
  username: string;
};

export type DirectMessageThreadDto = {
  id: number;
  counterpartUserId: number;
  counterpartUsername: string;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  unreadCount: number;
};

export type DirectMessageAttachmentDto = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export type DirectMessageMessageDto = {
  id: number;
  threadId: number;
  senderUserId: number;
  body: string;
  createdAt: string;
  attachments?: DirectMessageAttachmentDto[];
};

export const directMessagesApi = {
  searchRecipients: async (search: string): Promise<DirectMessageRecipient[]> => {
    const qs = new URLSearchParams({ search });
    const response = await apiFetch(`/api/direct-messages/recipients?${qs.toString()}`);
    const body = await response.json() as { success?: boolean; items?: DirectMessageRecipient[]; message?: string };
    if (!response.ok || !body.success) {
      throw new Error(body.message ?? 'Failed to search recipients.');
    }
    return body.items ?? [];
  },

  createThread: async (input: {
    recipientUserId: number;
    body?: string;
    attachmentIds?: string[];
    stagedSessionKey?: string;
  }) => {
    const response = await apiFetch('/api/direct-messages/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const body = await response.json() as {
      success?: boolean;
      thread?: DirectMessageThreadDto;
      message?: DirectMessageMessageDto | null;
      error?: string;
    };
    if (!response.ok || !body.success || !body.thread) {
      const errBody = body as { message?: string; error?: string };
      throw new Error(errBody.message ?? errBody.error ?? 'Failed to create conversation.');
    }
    return { thread: body.thread, message: body.message ?? null };
  },

  getThread: async (threadId: number): Promise<DirectMessageThreadDto> => {
    const response = await apiFetch(`/api/direct-messages/threads/${threadId}`);
    const body = await response.json() as { success?: boolean; thread?: DirectMessageThreadDto; message?: string };
    if (!response.ok || !body.success || !body.thread) {
      throw new Error(body.message ?? 'Failed to load conversation.');
    }
    return body.thread;
  },

  listMessages: async (threadId: number): Promise<DirectMessageMessageDto[]> => {
    const response = await apiFetch(`/api/direct-messages/threads/${threadId}/messages`);
    const body = await response.json() as { success?: boolean; messages?: DirectMessageMessageDto[]; message?: string };
    if (!response.ok || !body.success) {
      throw new Error(body.message ?? 'Failed to load messages.');
    }
    return body.messages ?? [];
  },

  sendMessage: async (
    threadId: number,
    text: string,
    options?: { attachmentIds?: string[]; stagedSessionKey?: string },
  ): Promise<DirectMessageMessageDto> => {
    const response = await apiFetch(`/api/direct-messages/threads/${threadId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: text,
        attachmentIds: options?.attachmentIds,
        stagedSessionKey: options?.stagedSessionKey,
      }),
    });
    const body = await response.json() as {
      success?: boolean;
      message?: DirectMessageMessageDto;
      error?: string;
    };
    if (!response.ok || !body.success || !body.message) {
      throw new Error(body.error ?? 'Failed to send message.');
    }
    return body.message;
  },

  markRead: async (threadId: number): Promise<void> => {
    const response = await apiFetch(`/api/direct-messages/threads/${threadId}/read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const body = await response.json() as { success?: boolean; message?: string };
    if (!response.ok || !body.success) {
      throw new Error(body.message ?? 'Failed to mark conversation read.');
    }
  },
};
