import React, { useState } from 'react';
import { FileText } from 'lucide-react';
import type { AiChatAttachment } from '../api/contracts/ai/chatHistoryTypes';
import { ChatImageLightbox } from './ChatImageLightbox';
import type { ChatImageGalleryItem } from './ChatImageLightbox';
import { resolveGalleryIndex } from './chatImageGallery';

const formatAttachmentShortName = (name: string): string => {
  if (name.length <= 9) return name;
  return `${name.slice(0, 3)}...${name.slice(-3)}`;
};

const downloadAttachment = (attachment: AiChatAttachment): void => {
  if (!attachment.previewUrl) return;
  const link = document.createElement('a');
  link.href = attachment.previewUrl;
  link.download = attachment.name || 'download';
  link.rel = 'noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
};

export type ChatMessageAttachmentsProps = {
  attachments: AiChatAttachment[];
  variant: 'user' | 'assistant';
  galleryImages?: ChatImageGalleryItem[];
};

export const ChatMessageAttachments: React.FC<ChatMessageAttachmentsProps> = ({
  attachments,
  galleryImages,
}) => {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const imageAttachments = attachments.filter(
    (attachment) => (
      attachment.previewUrl
      && (attachment.kind === 'image' || attachment.mimeType.startsWith('image/'))
    ),
  );
  const fileAttachments = attachments.filter(
    (attachment) => !(
      attachment.previewUrl
      && (attachment.kind === 'image' || attachment.mimeType.startsWith('image/'))
    ),
  );

  if (!imageAttachments.length && !fileAttachments.length) return null;

  const activeGallery = galleryImages?.length
    ? galleryImages
    : imageAttachments
      .filter((attachment) => attachment.previewUrl)
      .map((attachment) => ({
        src: attachment.previewUrl!,
        alt: attachment.name,
      }));

  const openImage = (src: string) => {
    setLightboxIndex(resolveGalleryIndex(activeGallery, src));
  };

  return (
    <>
      {imageAttachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {imageAttachments.map((attachment) => (
            <button
              key={attachment.id}
              type="button"
              className="h-[50px] cursor-zoom-in overflow-hidden rounded-md border border-slate-200/80 p-0"
              title={attachment.name}
              onClick={() => {
                if (!attachment.previewUrl) return;
                openImage(attachment.previewUrl);
              }}
            >
              <img
                src={attachment.previewUrl}
                alt={attachment.name}
                className="h-full w-auto max-w-none object-cover"
              />
            </button>
          ))}
        </div>
      ) : null}
      {fileAttachments.length > 0 ? (
        <div className="mb-2 flex flex-wrap gap-2">
          {fileAttachments.map((attachment) => (
            <button
              key={attachment.id}
              type="button"
              className="inline-flex max-w-full cursor-pointer items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              title={attachment.previewUrl ? `Download ${attachment.name}` : attachment.name}
              disabled={!attachment.previewUrl}
              onClick={() => downloadAttachment(attachment)}
            >
              <FileText className="h-3.5 w-3.5 shrink-0 text-slate-500" />
              <span className="max-w-[10rem] truncate font-medium">
                {formatAttachmentShortName(attachment.name)}
              </span>
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
