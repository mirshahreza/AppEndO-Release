import { useEffect, useMemo } from 'react';
import { useEditor } from '@tiptap/react';
import { Markdown } from 'tiptap-markdown';
import {
  DESIGNER_RICH_TEXT_DEFAULT_FONT_SIZE,
  DESIGNER_RICH_TEXT_DEFAULT_HEIGHT,
  resolveDesignerRichTextToolbarConfig,
  type DesignerRichTextToolbarConfig,
  type DesignerRichTextToolbarProps,
} from '../lib/designerRichTextConfig';
import { buildDesignerRichTextExtensions } from './designerRichTextExtensions';

type MarkdownEditorStorage = {
  markdown: {
    getMarkdown: () => string;
  };
};

const readMarkdown = (editor: NonNullable<ReturnType<typeof useEditor>>): string => {
  const storage = editor.storage as MarkdownEditorStorage;
  return storage.markdown?.getMarkdown?.() ?? '';
};

export type UseMarkdownWysiwygEditorOptions = DesignerRichTextToolbarProps & {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  editorHeight?: number | string;
  fontSize?: number;
  readOnly?: boolean;
  isReadOnly?: boolean;
  isDisabled?: boolean;
  onChange?: (value: string) => void;
};

export type UseMarkdownWysiwygEditorResult = {
  editor: ReturnType<typeof useEditor>;
  toolbar: DesignerRichTextToolbarConfig;
  resolvedReadOnly: boolean;
  resolvedHeight: string;
  fillHeight: boolean;
  fontSize: number;
};

export const useMarkdownWysiwygEditor = ({
  value,
  defaultValue,
  placeholder = 'Write in Markdown…',
  editorHeight = DESIGNER_RICH_TEXT_DEFAULT_HEIGHT,
  fontSize = DESIGNER_RICH_TEXT_DEFAULT_FONT_SIZE,
  readOnly,
  isReadOnly,
  isDisabled = false,
  showToolbar,
  enableBold,
  enableItalic,
  enableUnderline,
  enableStrike,
  enableInlineCode,
  enableSubscript,
  enableSuperscript,
  enableTextColor,
  enableHighlight,
  enableHeading,
  enableBulletList,
  enableOrderedList,
  enableTaskList,
  enableBlockquote,
  enableCodeBlock,
  enableHorizontalRule,
  enableTextAlign,
  enableTextDirection,
  enableIndent,
  enableLink,
  enableImage,
  enableTable,
  enableClearFormatting,
  enableUndoRedo,
  onChange,
}: UseMarkdownWysiwygEditorOptions): UseMarkdownWysiwygEditorResult => {
  const resolvedReadOnly = readOnly === true || isReadOnly === true || isDisabled;
  const toolbar = useMemo(
    () => resolveDesignerRichTextToolbarConfig({
      showToolbar,
      enableBold,
      enableItalic,
      enableUnderline,
      enableStrike,
      enableInlineCode,
      enableSubscript,
      enableSuperscript,
      enableTextColor,
      enableHighlight,
      enableHeading,
      enableBulletList,
      enableOrderedList,
      enableTaskList,
      enableBlockquote,
      enableCodeBlock,
      enableHorizontalRule,
      enableTextAlign,
      enableTextDirection,
      enableIndent,
      enableLink,
      enableImage,
      enableTable,
      enableClearFormatting,
      enableUndoRedo,
    }),
    [
      showToolbar,
      enableBold,
      enableItalic,
      enableUnderline,
      enableStrike,
      enableInlineCode,
      enableSubscript,
      enableSuperscript,
      enableTextColor,
      enableHighlight,
      enableHeading,
      enableBulletList,
      enableOrderedList,
      enableTaskList,
      enableBlockquote,
      enableCodeBlock,
      enableHorizontalRule,
      enableTextAlign,
      enableTextDirection,
      enableIndent,
      enableLink,
      enableImage,
      enableTable,
      enableClearFormatting,
      enableUndoRedo,
    ],
  );

  const initialContent = useMemo(
    () => (value ?? defaultValue ?? '').trim(),
    [value, defaultValue],
  );

  const extensions = useMemo(
    () => [
      // Block `dir` inherits editor chrome so empty RTL cultures start typing from the right.
      ...buildDesignerRichTextExtensions(toolbar, placeholder, resolvedReadOnly, { autoDir: false }),
      Markdown.configure({
        // Required so `<!-- @dir:rtl|ltr -->` markers survive parse (see DesignerTextDirection).
        html: true,
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    [toolbar, placeholder, resolvedReadOnly],
  );

  const resolvedHeight = typeof editorHeight === 'number'
    ? `${editorHeight}px`
    : (typeof editorHeight === 'string' && editorHeight.trim().length > 0
      ? editorHeight
      : `${DESIGNER_RICH_TEXT_DEFAULT_HEIGHT}px`);
  const fillHeight = resolvedHeight === '100%';

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initialContent,
    editable: !resolvedReadOnly,
    onUpdate: ({ editor: activeEditor }) => {
      onChange?.(readMarkdown(activeEditor).trim());
    },
  }, [extensions, resolvedReadOnly]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setEditable(!resolvedReadOnly);
  }, [editor, resolvedReadOnly]);

  useEffect(() => {
    if (!editor || value === undefined) {
      return;
    }
    const next = value.trim();
    const current = readMarkdown(editor).trim();
    if (next !== current) {
      editor.commands.setContent(next, { emitUpdate: false });
    }
  }, [editor, value]);

  return {
    editor,
    toolbar,
    resolvedReadOnly,
    resolvedHeight,
    fillHeight,
    fontSize,
  };
};
