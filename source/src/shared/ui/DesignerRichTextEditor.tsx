import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent } from '@tiptap/react';
import { cn } from '../../lib/utils';
import { sanitizeDesignerHtml } from '../../domain/component-designer/sanitizeDesignerHtml';
import type { EuaAssistSurface, EuaContextNeighborField } from '../api/contracts/ai/euaFieldAssist';
import type { DesignerRichTextToolbarProps } from '../lib/designerRichTextConfig';
import { DesignerRichTextToolbar } from './DesignerRichTextToolbar';
import { EnglishOnlyCultureScope } from '../../core/culture/EnglishOnlyCultureScope';
import { useOptionalCulture } from '../../core/culture/CultureContext';
import { useDesignerRichTextEditor } from './useDesignerRichTextEditor';
import { useMarkdownWysiwygEditor } from './useMarkdownWysiwygEditor';
import { isMarkdownTextDir, resolveMarkdownEditorTextDirection } from './designerRichTextMarkdownDir';
import { AiAutocompleteCaretGhost } from './ai-field-assist/AiAutocompleteCaretGhost';
import { AiTextContextMenu } from './ai-field-assist/AiTextContextMenu';
import { ensureEuaStatusLoaded } from './ai-field-assist/euaStatusCache';
import {
  insertTipTapCompletion,
  markdownAutocompleteCursorPosition,
  tiptapAutocompleteCursorPosition,
} from './ai-field-assist/markdownEditorAssist';
import { useAiAssistGate } from './ai-field-assist/useAiAssistGate';
import { useAiContextPlaceholder } from './ai-field-assist/useAiContextPlaceholder';
import { useAiFieldAutocomplete } from './ai-field-assist/useAiFieldAutocomplete';
import { useAiFieldEditHistory } from './ai-field-assist/useAiFieldEditHistory';
import { useAiTipTapAssistBindings } from './ai-field-assist/useAiTipTapAssistBindings';
import {
  useEuaDefaultModelId,
  useEuaFieldAssistReady,
  useEuaStatusSnapshot,
} from './ai-field-assist/useEuaCapability';
import './designerRichTextEditor.css';

type SharedFieldShellProps = {
  label?: string;
  description?: string;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  className?: string;
  children: React.ReactNode;
};

const FieldShell: React.FC<SharedFieldShellProps> = ({
  label,
  description,
  isRequired,
  isInvalid,
  errorMessage,
  className,
  children,
}) => (
  <div className={cn('flex w-full min-w-[220px] flex-col gap-[2px]', className)}>
    {label ? (
      <label className="ps-[4px] text-sm font-medium text-slate-700">
        {label}
        {isRequired ? <span className="text-rose-600"> *</span> : null}
      </label>
    ) : null}
    {children}
    {description ? <p className="ps-[4px] text-xs text-slate-500">{description}</p> : null}
    {isInvalid && errorMessage ? <p className="ps-[4px] text-xs text-rose-600">{errorMessage}</p> : null}
  </div>
);

export type DesignerRichTextEditorProps = DesignerRichTextToolbarProps & {
  label?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  description?: string;
  editorHeight?: number | string;
  fontSize?: number;
  readOnly?: boolean;
  isReadOnly?: boolean;
  isDisabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  className?: string;
  name?: string;
  ariaLabel?: string;
  onChange?: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLElement>;
  aiAssist?: boolean;
  aiAssistSurface?: EuaAssistSurface;
  fieldLabel?: string;
  contextSuggest?: boolean;
  sectionTitle?: string;
  sectionDescription?: string;
  neighborFields?: EuaContextNeighborField[];
};

export const DesignerRichTextEditor: React.FC<DesignerRichTextEditorProps> = ({
  label,
  description,
  isRequired,
  isInvalid,
  errorMessage,
  className,
  name,
  ariaLabel,
  value,
  defaultValue,
  onChange,
  onBlur,
  onMouseEnter,
  placeholder,
  aiAssist = true,
  aiAssistSurface = 'admin',
  fieldLabel,
  contextSuggest = false,
  sectionTitle,
  sectionDescription,
  neighborFields,
  ...editorOptions
}) => {
  const [htmlValue, setHtmlValue] = useState(() => sanitizeDesignerHtml(value ?? defaultValue ?? ''));
  const [bodyNode, setBodyNode] = useState<HTMLDivElement | null>(null);
  const editorRef = useRef<ReturnType<typeof useDesignerRichTextEditor>['editor']>(null);
  const htmlRef = useRef(htmlValue);
  htmlRef.current = htmlValue;

  const isControlDisabled = Boolean(editorOptions.readOnly || editorOptions.isReadOnly || editorOptions.isDisabled);
  const assistGate = useAiAssistGate({
    aiAssist,
    isControlDisabled,
    contextSuggest,
  });
  const editHistory = useAiFieldEditHistory();
  const resolvedFieldLabel = fieldLabel ?? ariaLabel ?? label ?? placeholder;
  const aiGeneratedPlaceholder = useAiContextPlaceholder({
    enabled: assistGate.shouldContextSuggest,
    fieldLabel: resolvedFieldLabel,
    fieldKind: 'multiline',
    sectionTitle,
    sectionDescription,
    neighborFields,
    currentValue: htmlValue,
    hasExplicitPlaceholder: Boolean(placeholder?.trim()),
    modelId: assistGate.defaultModelId,
    surface: aiAssistSurface,
  });
  const resolvedPlaceholder = placeholder ?? aiGeneratedPlaceholder ?? 'Start writing…';

  const getPlainText = useCallback(
    () => editorRef.current?.getText() ?? htmlRef.current,
    [],
  );
  const getCursorPosition = useCallback(
    () => tiptapAutocompleteCursorPosition(editorRef.current, getPlainText()),
    [getPlainText],
  );

  const autocomplete = useAiFieldAutocomplete({
    enabled: assistGate.shouldAutocomplete,
    getText: getPlainText,
    getCursorPosition,
    fieldLabel: resolvedFieldLabel,
    modelId: assistGate.defaultModelId,
    surface: aiAssistSurface,
  });

  const htmlChangeRef = useRef<(next: string) => void>(() => undefined);
  htmlChangeRef.current = (next) => {
    setHtmlValue(next);
    onChange?.(next);
    if (assistGate.shouldAutocomplete) {
      autocomplete.handleInputChange({
        text: editorRef.current?.getText() ?? next,
        cursorPosition: tiptapAutocompleteCursorPosition(editorRef.current, editorRef.current?.getText() ?? next),
      });
    }
  };

  const {
    editor,
    toolbar,
    resolvedReadOnly,
    resolvedHeight,
    fillHeight,
    fontSize,
  } = useDesignerRichTextEditor({
    ...editorOptions,
    value,
    defaultValue,
    placeholder: resolvedPlaceholder,
    onChange: (next) => htmlChangeRef.current(next),
  });

  editorRef.current = editor;

  useEffect(() => {
    if (value === undefined) {
      return;
    }

    setHtmlValue(sanitizeDesignerHtml(value));
  }, [value]);

  const applyHtml = useCallback((nextValue: string) => {
    const sanitized = sanitizeDesignerHtml(nextValue);
    const active = editorRef.current;
    if (active) {
      active.commands.setContent(sanitized, false);
    }
    setHtmlValue(sanitized);
    onChange?.(sanitized);
  }, [onChange]);

  const handleApply = useCallback((nextValue: string, beforeValue: string) => {
    if (!assistGate.diffUndoDisabled) {
      editHistory.pushAppliedEdit(beforeValue, nextValue);
    }
    applyHtml(nextValue);
  }, [applyHtml, assistGate.diffUndoDisabled, editHistory]);

  const handleUndoAiEdit = useCallback(() => {
    const previous = editHistory.undo(htmlRef.current);
    if (previous !== null) {
      applyHtml(previous);
    }
  }, [applyHtml, editHistory]);

  const handleRedoAiEdit = useCallback(() => {
    const next = editHistory.redo(htmlRef.current);
    if (next !== null) {
      applyHtml(next);
    }
  }, [applyHtml, editHistory]);

  const { handleEditorKeyDown } = useAiTipTapAssistBindings({
    shouldAutocomplete: assistGate.shouldAutocomplete,
    autocomplete,
    onAccept: (_nextValue, suffix) => {
      const html = insertTipTapCompletion(editorRef.current, suffix);
      if (html) {
        setHtmlValue(sanitizeDesignerHtml(html));
      }
    },
    diffUndoDisabled: assistGate.diffUndoDisabled,
    canUndo: editHistory.canUndo,
    canRedo: editHistory.canRedo,
    onUndo: handleUndoAiEdit,
    onRedo: handleRedoAiEdit,
  });

  const getSelection = useCallback(() => {
    const active = editorRef.current;
    if (!active) return null;
    const { from, to, empty } = active.state.selection;
    if (empty) return null;
    const text = active.state.doc.textBetween(from, to, '\n');
    const full = active.getText();
    if (!text || !full.includes(text)) {
      return null;
    }
    const start = full.indexOf(text);
    return { start, end: start + text.length, text };
  }, []);

  const showGhost = assistGate.shouldAutocomplete && Boolean(autocomplete.completion);

  const editorBody = (
    <div
      className={cn(
        'designer-rich-text-editor overflow-hidden rounded-md border border-slate-300 bg-white',
        fillHeight && 'designer-rich-text-editor--fill flex min-h-0 flex-1 flex-col',
        resolvedReadOnly ? 'opacity-90' : undefined,
        isInvalid ? 'border-rose-400' : undefined,
      )}
      data-designer-rich-text-editor="true"
      aria-label={ariaLabel}
      onBlur={onBlur}
      onMouseEnter={onMouseEnter}
      onKeyDown={handleEditorKeyDown}
    >
      {editor ? (
        <EnglishOnlyCultureScope>
          <DesignerRichTextToolbar editor={editor} toolbar={toolbar} readOnly={resolvedReadOnly} />
        </EnglishOnlyCultureScope>
      ) : null}
      <div
        ref={setBodyNode}
        className={cn('relative', fillHeight && 'min-h-0 flex-1 overflow-auto')}
      >
        {showGhost ? (
          <AiAutocompleteCaretGhost
            editor={editor}
            wrapper={bodyNode}
            completion={autocomplete.completion}
          />
        ) : null}
        <EditorContent
          editor={editor}
          className={cn('px-3 py-2 text-slate-800', fillHeight && 'h-full min-h-full')}
          style={{
            minHeight: fillHeight ? undefined : resolvedHeight,
            height: fillHeight ? '100%' : undefined,
            fontSize: `${fontSize}px`,
          }}
        />
      </div>
    </div>
  );

  return (
    <FieldShell
      label={label}
      description={description}
      isRequired={isRequired}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      className={cn(fillHeight && 'min-h-0 flex-1', className)}
    >
      {name ? <input type="hidden" name={name} value={htmlValue} readOnly={resolvedReadOnly} /> : null}
      {assistGate.shouldAssistContextMenu ? (
        <AiTextContextMenu
          getText={() => editorRef.current?.getHTML() ?? htmlRef.current}
          getSelection={getSelection}
          onApply={handleApply}
          fieldLabel={resolvedFieldLabel}
          surface={aiAssistSurface}
          actionsEnabled={assistGate.actionsEnabled}
          defaultModelId={assistGate.defaultModelId}
          canUndoAiEdit={!assistGate.diffUndoDisabled && editHistory.canUndo}
          canRedoAiEdit={!assistGate.diffUndoDisabled && editHistory.canRedo}
          onUndoAiEdit={assistGate.diffUndoDisabled ? undefined : handleUndoAiEdit}
          onRedoAiEdit={assistGate.diffUndoDisabled ? undefined : handleRedoAiEdit}
        >
          {editorBody}
        </AiTextContextMenu>
      ) : editorBody}
    </FieldShell>
  );
};

export type DesignerHtmlEditorFieldProps = DesignerRichTextEditorProps;

export const DesignerHtmlEditorField: React.FC<DesignerHtmlEditorFieldProps> = (props) => (
  <DesignerRichTextEditor {...props} />
);

export const DESIGNER_HTML_EDITOR_DEFAULT_LINES = 4;

export type DesignerMarkdownEditorChromeVariant = 'default' | 'flush';

export type DesignerMarkdownEditorFieldProps = DesignerRichTextEditorProps & {
  dir?: 'ltr' | 'rtl' | 'auto';
  /** `flush` — no outer box; toolbar + body fill the host (floating panels, modal bands). */
  chromeVariant?: DesignerMarkdownEditorChromeVariant;
  aiAssist?: boolean;
  aiAssistSurface?: EuaAssistSurface;
  fieldLabel?: string;
  contextSuggest?: boolean;
  sectionTitle?: string;
  sectionDescription?: string;
  neighborFields?: EuaContextNeighborField[];
};

/** Inline Markdown WYSIWYG — same editor as Base Components → Markdown editor (toolbar + TipTap). */
export const DesignerMarkdownEditorField: React.FC<DesignerMarkdownEditorFieldProps> = ({
  label,
  description,
  isRequired,
  isInvalid,
  errorMessage,
  className,
  name,
  ariaLabel,
  value,
  defaultValue,
  onChange,
  onBlur,
  onMouseEnter,
  dir = 'auto',
  chromeVariant = 'default',
  aiAssist = true,
  aiAssistSurface = 'admin',
  fieldLabel,
  contextSuggest = false,
  sectionTitle,
  sectionDescription,
  neighborFields,
  placeholder,
  ...editorOptions
}) => {
  const [markdownValue, setMarkdownValue] = useState(() => value ?? defaultValue ?? '');
  const [bodyNode, setBodyNode] = useState<HTMLDivElement | null>(null);
  const editorRef = useRef<ReturnType<typeof useMarkdownWysiwygEditor>['editor']>(null);
  const markdownRef = useRef(markdownValue);
  markdownRef.current = markdownValue;

  const status = useEuaStatusSnapshot();
  const actionsEnabled = useEuaFieldAssistReady();
  const defaultModelId = useEuaDefaultModelId();
  const editHistory = useAiFieldEditHistory();
  const isControlDisabled = Boolean(editorOptions.readOnly || editorOptions.isReadOnly || editorOptions.isDisabled);
  const contextMenuDisabled = status?.capabilities['eua.contextMenu'] === false;
  const autocompleteDisabled = status?.capabilities['eua.autocomplete'] === false;
  const contextSuggestDisabled = status?.capabilities['eua.contextSuggest'] === false;
  const diffUndoDisabled = status?.capabilities['eua.diffUndo'] === false;
  const shouldEnableAssist = aiAssist && !isControlDisabled;
  const shouldAssistContextMenu = shouldEnableAssist && !contextMenuDisabled;
  const shouldAutocomplete = shouldEnableAssist && !autocompleteDisabled && actionsEnabled;
  const shouldContextSuggest = shouldEnableAssist && contextSuggest && !contextSuggestDisabled && actionsEnabled;
  const resolvedFieldLabel = fieldLabel ?? ariaLabel ?? label ?? placeholder;

  const aiGeneratedPlaceholder = useAiContextPlaceholder({
    enabled: shouldContextSuggest,
    fieldLabel: resolvedFieldLabel,
    fieldKind: 'multiline',
    sectionTitle,
    sectionDescription,
    neighborFields,
    currentValue: markdownValue,
    hasExplicitPlaceholder: Boolean(placeholder?.trim()),
    modelId: defaultModelId,
    surface: aiAssistSurface,
  });
  const resolvedPlaceholder = placeholder ?? aiGeneratedPlaceholder ?? 'Write in Markdown…';
  const cultureDirection = useOptionalCulture()?.direction;

  const getText = useCallback(() => markdownRef.current, []);
  const getCursorPosition = useCallback(
    () => markdownAutocompleteCursorPosition(editorRef.current, markdownRef.current),
    [],
  );

  const autocomplete = useAiFieldAutocomplete({
    enabled: shouldAutocomplete,
    getText,
    getCursorPosition,
    fieldLabel: resolvedFieldLabel,
    modelId: defaultModelId,
    surface: aiAssistSurface,
  });

  const markdownChangeRef = useRef<(next: string) => void>(() => undefined);
  markdownChangeRef.current = (next) => {
    setMarkdownValue(next);
    onChange?.(next);
    if (shouldAutocomplete) {
      autocomplete.handleInputChange({
        text: next,
        cursorPosition: markdownAutocompleteCursorPosition(editorRef.current, next),
      });
    }
  };

  const {
    editor,
    toolbar,
    resolvedReadOnly,
    resolvedHeight,
    fillHeight,
    fontSize,
  } = useMarkdownWysiwygEditor({
    ...editorOptions,
    value,
    defaultValue,
    placeholder: resolvedPlaceholder,
    onChange: (next) => markdownChangeRef.current(next),
  });

  editorRef.current = editor;

  useEffect(() => {
    if (shouldEnableAssist) {
      void ensureEuaStatusLoaded();
    }
  }, [shouldEnableAssist]);

  useEffect(() => {
    if (value === undefined) {
      return;
    }
    setMarkdownValue(value);
  }, [value]);

  const applyValue = useCallback((nextValue: string) => {
    const active = editorRef.current;
    if (active) {
      active.commands.setContent(nextValue, { emitUpdate: false });
    }
    setMarkdownValue(nextValue);
    onChange?.(nextValue);
  }, [onChange]);

  const handleApply = useCallback((nextValue: string, beforeValue: string) => {
    if (!diffUndoDisabled) {
      editHistory.pushAppliedEdit(beforeValue, nextValue);
    }
    applyValue(nextValue);
  }, [applyValue, diffUndoDisabled, editHistory]);

  const handleUndoAiEdit = useCallback(() => {
    const previous = editHistory.undo(getText());
    if (previous !== null) {
      applyValue(previous);
    }
  }, [applyValue, editHistory, getText]);

  const handleRedoAiEdit = useCallback(() => {
    const next = editHistory.redo(getText());
    if (next !== null) {
      applyValue(next);
    }
  }, [applyValue, editHistory, getText]);

  const getSelection = useCallback(() => {
    const active = editorRef.current;
    if (!active) return null;
    const { from, to, empty } = active.state.selection;
    if (empty) return null;
    const text = active.state.doc.textBetween(from, to, '\n');
    const full = markdownRef.current;
    if (!text || !full.includes(text)) {
      return null;
    }
    const start = full.indexOf(text);
    return { start, end: start + text.length, text };
  }, []);

  const handleEditorKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (shouldAutocomplete) {
      if (event.key === 'Tab' && autocomplete.completion && !event.shiftKey) {
        const nextValue = autocomplete.acceptCompletion();
        if (nextValue !== null) {
          event.preventDefault();
          applyValue(nextValue);
          return;
        }
      }
      if (event.key === 'Escape' && autocomplete.completion) {
        event.preventDefault();
        autocomplete.dismiss();
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.code === 'Space') {
        event.preventDefault();
        autocomplete.requestSuggestion(true);
      }
    }

    if (!diffUndoDisabled) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        if (event.shiftKey) {
          if (editHistory.canRedo) {
            event.preventDefault();
            handleRedoAiEdit();
          }
        } else if (editHistory.canUndo) {
          event.preventDefault();
          handleUndoAiEdit();
        }
      } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y' && editHistory.canRedo) {
        event.preventDefault();
        handleRedoAiEdit();
      }
    }
  }, [
    applyValue,
    autocomplete,
    diffUndoDisabled,
    editHistory.canRedo,
    editHistory.canUndo,
    handleRedoAiEdit,
    handleUndoAiEdit,
    shouldAutocomplete,
  ]);

  const resolvedDir = resolveMarkdownEditorTextDirection(dir, markdownValue, {
    placeholder: resolvedPlaceholder,
    cultureDirection,
  });

  useEffect(() => {
    const active = editorRef.current;
    if (!active || !isMarkdownTextDir(dir)) {
      return;
    }
    if (markdownRef.current.trim()) {
      return;
    }
    active.chain().setTextDirection(dir).run();
  }, [dir, editor]);

  const showGhost = shouldAutocomplete && Boolean(autocomplete.completion);
  const flushChrome = chromeVariant === 'flush';

  const editorBody = (
    <div
      className={cn(
        'designer-rich-text-editor relative overflow-hidden bg-white',
        flushChrome
          ? 'rounded-none border-0'
          : 'rounded-md border border-slate-300',
        fillHeight && 'designer-rich-text-editor--fill flex min-h-0 flex-1 flex-col',
        resolvedReadOnly ? 'opacity-90' : undefined,
        !flushChrome && isInvalid ? 'border-rose-400' : undefined,
        flushChrome && isInvalid ? 'ring-1 ring-inset ring-rose-400' : undefined,
      )}
      data-designer-rich-text-editor="true"
      data-designer-markdown-editor="true"
      aria-label={ariaLabel}
      onBlur={onBlur}
      onMouseEnter={onMouseEnter}
      onKeyDown={handleEditorKeyDown}
    >
      {editor ? (
        <EnglishOnlyCultureScope>
          <DesignerRichTextToolbar
            editor={editor}
            toolbar={toolbar}
            readOnly={resolvedReadOnly}
            variant={flushChrome ? 'embedded' : 'default'}
            className={flushChrome ? 'border-b border-slate-200 bg-slate-50/80 px-2 py-1.5' : undefined}
          />
        </EnglishOnlyCultureScope>
      ) : null}
      <div
        ref={setBodyNode}
        className={cn('relative', fillHeight && 'min-h-0 flex-1 overflow-auto')}
        dir={resolvedDir}
      >
        {showGhost ? (
          <AiAutocompleteCaretGhost
            editor={editor}
            wrapper={bodyNode}
            completion={autocomplete.completion}
          />
        ) : null}
        <EditorContent
          editor={editor}
          className={cn(
            'text-slate-800',
            flushChrome ? 'px-3 py-2.5 sm:px-4' : 'px-3 py-2',
            fillHeight && 'h-full min-h-full',
          )}
          style={{
            minHeight: fillHeight ? undefined : resolvedHeight,
            height: fillHeight ? '100%' : undefined,
            fontSize: `${fontSize}px`,
          }}
        />
      </div>
    </div>
  );

  return (
    <FieldShell
      label={label}
      description={description}
      isRequired={isRequired}
      isInvalid={isInvalid}
      errorMessage={errorMessage}
      className={cn(fillHeight && 'min-h-0 flex-1', className)}
    >
      {name ? <input type="hidden" name={name} value={markdownValue} readOnly={resolvedReadOnly} /> : null}
      {shouldAssistContextMenu ? (
        <AiTextContextMenu
          getText={getText}
          getSelection={getSelection}
          onApply={handleApply}
          fieldLabel={resolvedFieldLabel}
          surface={aiAssistSurface}
          actionsEnabled={actionsEnabled}
          defaultModelId={defaultModelId}
          canUndoAiEdit={!diffUndoDisabled && editHistory.canUndo}
          canRedoAiEdit={!diffUndoDisabled && editHistory.canRedo}
          onUndoAiEdit={diffUndoDisabled ? undefined : handleUndoAiEdit}
          onRedoAiEdit={diffUndoDisabled ? undefined : handleRedoAiEdit}
        >
          {editorBody}
        </AiTextContextMenu>
      ) : editorBody}
    </FieldShell>
  );
};
