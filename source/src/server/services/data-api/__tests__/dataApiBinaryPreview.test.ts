import { describe, expect, it } from 'vitest';
import { applyBinaryPreviewToRows } from '../dataApiBinaryPreview';

const JPEG_BASE64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCwAB//2Q==';
const PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

describe('dataApiBinaryPreview', () => {
  it('derives filePreviewUrl from fileXs and strips binary columns', async () => {
    const rows = await applyBinaryPreviewToRows([
      {
        id: 'asset-1',
        fileName: 'pixel.png',
        fileMime: 'image/png',
        fileXs: Buffer.from(JPEG_BASE64, 'base64'),
      },
    ], {
      mimeField: 'fileMime',
      xsField: 'fileXs',
      fullField: 'file',
      outputField: 'filePreviewUrl',
      stripFields: ['file', 'fileXs'],
    });

    expect(rows[0].fileXs).toBeUndefined();
    expect(rows[0].file).toBeUndefined();
    expect(typeof rows[0].filePreviewUrl).toBe('string');
    expect(String(rows[0].filePreviewUrl)).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('falls back to a JPEG thumb from full file when fileXs is missing', async () => {
    const rows = await applyBinaryPreviewToRows([
      {
        id: 'asset-2',
        fileName: 'pixel.png',
        fileMime: 'image/png',
        file: Buffer.from(PNG_BASE64, 'base64'),
      },
    ], {
      mimeField: 'fileMime',
      xsField: 'fileXs',
      fullField: 'file',
      outputField: 'filePreviewUrl',
      stripFields: ['file', 'fileXs'],
    });

    expect(rows[0].file).toBeUndefined();
    expect(typeof rows[0].filePreviewUrl).toBe('string');
    expect(String(rows[0].filePreviewUrl)).toMatch(/^data:image\/jpeg;base64,/);
  });

  it('infers image mime from file name when fileMime is missing', async () => {
    const rows = await applyBinaryPreviewToRows([
      {
        id: 'asset-3',
        fileName: 'pixel.png',
        fileXs: Buffer.from(JPEG_BASE64, 'base64'),
      },
    ], {
      mimeField: 'fileMime',
      xsField: 'fileXs',
      fullField: 'file',
      outputField: 'filePreviewUrl',
      stripFields: ['file', 'fileXs'],
    });

    expect(typeof rows[0].filePreviewUrl).toBe('string');
    expect(String(rows[0].filePreviewUrl)).toMatch(/^data:image\/jpeg;base64,/);
  });
});
