import { describe, expect, it } from 'vitest';
import {
  clampFileManagerPreviewZoom,
  fileManagerPreviewMonacoFontSize,
  fileManagerPreviewPlainTextFontSize,
} from '../previewZoom';

describe('file-manager previewZoom', () => {
  it('clamps zoom values', () => {
    expect(clampFileManagerPreviewZoom(40)).toBe(50);
    expect(clampFileManagerPreviewZoom(250)).toBe(200);
    expect(clampFileManagerPreviewZoom(120)).toBe(120);
  });

  it('scales monaco and plain text font sizes', () => {
    expect(fileManagerPreviewMonacoFontSize(100)).toBe(13);
    expect(fileManagerPreviewMonacoFontSize(150)).toBe(20);
    expect(fileManagerPreviewPlainTextFontSize(100)).toBe('14px');
    expect(fileManagerPreviewPlainTextFontSize(150)).toBe('21px');
  });
});
