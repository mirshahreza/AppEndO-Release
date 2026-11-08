import type { AiChatAttachment } from '../api/contracts/ai/chatHistoryTypes';
import { extractEmbeddedDataImageUrls } from '../api/contracts/ai/agentMessageAttachments';
import type { ChatImageGalleryItem } from './ChatImageLightbox';

const isImageAttachment = (attachment: AiChatAttachment): boolean => (
  Boolean(attachment.previewUrl)
  && (attachment.kind === 'image' || attachment.mimeType.startsWith('image/'))
);

export const collectChatImageGallery = (
  messages: ReadonlyArray<{
    content?: string;
    attachments?: AiChatAttachment[];
  }>,
): ChatImageGalleryItem[] => {
  const items: ChatImageGalleryItem[] = [];
  const seen = new Set<string>();

  const push = (src: string, alt: string) => {
    if (!src || seen.has(src)) return;
    seen.add(src);
    items.push({ src, alt });
  };

  messages.forEach((message) => {
    const attachments = message.attachments ?? [];
    const hasAttachmentImages = attachments.some(isImageAttachment);

    attachments.forEach((attachment) => {
      if (!isImageAttachment(attachment) || !attachment.previewUrl) return;
      push(attachment.previewUrl, attachment.name || 'Image');
    });

    if (!hasAttachmentImages && message.content) {
      extractEmbeddedDataImageUrls(message.content).forEach((url, index) => {
        push(url, `Image ${index + 1}`);
      });
    }
  });

  return items;
};

export const resolveGalleryIndex = (
  gallery: readonly ChatImageGalleryItem[],
  src: string,
): number => {
  const index = gallery.findIndex((item) => item.src === src);
  return index >= 0 ? index : 0;
};
