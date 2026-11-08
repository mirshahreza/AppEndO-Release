import React, { useMemo, useState } from 'react';
import {
  containsAttachmentPayloadText,
  extractEmbeddedDataImageUrls,
  extractUserTextBeforeAttachmentPayload,
  hasImageAttachmentPreview,
  resolveChatMessageDisplayContent,
} from '../api/contracts/ai/agentMessageAttachments';
import type { AiChatAttachment } from '../api/contracts/ai/chatHistoryTypes';
import { getChatTextDirection } from '../lib/chatTextDirection';
import { ChatImageLightbox, type ChatImageGalleryItem } from './ChatImageLightbox';
import { resolveGalleryIndex } from './chatImageGallery';
import { ChatMarkdown, type ChatMarkdownTone } from './ChatMarkdown';
import { useSmoothStreamingText } from './useSmoothStreamingText';

export type ChatMessageContentProps = {
  content: string;
  attachments?: AiChatAttachment[];
  tone?: ChatMarkdownTone;
  galleryImages?: ChatImageGalleryItem[];
};

export const ChatMessageContent: React.FC<ChatMessageContentProps> = ({
  content,
  attachments,
  tone = 'assistant',
  galleryImages,
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const embeddedImageUrls = useMemo(() => {
    const hasAttachmentImages = attachments?.some((attachment) => (
      attachment.previewUrl
      && (attachment.kind === 'image' || attachment.mimeType.startsWith('image/'))
    ));
    if (hasAttachmentImages) {
      return [];
    }
    return extractEmbeddedDataImageUrls(content);
  }, [attachments, content]);
  const displayContent = useMemo(() => {
    if (
      hasImageAttachmentPreview(attachments)
      && containsAttachmentPayloadText(content)
    ) {
      return extractUserTextBeforeAttachmentPayload(content);
    }

    const resolved = resolveChatMessageDisplayContent(content, attachments);
    if (!resolved) {
      return '';
    }
    if (resolved.includes('data:image/')) {
      return '';
    }
    if (hasImageAttachmentPreview(attachments) && containsAttachmentPayloadText(resolved)) {
      return '';
    }
    return resolved;
  }, [attachments, content]);
  const direction = useMemo(() => getChatTextDirection(displayContent), [displayContent]);
  // Assistant text streams in live via text_delta events; pace the reveal so it reads as a
  // smooth flow instead of network-burst jumps. User/history content snaps instantly.
  const smoothedContent = useSmoothStreamingText(displayContent, tone === 'assistant');

  const localGallery = useMemo(
    () => embeddedImageUrls.map((url, index) => ({
      src: url,
      alt: `Attached image ${index + 1}`,
    })),
    [embeddedImageUrls],
  );
  const activeGallery = galleryImages?.length ? galleryImages : localGallery;

  if (!displayContent && !embeddedImageUrls.length && lightboxIndex === null) {
    return null;
  }

  return (
    <>
      {smoothedContent ? (
        <ChatMarkdown content={smoothedContent} dir={direction} tone={tone} className="text-start" />
      ) : null}
      {embeddedImageUrls.length > 0 ? (
        <div className="mt-2 flex flex-wrap gap-2">
          {embeddedImageUrls.map((url, index) => (
            <button
              key={`${index}-${url.slice(0, 32)}`}
              type="button"
              className="h-[50px] cursor-zoom-in overflow-hidden rounded-md border border-slate-200 p-0"
              onClick={() => setLightboxIndex(resolveGalleryIndex(activeGallery, url))}
            >
              <img
                src={url}
                alt="Attached image"
                className="h-full w-auto max-w-none object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
      {lightboxIndex !== null && activeGallery.length > 0 ? (
        <ChatImageLightbox
          images={activeGallery}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </>
  );
};
