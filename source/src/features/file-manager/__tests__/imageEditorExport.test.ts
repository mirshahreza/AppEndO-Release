import { describe, expect, it } from 'vitest';
import { resolveFileManagerImageExportFormat } from '../imageEditorExport';

describe('file-manager imageEditorExport', () => {
  it('maps known extensions and mime types', () => {
    expect(resolveFileManagerImageExportFormat('.png', null)).toBe('image/png');
    expect(resolveFileManagerImageExportFormat('.jpg', null)).toBe('image/jpeg');
    expect(resolveFileManagerImageExportFormat('.webp', null)).toBe('image/webp');
    expect(resolveFileManagerImageExportFormat('.gif', 'image/gif')).toBe('image/png');
    expect(resolveFileManagerImageExportFormat(null, 'image/jpeg')).toBe('image/jpeg');
  });
});
