import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Check,
  Circle,
  Crop,
  FlipHorizontal2,
  FlipVertical2,
  Maximize2,
  Minimize2,
  Minus,
  RotateCw,
  Square,
  Type,
  Upload,
  X,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  clampCropRect,
  loadImageElement,
  scaleCropRect,
  type CropRect,
} from '../../lib/imageEditor';
import {
  clampPointToNatural,
  displayPointToNatural,
  isPointInsideDisplayImage,
  normalizeDragRect,
  svgStrokeDasharray,
  type ImageEditorLineStyle,
  type ImageEditorPoint,
} from '../../lib/imageEditorAnnotations';
import {
  ImageEditorStrokeStylePicker,
  ImageEditorStrokeWidthPicker,
} from './ImageEditorStrokePickers';
import { UiInput } from '../ai-field-assist/AiAssistInput';
import { AppButton } from '../AppButton';
import { UiCheckboxChoice } from '../FormChoiceFields';
import { UiColorPicker } from '../UiColorPicker';
import {
  ICON_ACTION_BUTTON_MD_CLASS,
  ICON_ACTION_CONFIRM_CLASS,
} from '../surfaceClasses';
import { isImageEditorDrawTool, type ImageEditorTool } from './useImageEditorState';

type DisplayMetrics = {
  naturalWidth: number;
  naturalHeight: number;
  displayWidth: number;
  displayHeight: number;
  offsetX: number;
  offsetY: number;
  scale: number;
};

const computeDisplayMetrics = (
  naturalWidth: number,
  naturalHeight: number,
  containerWidth: number,
  containerHeight: number,
): DisplayMetrics => {
  const scale = Math.min(
    containerWidth / naturalWidth,
    containerHeight / naturalHeight,
    1,
  );
  const displayWidth = naturalWidth * scale;
  const displayHeight = naturalHeight * scale;
  const offsetX = (containerWidth - displayWidth) / 2;
  const offsetY = (containerHeight - displayHeight) / 2;
  return {
    naturalWidth,
    naturalHeight,
    displayWidth,
    displayHeight,
    offsetX,
    offsetY,
    scale,
  };
};

const displayRectToNatural = (rect: CropRect, metrics: DisplayMetrics): CropRect => {
  const scale = 1 / metrics.scale;
  return clampCropRect(
    scaleCropRect({
      x: rect.x - metrics.offsetX,
      y: rect.y - metrics.offsetY,
      width: rect.width,
      height: rect.height,
    }, scale),
    metrics.naturalWidth,
    metrics.naturalHeight,
  );
};

const naturalRectToDisplay = (rect: CropRect, metrics: DisplayMetrics): CropRect => ({
  x: metrics.offsetX + rect.x * metrics.scale,
  y: metrics.offsetY + rect.y * metrics.scale,
  width: rect.width * metrics.scale,
  height: rect.height * metrics.scale,
});

const createInitialCropRect = (naturalWidth: number, naturalHeight: number): CropRect => {
  const width = Math.round(naturalWidth * 0.7);
  const height = Math.round(naturalHeight * 0.7);
  return {
    x: Math.round((naturalWidth - width) / 2),
    y: Math.round((naturalHeight - height) / 2),
    width,
    height,
  };
};

type CropDragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';
type ResizeDragMode = 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'e' | 'w';

const computeResizeDisplayRect = (
  metrics: DisplayMetrics,
  resizeWidth: number,
  resizeHeight: number,
): CropRect => {
  const width = resizeWidth * (metrics.displayWidth / metrics.naturalWidth);
  const height = resizeHeight * (metrics.displayHeight / metrics.naturalHeight);
  return {
    x: metrics.offsetX + (metrics.displayWidth - width) / 2,
    y: metrics.offsetY + (metrics.displayHeight - height) / 2,
    width,
    height,
  };
};

const displayRectToResizeDimensions = (
  rect: CropRect,
  metrics: DisplayMetrics,
): { width: number; height: number } => ({
  width: Math.max(1, Math.round(rect.width * metrics.naturalWidth / metrics.displayWidth)),
  height: Math.max(1, Math.round(rect.height * metrics.naturalHeight / metrics.displayHeight)),
});

type ImageEditorCanvasProps = {
  dataUrl: string;
  activeTool: ImageEditorTool;
  cropRect: CropRect | null;
  onCropRectChange: (rect: CropRect | null) => void;
  onApplyCrop: (rect: CropRect) => void;
  onCancelCrop: () => void;
  resizeWidth: number;
  resizeHeight: number;
  lockAspectRatio: boolean;
  onResizeWidthChange: (value: string) => void;
  onResizeHeightChange: (value: string) => void;
  onLockAspectRatioChange: (locked: boolean) => void;
  onResizeDimensionsChange: (width: number, height: number) => void;
  onApplyResize: () => void;
  onCancelResize: () => void;
  expanded: boolean;
  strokeColor: string;
  strokeWidth: number;
  strokeLineStyle: ImageEditorLineStyle;
  textFontSize: number;
  onStrokeColorChange: (value: string) => void;
  onStrokeWidthChange: (width: number) => void;
  onStrokeLineStyleChange: (lineStyle: ImageEditorLineStyle) => void;
  onTextFontSizeChange: (value: string) => void;
  onDrawLine: (from: ImageEditorPoint, to: ImageEditorPoint) => void;
  onDrawRectangle: (rect: CropRect) => void;
  onDrawEllipse: (rect: CropRect) => void;
  onDrawText: (point: ImageEditorPoint, text: string) => void;
};

export const ImageEditorCanvas: React.FC<ImageEditorCanvasProps> = ({
  dataUrl,
  activeTool,
  cropRect,
  onCropRectChange,
  onApplyCrop,
  onCancelCrop,
  resizeWidth,
  resizeHeight,
  lockAspectRatio,
  onResizeWidthChange,
  onResizeHeightChange,
  onLockAspectRatioChange,
  onResizeDimensionsChange,
  onApplyResize,
  onCancelResize,
  expanded,
  strokeColor,
  strokeWidth,
  strokeLineStyle,
  textFontSize,
  onStrokeColorChange,
  onStrokeWidthChange,
  onStrokeLineStyleChange,
  onTextFontSizeChange,
  onDrawLine,
  onDrawRectangle,
  onDrawEllipse,
  onDrawText,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [metrics, setMetrics] = useState<DisplayMetrics | null>(null);
  const drawDragRef = useRef<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [drawPreview, setDrawPreview] = useState<{
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [textDraft, setTextDraft] = useState<{
    displayX: number;
    displayY: number;
    natural: ImageEditorPoint;
    value: string;
  } | null>(null);
  const cropDragRef = useRef<{
    mode: CropDragMode;
    startX: number;
    startY: number;
    origin: CropRect;
  } | null>(null);
  const resizeDragRef = useRef<{
    mode: ResizeDragMode;
    startX: number;
    startY: number;
    origin: CropRect;
  } | null>(null);

  const recomputeMetrics = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    const image = await loadImageElement(dataUrl);
    const next = computeDisplayMetrics(
      image.naturalWidth,
      image.naturalHeight,
      container.clientWidth,
      container.clientHeight,
    );
    setMetrics(next);
    if (activeTool === 'crop' && !cropRect) {
      onCropRectChange(createInitialCropRect(image.naturalWidth, image.naturalHeight));
    }
  }, [activeTool, cropRect, dataUrl, onCropRectChange]);

  useEffect(() => {
    void recomputeMetrics();
  }, [dataUrl, expanded, recomputeMetrics]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return undefined;
    const observer = new ResizeObserver(() => {
      void recomputeMetrics();
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [recomputeMetrics]);

  useEffect(() => {
    if (!isImageEditorDrawTool(activeTool)) {
      setTextDraft(null);
      setDrawPreview(null);
      drawDragRef.current = null;
    }
  }, [activeTool]);

  const pointerToLocal = (event: React.PointerEvent) => {
    const container = containerRef.current;
    if (!container) return null;
    const bounds = container.getBoundingClientRect();
    return {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
  };

  const localToNatural = (x: number, y: number) => {
    if (!metrics) return null;
    return clampPointToNatural(
      displayPointToNatural(x, y, metrics),
      metrics.naturalWidth,
      metrics.naturalHeight,
    );
  };

  const handleContainerPointerDown = (event: React.PointerEvent) => {
    if (event.target instanceof Element && event.target.closest('[data-image-editor-chrome]')) {
      return;
    }
    if (!metrics || !isImageEditorDrawTool(activeTool)) return;
    const local = pointerToLocal(event);
    if (!local || !isPointInsideDisplayImage(local.x, local.y, metrics)) return;
    event.preventDefault();

    if (activeTool === 'text') {
      const natural = localToNatural(local.x, local.y);
      if (!natural) return;
      setTextDraft({
        displayX: local.x,
        displayY: local.y,
        natural,
        value: '',
      });
      return;
    }

    drawDragRef.current = {
      startX: local.x,
      startY: local.y,
      currentX: local.x,
      currentY: local.y,
    };
    setDrawPreview({ ...drawDragRef.current });
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleCommitTextDraft = () => {
    if (!textDraft) return;
    const value = textDraft.value.trim();
    if (value) onDrawText(textDraft.natural, value);
    setTextDraft(null);
  };

  const displayCropRect = metrics && cropRect ? naturalRectToDisplay(cropRect, metrics) : null;
  const displayResizeRect = metrics && resizeWidth > 0 && resizeHeight > 0
    ? computeResizeDisplayRect(metrics, resizeWidth, resizeHeight)
    : null;

  const handleCropPointerDown = (event: React.PointerEvent, mode: CropDragMode) => {
    if (activeTool !== 'crop' || !displayCropRect) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    cropDragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: displayCropRect,
    };
  };

  const handleResizePointerDown = (event: React.PointerEvent, mode: ResizeDragMode) => {
    if (activeTool !== 'resize' || !displayResizeRect) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    resizeDragRef.current = {
      mode,
      startX: event.clientX,
      startY: event.clientY,
      origin: displayResizeRect,
    };
  };

  const computeResizeRectFromDrag = (
    origin: CropRect,
    mode: ResizeDragMode,
    dx: number,
    dy: number,
  ): CropRect => {
    const minSize = 24;
    const aspect = origin.width / origin.height;
    let { x, y, width, height } = origin;

    if (mode === 'se') {
      width = origin.width + dx;
      height = lockAspectRatio ? width / aspect : origin.height + dy;
    } else if (mode === 'sw') {
      width = origin.width - dx;
      height = lockAspectRatio ? width / aspect : origin.height + dy;
      x = origin.x + origin.width - width;
    } else if (mode === 'ne') {
      width = origin.width + dx;
      height = lockAspectRatio ? width / aspect : origin.height - dy;
      y = origin.y + origin.height - height;
    } else if (mode === 'nw') {
      width = origin.width - dx;
      height = lockAspectRatio ? width / aspect : origin.height - dy;
      x = origin.x + origin.width - width;
      y = origin.y + origin.height - height;
    } else if (mode === 'e') {
      width = origin.width + dx;
      if (lockAspectRatio) {
        height = width / aspect;
        y = origin.y + (origin.height - height) / 2;
      }
    } else if (mode === 'w') {
      width = origin.width - dx;
      if (lockAspectRatio) {
        height = width / aspect;
        y = origin.y + (origin.height - height) / 2;
      }
      x = origin.x + origin.width - width;
    } else if (mode === 's') {
      height = origin.height + dy;
      if (lockAspectRatio) {
        width = height * aspect;
        x = origin.x + (origin.width - width) / 2;
      }
    } else {
      height = origin.height - dy;
      if (lockAspectRatio) {
        width = height * aspect;
        x = origin.x + (origin.width - width) / 2;
      }
      y = origin.y + origin.height - height;
    }

    width = Math.max(minSize, width);
    height = Math.max(minSize, height);

    if (lockAspectRatio) {
      if (mode === 'e' || mode === 'w' || mode === 'nw' || mode === 'sw' || mode === 'ne' || mode === 'se') {
        height = width / aspect;
      } else {
        width = height * aspect;
      }

      if (mode.includes('w')) {
        x = origin.x + origin.width - width;
      }
      if (mode.includes('n')) {
        y = origin.y + origin.height - height;
      }
      if (mode === 'e' || mode === 'w') {
        y = origin.y + (origin.height - height) / 2;
      }
      if (mode === 'n' || mode === 's') {
        x = origin.x + (origin.width - width) / 2;
      }
    }

    return { x, y, width, height };
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    const drawDrag = drawDragRef.current;
    if (drawDrag) {
      const local = pointerToLocal(event);
      if (!local) return;
      drawDrag.currentX = local.x;
      drawDrag.currentY = local.y;
      setDrawPreview({
        startX: drawDrag.startX,
        startY: drawDrag.startY,
        currentX: drawDrag.currentX,
        currentY: drawDrag.currentY,
      });
      return;
    }

    const cropDrag = cropDragRef.current;
    if (cropDrag && metrics) {
      const dx = event.clientX - cropDrag.startX;
      const dy = event.clientY - cropDrag.startY;
      const minSize = 24;
      let next = { ...cropDrag.origin };

      if (cropDrag.mode === 'move') {
        next.x = cropDrag.origin.x + dx;
        next.y = cropDrag.origin.y + dy;
      } else if (cropDrag.mode === 'nw') {
        next.x = cropDrag.origin.x + dx;
        next.y = cropDrag.origin.y + dy;
        next.width = cropDrag.origin.width - dx;
        next.height = cropDrag.origin.height - dy;
      } else if (cropDrag.mode === 'ne') {
        next.y = cropDrag.origin.y + dy;
        next.width = cropDrag.origin.width + dx;
        next.height = cropDrag.origin.height - dy;
      } else if (cropDrag.mode === 'sw') {
        next.x = cropDrag.origin.x + dx;
        next.width = cropDrag.origin.width - dx;
        next.height = cropDrag.origin.height + dy;
      } else {
        next.width = cropDrag.origin.width + dx;
        next.height = cropDrag.origin.height + dy;
      }

      next.width = Math.max(minSize, next.width);
      next.height = Math.max(minSize, next.height);
      next.x = Math.max(metrics.offsetX, Math.min(next.x, metrics.offsetX + metrics.displayWidth - next.width));
      next.y = Math.max(metrics.offsetY, Math.min(next.y, metrics.offsetY + metrics.displayHeight - next.height));

      onCropRectChange(displayRectToNatural(next, metrics));
      return;
    }

    const resizeDrag = resizeDragRef.current;
    if (resizeDrag && metrics) {
      const dx = event.clientX - resizeDrag.startX;
      const dy = event.clientY - resizeDrag.startY;
      const next = computeResizeRectFromDrag(resizeDrag.origin, resizeDrag.mode, dx, dy);
      const dims = displayRectToResizeDimensions(next, metrics);
      onResizeDimensionsChange(dims.width, dims.height);
    }
  };

  const handlePointerUp = (event: React.PointerEvent) => {
    const drawDrag = drawDragRef.current;
    if (drawDrag && metrics) {
      drawDragRef.current = null;
      setDrawPreview(null);
      event.currentTarget.releasePointerCapture(event.pointerId);

      const startNatural = localToNatural(drawDrag.startX, drawDrag.startY);
      const endNatural = localToNatural(drawDrag.currentX, drawDrag.currentY);
      if (startNatural && endNatural) {
        if (activeTool === 'line') {
          const distance = Math.hypot(endNatural.x - startNatural.x, endNatural.y - startNatural.y);
          if (distance >= 2) onDrawLine(startNatural, endNatural);
        } else if (activeTool === 'rectangle') {
          const box = normalizeDragRect(startNatural, endNatural);
          if (box.width >= 2 && box.height >= 2) onDrawRectangle(box);
        } else if (activeTool === 'ellipse') {
          const box = normalizeDragRect(startNatural, endNatural);
          if (box.width >= 2 && box.height >= 2) onDrawEllipse(box);
        }
      }
    }

    if (cropDragRef.current) {
      cropDragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (resizeDragRef.current) {
      resizeDragRef.current = null;
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleApplyCrop = () => {
    if (!cropRect) return;
    onApplyCrop(cropRect);
  };

  const cropActionBarStyle = displayCropRect
    ? (() => {
        const barHeight = 36;
        const gap = 8;
        const belowTop = displayCropRect.y + displayCropRect.height + gap;
        const containerBottom = metrics ? metrics.offsetY + metrics.displayHeight : Number.POSITIVE_INFINITY;
        const placeAbove = belowTop + barHeight > containerBottom;
        return {
          left: displayCropRect.x + displayCropRect.width / 2,
          top: placeAbove
            ? displayCropRect.y - gap - barHeight
            : belowTop,
          transform: 'translateX(-50%)',
        } as const;
      })()
    : undefined;

  const previewImageStyle = activeTool === 'resize' && displayResizeRect
    ? {
        left: displayResizeRect.x,
        top: displayResizeRect.y,
        width: displayResizeRect.width,
        height: displayResizeRect.height,
      }
    : metrics
      ? {
          left: metrics.offsetX,
          top: metrics.offsetY,
          width: metrics.displayWidth,
          height: metrics.displayHeight,
        }
      : undefined;

  const resizeHandles: Array<{ mode: ResizeDragMode; className: string }> = displayResizeRect
    ? [
        { mode: 'nw', className: '-left-1.5 -top-1.5 cursor-nw-resize' },
        { mode: 'ne', className: '-right-1.5 -top-1.5 cursor-ne-resize' },
        { mode: 'sw', className: '-bottom-1.5 -left-1.5 cursor-sw-resize' },
        { mode: 'se', className: '-bottom-1.5 -right-1.5 cursor-se-resize' },
        { mode: 'n', className: '-top-1.5 left-1/2 -translate-x-1/2 cursor-n-resize' },
        { mode: 's', className: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-s-resize' },
        { mode: 'w', className: '-left-1.5 top-1/2 -translate-y-1/2 cursor-w-resize' },
        { mode: 'e', className: '-right-1.5 top-1/2 -translate-y-1/2 cursor-e-resize' },
      ]
    : [];

  const drawPreviewBox = drawPreview
    ? {
        x: Math.min(drawPreview.startX, drawPreview.currentX),
        y: Math.min(drawPreview.startY, drawPreview.currentY),
        width: Math.abs(drawPreview.currentX - drawPreview.startX),
        height: Math.abs(drawPreview.currentY - drawPreview.startY),
      }
    : null;

  const showDrawOptions = isImageEditorDrawTool(activeTool);
  const showStrokeOptions = showDrawOptions && activeTool !== 'text';
  const previewStrokeDasharray = svgStrokeDasharray(strokeLineStyle, strokeWidth);

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative flex-1 min-h-0 bg-slate-100 overflow-hidden',
        showDrawOptions && 'cursor-crosshair',
      )}
      onPointerDown={handleContainerPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      {metrics && previewImageStyle ? (
        <img
          src={dataUrl}
          alt="Editor canvas"
          draggable={false}
          className="absolute select-none pointer-events-none"
          style={previewImageStyle}
        />
      ) : null}

      {drawPreview && showDrawOptions && activeTool !== 'text' ? (
        <svg
          className="pointer-events-none absolute inset-0 z-[5] h-full w-full"
          aria-hidden
        >
          {activeTool === 'line' ? (
            <line
              x1={drawPreview.startX}
              y1={drawPreview.startY}
              x2={drawPreview.currentX}
              y2={drawPreview.currentY}
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={previewStrokeDasharray}
            />
          ) : null}
          {activeTool === 'rectangle' && drawPreviewBox ? (
            <rect
              x={drawPreviewBox.x}
              y={drawPreviewBox.y}
              width={drawPreviewBox.width}
              height={drawPreviewBox.height}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={previewStrokeDasharray}
            />
          ) : null}
          {activeTool === 'ellipse' && drawPreviewBox ? (
            <ellipse
              cx={drawPreviewBox.x + drawPreviewBox.width / 2}
              cy={drawPreviewBox.y + drawPreviewBox.height / 2}
              rx={drawPreviewBox.width / 2}
              ry={drawPreviewBox.height / 2}
              fill="none"
              stroke={strokeColor}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={previewStrokeDasharray}
            />
          ) : null}
        </svg>
      ) : null}

      {showDrawOptions ? (
        <div
          data-image-editor-chrome
          className="pointer-events-auto absolute top-3 left-1/2 z-10 flex -translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 shadow-md backdrop-blur-sm"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {showStrokeOptions ? (
            <>
              <ImageEditorStrokeWidthPicker
                value={strokeWidth}
                color={strokeColor}
                onChange={onStrokeWidthChange}
              />
              <ImageEditorStrokeStylePicker
                value={strokeLineStyle}
                strokeWidth={strokeWidth}
                color={strokeColor}
                onChange={onStrokeLineStyleChange}
              />
            </>
          ) : null}
          <UiColorPicker
            variant="swatch"
            size="sm"
            value={strokeColor}
            onChange={onStrokeColorChange}
            ariaLabel="Stroke color"
            showInput={false}
            showPresets
          />
          {activeTool === 'text' ? (
            <UiInput
              aiAssist={false}
              size="sm"
              type="number"
              min={8}
              max={120}
              value={textFontSize}
              ariaLabel="Text size"
              className="w-16"
              onChange={(event) => onTextFontSizeChange(event.target.value)}
            />
          ) : null}
        </div>
      ) : null}

      {textDraft ? (
        <div
          className="pointer-events-auto absolute z-20 flex max-w-[min(20rem,calc(100%-1rem))] items-center gap-2 rounded-lg border border-slate-200 bg-white/95 p-2 shadow-md backdrop-blur-sm"
          style={{ left: textDraft.displayX, top: textDraft.displayY }}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <UiInput
            key={`${textDraft.displayX}-${textDraft.displayY}`}
            aiAssist={false}
            size="sm"
            autoFocus
            value={textDraft.value}
            ariaLabel="Text to add"
            placeholder="Type here"
            onChange={(event) => setTextDraft((prev) => (
              prev ? { ...prev, value: event.target.value } : prev
            ))}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                handleCommitTextDraft();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setTextDraft(null);
              }
            }}
          />
          <AppButton intent="secondary" size="sm" onClick={handleCommitTextDraft}>
            Add
          </AppButton>
          <AppButton intent="cancel" size="sm" onClick={() => setTextDraft(null)}>
            <X className="h-3.5 w-3.5" />
          </AppButton>
        </div>
      ) : null}

      {activeTool === 'resize' && metrics ? (
        <>
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute border border-dashed border-slate-400/70"
              style={{
                left: metrics.offsetX,
                top: metrics.offsetY,
                width: metrics.displayWidth,
                height: metrics.displayHeight,
              }}
            />
          </div>

          {displayResizeRect ? (
            <div
              className="absolute border-2 border-indigo-500"
              style={{
                left: displayResizeRect.x,
                top: displayResizeRect.y,
                width: displayResizeRect.width,
                height: displayResizeRect.height,
              }}
            >
              {resizeHandles.map(({ mode, className }) => (
                <button
                  key={mode}
                  type="button"
                  aria-label={`Resize ${mode}`}
                  className={cn(
                    'absolute h-3 w-3 rounded-full border border-white bg-indigo-500',
                    className,
                  )}
                  onPointerDown={(event) => {
                    event.stopPropagation();
                    handleResizePointerDown(event, mode);
                  }}
                />
              ))}
            </div>
          ) : null}

          <div className="pointer-events-auto absolute top-3 left-1/2 z-10 flex -translate-x-1/2 items-end gap-3 rounded-lg border border-slate-200 bg-white/95 px-4 py-3 shadow-md backdrop-blur-sm">
            <div className="flex w-20 shrink-0 flex-col gap-[2px]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ps-[4px]">Width</label>
              <UiInput
                size="sm"
                type="number"
                value={resizeWidth}
                ariaLabel="Resize width"
                onChange={(event) => onResizeWidthChange(event.target.value)}
              />
            </div>
            <div className="flex w-20 shrink-0 flex-col gap-[2px]">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 ps-[4px]">Height</label>
              <UiInput
                size="sm"
                type="number"
                value={resizeHeight}
                ariaLabel="Resize height"
                onChange={(event) => onResizeHeightChange(event.target.value)}
              />
            </div>
            <div className="shrink-0 pb-1">
              <UiCheckboxChoice
                id="image-editor-lock-ratio"
                checked={lockAspectRatio}
                onChange={onLockAspectRatioChange}
              >
                Lock ratio
              </UiCheckboxChoice>
            </div>
            <AppButton intent="cancel" onClick={onCancelResize}>
              Cancel
            </AppButton>
            <AppButton intent="secondary" onClick={onApplyResize}>
              Apply
            </AppButton>
          </div>

          <button
            type="button"
            title="Apply"
            aria-label="Apply"
            className={cn(ICON_ACTION_BUTTON_MD_CLASS, ICON_ACTION_CONFIRM_CLASS, 'absolute bottom-4 right-4 z-10 bg-white shadow-sm')}
            onClick={onApplyResize}
          >
            <Check className="h-4 w-4" />
          </button>
        </>
      ) : null}

      {activeTool === 'crop' && displayCropRect ? (
        <>
          <div className="absolute inset-0 pointer-events-none">
            <div
              className="absolute bg-slate-900/35"
              style={{ left: 0, top: 0, right: 0, height: displayCropRect.y }}
            />
            <div
              className="absolute bg-slate-900/35"
              style={{
                left: 0,
                top: displayCropRect.y,
                width: displayCropRect.x,
                height: displayCropRect.height,
              }}
            />
            <div
              className="absolute bg-slate-900/35"
              style={{
                left: displayCropRect.x + displayCropRect.width,
                top: displayCropRect.y,
                right: 0,
                height: displayCropRect.height,
              }}
            />
            <div
              className="absolute bg-slate-900/35"
              style={{
                left: 0,
                top: displayCropRect.y + displayCropRect.height,
                right: 0,
                bottom: 0,
              }}
            />
          </div>

          <div
            className="absolute border-2 border-indigo-500 cursor-move"
            style={{
              left: displayCropRect.x,
              top: displayCropRect.y,
              width: displayCropRect.width,
              height: displayCropRect.height,
            }}
            onPointerDown={(event) => handleCropPointerDown(event, 'move')}
          >
            {(['nw', 'ne', 'sw', 'se'] as const).map((corner) => (
              <button
                key={corner}
                type="button"
                aria-label={`Resize ${corner}`}
                className="absolute h-3 w-3 rounded-full border border-white bg-indigo-500"
                style={{
                  left: corner.includes('w') ? -6 : undefined,
                  right: corner.includes('e') ? -6 : undefined,
                  top: corner.includes('n') ? -6 : undefined,
                  bottom: corner.includes('s') ? -6 : undefined,
                  cursor: `${corner}-resize`,
                }}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  handleCropPointerDown(event, corner);
                }}
              />
            ))}
          </div>

          {cropActionBarStyle ? (
            <div
              className="pointer-events-auto absolute z-10 flex items-center gap-2 rounded-lg border border-slate-200 bg-white/95 px-2 py-1.5 shadow-md backdrop-blur-sm"
              style={cropActionBarStyle}
            >
              <AppButton intent="cancel" size="sm" onClick={onCancelCrop}>
                <X className="h-3.5 w-3.5" />
                Cancel
              </AppButton>
              <AppButton intent="secondary" size="sm" onClick={handleApplyCrop}>
                <Check className="h-3.5 w-3.5" />
                Apply crop
              </AppButton>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
};

type ImageEditorToolsRailProps = {
  activeTool: ImageEditorTool;
  onSelectTool: (tool: ImageEditorTool) => void;
  onUpload: () => void;
  onRotate: () => void;
  onFlipHorizontal: () => void;
  onFlipVertical: () => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  previewSrc: string;
};

export const ImageEditorToolsRail: React.FC<ImageEditorToolsRailProps> = ({
  activeTool,
  onSelectTool,
  onUpload,
  onRotate,
  onFlipHorizontal,
  onFlipVertical,
  expanded,
  onToggleExpanded,
  previewSrc,
}) => {
  const toolButtonClass = (tool: ImageEditorTool) => cn(
    ICON_ACTION_BUTTON_MD_CLASS,
    activeTool === tool
      ? 'bg-indigo-50 text-indigo-600'
      : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600',
  );

  return (
    <aside className="flex w-16 shrink-0 flex-col items-center gap-2 overflow-y-auto border-r border-slate-200 bg-white py-3">
      <div className="h-12 w-12 overflow-hidden rounded-md border border-slate-200">
        <img src={previewSrc} alt="Source thumbnail" className="h-full w-full object-cover" />
      </div>

      <button type="button" title="Upload" aria-label="Upload image" className={cn(ICON_ACTION_BUTTON_MD_CLASS, 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600')} onClick={onUpload}>
        <Upload className="h-4 w-4" />
      </button>
      <button type="button" title="Crop" aria-label="Crop" className={toolButtonClass('crop')} onClick={() => onSelectTool('crop')}>
        <Crop className="h-4 w-4" />
      </button>
      <button type="button" title="Resize" aria-label="Resize" className={toolButtonClass('resize')} onClick={() => onSelectTool('resize')}>
        <Maximize2 className="h-4 w-4" />
      </button>
      <button type="button" title="Line" aria-label="Draw line" className={toolButtonClass('line')} onClick={() => onSelectTool('line')}>
        <Minus className="h-4 w-4 rotate-45" />
      </button>
      <button type="button" title="Rectangle" aria-label="Draw rectangle" className={toolButtonClass('rectangle')} onClick={() => onSelectTool('rectangle')}>
        <Square className="h-4 w-4" />
      </button>
      <button type="button" title="Circle" aria-label="Draw circle" className={toolButtonClass('ellipse')} onClick={() => onSelectTool('ellipse')}>
        <Circle className="h-4 w-4" />
      </button>
      <button type="button" title="Text" aria-label="Add text" className={toolButtonClass('text')} onClick={() => onSelectTool('text')}>
        <Type className="h-4 w-4" />
      </button>
      <button type="button" title="Rotate 90°" aria-label="Rotate 90 degrees" className={cn(ICON_ACTION_BUTTON_MD_CLASS, 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600')} onClick={onRotate}>
        <RotateCw className="h-4 w-4" />
      </button>
      <button type="button" title="Flip horizontal" aria-label="Flip horizontal" className={cn(ICON_ACTION_BUTTON_MD_CLASS, 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600')} onClick={onFlipHorizontal}>
        <FlipHorizontal2 className="h-4 w-4" />
      </button>
      <button type="button" title="Flip vertical" aria-label="Flip vertical" className={cn(ICON_ACTION_BUTTON_MD_CLASS, 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600')} onClick={onFlipVertical}>
        <FlipVertical2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        title={expanded ? 'Restore panels' : 'Expand canvas'}
        aria-label={expanded ? 'Restore panels' : 'Expand canvas'}
        className={cn(ICON_ACTION_BUTTON_MD_CLASS, 'text-slate-500 hover:bg-cyan-50 hover:text-cyan-600')}
        onClick={onToggleExpanded}
      >
        {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
    </aside>
  );
};

type ImageEditorHistoryRailProps = {
  items: Array<{ id: string; dataUrl: string; label: string; entryIndex: number }>;
  activeIndex: number;
  onSelect: (index: number) => void;
};

export const ImageEditorHistoryRail: React.FC<ImageEditorHistoryRailProps> = ({
  items,
  activeIndex,
  onSelect,
}) => (
  <aside aria-label="Edit history" className="flex w-24 shrink-0 flex-col gap-2 overflow-y-auto border-r border-slate-200 bg-white p-2">
    {items.map((item) => (
      <button
        key={item.id}
        type="button"
        title={item.label}
        aria-label={item.label}
        onClick={() => onSelect(item.entryIndex)}
        className={cn(
          'overflow-hidden rounded-md border transition-colors',
          item.entryIndex === activeIndex
            ? 'border-indigo-500 ring-2 ring-indigo-200'
            : 'border-slate-200 hover:border-indigo-300',
        )}
      >
        <img src={item.dataUrl} alt={item.label} className="aspect-square w-full object-cover" />
      </button>
    ))}
  </aside>
);
