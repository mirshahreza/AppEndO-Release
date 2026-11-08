export type ImageEditorExportFormat = 'image/jpeg' | 'image/png' | 'image/webp';

export type CropRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export const clampCropRect = (rect: CropRect, maxWidth: number, maxHeight: number): CropRect => {
  const width = Math.max(1, Math.min(rect.width, maxWidth));
  const height = Math.max(1, Math.min(rect.height, maxHeight));
  const x = Math.max(0, Math.min(rect.x, maxWidth - width));
  const y = Math.max(0, Math.min(rect.y, maxHeight - height));
  return { x, y, width, height };
};

export const scaleCropRect = (rect: CropRect, scale: number): CropRect => ({
  x: Math.round(rect.x * scale),
  y: Math.round(rect.y * scale),
  width: Math.max(1, Math.round(rect.width * scale)),
  height: Math.max(1, Math.round(rect.height * scale)),
});

export const loadImageElement = (src: string): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Failed to load image.'));
    image.src = src;
  });
};

export const imageElementToCanvas = (image: HTMLImageElement): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth || image.width;
  canvas.height = image.naturalHeight || image.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to prepare image canvas.');
  ctx.drawImage(image, 0, 0);
  return canvas;
};

export const dataUrlToCanvas = async (dataUrl: string): Promise<HTMLCanvasElement> => {
  const image = await loadImageElement(dataUrl);
  return imageElementToCanvas(image);
};

export const canvasToDataUrl = (
  canvas: HTMLCanvasElement,
  mime: ImageEditorExportFormat = 'image/png',
  quality?: number,
): string => canvas.toDataURL(mime, quality);

const BASE64_DATA_URL_PATTERN = /^data:[^;]+;base64,/i;

export const isBase64DataUrl = (src: string): boolean => BASE64_DATA_URL_PATTERN.test(src.trim());

/** Converts any image source into a compact data URL for AI image APIs. */
export const ensureDataUrlForAiEdit = async (src: string): Promise<string> => {
  const trimmed = src.trim();
  if (/^data:image\/(jpeg|jpg|png|webp);base64,/i.test(trimmed)) return trimmed;

  const canvas = await dataUrlToCanvas(trimmed);
  return canvasToDataUrl(canvas, 'image/jpeg', 0.92);
};

/** Converts blob/http image sources into a base64 data URL for AI API payloads. */
export const ensureBase64DataUrl = async (src: string): Promise<string> => {
  const trimmed = src.trim();
  if (isBase64DataUrl(trimmed)) return trimmed;

  const canvas = await dataUrlToCanvas(trimmed);
  return canvasToDataUrl(canvas, 'image/jpeg', 0.92);
};

export const cropCanvas = (source: HTMLCanvasElement, rect: CropRect): HTMLCanvasElement => {
  const bounded = clampCropRect(rect, source.width, source.height);
  const canvas = document.createElement('canvas');
  canvas.width = bounded.width;
  canvas.height = bounded.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to prepare image canvas.');
  ctx.drawImage(
    source,
    bounded.x,
    bounded.y,
    bounded.width,
    bounded.height,
    0,
    0,
    bounded.width,
    bounded.height,
  );
  return canvas;
};

export const resizeCanvas = (
  source: HTMLCanvasElement,
  width: number,
  height: number,
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to prepare image canvas.');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  return canvas;
};

export const rotateCanvas = (source: HTMLCanvasElement, degrees: 90 | -90 | 180): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to prepare image canvas.');

  if (degrees === 180) {
    canvas.width = source.width;
    canvas.height = source.height;
    ctx.translate(canvas.width, canvas.height);
    ctx.rotate(Math.PI);
    ctx.drawImage(source, 0, 0);
    return canvas;
  }

  canvas.width = source.height;
  canvas.height = source.width;
  if (degrees === 90) {
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
  } else {
    ctx.translate(0, canvas.height);
    ctx.rotate(-Math.PI / 2);
  }
  ctx.drawImage(source, 0, 0);
  return canvas;
};

/** Rotates around center and expands canvas so corners are not clipped. */
export const rotateCanvasByDegrees = (source: HTMLCanvasElement, degrees: number): HTMLCanvasElement => {
  const radians = (degrees * Math.PI) / 180;
  const sin = Math.abs(Math.sin(radians));
  const cos = Math.abs(Math.cos(radians));
  const width = Math.ceil(source.width * cos + source.height * sin);
  const height = Math.ceil(source.width * sin + source.height * cos);

  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, width);
  canvas.height = Math.max(1, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to prepare image canvas.');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(radians);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
};

export const adjustCanvasTone = (
  source: HTMLCanvasElement,
  options: { brightness?: number; contrast?: number },
): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to prepare image canvas.');
  ctx.drawImage(source, 0, 0);

  const brightness = options.brightness ?? 0;
  const contrast = options.contrast ?? 0;
  if (brightness === 0 && contrast === 0) return canvas;

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data } = imageData;
  const contrastFactor = contrast === 0
    ? 1
    : (259 * (contrast + 255)) / (255 * (259 - contrast));

  for (let index = 0; index < data.length; index += 4) {
    for (let channel = 0; channel < 3; channel += 1) {
      let value = data[index + channel];
      if (contrast !== 0) value = contrastFactor * (value - 128) + 128;
      if (brightness !== 0) value += brightness * 2.55;
      data[index + channel] = Math.max(0, Math.min(255, Math.round(value)));
    }
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
};

export const flipCanvas = (source: HTMLCanvasElement, horizontal: boolean): HTMLCanvasElement => {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to prepare image canvas.');
  ctx.translate(horizontal ? canvas.width : 0, horizontal ? 0 : canvas.height);
  ctx.scale(horizontal ? -1 : 1, horizontal ? 1 : -1);
  ctx.drawImage(source, 0, 0);
  return canvas;
};

export const canvasToFile = (
  canvas: HTMLCanvasElement,
  fileName: string,
  mime: ImageEditorExportFormat,
  quality?: number,
): Promise<File> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode image.'));
          return;
        }
        const extension = mime === 'image/png'
          ? 'png'
          : mime === 'image/webp'
            ? 'webp'
            : 'jpg';
        const baseName = fileName.replace(/\.[^.]+$/, '') || 'image';
        resolve(new File([blob], `${baseName}.${extension}`, { type: mime, lastModified: Date.now() }));
      },
      mime,
      quality,
    );
  });
};

export const resolveExportQuality = (mime: ImageEditorExportFormat, qualityPercent = 82): number | undefined => {
  if (mime === 'image/png') return undefined;
  return Math.min(1, Math.max(0.01, qualityPercent / 100));
};

export const extensionForMime = (mime: ImageEditorExportFormat): string => {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
};
