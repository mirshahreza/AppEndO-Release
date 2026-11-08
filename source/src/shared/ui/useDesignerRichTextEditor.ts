import { useEffect, useMemo, useRef } from 'react';
import { useEditor } from '@tiptap/react';
import { sanitizeDesignerHtml } from '../../domain/component-designer/sanitizeDesignerHtml';
import {
  DESIGNER_RICH_TEXT_DEFAULT_FONT_SIZE,
  DESIGNER_RICH_TEXT_DEFAULT_HEIGHT,
  resolveDesignerRichTextToolbarConfig,
  type DesignerRichTextToolbarConfig,
  type DesignerRichTextToolbarProps,
} from '../lib/designerRichTextConfig';
import { shouldPreserveExternalHtmlOnVisualUpdate } from '../lib/richTextVisualSync';
import { buildDesignerRichTextExtensions } from './designerRichTextExtensions';

export type UseDesignerRichTextEditorOptions = DesignerRichTextToolbarProps & {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  editorHeight?: number | string;
  fontSize?: number;
  readOnly?: boolean;
  isReadOnly?: boolean;
  isDisabled?: boolean;
  onChange?: (value: string) => void;
  sanitizeHtml?: (html: string) => string;
  /** When false, external `value` is not pushed into TipTap (trusted snippet visual uses a separate pane). */
  syncExternalValue?: boolean;
};

export type UseDesignerRichTextEditorResult = {
  editor: ReturnType<typeof useEditor>;
  toolbar: DesignerRichTextToolbarConfig;
  resolvedReadOnly: boolean;
  resolvedHeight: string;
  fillHeight: boolean;
  fontSize: number;
};

export const useDesignerRichTextEditor = ({
  value,
  defaultValue,
  placeholder = 'Start writing…',
  editorHeight = DESIGNER_RICH_TEXT_DEFAULT_HEIGHT,
  fontSize = DESIGNER_RICH_TEXT_DEFAULT_FONT_SIZE,
  readOnly,
  isReadOnly,
  isDisabled = false,
  sanitizeHtml = sanitizeDesignerHtml,
  syncExternalValue = true,
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
}: UseDesignerRichTextEditorOptions): UseDesignerRichTextEditorResult => {
  const resolvedReadOnly = readOnly === true || isReadOnly === true || isDisabled;
  const externalValueRef = useRef(value ?? defaultValue ?? '');
  externalValueRef.current = value ?? defaultValue ?? '';
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
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
    () => sanitizeHtml(value ?? defaultValue ?? ''),
    [value, defaultValue, sanitizeHtml],
  );

  const extensions = useMemo(
    () => buildDesignerRichTextExtensions(toolbar, placeholder, resolvedReadOnly),
    [toolbar, placeholder, resolvedReadOnly],
  );

  const resolvedHeight = typeof editorHeight === 'number'
    ? `${editorHeight}px`
    : (typeof editorHeight === 'string' && editorHeight.trim().length > 0
      ? editorHeight
      : `${DESIGNER_RICH_TEXT_DEFAULT_HEIGHT}px`);
  const fillHeight = resolvedHeight === '100%';
  const lastSyncedExternalRef = useRef<string | undefined>(undefined);
  const suppressVisualOnChangeRef = useRef(true);

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: initialContent,
    editable: !resolvedReadOnly,
    onUpdate: ({ editor: activeEditor, transaction }) => {
      if (suppressVisualOnChangeRef.current) {
        return;
      }
      if (transaction && !transaction.docChanged) {
        return;
      }
      const nextVisual = sanitizeHtml(activeEditor.getHTML());
      if (shouldPreserveExternalHtmlOnVisualUpdate(externalValueRef.current, nextVisual)) {
        return;
      }
      onChangeRef.current?.(nextVisual);
    },
  }, [extensions, resolvedReadOnly, sanitizeHtml]);

  useEffect(() => {
    if (!editor) {
      return;
    }

    editor.setEditable(!resolvedReadOnly);
  }, [editor, resolvedReadOnly]);

  useEffect(() => {
    if (!syncExternalValue || !editor || value === undefined) {
      return;
    }

    if (lastSyncedExternalRef.current === value) {
      suppressVisualOnChangeRef.current = false;
      return;
    }

    suppressVisualOnChangeRef.current = true;
    const sanitized = sanitizeHtml(value);
    editor.commands.setContent(sanitized, { emitUpdate: false });
    lastSyncedExternalRef.current = value;
    suppressVisualOnChangeRef.current = false;
  }, [editor, value, sanitizeHtml, syncExternalValue]);

  useEffect(() => {
    lastSyncedExternalRef.current = undefined;
    suppressVisualOnChangeRef.current = true;
  }, [editor]);

  return {
    editor,
    toolbar,
    resolvedReadOnly,
    resolvedHeight,
    fillHeight,
    fontSize,
  };
};
