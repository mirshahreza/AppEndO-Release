import React, { useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent } from '@tiptap/react';
import { Save, X } from 'lucide-react';
import { EnglishOnlyCultureScope } from '../../core/culture/EnglishOnlyCultureScope';
import { AppButton } from './AppButton';
import { CreateEditModalShell, type CreateEditModalSize } from './CreateEditModalShell';
import {
  CONTENT_EDITOR_DIALOG_DEFAULT_SIZE,
  resolveContentEditorDialogShellClass,
} from './surfaceClasses';
import { DesignerRichTextToolbar } from './DesignerRichTextToolbar';
import { useMarkdownWysiwygEditor } from './useMarkdownWysiwygEditor';
import { resolveMarkdownEditorTextDirection } from './designerRichTextMarkdownDir';
import type { DesignerRichTextToolbarProps } from '../lib/designerRichTextConfig';
import { AiAutocompleteCaretGhost } from './ai-field-assist/AiAutocompleteCaretGhost';
import { AiTextContextMenu } from './ai-field-assist/AiTextContextMenu';
import { markdownAutocompleteCursorPosition } from './ai-field-assist/markdownEditorAssist';
import { useAiAssistGate } from './ai-field-assist/useAiAssistGate';
import { useAiFieldAutocomplete } from './ai-field-assist/useAiFieldAutocomplete';
import { useAiFieldEditHistory } from './ai-field-assist/useAiFieldEditHistory';
import { useAiTipTapAssistBindings } from './ai-field-assist/useAiTipTapAssistBindings';
import './designerRichTextEditor.css';

export const MARKDOWN_EDIT_DIALOG_TOOLBAR = {
  enableCodeBlock: true,
  enableTextDirection: true,
  enableImage: false,
  enableTable: false,
} as const;

export type MarkdownEditDialogProps = {
  open: boolean;
  title: string;
  initialValue: string;
  onSave: (value: string) => void;
  onClose: () => void;
  size?: CreateEditModalSize;
  shellClassName?: string;
  placeholder?: string;
  readOnly?: boolean;
  dir?: 'ltr' | 'rtl' | 'auto';
  toolbarProps?: DesignerRichTextToolbarProps;
};

const MarkdownEditDialogBody: React.FC<MarkdownEditDialogProps> = ({
  title,
  initialValue,
  onSave,
  onClose,
  size = CONTENT_EDITOR_DIALOG_DEFAULT_SIZE,
  shellClassName,
  placeholder = 'Write in Markdown…',
  readOnly = false,
  dir = 'auto',
  toolbarProps,
}) => {
  const [draft, setDraft] = useState(initialValue);
  const [bodyNode, setBodyNode] = useState<HTMLDivElement | null>(null);
  const editorRef = useRef<ReturnType<typeof useMarkdownWysiwygEditor>['editor']>(null);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    setDraft(initialValue);
  }, [initialValue]);

  const assistGate = useAiAssistGate({
    aiAssist: true,
    isControlDisabled: readOnly,
  });
  const editHistory = useAiFieldEditHistory();

  const getText = useCallback(() => draftRef.current, []);
  const getCursorPosition = useCallback(
    () => markdownAutocompleteCursorPosition(editorRef.current, draftRef.current),
    [],
  );

  const autocomplete = useAiFieldAutocomplete({
    enabled: assistGate.shouldAutocomplete,
    getText,
    getCursorPosition,
    fieldLabel: title,
    modelId: assistGate.defaultModelId,
    surface: 'admin',
  });

  const markdownChangeRef = useRef<(next: string) => void>(() => undefined);
  markdownChangeRef.current = (next) => {
    setDraft(next);
    if (assistGate.shouldAutocomplete) {
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
    fontSize,
  } = useMarkdownWysiwygEditor({
    value: draft,
    placeholder,
    editorHeight: '100%',
    readOnly,
    onChange: (next) => markdownChangeRef.current(next),
    ...MARKDOWN_EDIT_DIALOG_TOOLBAR,
    ...toolbarProps,
  });

  editorRef.current = editor;

  const applyValue = useCallback((nextValue: string) => {
    const active = editorRef.current;
    if (active) {
      active.commands.setContent(nextValue, false);
    }
    setDraft(nextValue);
  }, []);

  const handleApply = useCallback((nextValue: string, beforeValue: string) => {
    if (!assistGate.diffUndoDisabled) {
      editHistory.pushAppliedEdit(beforeValue, nextValue);
    }
    applyValue(nextValue);
  }, [applyValue, assistGate.diffUndoDisabled, editHistory]);

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

  const { handleEditorKeyDown } = useAiTipTapAssistBindings({
    shouldAutocomplete: assistGate.shouldAutocomplete,
    autocomplete,
    onAccept: (nextValue) => applyValue(nextValue),
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
    const full = draftRef.current;
    if (!text || !full.includes(text)) {
      return null;
    }
    const start = full.indexOf(text);
    return { start, end: start + text.length, text };
  }, []);

  const resolvedDir = resolveMarkdownEditorTextDirection(dir, draft);
  const showGhost = assistGate.shouldAutocomplete && Boolean(autocomplete.completion);

  const handleSave = () => {
    onSave(draft.trim());
    onClose();
  };

  const editorBody = (
    <div
      className="flex h-full min-h-0 flex-1 flex-col overflow-hidden"
      data-floating-panel-drag-exclude
      onKeyDown={handleEditorKeyDown}
    >
      <div
        ref={setBodyNode}
        className="designer-rich-text-editor designer-rich-text-editor--fill relative min-h-0 flex-1 overflow-hidden bg-white"
        data-designer-rich-text-editor="true"
        dir={resolvedDir}
      >
        <div className="relative min-h-0 flex-1 overflow-auto">
          {showGhost ? (
            <AiAutocompleteCaretGhost
              editor={editor}
              wrapper={bodyNode}
              completion={autocomplete.completion}
            />
          ) : null}
          <EditorContent
            editor={editor}
            className="h-full min-h-full px-[15px] py-3 text-slate-800"
            style={{ fontSize: `${fontSize}px` }}
          />
        </div>
      </div>
    </div>
  );

  return (
    <CreateEditModalShell
      size={size}
      title={title}
      subtitle={editor ? (
        <EnglishOnlyCultureScope>
          <DesignerRichTextToolbar
            editor={editor}
            toolbar={toolbar}
            readOnly={resolvedReadOnly}
            variant="embedded"
          />
        </EnglishOnlyCultureScope>
      ) : null}
      subtitleClassName="!p-0 text-inherit"
      gradient={false}
      onClose={onClose}
      onBackdropClick={onClose}
      bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !p-0"
      shellClassName={resolveContentEditorDialogShellClass(size, shellClassName)}
      footer={(
        <div className="flex justify-end gap-2">
          <AppButton intent="secondary" size="sm" onClick={onClose}>
            <X className="h-3.5 w-3.5" />
            Close
          </AppButton>
          <AppButton intent="primary" size="sm" onClick={handleSave} disabled={readOnly}>
            <Save className="h-3.5 w-3.5" />
            Save
          </AppButton>
        </div>
      )}
    >
      {assistGate.shouldAssistContextMenu ? (
        <AiTextContextMenu
          getText={getText}
          getSelection={getSelection}
          onApply={handleApply}
          fieldLabel={title}
          surface="admin"
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
    </CreateEditModalShell>
  );
};

export const MarkdownEditDialog: React.FC<MarkdownEditDialogProps> = (props) => {
  if (!props.open) {
    return null;
  }

  return <MarkdownEditDialogBody {...props} />;
};
