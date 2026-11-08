import { describe, expect, it } from 'vitest';
import { formatComponentLayoutPatchPreview } from '../componentLayoutPatchPreview';

describe('formatComponentLayoutPatchPreview', () => {
  it('summarizes layout patch structure', () => {
    const preview = formatComponentLayoutPatchPreview({
      name: 'Users CRUD',
      folder: 'admin',
      baseLayoutId: 'users-template',
      document: {
        nodes: {
          root: { type: 'container' },
          field1: { type: 'UiInput' },
          field2: { type: 'UiInput' },
        },
      },
      bindingDefinitions: {
        users: { sourceType: 'apiRef' },
      },
    });

    expect(preview).toContain('Name: Users CRUD');
    expect(preview).toContain('Folder: admin');
    expect(preview).toContain('Based on: users-template');
    expect(preview).toContain('Nodes: 3');
    expect(preview).toContain('Node types:');
    expect(preview).toContain('Bindings: 1');
  });

  it('handles invalid payloads', () => {
    expect(formatComponentLayoutPatchPreview(null)).toContain('Invalid');
  });
});
