import React, { Suspense, lazy, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { EditorContent } from '@tiptap/react';
import type { OnMount } from '@monaco-editor/react';
import { cn } from '../../../lib/utils';
import {
  DESIGNER_RICH_TEXT_DEFAULT_FONT_SIZE,
} from '../../lib/designerRichTextConfig';
import { EnglishOnlyCultureScope } from '../../../core/culture/EnglishOnlyCultureScope';
import { DesignerRichTextToolbar } from '../DesignerRichTextToolbar';
import { useDesignerRichTextEditor } from '../useDesignerRichTextEditor';
import '../designerRichTextEditor.css';
import { HtmlEditorModeBar } from './HtmlEditorModeBar';
import { HtmlEditorSourceToggle } from './HtmlEditorVisualSourceSwitch';
import { HtmlPreview } from './HtmlPreview';
import {
  HTML_EDITOR_DEFAULT_HEIGHT,
  HTML_EDITOR_DEFAULT_MODE,
  HTML_EDITOR_DEFAULT_PREVIEW_DEVICE,
  type HtmlEditorMode,
  type HtmlEditorPreviewDevice,
} from './types';
import { HTML_EDITOR_MONACO_OPTIONS, setupHtmlEditorMonacoOnMount } from './htmlEditorMonaco';
import { useHtmlEditorState } from './useHtmlEditorState';
import { AiAutocompleteCaretGhost } from '../ai-field-assist/AiAutocompleteCaretGhost';
import { AiTextContextMenu } from '../ai-field-assist/AiTextContextMenu';
import {
  insertTipTapCompletion,
  tiptapAutocompleteCursorPosition,
} from '../ai-field-assist/markdownEditorAssist';
import { useAiAssistGate } from '../ai-field-assist/useAiAssistGate';
import { useAiFieldAutocomplete } from '../ai-field-assist/useAiFieldAutocomplete';
import { useAiFieldEditHistory } from '../ai-field-assist/useAiFieldEditHistory';
import { useAiTipTapAssistBindings } from '../ai-field-assist/useAiTipTapAssistBindings';
import { useMonacoAiAutocomplete } from '../ai-field-assist/useMonacoAiAutocomplete';
import type { MonacoApiLike, MonacoEditorLike } from '../ai-field-assist/monacoEditorAssist';
import { shouldPreserveExternalHtmlOnVisualUpdate } from '../../lib/richTextVisualSync';
import { MONACO_EDITOR_LTR_SHELL_CLASS } from '../monacoEditorLtr';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));

import type { HtmlEditorProps } from './htmlEditorProps';
import { HtmlSourceEditor } from './HtmlSourceEditor';
import {
  parseHtmlEditorRootHeightPx,
  resolveHtmlEditorBodyHeightPx,
  resolveHtmlEditorChromeHeightPx,
} from './htmlEditorLayout';

export type { HtmlEditorProps } from './htmlEditorProps';

export const HtmlEditor: React.FC<HtmlEditorProps> = (props) => {
  if (props.sourceOnly) {
    return (
      <HtmlSourceEditor
        value={props.value}
        defaultValue={props.defaultValue}
        onChange={props.onChange}
        editorHeight={props.editorHeight}
        readOnly={props.readOnly}
        isReadOnly={props.isReadOnly}
        isDisabled={props.isDisabled}
        className={props.className}
        trustedHtml={props.trustedHtml}
        placeholder={props.placeholder}
        ariaLabel={props.fieldLabel ?? props.placeholder}
      />
    );
  }

  const {
  value,
  defaultValue = '',
  onChange,
  mode: controlledMode,
  defaultMode = HTML_EDITOR_DEFAULT_MODE,
  onModeChange,
  previewDevice: controlledPreviewDevice,
  defaultPreviewDevice = HTML_EDITOR_DEFAULT_PREVIEW_DEVICE,
  onPreviewDeviceChange,
  placeholder = 'Start writing HTML…',
  editorHeight = HTML_EDITOR_DEFAULT_HEIGHT,
  fontSize = DESIGNER_RICH_TEXT_DEFAULT_FONT_SIZE,
  readOnly,
  isReadOnly,
  isDisabled = false,
  className,
  showModeBar = true,
  toolbarVisualSourceSwitch = false,
  showStats = true,
  dir = 'ltr',
  aiAssist = true,
  aiAssistSurface = 'admin',
  fieldLabel,
  trustedHtml = false,
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
  } = props;
  const resolvedReadOnly = readOnly === true || isReadOnly === true || isDisabled;
  const {
    html,
    safeHtml,
    mode,
    previewDevice,
    formatting,
    stats,
    setHtml,
    setMode,
    setPreviewDevice,
    formatHtml,
    copyHtml,
  } = useHtmlEditorState({
    value,
    defaultValue,
    mode: controlledMode,
    defaultMode,
    previewDevice: controlledPreviewDevice,
    defaultPreviewDevice,
    onChange,
    onModeChange,
    onPreviewDeviceChange,
    trustedHtml,
  });

  const resolvedHeight = typeof editorHeight === 'number'
    ? `${editorHeight}px`
    : (typeof editorHeight === 'string' && editorHeight.trim().length > 0
      ? editorHeight
      : `${HTML_EDITOR_DEFAULT_HEIGHT}px`);
  const fillHeight = resolvedHeight === '100%';
  const rootHeightPx = parseHtmlEditorRootHeightPx(editorHeight, HTML_EDITOR_DEFAULT_HEIGHT);
  const htmlChangeRef = useRef<(next: string) => void>(setHtml);
  const passthroughHtml = useCallback((next: string) => next, []);

  const {
    editor,
    toolbar,
    resolvedReadOnly: visualReadOnly,
    fontSize: visualFontSize,
  } = useDesignerRichTextEditor({
    value: trustedHtml ? html : safeHtml,
    placeholder,
    editorHeight: '100%',
    fontSize,
    readOnly: resolvedReadOnly,
    onChange: (next) => htmlChangeRef.current(next),
    sanitizeHtml: trustedHtml ? passthroughHtml : undefined,
    syncExternalValue: true,
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
  });

  const editorRef = useRef(editor);
  editorRef.current = editor;
  const [visualBodyNode, setVisualBodyNode] = useState<HTMLDivElement | null>(null);
  const [assistPane, setAssistPane] = useState<'visual' | 'source'>(mode === 'source' ? 'source' : 'visual');
  const [monacoEditor, setMonacoEditor] = useState<MonacoEditorLike | null>(null);
  const [monacoApi, setMonacoApi] = useState<MonacoApiLike | null>(null);
  const monacoHostRef = useRef<HTMLDivElement>(null);
  const monacoLayoutRef = useRef<{ layout: (dimensions: { width: number; height: number }) => void } | null>(null);
  const assistGate = useAiAssistGate({
    aiAssist,
    isControlDisabled: resolvedReadOnly,
  });
  const editHistory = useAiFieldEditHistory();
  const resolvedFieldLabel = fieldLabel ?? placeholder ?? 'HTML';
  const shouldAutocompleteVisual = assistGate.shouldAutocomplete
    && (mode === 'visual' || (mode === 'split' && assistPane === 'visual'));
  const shouldAutocompleteSource = assistGate.shouldAutocomplete
    && (mode === 'source' || (mode === 'split' && assistPane === 'source'));

  const getVisualText = useCallback(() => editorRef.current?.getText() ?? html, [html]);
  const getVisualCursorPosition = useCallback(
    () => tiptapAutocompleteCursorPosition(editorRef.current, getVisualText()),
    [getVisualText],
  );

  const visualAutocomplete = useAiFieldAutocomplete({
    enabled: shouldAutocompleteVisual,
    getText: getVisualText,
    getCursorPosition: getVisualCursorPosition,
    fieldLabel: resolvedFieldLabel,
    modelId: assistGate.defaultModelId,
    surface: aiAssistSurface,
  });

  htmlChangeRef.current = (next) => {
    if (trustedHtml && shouldPreserveExternalHtmlOnVisualUpdate(html, next)) {
      return;
    }
    setHtml(next);
    if (shouldAutocompleteVisual) {
      visualAutocomplete.handleInputChange({
        text: editorRef.current?.getText() ?? next,
        cursorPosition: tiptapAutocompleteCursorPosition(
          editorRef.current,
          editorRef.current?.getText() ?? next,
        ),
      });
    }
  };

  const applyHtml = useCallback((nextValue: string) => {
    setHtml(nextValue);
  }, [setHtml]);

  const handleApply = useCallback((nextValue: string, beforeValue: string) => {
    if (!assistGate.diffUndoDisabled) {
      editHistory.pushAppliedEdit(beforeValue, nextValue);
    }
    applyHtml(nextValue);
  }, [applyHtml, assistGate.diffUndoDisabled, editHistory]);

  const handleUndoAiEdit = useCallback(() => {
    const previous = editHistory.undo(html);
    if (previous !== null) {
      applyHtml(previous);
    }
  }, [applyHtml, editHistory, html]);

  const handleRedoAiEdit = useCallback(() => {
    const next = editHistory.redo(html);
    if (next !== null) {
      applyHtml(next);
    }
  }, [applyHtml, editHistory, html]);

  const { handleEditorKeyDown: handleVisualAssistKeyDown } = useAiTipTapAssistBindings({
    shouldAutocomplete: shouldAutocompleteVisual,
    autocomplete: visualAutocomplete,
    onAccept: (_nextValue, suffix) => {
      insertTipTapCompletion(editorRef.current, suffix);
    },
    diffUndoDisabled: assistGate.diffUndoDisabled,
    canUndo: editHistory.canUndo,
    canRedo: editHistory.canRedo,
    onUndo: handleUndoAiEdit,
    onRedo: handleRedoAiEdit,
  });

  const getVisualSelection = useCallback(() => {
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

  useMonacoAiAutocomplete({
    enabled: shouldAutocompleteSource,
    editor: monacoEditor,
    monaco: monacoApi,
    fieldLabel: resolvedFieldLabel,
    modelId: assistGate.defaultModelId,
    surface: aiAssistSurface,
    onAccept: (nextValue) => setHtml(nextValue),
  });

  const compactVisualSource = toolbarVisualSourceSwitch && !showModeBar;
  const compactSourceMode = compactVisualSource && mode === 'source';
  const compactVisualMode = compactVisualSource && !compactSourceMode;
  const showVisual = mode === 'visual' || (compactVisualSource && compactVisualMode);
  const showSource = mode === 'source' || mode === 'split' || compactSourceMode;
  const showPreview = !compactVisualSource && (mode === 'preview' || mode === 'split');
  const showVisualGhost = shouldAutocompleteVisual && Boolean(visualAutocomplete.completion);

  const showCompactRichToolbar = compactVisualSource
    && Boolean(editor)
    && showToolbar !== false
    && toolbar.showToolbar
    && !compactSourceMode;
  const showCompactToggleOnly = compactVisualSource && !showCompactRichToolbar;
  const showStandaloneToolbar = !compactVisualSource
    && (mode === 'visual' || mode === 'split')
    && Boolean(editor)
    && toolbar.showToolbar
    && showToolbar !== false;

  const chromeToolbarPx = resolveHtmlEditorChromeHeightPx({
    showModeBar,
    compactVisualSource,
    compactSourceMode,
    showCompactRichToolbar,
    showStandaloneToolbar,
  });
  const editorBodyHeightPx = resolveHtmlEditorBodyHeightPx(rootHeightPx, chromeToolbarPx);

  const layoutMonacoSurface = useCallback(() => {
    const host = monacoHostRef.current;
    const instance = monacoLayoutRef.current;
    if (!host || !instance || editorBodyHeightPx === null) {
      return;
    }
    const widthPx = Math.max(1, host.clientWidth);
    const heightPx = Math.max(96, editorBodyHeightPx);
    instance.layout({ width: widthPx, height: heightPx });
  }, [editorBodyHeightPx]);

  const handleMonacoMount: OnMount = (mountedEditor, mountedMonaco) => {
    setupHtmlEditorMonacoOnMount(mountedEditor, mountedMonaco);
    setMonacoEditor(mountedEditor as unknown as MonacoEditorLike);
    setMonacoApi(mountedMonaco as unknown as MonacoApiLike);
    monacoLayoutRef.current = mountedEditor as { layout: (dimensions: { width: number; height: number }) => void };
    window.requestAnimationFrame(layoutMonacoSurface);
  };

  useEffect(() => {
    if (!showSource) {
      setMonacoEditor(null);
      setMonacoApi(null);
      monacoLayoutRef.current = null;
    }
  }, [showSource]);

  useLayoutEffect(() => {
    if (!showSource || editorBodyHeightPx === null) {
      return;
    }
    layoutMonacoSurface();
    const frame = window.requestAnimationFrame(layoutMonacoSurface);
    return () => window.cancelAnimationFrame(frame);
  }, [showSource, editorBodyHeightPx, html, layoutMonacoSurface]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const mod = event.metaKey || event.ctrlKey;
    if (!mod) {
      return;
    }

    if (event.shiftKey && event.key.toLowerCase() === 'f') {
      if (!resolvedReadOnly && (mode === 'source' || mode === 'split')) {
        event.preventDefault();
        void formatHtml();
      }
      return;
    }

    if (event.shiftKey && event.key === '1') {
      event.preventDefault();
      setMode('visual');
    } else if (event.shiftKey && event.key === '2') {
      event.preventDefault();
      setMode('source');
    } else if (event.shiftKey && event.key === '3') {
      event.preventDefault();
      setMode('split');
    } else if (event.shiftKey && event.key === '4') {
      event.preventDefault();
      setMode('preview');
    }
  }, [formatHtml, mode, resolvedReadOnly, setMode]);

  const sourceToggleControl = compactVisualSource ? (
    <HtmlEditorSourceToggle
      sourceActive={compactSourceMode}
      onToggle={() => setMode(compactSourceMode ? 'visual' : 'source')}
      disabled={resolvedReadOnly}
    />
  ) : null;

  const visualPane = (
    <div
      ref={setVisualBodyNode}
      className={cn(
        'designer-rich-text-editor designer-rich-text-editor--fill relative overflow-auto',
        compactVisualSource ? 'h-full' : 'min-h-0 flex-1',
      )}
      style={compactVisualSource && editorBodyHeightPx !== null
        ? { height: editorBodyHeightPx, minHeight: editorBodyHeightPx }
        : undefined}
      onFocusCapture={() => setAssistPane('visual')}
      onKeyDown={handleVisualAssistKeyDown}
    >
      {showVisualGhost ? (
        <AiAutocompleteCaretGhost
          editor={editor}
          wrapper={visualBodyNode}
          completion={visualAutocomplete.completion}
        />
      ) : null}
      <EditorContent
        editor={editor}
        className="h-full min-h-full px-3 py-2 text-slate-800"
        style={{ fontSize: `${visualFontSize}px` }}
      />
    </div>
  );

  const monacoPane = editorBodyHeightPx !== null ? (
    <div
      ref={monacoHostRef}
      dir="ltr"
      lang="en"
      className={cn('h-full w-full overflow-hidden', MONACO_EDITOR_LTR_SHELL_CLASS)}
      style={{ height: editorBodyHeightPx, minHeight: editorBodyHeightPx }}
    >
      <Suspense
        fallback={(
          <div
            className="flex w-full items-center justify-center font-mono text-xs text-slate-400"
            style={{ height: editorBodyHeightPx }}
          >
            Loading source editor…
          </div>
        )}
      >
        <MonacoEditor
          key="html-editor-monaco"
          height={editorBodyHeightPx}
          width="100%"
          language="html"
          theme="vs"
          value={html}
          onChange={(next) => {
            if (resolvedReadOnly) {
              return;
            }
            setHtml(next ?? '');
          }}
          onMount={handleMonacoMount}
          options={{
            ...HTML_EDITOR_MONACO_OPTIONS,
            minimap: { enabled: false },
            automaticLayout: true,
            readOnly: resolvedReadOnly,
          }}
        />
      </Suspense>
    </div>
  ) : (
    <Suspense fallback={null}>
      <MonacoEditor
        height="100%"
        language="html"
        theme="vs"
        value={html}
        onChange={(next) => {
          if (resolvedReadOnly) {
            return;
          }
          setHtml(next ?? '');
        }}
        onMount={handleMonacoMount}
        options={{
          ...HTML_EDITOR_MONACO_OPTIONS,
          readOnly: resolvedReadOnly,
        }}
      />
    </Suspense>
  );

  return (
    <div
      className={cn(
        'html-editor flex min-h-0 flex-col overflow-hidden rounded-md border border-slate-300 bg-white',
        fillHeight && 'h-full flex-1',
        resolvedReadOnly && 'opacity-90',
        className,
      )}
      style={fillHeight ? undefined : { height: resolvedHeight, minHeight: resolvedHeight }}
      data-html-editor="true"
      data-html-editor-mode={mode}
      onKeyDown={handleKeyDown}
    >
      {showModeBar ? (
        <HtmlEditorModeBar
          mode={mode}
          onModeChange={setMode}
          previewDevice={previewDevice}
          onPreviewDeviceChange={setPreviewDevice}
          stats={stats}
          readOnly={resolvedReadOnly}
          formatting={formatting}
          showStats={showStats}
          onFormat={resolvedReadOnly ? undefined : () => { void formatHtml(); }}
          onCopy={() => { void copyHtml(); }}
        />
      ) : null}

      {showCompactRichToolbar ? (
        <EnglishOnlyCultureScope>
          <DesignerRichTextToolbar
            editor={editor}
            toolbar={toolbar}
            readOnly={visualReadOnly || compactSourceMode}
            variant="default"
            layout="inline"
            trailingSlot={sourceToggleControl}
          />
        </EnglishOnlyCultureScope>
      ) : showCompactToggleOnly ? (
        <div className="flex justify-end border-b border-slate-200 bg-slate-50 px-2 py-1.5">
          {sourceToggleControl}
        </div>
      ) : (
        showStandaloneToolbar ? (
          <EnglishOnlyCultureScope>
            <DesignerRichTextToolbar
              editor={editor}
              toolbar={toolbar}
              readOnly={visualReadOnly}
            />
          </EnglishOnlyCultureScope>
        ) : null
      )}

      <div
        className={cn(
          'relative overflow-hidden',
          compactVisualSource ? 'shrink-0' : 'flex min-h-0 flex-1',
          !compactVisualSource && mode === 'split' && 'flex-col lg:flex-row',
        )}
        style={editorBodyHeightPx !== null
          ? { height: editorBodyHeightPx, minHeight: editorBodyHeightPx }
          : undefined}
      >
        {compactVisualSource ? (
          compactSourceMode ? (
            <div
              className="h-full w-full"
              onFocusCapture={() => setAssistPane('source')}
            >
              {monacoPane}
            </div>
          ) : showVisual ? (
            assistGate.shouldAssistContextMenu ? (
              <AiTextContextMenu
                getText={() => editorRef.current?.getHTML() ?? html}
                getSelection={getVisualSelection}
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
                {visualPane}
              </AiTextContextMenu>
            ) : visualPane
          ) : null
        ) : (
          <>
            {showVisual ? (
              assistGate.shouldAssistContextMenu ? (
                <AiTextContextMenu
                  getText={() => editorRef.current?.getHTML() ?? html}
                  getSelection={getVisualSelection}
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
                  {visualPane}
                </AiTextContextMenu>
              ) : visualPane
            ) : null}

            {showSource ? (
              <div
                className={cn(
                  'relative min-h-0 min-w-0 flex-1 overflow-hidden border-slate-200',
                  mode === 'split' && 'border-b lg:border-b-0 lg:border-e',
                )}
                onFocusCapture={() => setAssistPane('source')}
              >
                {monacoPane}
              </div>
            ) : null}
          </>
        )}

        {!compactVisualSource && showPreview ? (
          <div className="min-h-0 min-w-0 flex-1 overflow-hidden p-2">
            <HtmlPreview
              html={safeHtml}
              dir={dir}
              device={previewDevice}
              className="h-full"
              emptyFallback={(
                <div className="flex h-full min-h-[160px] items-center justify-center rounded-md border border-dashed border-slate-200 bg-white/70 px-3 text-[11px] text-slate-400">
                  Nothing to preview yet
                </div>
              )}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
};
