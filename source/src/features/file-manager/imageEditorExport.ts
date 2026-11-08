import type { ImageEditorExportFormat } from '../../shared/lib/imageEditor';

const EXTENSION_TO_EXPORT_FORMAT: Record<string, ImageEditorExportFormat> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

export const resolveFileManagerImageExportFormat = (
  extension: string | null | undefined,
  mimeType: string | null | undefined,
): ImageEditorExportFormat => {
  if (extension && EXTENSION_TO_EXPORT_FORMAT[extension.toLowerCase()]) {
    return EXTENSION_TO_EXPORT_FORMAT[extension.toLowerCase()];
  }

  if (mimeType === 'image/png' || mimeType === 'image/jpeg' || mimeType === 'image/webp') {
    return mimeType;
  }

  return 'image/png';
};
