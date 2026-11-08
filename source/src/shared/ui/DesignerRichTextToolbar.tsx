import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  ArrowLeftToLine,
  ArrowRightToLine,
  Baseline,
  Bold,
  Code,
  Code2,
  Eraser,
  Heading1,
  Heading2,
  Heading3,
  Highlighter,
  Image as ImageIcon,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListChecks,
  ListOrdered,
  Minus,
  Pilcrow,
  Quote,
  Redo2,
  Strikethrough,
  Subscript,
  Superscript,
  Table2,
  Underline as UnderlineIcon,
  Undo2,
  Unlink,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
  DESIGNER_RICH_TEXT_COLOR_PRESETS,
  hasAnyDesignerRichTextToolbarFeature,
  isDesignerRichTextToolbarFeatureEnabled,
  type DesignerRichTextToolbarConfig,
  type DesignerRichTextToolbarFeature,
} from '../lib/designerRichTextConfig';
import { normalizeHex } from '../theme/accentColorUtils';
import { AppButton } from './AppButton';

const DEFAULT_TEXT_COLOR_HEX = '#0F172A';

const toToolbarColorHex = (raw: string | undefined): string => {
  if (!raw) return DEFAULT_TEXT_COLOR_HEX;
  return normalizeHex(raw) ?? DEFAULT_TEXT_COLOR_HEX;
};

const TOOLBAR_BUTTON_CLASS = 'h-7 w-7 min-h-7 min-w-7 p-0';
const TOOLBAR_ACTIVE_CLASS = 'border-cyan-300 bg-cyan-50 text-cyan-700';

type ToolbarButtonProps = {
  title: string;
  isActive?: boolean;
  isDisabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

const ToolbarButton: React.FC<ToolbarButtonProps> = ({
  title,
  isActive = false,
  isDisabled = false,
  onClick,
  children,
}) => (
  <AppButton
    type="button"
    intent={isActive ? 'toggle-on' : 'toggle-off'}
    size="icon-sm"
    className={cn(TOOLBAR_BUTTON_CLASS, isActive ? TOOLBAR_ACTIVE_CLASS : undefined)}
    title={title}
    aria-label={title}
    disabled={isDisabled}
    onClick={onClick}
  >
    {children}
  </AppButton>
);

const ToolbarDivider: React.FC = () => (
  <span className="mx-0.5 h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />
);

type TextColorToolbarPickerProps = {
  editor: Editor;
};

const TextColorToolbarPicker: React.FC<TextColorToolbarPickerProps> = ({ editor }) => {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);
  const panelId = useId();
  const activeColor = toToolbarColorHex(editor.getAttributes('textStyle').color as string | undefined);
  const hasCustomColor = Boolean(editor.getAttributes('textStyle').color);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (rootRef.current?.contains(target)) return;
      // Native OS color dialog clicks land outside the panel; keep it open while picking.
      if (document.activeElement === colorInputRef.current) return;
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const applyColor = (color: string, options?: { keepEditorFocus?: boolean; close?: boolean }) => {
    const chain = options?.keepEditorFocus === false
      ? editor.chain().setColor(color)
      : editor.chain().focus().setColor(color);
    chain.run();
    if (options?.close) setOpen(false);
  };

  const clearColor = () => {
    editor.chain().focus().unsetColor().run();
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <AppButton
        type="button"
        intent={hasCustomColor || open ? 'toggle-on' : 'toggle-off'}
        size="icon-sm"
        className={cn(TOOLBAR_BUTTON_CLASS, (hasCustomColor || open) ? TOOLBAR_ACTIVE_CLASS : undefined)}
        title="Text color"
        aria-label="Text color"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="flex flex-col items-center gap-0.5">
          <Baseline className="size-3.5" />
          <span
            className="h-0.5 w-3.5 rounded-sm"
            style={{ backgroundColor: activeColor }}
            aria-hidden="true"
          />
        </span>
      </AppButton>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label="Text color picker"
          className="absolute start-0 top-full z-30 mt-1 w-48 rounded-md border border-slate-200 bg-white p-2 shadow-lg"
        >
          <label className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1.5">
            <span
              className="relative size-6 shrink-0 overflow-hidden rounded border border-slate-200"
              style={{ backgroundColor: activeColor }}
            >
              <input
                ref={colorInputRef}
                type="color"
                value={activeColor}
                onChange={(event) => applyColor(event.target.value.toUpperCase(), { keepEditorFocus: false })}
                onBlur={() => editor.commands.focus()}
                className="absolute inset-0 cursor-pointer opacity-0"
                aria-label="Pick custom text color"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">
                Custom
              </span>
              <span className="block truncate font-mono text-xs font-semibold text-slate-800">
                {activeColor}
              </span>
            </span>
          </label>

          <div className="mt-2 grid grid-cols-5 gap-1.5" role="listbox" aria-label="Preset text colors">
            {DESIGNER_RICH_TEXT_COLOR_PRESETS.map((color) => {
              const selected = activeColor === color.toUpperCase();
              return (
                <button
                  key={color}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  title={`Text color ${color}`}
                  aria-label={`Text color ${color}`}
                  className={cn(
                    'size-6 rounded border transition-transform hover:scale-105',
                    selected ? 'border-cyan-500 ring-1 ring-cyan-300' : 'border-slate-200',
                  )}
                  style={{ backgroundColor: color }}
                  onClick={() => applyColor(color, { close: true })}
                />
              );
            })}
          </div>

          <AppButton
            type="button"
            intent="cancel"
            size="sm"
            className="mt-2 w-full justify-start gap-1.5"
            onClick={clearColor}
          >
            <Eraser className="size-3.5" />
            Reset color
          </AppButton>
        </div>
      ) : null}
    </div>
  );
};

type InlineEditorPanelProps = {
  label: string;
  inputId: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  onApply: () => void;
  onCancel: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
};

const InlineEditorPanel: React.FC<InlineEditorPanelProps> = ({
  label,
  inputId,
  value,
  placeholder,
  onChange,
  onApply,
  onCancel,
  inputRef,
}) => (
  <div className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 bg-white px-2 py-2">
    <label className="ps-[4px] text-xs font-medium text-slate-600" htmlFor={inputId}>
      {label}
    </label>
    <input
      ref={inputRef}
      id={inputId}
      type="url"
      autoFocus
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          onApply();
        }
        if (event.key === 'Escape') {
          event.preventDefault();
          onCancel();
        }
      }}
      placeholder={placeholder}
      className="min-w-[12rem] flex-1 rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-800 outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-200"
    />
    <AppButton type="button" intent="primary" onClick={onApply}>
      Apply
    </AppButton>
    <AppButton type="button" intent="cancel" onClick={onCancel}>
      Cancel
    </AppButton>
  </div>
);

export type DesignerRichTextToolbarProps = {
  editor: Editor;
  toolbar: DesignerRichTextToolbarConfig;
  readOnly: boolean;
  /** `embedded` drops outer chrome when rendered inside a dialog band. */
  variant?: 'default' | 'embedded';
  /** `inline` keeps the button row on one line inside a parent chrome bar (e.g. HTML editor). */
  layout?: 'stacked' | 'inline';
  /** Rendered after the last toolbar control (e.g. HTML source toggle). */
  trailingSlot?: React.ReactNode;
  className?: string;
};

export const DesignerRichTextToolbar: React.FC<DesignerRichTextToolbarProps> = ({
  editor,
  toolbar,
  readOnly,
  variant = 'default',
  layout = 'stacked',
  trailingSlot,
  className,
}) => {
  const [activePanel, setActivePanel] = useState<'link' | 'image' | null>(null);
  const [linkDraft, setLinkDraft] = useState('');
  const [imageDraft, setImageDraft] = useState('');
  const linkInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const isFeatureEnabled = useCallback(
    (feature: DesignerRichTextToolbarFeature) => isDesignerRichTextToolbarFeatureEnabled(toolbar, feature),
    [toolbar],
  );

  const openLinkEditor = useCallback(() => {
    const previousUrl = editor.getAttributes('link').href as string | undefined;
    setLinkDraft(previousUrl ?? '');
    setActivePanel('link');
    window.requestAnimationFrame(() => linkInputRef.current?.focus());
  }, [editor]);

  const openImageEditor = useCallback(() => {
    setImageDraft('');
    setActivePanel('image');
    window.requestAnimationFrame(() => imageInputRef.current?.focus());
  }, []);

  const applyLink = useCallback(() => {
    const trimmed = linkDraft.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      setActivePanel(null);
      return;
    }

    const href = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
    editor.chain().focus().extendMarkRange('link').setLink({ href }).run();
    setActivePanel(null);
  }, [editor, linkDraft]);

  const applyImage = useCallback(() => {
    const trimmed = imageDraft.trim();
    if (!trimmed) {
      setActivePanel(null);
      return;
    }

    const src = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('/')
      ? trimmed
      : `https://${trimmed}`;
    editor.chain().focus().setImage({ src }).run();
    setActivePanel(null);
    setImageDraft('');
  }, [editor, imageDraft]);

  const removeLink = useCallback(() => {
    editor.chain().focus().extendMarkRange('link').unsetLink().run();
    setActivePanel(null);
    setLinkDraft('');
  }, [editor]);

  const clearFormatting = useCallback(() => {
    const chain = editor.chain().focus().clearNodes().unsetAllMarks();
    if (isFeatureEnabled('textDirection')) {
      chain.unsetTextDirection();
    }
    chain.run();
  }, [editor, isFeatureEnabled]);

  const hasToolbarFeatures = hasAnyDesignerRichTextToolbarFeature(toolbar);
  if ((!hasToolbarFeatures || readOnly) && !trailingSlot) {
    return null;
  }

  const inlineLayout = layout === 'inline';

  return (
    <div
      className={cn(
        inlineLayout
          ? 'flex min-w-0 flex-1 flex-col gap-2'
          : 'flex flex-col gap-2 px-2 py-2',
        variant === 'default' && 'border-b border-slate-200 bg-slate-50',
        inlineLayout && variant === 'default' && 'w-full px-2 py-1.5',
        !inlineLayout && variant === 'default' && 'px-2 py-2',
        variant === 'embedded' && 'bg-transparent',
        className,
      )}
    >
      <div className="flex flex-wrap items-center gap-1">
        {hasToolbarFeatures && !readOnly ? (
          <>
        {isFeatureEnabled('undoRedo') ? (
          <>
            <ToolbarButton
              title="Undo"
              isDisabled={!editor.can().chain().focus().undo().run()}
              onClick={() => editor.chain().focus().undo().run()}
            >
              <Undo2 className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Redo"
              isDisabled={!editor.can().chain().focus().redo().run()}
              onClick={() => editor.chain().focus().redo().run()}
            >
              <Redo2 className="size-3.5" />
            </ToolbarButton>
            <ToolbarDivider />
          </>
        ) : null}

        {isFeatureEnabled('bold') ? (
          <ToolbarButton
            title="Bold"
            isActive={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('italic') ? (
          <ToolbarButton
            title="Italic"
            isActive={editor.isActive('italic')}
            onClick={() => editor.chain().focus().toggleItalic().run()}
          >
            <Italic className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('underline') ? (
          <ToolbarButton
            title="Underline"
            isActive={editor.isActive('underline')}
            onClick={() => editor.chain().focus().toggleUnderline().run()}
          >
            <UnderlineIcon className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('strike') ? (
          <ToolbarButton
            title="Strikethrough"
            isActive={editor.isActive('strike')}
            onClick={() => editor.chain().focus().toggleStrike().run()}
          >
            <Strikethrough className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('inlineCode') ? (
          <ToolbarButton
            title="Inline code"
            isActive={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code2 className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('subscript') ? (
          <ToolbarButton
            title="Subscript"
            isActive={editor.isActive('subscript')}
            onClick={() => editor.chain().focus().toggleSubscript().run()}
          >
            <Subscript className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('superscript') ? (
          <ToolbarButton
            title="Superscript"
            isActive={editor.isActive('superscript')}
            onClick={() => editor.chain().focus().toggleSuperscript().run()}
          >
            <Superscript className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('highlight') ? (
          <ToolbarButton
            title="Highlight"
            isActive={editor.isActive('highlight')}
            onClick={() => editor.chain().focus().toggleHighlight().run()}
          >
            <Highlighter className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('textColor') ? (
          <>
            <ToolbarDivider />
            <TextColorToolbarPicker editor={editor} />
          </>
        ) : null}

        {isFeatureEnabled('heading') ? (
          <>
            <ToolbarDivider />
            <ToolbarButton
              title="Paragraph"
              isActive={editor.isActive('paragraph')}
              onClick={() => editor.chain().focus().setParagraph().run()}
            >
              <Pilcrow className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Heading 1"
              isActive={editor.isActive('heading', { level: 1 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
            >
              <Heading1 className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Heading 2"
              isActive={editor.isActive('heading', { level: 2 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              <Heading2 className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Heading 3"
              isActive={editor.isActive('heading', { level: 3 })}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              <Heading3 className="size-3.5" />
            </ToolbarButton>
          </>
        ) : null}

        {(isFeatureEnabled('bulletList')
          || isFeatureEnabled('orderedList')
          || isFeatureEnabled('taskList')
          || isFeatureEnabled('blockquote')
          || isFeatureEnabled('codeBlock')
          || isFeatureEnabled('horizontalRule')
          || isFeatureEnabled('indent')) ? (
          <ToolbarDivider />
        ) : null}

        {isFeatureEnabled('bulletList') ? (
          <ToolbarButton
            title="Bullet list"
            isActive={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('orderedList') ? (
          <ToolbarButton
            title="Numbered list"
            isActive={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('taskList') ? (
          <ToolbarButton
            title="Task list"
            isActive={editor.isActive('taskList')}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            <ListChecks className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('indent') ? (
          <>
            <ToolbarButton
              title="Indent"
              isDisabled={!editor.can().sinkListItem('listItem')}
              onClick={() => editor.chain().focus().sinkListItem('listItem').run()}
            >
              <IndentIncrease className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Outdent"
              isDisabled={!editor.can().liftListItem('listItem')}
              onClick={() => editor.chain().focus().liftListItem('listItem').run()}
            >
              <IndentDecrease className="size-3.5" />
            </ToolbarButton>
          </>
        ) : null}

        {isFeatureEnabled('blockquote') ? (
          <ToolbarButton
            title="Blockquote"
            isActive={editor.isActive('blockquote')}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
          >
            <Quote className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('codeBlock') ? (
          <ToolbarButton
            title="Code block"
            isActive={editor.isActive('codeBlock')}
            onClick={() => editor.chain().focus().toggleCodeBlock().run()}
          >
            <Code className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('horizontalRule') ? (
          <ToolbarButton
            title="Horizontal rule"
            onClick={() => editor.chain().focus().setHorizontalRule().run()}
          >
            <Minus className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('textAlign') ? (
          <>
            <ToolbarDivider />
            <ToolbarButton
              title="Align left"
              isActive={editor.isActive({ textAlign: 'left' })}
              onClick={() => editor.chain().focus().setTextAlign('left').run()}
            >
              <AlignLeft className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Align center"
              isActive={editor.isActive({ textAlign: 'center' })}
              onClick={() => editor.chain().focus().setTextAlign('center').run()}
            >
              <AlignCenter className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Align right"
              isActive={editor.isActive({ textAlign: 'right' })}
              onClick={() => editor.chain().focus().setTextAlign('right').run()}
            >
              <AlignRight className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Justify"
              isActive={editor.isActive({ textAlign: 'justify' })}
              onClick={() => editor.chain().focus().setTextAlign('justify').run()}
            >
              <AlignJustify className="size-3.5" />
            </ToolbarButton>
          </>
        ) : null}

        {isFeatureEnabled('textDirection') ? (
          <>
            <ToolbarDivider />
            <AppButton
              type="button"
              intent={editor.isActive({ dir: 'ltr' }) ? 'toggle-on' : 'toggle-off'}
              size="icon-sm"
              className={cn(
                TOOLBAR_BUTTON_CLASS,
                'w-auto min-w-7 gap-0.5 px-1.5',
                editor.isActive({ dir: 'ltr' }) ? TOOLBAR_ACTIVE_CLASS : undefined,
              )}
              title="Paragraph direction: left to right"
              aria-label="Paragraph direction: left to right"
              aria-pressed={editor.isActive({ dir: 'ltr' })}
              onClick={() => editor.chain().focus().setTextDirection('ltr').run()}
            >
              <ArrowRightToLine className="size-3" />
              <span className="text-[9px] font-bold leading-none tracking-wide">LTR</span>
            </AppButton>
            <AppButton
              type="button"
              intent={editor.isActive({ dir: 'rtl' }) ? 'toggle-on' : 'toggle-off'}
              size="icon-sm"
              className={cn(
                TOOLBAR_BUTTON_CLASS,
                'w-auto min-w-7 gap-0.5 px-1.5',
                editor.isActive({ dir: 'rtl' }) ? TOOLBAR_ACTIVE_CLASS : undefined,
              )}
              title="Paragraph direction: right to left"
              aria-label="Paragraph direction: right to left"
              aria-pressed={editor.isActive({ dir: 'rtl' })}
              onClick={() => editor.chain().focus().setTextDirection('rtl').run()}
            >
              <ArrowLeftToLine className="size-3" />
              <span className="text-[9px] font-bold leading-none tracking-wide">RTL</span>
            </AppButton>
          </>
        ) : null}

        {(isFeatureEnabled('link') || isFeatureEnabled('image') || isFeatureEnabled('table')) ? (
          <ToolbarDivider />
        ) : null}

        {isFeatureEnabled('link') ? (
          <>
            <ToolbarButton
              title="Insert link"
              isActive={editor.isActive('link')}
              onClick={openLinkEditor}
            >
              <Link2 className="size-3.5" />
            </ToolbarButton>
            <ToolbarButton
              title="Remove link"
              isDisabled={!editor.isActive('link')}
              onClick={removeLink}
            >
              <Unlink className="size-3.5" />
            </ToolbarButton>
          </>
        ) : null}

        {isFeatureEnabled('image') ? (
          <ToolbarButton
            title="Insert image"
            onClick={openImageEditor}
          >
            <ImageIcon className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('table') ? (
          <ToolbarButton
            title="Insert table"
            isActive={editor.isActive('table')}
            onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
          >
            <Table2 className="size-3.5" />
          </ToolbarButton>
        ) : null}

        {isFeatureEnabled('clearFormatting') ? (
          <>
            <ToolbarDivider />
            <ToolbarButton
              title="Clear formatting"
              onClick={clearFormatting}
            >
              <Eraser className="size-3.5" />
            </ToolbarButton>
          </>
        ) : null}
          </>
        ) : null}
        {trailingSlot ? (
          <>
            {hasToolbarFeatures && !readOnly ? <ToolbarDivider /> : null}
            <span className={cn((!hasToolbarFeatures || readOnly) && 'ms-auto shrink-0')}>
              {trailingSlot}
            </span>
          </>
        ) : null}
      </div>

      {activePanel === 'link' && isFeatureEnabled('link') ? (
        <InlineEditorPanel
          label="Link URL"
          inputId="designer-rich-text-link"
          value={linkDraft}
          placeholder="https://example.com"
          onChange={setLinkDraft}
          onApply={applyLink}
          onCancel={() => setActivePanel(null)}
          inputRef={linkInputRef}
        />
      ) : null}

      {activePanel === 'image' && isFeatureEnabled('image') ? (
        <InlineEditorPanel
          label="Image URL"
          inputId="designer-rich-text-image"
          value={imageDraft}
          placeholder="https://example.com/image.png"
          onChange={setImageDraft}
          onApply={applyImage}
          onCancel={() => setActivePanel(null)}
          inputRef={imageInputRef}
        />
      ) : null}
    </div>
  );
};
