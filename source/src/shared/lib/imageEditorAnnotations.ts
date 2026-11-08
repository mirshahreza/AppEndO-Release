import type { CropRect } from './imageEditor';

export type ImageEditorPoint = {
  x: number;
  y: number;
};

export type ImageEditorLineStyle = 'solid' | 'dashed' | 'dotted';

export type ImageEditorStrokeStyle = {
  color: string;
  lineWidth: number;
  lineStyle: ImageEditorLineStyle;
};

export const IMAGE_EDITOR_STROKE_WIDTH_PRESETS = [2, 3, 4, 6, 8, 12, 16, 24] as const;

export const canvasLineDashForStyle = (
  lineStyle: ImageEditorLineStyle,
  lineWidth: number,
): number[] => {
  if (lineStyle === 'dashed') return [lineWidth * 4, lineWidth * 2.5];
  if (lineStyle === 'dotted') return [lineWidth, lineWidth];
  return [];
};

export const svgStrokeDasharray = (
  lineStyle: ImageEditorLineStyle,
  lineWidth: number,
): string | undefined => {
  const segments = canvasLineDashForStyle(lineStyle, lineWidth);
  if (segments.length === 0) return undefined;
  return segments.join(' ');
};

export type DisplayMetrics = {
  naturalWidth: number;
  naturalHeight: number;
  displayWidth: number;
  displayHeight: number;
  offsetX: number;
  offsetY: number;
  scale: number;
};

export const displayPointToNatural = (
  x: number,
  y: number,
  metrics: DisplayMetrics,
): ImageEditorPoint => ({
  x: (x - metrics.offsetX) / metrics.scale,
  y: (y - metrics.offsetY) / metrics.scale,
});

export const clampPointToNatural = (
  point: ImageEditorPoint,
  width: number,
  height: number,
): ImageEditorPoint => ({
  x: Math.max(0, Math.min(point.x, width)),
  y: Math.max(0, Math.min(point.y, height)),
});

export const normalizeDragRect = (start: ImageEditorPoint, end: ImageEditorPoint): CropRect => {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);
  return { x, y, width, height };
};

const configureStroke = (ctx: CanvasRenderingContext2D, style: ImageEditorStrokeStyle) => {
  ctx.strokeStyle = style.color;
  ctx.lineWidth = style.lineWidth;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(canvasLineDashForStyle(style.lineStyle, style.lineWidth));
};

export const strokeLineOnContext = (
  ctx: CanvasRenderingContext2D,
  from: ImageEditorPoint,
  to: ImageEditorPoint,
  style: ImageEditorStrokeStyle,
) => {
  configureStroke(ctx, style);
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
};

export const strokeRectOnContext = (
  ctx: CanvasRenderingContext2D,
  rect: CropRect,
  style: ImageEditorStrokeStyle,
) => {
  if (rect.width < 1 || rect.height < 1) return;
  configureStroke(ctx, style);
  ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);
};

export const strokeEllipseOnContext = (
  ctx: CanvasRenderingContext2D,
  rect: CropRect,
  style: ImageEditorStrokeStyle,
) => {
  if (rect.width < 1 || rect.height < 1) return;
  configureStroke(ctx, style);
  const cx = rect.x + rect.width / 2;
  const cy = rect.y + rect.height / 2;
  const rx = rect.width / 2;
  const ry = rect.height / 2;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
};

export const drawTextOnContext = (
  ctx: CanvasRenderingContext2D,
  point: ImageEditorPoint,
  text: string,
  options: { color: string; fontSize: number },
) => {
  const trimmed = text.trim();
  if (!trimmed) return;
  ctx.fillStyle = options.color;
  ctx.font = `${Math.max(8, options.fontSize)}px ui-sans-serif, system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(trimmed, point.x, point.y);
};

export const isPointInsideDisplayImage = (
  x: number,
  y: number,
  metrics: DisplayMetrics,
): boolean => (
  x >= metrics.offsetX
  && x <= metrics.offsetX + metrics.displayWidth
  && y >= metrics.offsetY
  && y <= metrics.offsetY + metrics.displayHeight
);
