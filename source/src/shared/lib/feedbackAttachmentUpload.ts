import { apiFetch } from '../api/authSession';
import type { FeedbackAttachmentDto } from '../api/contracts/feedback/types';
import { getFeedbackSessionKey } from './feedbackSessionKey';

export async function uploadFeedbackAttachments(files: File[]): Promise<FeedbackAttachmentDto[]> {
  if (files.length === 0) {
    return [];
  }
  const formData = new FormData();
  for (const file of files) {
    formData.append('files', file);
  }
  const response = await apiFetch('/api/feedback/attachments', {
    method: 'POST',
    body: formData,
    headers: { 'x-feedback-session': getFeedbackSessionKey() },
  });
  const body = (await response.json().catch(() => ({}))) as {
    success?: boolean;
    attachments?: FeedbackAttachmentDto[];
    error?: string;
  };
  if (!response.ok || body.success === false) {
    throw new Error(typeof body.error === 'string' ? body.error : 'Failed to upload attachments.');
  }
  return body.attachments ?? [];
}
