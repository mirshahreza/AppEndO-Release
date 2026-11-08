/** @vitest-environment jsdom */
import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { resolveDesignerRichTextToolbarConfig } from '../../lib/designerRichTextConfig';
import { buildDesignerRichTextExtensions } from '../designerRichTextExtensions';

describe('DesignerLucideIcon with full rich-text extensions', () => {
  it('parses lucide icon from setContent HTML', () => {
    const toolbar = resolveDesignerRichTextToolbarConfig({ showToolbar: true, enableBold: true });
    const extensions = buildDesignerRichTextExtensions(toolbar, 'placeholder', false);
    const editor = new Editor({
      extensions,
      content: '',
    });

    for (const sample of [
      '<i data-lucide="User"></i>',
      '<p><i data-lucide="User"></i></p>',
    ]) {
      editor.commands.setContent(sample, { emitUpdate: false });
      const html = editor.getHTML();
      expect(html, `sample: ${sample}`).toContain('data-lucide="User"');
      expect(html, `sample: ${sample}`).not.toBe('<p></p>');
    }
    editor.destroy();
  });
});
