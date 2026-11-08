import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  canvasToDataUrl,
  cropCanvas,
  dataUrlToCanvas,
  flipCanvas,
  resizeCanvas,
  rotateCanvas,
  type CropRect,
} from '../../lib/imageEditor';
import {
  drawTextOnContext,
  strokeEllipseOnContext,
  strokeLineOnContext,
  strokeRectOnContext,
  type ImageEditorPoint,
  type ImageEditorLineStyle,
  type ImageEditorStrokeStyle,
} from '../../lib/imageEditorAnnotations';

export type ImageEditorHistoryEntry = {
  id: string;
  dataUrl: string;
  label: string;
};

const createEntryId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export type ImageEditorDrawTool = 'line' | 'rectangle' | 'ellipse' | 'text';

export type ImageEditorTool = 'view' | 'crop' | 'resize' | ImageEditorDrawTool;

export const isImageEditorDrawTool = (tool: ImageEditorTool): tool is ImageEditorDrawTool => (
  tool === 'line'
  || tool === 'rectangle'
  || tool === 'ellipse'
  || tool === 'text'
);

const DEFAULT_STROKE_COLOR = '#e11d48';
const DEFAULT_STROKE_WIDTH = 4;
const DEFAULT_STROKE_LINE_STYLE: ImageEditorLineStyle = 'solid';
const DEFAULT_TEXT_FONT_SIZE = 28;

export function useImageEditorState(initialDataUrl: string) {
  const [entries, setEntries] = useState<ImageEditorHistoryEntry[]>(() => ([
    { id: createEntryId(), dataUrl: initialDataUrl, label: 'Original' },
  ]));
  const [index, setIndex] = useState(0);
  const [activeTool, setActiveTool] = useState<ImageEditorTool>('view');
  const [cropRect, setCropRect] = useState<CropRect | null>(null);
  const [resizeWidth, setResizeWidth] = useState(0);
  const [resizeHeight, setResizeHeight] = useState(0);
  const [lockAspectRatio, setLockAspectRatio] = useState(true);
  const [sourceWidth, setSourceWidth] = useState(0);
  const [sourceHeight, setSourceHeight] = useState(0);
  const [baselineDataUrl, setBaselineDataUrl] = useState(initialDataUrl);
  const [strokeColor, setStrokeColor] = useState(DEFAULT_STROKE_COLOR);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE_WIDTH);
  const [strokeLineStyle, setStrokeLineStyle] = useState<ImageEditorLineStyle>(DEFAULT_STROKE_LINE_STYLE);
  const [textFontSize, setTextFontSize] = useState(DEFAULT_TEXT_FONT_SIZE);

  const currentEntry = entries[index] ?? entries[0];
  const currentDataUrl = currentEntry?.dataUrl ?? initialDataUrl;

  useEffect(() => {
    let cancelled = false;
    void dataUrlToCanvas(currentDataUrl).then((canvas) => {
      if (cancelled) return;
      setSourceWidth(canvas.width);
      setSourceHeight(canvas.height);
    });
    return () => {
      cancelled = true;
    };
  }, [currentDataUrl]);

  const pushCanvas = useCallback(async (
    canvas: HTMLCanvasElement,
    label: string,
    options?: { keepActiveTool?: boolean },
  ) => {
    const dataUrl = canvasToDataUrl(canvas);
    const entry: ImageEditorHistoryEntry = { id: createEntryId(), dataUrl, label };
    setEntries((prev) => {
      const next = [...prev.slice(0, index + 1), entry];
      return next;
    });
    setIndex((prev) => prev + 1);
    if (!options?.keepActiveTool) {
      setActiveTool('view');
    }
    setCropRect(null);
    return dataUrl;
  }, [index]);

  const pushFromDataUrl = useCallback((dataUrl: string, label: string) => {
    const entry: ImageEditorHistoryEntry = { id: createEntryId(), dataUrl, label };
    setEntries((prev) => [...prev.slice(0, index + 1), entry]);
    setIndex((prev) => prev + 1);
    setActiveTool('view');
    setCropRect(null);
  }, [index]);

  const jumpToHistory = useCallback((targetIndex: number) => {
    if (targetIndex < 0 || targetIndex >= entries.length) return;
    setIndex(targetIndex);
    setActiveTool('view');
    setCropRect(null);
  }, [entries.length]);

  const resetFromDataUrl = useCallback((dataUrl: string, label = 'Original') => {
    const entry: ImageEditorHistoryEntry = { id: createEntryId(), dataUrl, label };
    setEntries([entry]);
    setIndex(0);
    setActiveTool('view');
    setCropRect(null);
    setBaselineDataUrl(dataUrl);
  }, []);

  const applyCrop = useCallback(async (rect: CropRect) => {
    const canvas = await dataUrlToCanvas(currentDataUrl);
    const next = cropCanvas(canvas, rect);
    return pushCanvas(next, 'Crop');
  }, [currentDataUrl, pushCanvas]);

  const applyResize = useCallback(async (width: number, height: number) => {
    const canvas = await dataUrlToCanvas(currentDataUrl);
    const next = resizeCanvas(canvas, width, height);
    return pushCanvas(next, `Resize ${width}×${height}`);
  }, [currentDataUrl, pushCanvas]);

  const applyRotate = useCallback(async (degrees: 90 | -90 | 180) => {
    const canvas = await dataUrlToCanvas(currentDataUrl);
    const next = rotateCanvas(canvas, degrees);
    const label = degrees === 180 ? 'Rotate 180°' : degrees === 90 ? 'Rotate 90°' : 'Rotate -90°';
    await pushCanvas(next, label);
  }, [currentDataUrl, pushCanvas]);

  const applyFlip = useCallback(async (horizontal: boolean) => {
    const canvas = await dataUrlToCanvas(currentDataUrl);
    const next = flipCanvas(canvas, horizontal);
    await pushCanvas(next, horizontal ? 'Flip horizontal' : 'Flip vertical');
  }, [currentDataUrl, pushCanvas]);

  const strokeStyle = useMemo<ImageEditorStrokeStyle>(
    () => ({ color: strokeColor, lineWidth: strokeWidth, lineStyle: strokeLineStyle }),
    [strokeColor, strokeLineStyle, strokeWidth],
  );

  const applyAnnotation = useCallback(async (
    label: string,
    draw: (ctx: CanvasRenderingContext2D) => void,
  ) => {
    const canvas = await dataUrlToCanvas(currentDataUrl);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to prepare image canvas.');
    draw(ctx);
    return pushCanvas(canvas, label, { keepActiveTool: true });
  }, [currentDataUrl, pushCanvas]);

  const applyDrawLine = useCallback(async (from: ImageEditorPoint, to: ImageEditorPoint) => {
    await applyAnnotation('Line', (ctx) => {
      strokeLineOnContext(ctx, from, to, strokeStyle);
    });
  }, [applyAnnotation, strokeStyle]);

  const applyDrawRectangle = useCallback(async (rect: CropRect) => {
    await applyAnnotation('Rectangle', (ctx) => {
      strokeRectOnContext(ctx, rect, strokeStyle);
    });
  }, [applyAnnotation, strokeStyle]);

  const applyDrawEllipse = useCallback(async (rect: CropRect) => {
    await applyAnnotation('Circle', (ctx) => {
      strokeEllipseOnContext(ctx, rect, strokeStyle);
    });
  }, [applyAnnotation, strokeStyle]);

  const applyDrawText = useCallback(async (point: ImageEditorPoint, text: string) => {
    await applyAnnotation('Text', (ctx) => {
      drawTextOnContext(ctx, point, text, { color: strokeColor, fontSize: textFontSize });
    });
  }, [applyAnnotation, strokeColor, textFontSize]);

  const initResizeFromImage = useCallback(async () => {
    const canvas = await dataUrlToCanvas(currentDataUrl);
    setResizeWidth(canvas.width);
    setResizeHeight(canvas.height);
  }, [currentDataUrl]);

  const canUndo = index > 0;
  const hasAppliedChanges = currentDataUrl !== baselineDataUrl;
  const hasPendingCrop = activeTool === 'crop' && cropRect !== null;
  const hasPendingResize = activeTool === 'resize';
  const hasPendingToolEdits = hasPendingCrop || hasPendingResize;
  const canFooterApply = hasAppliedChanges || hasPendingToolEdits;

  const discardPendingEdits = useCallback(() => {
    setActiveTool('view');
    setCropRect(null);
    if (sourceWidth > 0) {
      setResizeWidth(sourceWidth);
      setResizeHeight(sourceHeight);
    }
  }, [sourceHeight, sourceWidth]);

  const applyPendingToolEdits = useCallback(async (): Promise<string> => {
    if (activeTool === 'crop' && cropRect) {
      return applyCrop(cropRect);
    }
    if (activeTool === 'resize') {
      if (resizeWidth !== sourceWidth || resizeHeight !== sourceHeight) {
        return applyResize(resizeWidth, resizeHeight);
      }
      discardPendingEdits();
      return currentDataUrl;
    }
    return currentDataUrl;
  }, [
    activeTool,
    applyCrop,
    applyResize,
    cropRect,
    currentDataUrl,
    discardPendingEdits,
    resizeHeight,
    resizeWidth,
    sourceHeight,
    sourceWidth,
  ]);

  const historyItems = useMemo(
    () => entries.map((entry, entryIndex) => ({ ...entry, entryIndex })),
    [entries],
  );

  return {
    activeTool,
    setActiveTool,
    cropRect,
    setCropRect,
    resizeWidth,
    setResizeWidth,
    resizeHeight,
    setResizeHeight,
    lockAspectRatio,
    setLockAspectRatio,
    currentDataUrl,
    historyItems,
    index,
    canUndo,
    hasAppliedChanges,
    hasPendingCrop,
    hasPendingResize,
    hasPendingToolEdits,
    canFooterApply,
    discardPendingEdits,
    applyPendingToolEdits,
    jumpToHistory,
    resetFromDataUrl,
    applyCrop,
    applyResize,
    applyRotate,
    applyFlip,
    initResizeFromImage,
    pushFromDataUrl,
    strokeColor,
    setStrokeColor,
    strokeWidth,
    setStrokeWidth,
    strokeLineStyle,
    setStrokeLineStyle,
    textFontSize,
    setTextFontSize,
    applyDrawLine,
    applyDrawRectangle,
    applyDrawEllipse,
    applyDrawText,
  };
}
