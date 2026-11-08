import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pencil, Trash2, Upload } from 'lucide-react';
import { useOptionalCultureT } from '../../core/culture/CultureContext';
import { cn } from '../../lib/utils';
import {
  fileMatchesAccept,
  isImageFile,
  isImageMimeType,
  isImageUrl,
  type ImageResizeOptions,
} from '../lib/fileFieldUtils';
import { ImageEditorSaveDialog } from './image-editor/ImageEditorSaveDialog';
import { AiImageFieldAssistActions } from './ai-field-assist/AiImageFieldAssistActions';
import {
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_DELETE_CLASS,
  ICON_ACTION_EDIT_CLASS,
} from './surfaceClasses';

export type UiImageFieldProps = {
  value?: File | null;
  previewSrc?: string | null;
  previewFileName?: string | null;
  previewMimeType?: string | null;
  accept?: string;
  disabled?: boolean;
  className?: string;
  boxClassName?: string;
  ariaLabel?: string;
  emptyHint?: string;
  size?: number;
  editorTitle?: string;
  enableAiPanel?: boolean;
  /** OCR result callback (EUA-12). */
  onOcrText?: (text: string) => void;
  /** Alt-text suggestion callback (EUA-13). */
  onAltText?: (altText: string) => void;
  ocrTargetLabel?: string;
  /** When false, hides the file name caption under the preview box. Default true. */
  showFileName?: boolean;
  /** When true, opens the editor on pick or when clicking a filled preview; default false — use the edit control. */
  openEditorOnPick?: boolean;
  /** When false, hides edit affordances and skips the image editor dialog. Default true. */
  enableImageEditor?: boolean;
  onChange: (file: File | null) => void | Promise<void>;
  onError?: (error: Error) => void;
  /** Applied after editor confirm when editor is bypassed for direct upload fallback. */
  resize?: ImageResizeOptions;
};

export const UiImageField: React.FC<UiImageFieldProps> = ({
  value,
  previewSrc,
  previewFileName,
  previewMimeType,
  accept = 'image/*',
  disabled = false,
  className,
  boxClassName,
  ariaLabel,
  emptyHint,
  size = 112,
  editorTitle,
  enableAiPanel = true,
  enableImageEditor = true,
  onOcrText,
  onAltText,
  ocrTargetLabel,
  showFileName = true,
  openEditorOnPick = false,
  onChange,
  onError,
}) => {
  const t = useOptionalCultureT();
  const resolvedAriaLabel = ariaLabel ?? t('ui.controls.imageUpload.fileInputAria');
  const resolvedEmptyHint = emptyHint ?? t('ui.controls.imageUpload.compactEmptyHint');
  const resolvedEditorTitle = editorTitle ?? t('ui.controls.imageUpload.editorTitle');
  const inputRef = useRef<HTMLInputElement>(null);
  const previewSrcRef = useRef(previewSrc);
  const [selectedFile, setSelectedFile] = useState<File | null>(value ?? null);
  const [localPreviewSrc, setLocalPreviewSrc] = useState<string | null>(null);
  const [remotePreviewSuppressed, setRemotePreviewSuppressed] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorSrc, setEditorSrc] = useState<string | null>(null);
  const [editorFileName, setEditorFileName] = useState('image.jpg');
  const [isProcessing, setIsProcessing] = useState(false);
  const [imageLoadFailed, setImageLoadFailed] = useState(false);

  useEffect(() => {
    setSelectedFile(value ?? null);
    if (value) setRemotePreviewSuppressed(false);
  }, [value]);

  useEffect(() => {
    if (previewSrc !== previewSrcRef.current) {
      previewSrcRef.current = previewSrc;
      setRemotePreviewSuppressed(false);
      setImageLoadFailed(false);
    }
  }, [previewSrc]);

  useEffect(() => {
    if (!selectedFile) {
      setLocalPreviewSrc(null);
      return undefined;
    }

    const objectUrl = URL.createObjectURL(selectedFile);
    setLocalPreviewSrc(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const remotePreviewSrc = remotePreviewSuppressed ? null : (previewSrc ?? null);
  const displaySrc = localPreviewSrc || remotePreviewSrc || null;
  const displayName = selectedFile?.name || previewFileName || null;
  const displayMimeType = selectedFile?.type || previewMimeType || null;
  const showImagePreview = Boolean(displaySrc) && !imageLoadFailed && (
    selectedFile
      ? isImageFile(selectedFile)
      : isImageMimeType(displayMimeType) || isImageUrl(displaySrc)
  );

  const boxStyle = useMemo(() => ({ width: size, height: size }), [size]);

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

  const handleBoxClick = () => {
    if (disabled || isProcessing) return;
    if (showImagePreview && displaySrc && enableImageEditor && openEditorOnPick) {
      openEditor(displaySrc, displayName || 'image.jpg');
      return;
    }
    openPicker();
  };

  const applyPickedFile = async (rawFile: File) => {
    setIsProcessing(true);
    try {
      setSelectedFile(rawFile);
      await onChange(rawFile);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to save image.'));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInputChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const rawFile = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (!rawFile) return;

    if (!fileMatchesAccept(rawFile, accept)) {
      onError?.(new Error('Selected file type is not allowed.'));
      return;
    }

    if (enableImageEditor && openEditorOnPick) {
      const objectUrl = URL.createObjectURL(rawFile);
      openEditor(objectUrl, rawFile.name);
      return;
    }

    await applyPickedFile(rawFile);
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

  const handleEditorClose = () => {
    setEditorOpen(false);
  };

  const handleDelete = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (disabled || isProcessing) return;

    setIsProcessing(true);
    try {
      setSelectedFile(null);
      setRemotePreviewSuppressed(true);
      await onChange(null);
    } catch (error) {
      onError?.(error instanceof Error ? error : new Error('Failed to remove image.'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <div className={cn('inline-flex flex-col gap-1.5', className)}>
        <div className="group relative shrink-0" style={boxStyle}>
          <button
            type="button"
            onClick={handleBoxClick}
            disabled={disabled || isProcessing}
            aria-label={resolvedAriaLabel}
            style={boxStyle}
            className={cn(
              'relative overflow-hidden rounded-md border border-slate-300 bg-white text-slate-500 transition-colors',
              'hover:border-indigo-400 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200',
              'disabled:cursor-not-allowed disabled:opacity-60',
              boxClassName,
            )}
          >
            {showImagePreview && displaySrc ? (
              <img
                src={displaySrc}
                alt={displayName || 'Image preview'}
                className="h-full w-full object-contain"
                onError={() => setImageLoadFailed(true)}
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 px-2 text-center">
                <Upload className="h-5 w-5 text-slate-400" />
                {isProcessing || emptyHint ? (
                  <span className="text-[10px] font-semibold text-slate-500">
                    {isProcessing ? t('ui.controls.imageUpload.processing') : resolvedEmptyHint}
                  </span>
                ) : null}
              </div>
            )}
          </button>

          {showImagePreview ? (
            <div
              className={cn(
                'absolute bottom-1 end-1 flex items-center gap-0.5',
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
                    'bg-white/90 shadow-sm',
                  )}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (displaySrc) openEditor(displaySrc, displayName || 'image.jpg');
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
                onClick={(event) => void handleDelete(event)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}

          <input
            ref={inputRef}
            type="file"
            accept={accept}
            disabled={disabled || isProcessing}
            onChange={(event) => void handleInputChange(event)}
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
        </div>

        {showFileName ? (
          <span
            className="block h-[14px] max-w-full truncate text-[10px] font-medium leading-[14px] text-slate-600"
            title={displayName && showImagePreview ? displayName : undefined}
          >
            {displayName && showImagePreview ? displayName : '\u00a0'}
          </span>
        ) : null}

        {(onOcrText || onAltText) && selectedFile ? (
          <AiImageFieldAssistActions
            file={selectedFile}
            disabled={disabled || isProcessing}
            targetFieldLabel={ocrTargetLabel ?? ariaLabel}
            onOcrText={onOcrText}
            onAltText={onAltText}
          />
        ) : null}
      </div>

      {enableImageEditor && editorOpen && editorSrc ? (
        <ImageEditorSaveDialog
          open={editorOpen}
          title={resolvedEditorTitle}
          initialSrc={editorSrc}
          initialFileName={editorFileName}
          enableAiPanel={enableAiPanel}
          onClose={handleEditorClose}
          onSave={handleEditorConfirm}
          onReplaceImage={(src, fileName) => {
            setEditorSrc(src);
            setEditorFileName(fileName);
          }}
        />
      ) : null}
    </>
  );
};
