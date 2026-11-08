import { apiFetch } from '../api/authSession';
import { getDirectMessageSessionKey } from './directMessageSessionKey';

export type DirectMessageStagedAttachment = {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: string;
};

export async function uploadDirectMessageAttachments(
  files: File[],
): Promise<DirectMessageStagedAttachment[]> {
  if (files.length === 0) {
    return [];
  }
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const response = await apiFetch('/api/direct-messages/attachments', {
    method: 'POST',
    body: formData,
    headers: { 'x-direct-message-session': getDirectMessageSessionKey() },
  });
  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    attachments?: DirectMessageStagedAttachment[];
    message?: string;
    error?: string;
  };
  if (!response.ok || body.success === false) {
    throw new Error(typeof body.message === 'string' ? body.message : body.error ?? 'Failed to upload attachments.');
  }
  return body.attachments ?? [];
}
