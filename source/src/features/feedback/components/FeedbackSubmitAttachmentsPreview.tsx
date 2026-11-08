import React, { useMemo } from 'react';
import {
  File,
  FileArchive,
  FileAudio,
  FileCode,
  FileSpreadsheet,
  FileText,
  FileVideo,
  Pencil,
  X,
} from 'lucide-react';
import type { FeedbackAttachmentDto } from '../../../shared/api/contracts/feedback/types';
import {
  isImageMimeType,
  resolveFileIconKind,
  type FileIconKind,
} from '../../../shared/lib/fileFieldUtils';
import { cn } from '../../../lib/utils';

const IMAGE_PREVIEW_MAX_PX = 150;
const IMAGE_TILE_HEIGHT_PX = 104;

const FILE_KIND_ICON: Record<Exclude<FileIconKind, 'image'>, React.ComponentType<{ className?: string }>> = {
  pdf: FileText,
  archive: FileArchive,
  audio: FileAudio,
  video: FileVideo,
  spreadsheet: FileSpreadsheet,
  document: FileText,
  code: FileCode,
  generic: File,
};

const FILE_KIND_ICON_CLASS: Record<Exclude<FileIconKind, 'image'>, string> = {
  pdf: 'text-rose-600',
  archive: 'text-amber-600',
  audio: 'text-violet-600',
  video: 'text-fuchsia-600',
  spreadsheet: 'text-emerald-600',
  document: 'text-indigo-600',
  code: 'text-slate-600',
  generic: 'text-slate-500',
};

export type FeedbackStagedAttachment = FeedbackAttachmentDto & {
  previewUrl?: string;
};

export type FeedbackSubmitAttachmentsPreviewProps = {
  attachments: FeedbackStagedAttachment[];
  onRemove: (id: string) => void;
  removeAriaLabel: string;
  onEditImage?: (id: string) => void;
  editImageAriaLabel?: string;
  editImageDisabled?: boolean;
};

export const FeedbackSubmitAttachmentsPreview: React.FC<FeedbackSubmitAttachmentsPreviewProps> = ({
  attachments,
  onRemove,
  removeAriaLabel,
  onEditImage,
  editImageAriaLabel,
  editImageDisabled = false,
}) => {
  const { images, files } = useMemo(() => {
    const imageItems: FeedbackStagedAttachment[] = [];
    const fileItems: FeedbackStagedAttachment[] = [];
    for (const item of attachments) {
      if (isImageMimeType(item.mimeType)) {
        imageItems.push(item);
      } else {
        fileItems.push(item);
      }
    }
    return { images: imageItems, files: fileItems };
  }, [attachments]);

  if (images.length === 0 && files.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {images.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2">
            {images.map((item) => (
              <div
                key={item.id}
                className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200/90 bg-slate-50/60"
                style={{
                  height: IMAGE_TILE_HEIGHT_PX,
                  maxWidth: IMAGE_PREVIEW_MAX_PX,
                  minWidth: 72,
                }}
              >
                {item.previewUrl ? (
                  <img
                    src={item.previewUrl}
                    alt=""
                    className="max-h-full max-w-full object-contain"
                    style={{ maxHeight: IMAGE_TILE_HEIGHT_PX, maxWidth: IMAGE_PREVIEW_MAX_PX }}
                  />
                ) : (
                  <span className="px-2 text-[10px] text-slate-400">{item.fileName}</span>
                )}
                <div className="absolute end-1 top-1 flex flex-row items-center gap-0.5">
                  {onEditImage && item.previewUrl ? (
                    <button
                      type="button"
                      className="rounded-full bg-white/90 p-0.5 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={editImageDisabled}
                      onClick={() => onEditImage(item.id)}
                      aria-label={editImageAriaLabel}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="rounded-full bg-white/90 p-0.5 text-slate-500 shadow-sm transition-colors hover:bg-white hover:text-rose-600"
                    onClick={() => onRemove(item.id)}
                    aria-label={removeAriaLabel}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {files.length > 0 ? (
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap gap-2">
            {files.map((item) => {
              const kind = resolveFileIconKind(item.fileName, item.mimeType);
              const iconKind = kind === 'image' ? 'generic' : kind;
              const Icon = FILE_KIND_ICON[iconKind];
              const iconClass = FILE_KIND_ICON_CLASS[iconKind];
              return (
                <div
                  key={item.id}
                  className="inline-flex max-w-full items-center gap-2 rounded-lg border border-slate-200 bg-slate-50/80 px-2.5 py-1.5"
                  title={item.fileName}
                >
                  <Icon className={cn('h-4 w-4 shrink-0', iconClass)} aria-hidden />
                  <span className="max-w-[10rem] truncate text-xs font-medium text-slate-700">
                    {item.fileName}
                  </span>
                  <button
                    type="button"
                    className="shrink-0 rounded-full p-0.5 text-slate-400 transition-colors hover:bg-black/5 hover:text-rose-600"
                    onClick={() => onRemove(item.id)}
                    aria-label={removeAriaLabel}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
};
