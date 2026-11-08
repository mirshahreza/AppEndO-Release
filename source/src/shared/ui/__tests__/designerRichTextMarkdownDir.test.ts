/** @vitest-environment jsdom */
import { Editor } from '@tiptap/core';
import { Markdown } from 'tiptap-markdown';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveDesignerRichTextToolbarConfig } from '../../lib/designerRichTextConfig';
import { buildDesignerRichTextExtensions } from '../designerRichTextExtensions';
import {
  applyMarkdownDirCommentsToDom,
  markdownDirComment,
  resolveMarkdownEditorTextDirection,
  unwrapMarkdownDirComments,
} from '../designerRichTextMarkdownDir';

const toolbar = resolveDesignerRichTextToolbarConfig({
  enableTextDirection: true,
  enableHeading: true,
  enableBlockquote: true,
  enableBold: true,
  enableBulletList: true,
});

const createEditor = (content = '', autoDir = false) => new Editor({
  content,
  extensions: [
    ...buildDesignerRichTextExtensions(toolbar, 'Write…', false, { autoDir }),
    Markdown.configure({
      html: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
  ],
});

describe('designerRichTextMarkdownDir', () => {
  let editor: Editor | null = null;

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  it('unwrapMarkdownDirComments strips markers and returns first dir', () => {
    const raw = `${markdownDirComment('rtl')}\nHello **world**\n\n${markdownDirComment('ltr')}\nSecond`;
    expect(unwrapMarkdownDirComments(raw)).toEqual({
      content: 'Hello **world**\n\nSecond',
      dir: 'rtl',
    });
  });

  it('applyMarkdownDirCommentsToDom sets dir on the following element', () => {
    const root = document.createElement('div');
    root.innerHTML = '<!-- @dir:rtl --><p>سلام</p>';
    applyMarkdownDirCommentsToDom(root);
    expect(root.querySelector('p')?.getAttribute('dir')).toBe('rtl');
    expect(root.innerHTML).toBe('<p dir="rtl">سلام</p>');
  });

  it('persists paragraph direction across markdown save/reload', () => {
    editor = createEditor('Hello **world**');
    editor.chain().selectAll().setTextDirection('rtl').run();

    const markdown = (editor.storage as { markdown: { getMarkdown: () => string } })
      .markdown
      .getMarkdown();
    expect(markdown).toContain(markdownDirComment('rtl'));
    expect(markdown).toContain('Hello **world**');

    editor.commands.setContent(markdown);
    expect(editor.state.doc.firstChild?.attrs.dir).toBe('rtl');
    expect(editor.getJSON()).toMatchObject({
      content: [{
        type: 'paragraph',
        attrs: { dir: 'rtl' },
      }],
    });
  });

  it('keeps plain markdown when direction is unset', () => {
    editor = createEditor('Just text');
    const markdown = (editor.storage as { markdown: { getMarkdown: () => string } })
      .markdown
      .getMarkdown();
    expect(markdown).toBe('Just text');
    expect(markdown).not.toContain('@dir:');
  });

  it('resolves editor chrome dir from the first meaningful character', () => {
    expect(resolveMarkdownEditorTextDirection('auto', 'سلام دنیا')).toBe('rtl');
    expect(resolveMarkdownEditorTextDirection('auto', 'Hello world')).toBe('ltr');
    expect(resolveMarkdownEditorTextDirection('auto', '')).toBe('ltr');
    expect(resolveMarkdownEditorTextDirection('auto', '', { cultureDirection: 'rtl' })).toBe('rtl');
    expect(resolveMarkdownEditorTextDirection('auto', '', { placeholder: 'اكتب رسالتك…' })).toBe('rtl');
    expect(resolveMarkdownEditorTextDirection('auto', `${markdownDirComment('ltr')}\nسلام`)).toBe('rtl');
    expect(resolveMarkdownEditorTextDirection('ltr', 'سلام')).toBe('ltr');
    expect(resolveMarkdownEditorTextDirection('rtl', 'Hello')).toBe('rtl');
  });

  it('inherits chrome direction on blocks without leaking dir into markdown', () => {
    editor = createEditor('سلام', false);
    expect(editor.getHTML()).not.toContain('dir="auto"');
    const markdown = (editor.storage as { markdown: { getMarkdown: () => string } })
      .markdown
      .getMarkdown();
    expect(markdown).toContain('سلام');
    expect(markdown).not.toContain('@dir:');
    expect(markdown).not.toContain('dir="auto"');
  });
});
