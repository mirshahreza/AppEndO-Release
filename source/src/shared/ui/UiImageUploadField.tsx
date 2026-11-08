import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useOptionalCultureT } from '../../core/culture/CultureContext';
import { cn } from '../../lib/utils';
import {
  fileMatchesAccept,
  isImageFile,
  isImageMimeType,
  isImageUrl,
} from '../lib/fileFieldUtils';
import { ChatImageLightbox } from './ChatImageLightbox';
import { ImageEditorSaveDialog } from './image-editor/ImageEditorSaveDialog';
import {
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_DELETE_CLASS,
  ICON_ACTION_EDIT_CLASS,
} from './surfaceClasses';

export type UiImageUploadFieldShape = 'circle' | 'rectangle';
export type UiImageUploadFieldAccent = 'emerald' | 'rose' | 'slate';

const UPLOAD_FIELD_ACCENT_CLASS: Record<
  UiImageUploadFieldAccent,
  { zone: string; icon: string; rejected: string }
> = {
  emerald: {
    zone: 'border-emerald-300',
    icon: 'text-emerald-600',
    rejected: 'border-rose-300 bg-rose-50/30',
  },
  rose: {
    zone: 'border-rose-200/90 bg-gradient-to-b from-rose-50/40 to-white',
    icon: 'text-rose-600',
    rejected: 'border-rose-400 bg-rose-50/50',
  },
  slate: {
    zone: 'border-slate-200/90 bg-gradient-to-b from-slate-50/50 to-white',
    icon: 'text-slate-700',
    rejected: 'border-rose-300 bg-rose-50/30',
  },
};

export type UiImageUploadFieldProps = {
  value?: File | null;
  /** Existing stored image URL when no local `value` is selected (edit surfaces). */
  previewSrc?: string | null;
  previewMimeType?: string | null;
  onChange: (file: File | null) => void | Promise<void>;
  accept?: string;
  disabled?: boolean;
  className?: string;
  zoneClassName?: string;
  ariaLabel?: string;
  /** Circle for profile photos; rectangle for documents and attachments. */
  shape?: UiImageUploadFieldShape;
  /** Fixed zone height in px; container size does not change when an image is selected. */
  zoneHeight?: number;
  maxSizeMb?: number;
  enableImageEditor?: boolean;
  enableAiPanel?: boolean;
  editorTitle?: string;
  /** When true, opens the editor immediately after pick; default false — use the edit control instead. */
  openEditorOnPick?: boolean;
  accent?: UiImageUploadFieldAccent;
  /** When false, empty rectangle zones show icon only (section-level hint elsewhere). Default true. */
  showEmptyZoneDescription?: boolean;
  /** When true, clicking the preview image opens it in a new browser tab. Default false. */
  openPreviewOnClick?: boolean;
  /** When true, clicking the preview opens a maximized in-app lightbox (overrides new tab). Default false. */
  openPreviewInLightbox?: boolean;
  /** When false, hide edit/remove controls on the preview (read-only surfaces). Default true. */
  showPreviewActions?: boolean;
  /** Allow picking multiple files in the file dialog (and batch drop). */
  allowMultiple?: boolean;
  /** When set with `allowMultiple`, valid picks are delivered in one batch (add-only slots). */
  onBatchChange?: (files: readonly File[]) => void | Promise<void>;
  onError?: (error: Error) => void;
};

const DEFAULT_RECTANGLE_HEIGHT = 220;
const DEFAULT_CIRCLE_SIZE = 120;

const readMaxBytes = (maxSizeMb: number) => maxSizeMb * 1024 * 1024;

export const UiImageUploadField: React.FC<UiImageUploadFieldProps> = ({
  value = null,
  previewSrc,
  previewMimeType,
  onChange,
  accept = 'image/*',
  disabled = false,
  className,
  zoneClassName,
  ariaLabel,
  shape = 'rectangle',
  zoneHeight = shape === 'circle' ? DEFAULT_CIRCLE_SIZE : DEFAULT_RECTANGLE_HEIGHT,
  maxSizeMb = 10,
  enableImageEditor = true,
  enableAiPanel = true,
  editorTitle,
  openEditorOnPick = false,
  accent = 'emerald',
  showEmptyZoneDescription = true,
  openPreviewOnClick = false,
  openPreviewInLightbox = false,
  showPreviewActions = true,
  allowMultiple = false,
  onBatchChange,
  onError,
}) => {
  const t = useOptionalCultureT();
  const accentClass = UPLOAD_FIELD_ACCENT_CLASS[accent];
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(value ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [remotePreviewSuppressed, setRemotePreviewSuppressed] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [editorFileName, setEditorFileName] = useState('image.jpg');
  const [isProcessing, setIsProcessing] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const resolvedAriaLabel = ariaLabel ?? t('ui.controls.imageUpload.fileInputAria');
  const resolvedEditorTitle = editorTitle ?? t('ui.controls.imageUpload.editorTitle');

  useEffect(() => {
    setSelectedFile(value ?? null);
    if (value) {
      setRemotePreviewSuppressed(false);
      setImageLoadFailed(false);
    }
  }, [value]);

  useEffect(() => {
    setRemotePreviewSuppressed(false);
    setImageLoadFailed(false);
  }, [previewSrc]);

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return undefined;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const zoneStyle = useMemo(
    () => ({
      height: zoneHeight,
      ...(shape === 'circle' ? { width: zoneHeight } : {}),
    }),
    [shape, zoneHeight],
  );

  const isCircle = shape === 'circle';

  const remotePreviewSrc = remotePreviewSuppressed ? null : (previewSrc?.trim() || null);
  const displaySrc = previewUrl || remotePreviewSrc || null;
  const showImagePreview = Boolean(displaySrc) && !imageLoadFailed && (
    selectedFile
      ? isImageFile(selectedFile)
      : isImageMimeType(previewMimeType) || isImageUrl(displaySrc)
  );

  const openEditor = (src: string, fileName: string) => {
    if (!enableImageEditor) return;
    setEditorSrc(src);
    setEditorFileName(fileName);
    setEditorOpen(true);
  };

  const openPicker = () => {
    if (disabled || isProcessing) return;
    inputRef.current?.click();
  };

  const applyFile = async (file: File | null) => {
    setIsProcessing(true);
    try {
      const addOnlySlot = value == null;
      if (file && !addOnlySlot) {
        setSelectedFile(file);
      }
      await onChange(file);
      if (file === null || addOnlySlot) {
        setSelectedFile(null);
        setRejected(false);
      }
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to save image.'));
      if (value == null) {
        setSelectedFile(null);
        setRejected(false);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const validateRawFile = (rawFile: File): boolean => {
    if (!fileMatchesAccept(rawFile, accept)) {
      onError?.(new Error('Selected file type is not allowed.'));
      return false;
    }
    if (rawFile.size > readMaxBytes(maxSizeMb)) {
      onError?.(new Error('Selected file exceeds the allowed size limit.'));
      return false;
    }
    return true;
  };

  const validateAndPick = async (rawFile: File) => {
    setRejected(false);
    if (!validateRawFile(rawFile)) {
      setRejected(true);
      return;
    }

    if (enableImageEditor && openEditorOnPick) {
      const objectUrl = URL.createObjectURL(rawFile);
      openEditor(objectUrl, rawFile.name);
      return;
    }

    await applyFile(rawFile);
  };

  const receiveMany = async (files: readonly File[]) => {
    if (files.length === 0) {
      return;
    }
    setRejected(false);
    const valid = files.filter((file) => validateRawFile(file));
    if (valid.length === 0) {
      setRejected(true);
      return;
    }
    if (allowMultiple && onBatchChange) {
      setIsProcessing(true);
      try {
        await onBatchChange(valid);
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Failed to save files.'));
      } finally {
        setIsProcessing(false);
      }
      return;
    }
    for (const file of valid) {
      await validateAndPick(file);
    }
  };

  const receiveFiles = (incoming: FileList | readonly File[] | null) => {
    if (!incoming?.length) {
      return;
    }
    const list = Array.from(incoming);
    if (allowMultiple) {
      void receiveMany(list);
      return;
    }
    void validateAndPick(list[0]!);
  };

  const handleEditorConfirm = async (file: File) => {
    setIsProcessing(true);
    try {
      setSelectedFile(file);
      await onChange(file);
    } catch (error) {
      const normalized = error instanceof Error ? error : new Error('Failed to save image.');
      onError?.(normalized);
      throw normalized;
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRemove = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (disabled || isProcessing || !showImagePreview) return;
    setRejected(false);
    if (selectedFile) {
      await applyFile(null);
      return;
    }
    setRemotePreviewSuppressed(true);
    await onChange(null);
  };

  const titleKey = rejected
    ? 'ui.controls.imageUpload.rejectedTitle'
    : 'ui.controls.imageUpload.chooseTitle';

  const hintText = t('ui.controls.imageUpload.localPreviewHint')
    .replace('{maxSizeMb}', String(maxSizeMb));

  const emptyZoneInteractive = !showImagePreview && !disabled && !isProcessing;

  const previewClickEnabled = openPreviewOnClick || openPreviewInLightbox;

  const activatePreview = () => {
    if (!displaySrc || isProcessing) {
      return;
    }
    if (openPreviewInLightbox) {
      setLightboxOpen(true);
      return;
    }
    if (openPreviewOnClick) {
      window.open(displaySrc, '_blank', 'noopener,noreferrer');
    }
  };

  const emptyPlusSizeClass = isCircle
    ? 'size-11 sm:size-12'
    : 'size-12 sm:size-14';

  const emptyPlusIconClass = isCircle ? 'h-5 w-5 sm:h-6 sm:w-6' : 'h-6 w-6 sm:h-7 sm:w-7';

  const showEmptyLoading = !showImagePreview && (isProcessing || (value == null && disabled));

  return (
    <>
      <div className={cn('w-full', className)} data-ui-image-upload={shape}>
        <div
          className={cn(
            'group relative overflow-hidden border-2 border-dashed bg-white text-center transition-colors',
            isCircle ? 'mx-auto w-full max-w-full rounded-full' : 'w-full rounded-md',
            emptyZoneInteractive && 'cursor-pointer',
            rejected ? accentClass.rejected : accentClass.zone,
            isCircle && accent === 'rose' && 'shadow-[0_0_14px_rgba(244,63,94,0.2)]',
            zoneClassName,
          )}
          onClick={emptyZoneInteractive ? openPicker : undefined}
          onKeyDown={
            emptyZoneInteractive
              ? (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  openPicker();
                }
              }
              : undefined
          }
          role={emptyZoneInteractive ? 'button' : undefined}
          tabIndex={emptyZoneInteractive ? 0 : undefined}
          aria-label={emptyZoneInteractive ? resolvedAriaLabel : undefined}
          style={zoneStyle}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            receiveFiles(event.dataTransfer.files);
          }}
        >
          {showImagePreview && displaySrc ? (
            <>
              <img
                src={displaySrc}
                alt={t('ui.controls.imageUpload.previewAlt')}
                draggable={false}
                className={cn(
                  'absolute bg-white',
                  isCircle
                    ? 'inset-0 h-full w-full rounded-full object-cover'
                    : 'inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] object-contain',
                  previewClickEnabled && !isProcessing && 'cursor-zoom-in',
                )}
                onError={() => setImageLoadFailed(true)}
                onClick={
                  previewClickEnabled
                    ? (event) => {
                      event.stopPropagation();
                      activatePreview();
                    }
                    : undefined
                }
                onKeyDown={
                  previewClickEnabled
                    ? (event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        event.stopPropagation();
                        activatePreview();
                      }
                    }
                    : undefined
                }
                role={previewClickEnabled ? 'button' : undefined}
                tabIndex={previewClickEnabled ? 0 : undefined}
              />
              {showPreviewActions ? (
                <div
                  className={cn(
                    'absolute flex items-center gap-1',
                    isCircle
                      ? 'inset-0 justify-center rounded-full bg-black/20'
                      : 'bottom-2 end-2 gap-0.5',
                    'pointer-events-none opacity-0 transition-opacity',
                    'group-hover:pointer-events-auto group-hover:opacity-100',
                    'group-focus-within:pointer-events-auto group-focus-within:opacity-100',
                  )}
                >
                  {enableImageEditor ? (
                    <button
                      type="button"
                      tabIndex={-1}
                      title={t('ui.controls.imageUpload.editImage')}
                      aria-label={t('ui.controls.imageUpload.editImage')}
                      disabled={disabled || isProcessing}
                      className={cn(
                        ICON_ACTION_BUTTON_SM_CLASS,
                        ICON_ACTION_EDIT_CLASS,
                        'pointer-events-auto bg-white/90 shadow-sm',
                      )}
                      onClick={(event) => {
                        event.stopPropagation();
                        openEditor(displaySrc, selectedFile?.name ?? 'image.jpg');
                      }}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    tabIndex={-1}
                    title={t('ui.controls.imageUpload.removeImage')}
                    aria-label={t('ui.controls.imageUpload.removeImage')}
                    disabled={disabled || isProcessing}
                    className={cn(
                      ICON_ACTION_BUTTON_SM_CLASS,
                      ICON_ACTION_DELETE_CLASS,
                      'bg-white/90 shadow-sm',
                    )}
                    onClick={(event) => void handleRemove(event)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div
              className={cn(
                'flex h-full flex-col items-center justify-center gap-2',
                isCircle ? 'px-2' : 'px-4 py-3',
              )}
            >
              <span
                className={cn(
                  'inline-flex shrink-0 items-center justify-center rounded-full border-2 bg-white shadow-sm',
                  !showEmptyLoading && 'transition-colors group-hover:bg-slate-50/90 group-focus-visible:ring-2 group-focus-visible:ring-offset-2',
                  emptyPlusSizeClass,
                  accentClass.icon,
                  accent === 'slate' && 'border-slate-300 group-focus-visible:ring-slate-400',
                  accent === 'rose' && 'border-rose-200 group-focus-visible:ring-rose-300',
                  accent === 'emerald' && 'border-emerald-300 group-focus-visible:ring-emerald-400',
                )}
                aria-hidden={!showEmptyLoading}
              >
                {showEmptyLoading ? (
                  <Loader2 className={cn(emptyPlusIconClass, 'animate-spin')} strokeWidth={2.25} />
                ) : (
                  <Plus className={emptyPlusIconClass} strokeWidth={2.25} />
                )}
              </span>
              {isCircle || !showEmptyZoneDescription ? (
                <span className="sr-only">
                  {showEmptyLoading
                    ? t('ui.controls.imageUpload.processing')
                    : t('ui.controls.imageUpload.chooseButton')}
                </span>
              ) : (
                <>
                  <p className="text-sm font-semibold text-slate-900">
                    {isProcessing ? t('ui.controls.imageUpload.processing') : t(titleKey)}
                  </p>
                  <p className="mx-auto max-w-md text-xs text-slate-500">{hintText}</p>
                </>
              )}
            </div>
          )}

          <input
            ref={inputRef}
            className="sr-only"
            type="file"
            accept={accept}
            multiple={allowMultiple}
            disabled={disabled || isProcessing}
            aria-label={resolvedAriaLabel}
            onChange={(event) => {
              receiveFiles(event.target.files);
              event.target.value = '';
            }}
          />
        </div>
      </div>

      {enableImageEditor && editorOpen && editorSrc ? (
        <ImageEditorSaveDialog
          open={editorOpen}
          title={resolvedEditorTitle}
          initialSrc={editorSrc}
          initialFileName={editorFileName}
          enableAiPanel={enableAiPanel}
          onClose={() => setEditorOpen(false)}
          onSave={handleEditorConfirm}
          onReplaceImage={(src, fileName) => {
            setEditorSrc(src);
            setEditorFileName(fileName);
          }}
        />
      ) : null}

      {lightboxOpen && displaySrc && showImagePreview ? (
        <ChatImageLightbox
          images={[{ src: displaySrc, alt: resolvedAriaLabel }]}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  );
};
