/** @vitest-environment jsdom */
import { Editor } from '@tiptap/core';
import Document from '@tiptap/extension-document';
import Paragraph from '@tiptap/extension-paragraph';
import Text from '@tiptap/extension-text';
import { describe, expect, it } from 'vitest';
import { DesignerLucideIcon } from '../designerRichTextLucideIcon';

describe('DesignerLucideIcon', () => {
  it('round-trips lucide icon markup in TipTap HTML', () => {
    const editor = new Editor({
      extensions: [Document, Paragraph, Text, DesignerLucideIcon],
      content: '<i data-lucide="User"></i>',
    });

    expect(editor.getHTML()).toContain('data-lucide="User"');
    editor.destroy();
  });
});
