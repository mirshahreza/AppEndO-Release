export type FileIconKind =
  | 'image'
  | 'pdf'
  | 'archive'
  | 'audio'
  | 'video'
  | 'spreadsheet'
  | 'document'
  | 'code'
  | 'generic';

export type ImageResizeOptions = {
  maxWidth: number;
  maxHeight: number;
  /** 0–100, default 80 */
  quality?: number;
};

export const getFileExtension = (fileName: string): string => {
  const trimmed = fileName.trim();
  const dotIndex = trimmed.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === trimmed.length - 1) return '';
  return trimmed.slice(dotIndex + 1).toLowerCase();
};

export const isImageMimeType = (mimeType?: string | null): boolean => {
  if (!mimeType) return false;
  return mimeType.startsWith('image/');
};

export const isImageFile = (file: File): boolean => isImageMimeType(file.type);

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif']);

export const isImageUrl = (value?: string | null): boolean => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) {
    return false;
  }

  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return true;
  }

  const path = trimmed.split(/[?#]/, 1)[0] ?? trimmed;
  if (/\/member-files\/[^/]+\/content\/?$/i.test(path)) {
    return true;
  }
  return IMAGE_EXTENSIONS.has(getFileExtension(path));
};

export const resolveFileIconKind = (fileName: string, mimeType?: string | null): FileIconKind => {
  if (isImageMimeType(mimeType)) return 'image';

  const ext = getFileExtension(fileName);
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'avif'].includes(ext)) return 'image';
  if (ext === 'pdf') return 'pdf';
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
  if (['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'].includes(ext)) return 'audio';
  if (['mp4', 'mov', 'avi', 'mkv', 'webm'].includes(ext)) return 'video';
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'spreadsheet';
  if (['doc', 'docx', 'txt', 'rtf', 'odt'].includes(ext)) return 'document';
  if (['js', 'ts', 'tsx', 'jsx', 'json', 'xml', 'html', 'css', 'md'].includes(ext)) return 'code';
  return 'generic';
};

export const buildDataUrlFromBase64 = (base64: string, mimeType = 'application/octet-stream'): string => {
  if (base64.startsWith('data:')) return base64;
  return `data:${mimeType};base64,${base64}`;
};

export const loadImageFile = (file: File): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image file.'));
    };
    image.src = url;
  });
};

export const imageToJpegBase64 = (image: HTMLImageElement, maxDimension: number, quality: number): string => {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to prepare image canvas.');
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  const dataUrl = canvas.toDataURL('image/jpeg', quality);
  return dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
};

const canvasToJpegFile = (canvas: HTMLCanvasElement, fileName: string, quality: number): Promise<File> => {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to encode resized image.'));
          return;
        }
        const baseName = fileName.replace(/\.[^.]+$/, '') || 'image';
        resolve(new File([blob], `${baseName}.jpg`, { type: 'image/jpeg', lastModified: Date.now() }));
      },
      'image/jpeg',
      quality,
    );
  });
};

export const resizeImageFile = async (file: File, options: ImageResizeOptions): Promise<File> => {
  const qualityPercent = options.quality ?? 80;
  const quality = Math.min(1, Math.max(0.01, qualityPercent / 100));
  const image = await loadImageFile(file);

  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(1, options.maxWidth / width, options.maxHeight / height);
  const targetWidth = Math.max(1, Math.round(width * scale));
  const targetHeight = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Failed to prepare image canvas.');
  ctx.drawImage(image, 0, 0, targetWidth, targetHeight);

  return canvasToJpegFile(canvas, file.name, quality);
};

export const fileMatchesAccept = (file: File, accept?: string): boolean => {
  if (!accept?.trim()) return true;

  const tokens = accept
    .split(',')
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) return true;

  const fileName = file.name.toLowerCase();
  const fileType = file.type.toLowerCase();
  const fileExt = getFileExtension(fileName);

  return tokens.some((token) => {
    if (token.startsWith('.')) {
      return fileExt === token.slice(1);
    }
    if (token.endsWith('/*')) {
      const prefix = token.slice(0, -1);
      return fileType.startsWith(prefix);
    }
    return fileType === token;
  });
};

export const readFileAsDataUrl = (file: File): Promise<string> => (
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Failed to read file.'));
    };
    reader.onerror = () => {
      reject(reader.error ?? new Error('Failed to read file.'));
    };
    reader.readAsDataURL(file);
  })
);
