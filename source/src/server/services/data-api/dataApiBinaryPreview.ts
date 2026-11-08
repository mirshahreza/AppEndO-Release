import sharp from 'sharp';
import { getFileExtension } from '../../../shared/lib/fileFieldUtils';
import type { EdgeApiBinaryPreviewConfig } from '../../../shared/api/contracts/data-api';

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  avif: 'image/avif',
  bmp: 'image/bmp',
};

const isImageMime = (mime: unknown): mime is string =>
  typeof mime === 'string' && mime.toLowerCase().startsWith('image/');

const inferImageMime = (
  mimeField: unknown,
  fileNameField: unknown,
): string | null => {
  if (isImageMime(mimeField)) {
    return mimeField.toLowerCase();
  }
  if (typeof fileNameField !== 'string' || !fileNameField.trim()) {
    return null;
  }
  const ext = getFileExtension(fileNameField);
  return MIME_BY_EXTENSION[ext] ?? null;
};

const toBuffer = (value: unknown): Buffer | null => {
  if (Buffer.isBuffer(value)) {
    return value.length ? value : null;
  }
  if (value instanceof Uint8Array) {
    return value.length ? Buffer.from(value) : null;
  }
  if (value && typeof value === 'object' && 'type' in value) {
    const record = value as { type?: unknown; data?: unknown };
    if (record.type === 'Buffer' && Array.isArray(record.data)) {
      const buffer = Buffer.from(record.data as number[]);
      return buffer.length ? buffer : null;
    }
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('data:')) {
      const encoded = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : '';
      if (!encoded) return null;
      try {
        const buffer = Buffer.from(encoded, 'base64');
        return buffer.length ? buffer : null;
      } catch {
        return null;
      }
    }
    const encoded = trimmed.includes(',') ? (trimmed.split(',').pop() ?? '') : trimmed;
    try {
      const buffer = Buffer.from(encoded, 'base64');
      return buffer.length ? buffer : null;
    } catch {
      return null;
    }
  }
  return null;
};

/** Stored xs thumbnails are always JPEG from the upload / create pipeline. */
const XS_THUMB_MIME = 'image/jpeg';

const buildPreviewUrl = async (
  row: Record<string, unknown>,
  config: EdgeApiBinaryPreviewConfig,
): Promise<string | null> => {
  const mime = inferImageMime(row[config.mimeField], row.fileName);
  if (!mime) {
    return null;
  }

  const xsField = config.xsField?.trim();
  const xs = xsField ? toBuffer(row[xsField]) : null;
  if (xs) {
    return `data:${XS_THUMB_MIME};base64,${xs.toString('base64')}`;
  }

  const fullField = config.fullField?.trim();
  if (!fullField) {
    return null;
  }
  const full = toBuffer(row[fullField]);
  if (!full) {
    return null;
  }

  try {
    const thumb = await sharp(full, { failOn: 'error' })
      .resize({ height: 100, withoutEnlargement: true })
      .jpeg({ quality: 72 })
      .toBuffer();
    return `data:${XS_THUMB_MIME};base64,${thumb.toString('base64')}`;
  } catch {
    return null;
  }
};

export const extendAttributesForBinaryPreview = (
  attributes: string[] | { include: unknown[]; exclude?: string[] } | undefined,
  config: EdgeApiBinaryPreviewConfig,
  readableAttributes: string[] | undefined,
): string[] | { include: unknown[]; exclude?: string[] } | undefined => {
  const extraFields = [config.xsField, config.fullField]
    .filter((field): field is string => Boolean(field?.trim()))
    .filter((field) => !readableAttributes?.includes(field));

  if (extraFields.length === 0) {
    return attributes;
  }

  if (!attributes || Array.isArray(attributes)) {
    const base = attributes ?? readableAttributes ?? [];
    return [...base, ...extraFields.filter((field) => !base.includes(field))];
  }

  return attributes;
};

export const applyBinaryPreviewToRows = async (
  rows: Record<string, unknown>[],
  config: EdgeApiBinaryPreviewConfig,
): Promise<Record<string, unknown>[]> => {
  const stripFields = new Set(
  (config.stripFields ?? [config.xsField, config.fullField].filter(Boolean)) as string[],
  );

  return Promise.all(rows.map(async (row) => {
    const filePreviewUrl = await buildPreviewUrl(row, config);
    const next = { ...row, [config.outputField]: filePreviewUrl };
    for (const field of stripFields) {
      delete next[field];
    }
    return next;
  }));
};
