import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Pencil, X, XCircle } from 'lucide-react';
import { AppButton } from '../AppButton';
import { ConfirmDialogShell } from '../ConfirmDialogShell';
import { CreateEditModalShell } from '../CreateEditModalShell';
import {
  canvasToFile,
  dataUrlToCanvas,
  extensionForMime,
  resolveExportQuality,
  type ImageEditorExportFormat,
} from '../../lib/imageEditor';
import { ImageEditorAiPanel } from './ImageEditorAiPanel';
import {
  ImageEditorCanvas,
  ImageEditorHistoryRail,
  ImageEditorToolsRail,
} from './ImageEditorPanels';
import { useAiSettingsQuery } from '../../api/queries/aiModels';
import { EnglishOnlyCultureScope } from '../../../core/culture/EnglishOnlyCultureScope';
import { isAiGloballyEnabled } from '../../lib/aiAccess';
import { useImageEditorState, type ImageEditorTool } from './useImageEditorState';
import { DIALOG_DEEP_NESTED_BACKDROP_Z_CLASS } from '../surfaceClasses';

export type ImageEditorModalProps = {
  open: boolean;
  title?: string;
  initialSrc: string;
  initialFileName?: string;
  exportFormat?: ImageEditorExportFormat;
  exportQuality?: number;
  enableAiPanel?: boolean;
  onClose: () => void;
  onConfirm: (file: File) => void | Promise<void>;
  onReplaceImage?: (dataUrl: string, fileName: string) => void;
};

export const ImageEditorModal: React.FC<ImageEditorModalProps> = ({
  open,
  title = 'Image Editor',
  initialSrc,
  initialFileName = 'image.jpg',
  exportFormat = 'image/jpeg',
  exportQuality = 82,
  enableAiPanel = true,
  onClose,
  onConfirm,
  onReplaceImage,
}) => {
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingEditsPrompt, setPendingEditsPrompt] = useState(false);
  const editor = useImageEditorState(initialSrc);
  const aiSettingsQuery = useAiSettingsQuery({ enabled: open && enableAiPanel });

  useLayoutEffect(() => {
    if (!open) return;
    editor.resetFromDataUrl(initialSrc);
    setExpanded(false);
    setError(null);
    setPendingEditsPrompt(false);
  }, [initialSrc, open]);

  useEffect(() => {
    if (editor.activeTool === 'resize') {
      void editor.initResizeFromImage();
    }
  }, [editor.activeTool, editor.currentDataUrl]);

  const handleSelectTool = (tool: ImageEditorTool) => {
    editor.setActiveTool(tool);
    editor.setCropRect(null);
  };

  const handleTextFontSizeChange = (value: string) => {
    editor.setTextFontSize(Math.max(8, Math.min(120, Number.parseInt(value, 10) || 8)));
  };

  const handleResizeWidthChange = (value: string) => {
    const width = Math.max(1, Number.parseInt(value, 10) || 1);
    editor.setResizeWidth(width);
    if (editor.lockAspectRatio && editor.resizeHeight > 0 && editor.resizeWidth > 0) {
      const ratio = editor.resizeHeight / editor.resizeWidth;
      editor.setResizeHeight(Math.max(1, Math.round(width * ratio)));
    }
  };

  const handleResizeHeightChange = (value: string) => {
    const height = Math.max(1, Number.parseInt(value, 10) || 1);
    editor.setResizeHeight(height);
    if (editor.lockAspectRatio && editor.resizeHeight > 0 && editor.resizeWidth > 0) {
      const ratio = editor.resizeWidth / editor.resizeHeight;
      editor.setResizeWidth(Math.max(1, Math.round(height * ratio)));
    }
  };

  const handleResizeDimensionsChange = (width: number, height: number) => {
    editor.setResizeWidth(width);
    editor.setResizeHeight(height);
  };

  const handleCancelResize = () => {
    editor.discardPendingEdits();
  };

  const handleCancelCrop = () => {
    editor.discardPendingEdits();
  };

  const exportDataUrl = async (dataUrl: string) => {
    const canvas = await dataUrlToCanvas(dataUrl);
    const extension = extensionForMime(exportFormat);
    const baseName = initialFileName.replace(/\.[^.]+$/, '') || 'image';
    return canvasToFile(
      canvas,
      `${baseName}.${extension}`,
      exportFormat,
      resolveExportQuality(exportFormat, exportQuality),
    );
  };

  const handleConfirm = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const file = await exportDataUrl(editor.currentDataUrl);
      await onConfirm(file);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save image.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyPendingEdits = async (): Promise<string> => editor.applyPendingToolEdits();

  const handleFooterApplyClick = () => {
    if (!editor.canFooterApply) return;
    if (editor.hasPendingToolEdits) {
      setPendingEditsPrompt(true);
      return;
    }
    void handleConfirm();
  };

  const handleApplyPendingAndSave = async () => {
    setPendingEditsPrompt(false);
    setIsSaving(true);
    setError(null);
    try {
      const dataUrl = await handleApplyPendingEdits();
      const file = await exportDataUrl(dataUrl);
      await onConfirm(file);
      onClose();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save image.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWithoutPendingEdits = async () => {
    setPendingEditsPrompt(false);
    editor.discardPendingEdits();
    await handleConfirm();
  };

  const handleUploadSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    try {
      editor.resetFromDataUrl(objectUrl, file.name);
      onReplaceImage?.(objectUrl, file.name);
    } catch {
      URL.revokeObjectURL(objectUrl);
      setError('Failed to load uploaded image.');
    }
  };

  const showHistory = !expanded;
  const showAi = enableAiPanel
    && isAiGloballyEnabled(aiSettingsQuery.data?.enabled)
    && !expanded;

  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <EnglishOnlyCultureScope>
    <CreateEditModalShell
      title={title}
      size="maximized"
      onClose={onClose}
      onBackdropClick={onClose}
      backdropClassName={`!${DIALOG_DEEP_NESTED_BACKDROP_Z_CLASS}`}
      bodyOuterClassName="flex-1 min-h-0 overflow-hidden"
      bodyClassName="!p-0 !bg-slate-100 flex flex-col min-h-0 h-full"
      footerClassName="!mt-0"
      footer={(
        <>
          {error ? <p className="me-auto text-xs text-rose-600">{error}</p> : null}
          <AppButton intent="cancel" onClick={onClose} disabled={isSaving}>
            <X className="h-3.5 w-3.5" />
            Cancel
          </AppButton>
          <AppButton
            intent="primary"
            onClick={() => void handleFooterApplyClick()}
            disabled={isSaving || !editor.canFooterApply}
          >
            <Check className="h-3.5 w-3.5" />
            {isSaving ? 'Saving...' : 'Apply'}
          </AppButton>
        </>
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1">
          <ImageEditorToolsRail
            previewSrc={editor.currentDataUrl}
            activeTool={editor.activeTool}
            onSelectTool={handleSelectTool}
            onUpload={() => uploadInputRef.current?.click()}
            onRotate={() => void editor.applyRotate(90)}
            onFlipHorizontal={() => void editor.applyFlip(true)}
            onFlipVertical={() => void editor.applyFlip(false)}
            expanded={expanded}
            onToggleExpanded={() => setExpanded((value) => !value)}
          />

          {showHistory ? (
            <ImageEditorHistoryRail
              items={editor.historyItems}
              activeIndex={editor.index}
              onSelect={editor.jumpToHistory}
            />
          ) : null}

          <ImageEditorCanvas
            dataUrl={editor.currentDataUrl}
            activeTool={editor.activeTool}
            cropRect={editor.cropRect}
            onCropRectChange={editor.setCropRect}
            onApplyCrop={(rect) => void editor.applyCrop(rect)}
            onCancelCrop={handleCancelCrop}
            resizeWidth={editor.resizeWidth}
            resizeHeight={editor.resizeHeight}
            lockAspectRatio={editor.lockAspectRatio}
            onResizeWidthChange={handleResizeWidthChange}
            onResizeHeightChange={handleResizeHeightChange}
            onLockAspectRatioChange={editor.setLockAspectRatio}
            onResizeDimensionsChange={handleResizeDimensionsChange}
            onApplyResize={() => void editor.applyResize(editor.resizeWidth, editor.resizeHeight)}
            onCancelResize={handleCancelResize}
            expanded={expanded}
            strokeColor={editor.strokeColor}
            strokeWidth={editor.strokeWidth}
            strokeLineStyle={editor.strokeLineStyle}
            textFontSize={editor.textFontSize}
            onStrokeColorChange={editor.setStrokeColor}
            onStrokeWidthChange={editor.setStrokeWidth}
            onStrokeLineStyleChange={editor.setStrokeLineStyle}
            onTextFontSizeChange={handleTextFontSizeChange}
            onDrawLine={(from, to) => void editor.applyDrawLine(from, to)}
            onDrawRectangle={(rect) => void editor.applyDrawRectangle(rect)}
            onDrawEllipse={(rect) => void editor.applyDrawEllipse(rect)}
            onDrawText={(point, text) => void editor.applyDrawText(point, text)}
          />

          {showAi ? (
            <ImageEditorAiPanel
              currentDataUrl={editor.currentDataUrl}
              onApplyImage={editor.pushFromDataUrl}
            />
          ) : null}
        </div>
      </div>

      <input
        ref={uploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => void handleUploadSelected(event)}
      />

      <ConfirmDialogShell
        open={pendingEditsPrompt}
        title="Unapplied edits"
        tone="default"
        size="xl"
        onClose={() => setPendingEditsPrompt(false)}
        backdropClassName="!z-[140]"
        footer={(
          <>
            <AppButton
              intent="cancel"
              className="shrink-0 whitespace-nowrap"
              onClick={() => setPendingEditsPrompt(false)}
              disabled={isSaving}
            >
              <Pencil className="h-3.5 w-3.5" />
              Keep editing
            </AppButton>
            <AppButton
              intent="secondary"
              className="shrink-0 whitespace-nowrap"
              onClick={() => void handleSaveWithoutPendingEdits()}
              disabled={isSaving}
            >
              <XCircle className="h-3.5 w-3.5" />
              Reject changes
            </AppButton>
            <AppButton
              intent="primary"
              className="shrink-0 whitespace-nowrap"
              onClick={() => void handleApplyPendingAndSave()}
              disabled={isSaving}
            >
              <Check className="h-3.5 w-3.5" />
              {isSaving ? 'Saving...' : 'Apply'}
            </AppButton>
          </>
        )}
      >
        <p className="text-sm text-slate-600">
          {editor.hasPendingCrop
            ? 'You have crop changes that have not been applied yet. Apply them before saving, or save the image without those changes.'
            : 'You have resize changes that have not been applied yet. Apply them before saving, or save the image without those changes.'}
        </p>
      </ConfirmDialogShell>
    </CreateEditModalShell>
    </EnglishOnlyCultureScope>,
    document.body,
  );
};
