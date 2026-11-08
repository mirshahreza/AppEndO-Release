import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { EuaAssistSurface, EuaFieldKind, EuaTransformAction } from '../../api/contracts/ai/euaFieldAssist';
import { transformFieldText } from '../../api/queries/euaFieldAssist';
import {
  SPLIT_BUTTON_MENU_ITEM_CLASS,
  SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS,
  useSplitButtonMenu,
} from '../AppSplitButton';
import { AiCustomPromptDialog } from './AiCustomPromptDialog';
import { AiEditPreviewDialog } from './AiEditPreviewDialog';

type MenuAction = {
  id: string;
  label: string;
  action: EuaTransformAction;
  targetLanguage?: string;
};

const MULTILINE_TEXT_ACTIONS: MenuAction[] = [
  { id: 'expand', label: 'Expand Text', action: 'expand' },
  { id: 'summarize', label: 'Summarize', action: 'summarize' },
  { id: 'formal', label: 'Make formal', action: 'formal' },
  { id: 'casual', label: 'Make casual', action: 'casual' },
  { id: 'spell', label: 'Fix spelling & grammar', action: 'spell-grammar' },
  { id: 'markdown', label: 'Format as markdown', action: 'markdown-format' },
];

const SINGLE_LINE_TEXT_ACTIONS: MenuAction[] = [
  { id: 'expand', label: 'Expand Text', action: 'expand' },
  { id: 'spell', label: 'Fix spelling & grammar', action: 'spell-grammar' },
  { id: 'formal', label: 'Make formal', action: 'formal' },
  { id: 'casual', label: 'Make casual', action: 'casual' },
];

const TRANSLATE_ACTIONS: MenuAction[] = [
  { id: 'translate-en', label: 'Translate to English', action: 'translate', targetLanguage: 'English' },
  { id: 'translate-fa', label: 'Translate to Persian', action: 'translate', targetLanguage: 'Persian' },
  { id: 'translate-ar', label: 'Translate to Arabic', action: 'translate', targetLanguage: 'Arabic' },
];

export type AiTextContextMenuProps = {
  children: React.ReactNode;
  getText: () => string;
  getSelection: () => { start: number; end: number; text: string } | null;
  onApply: (nextValue: string, beforeValue: string) => void;
  fieldLabel?: string;
  surface?: EuaAssistSurface;
  disabled?: boolean;
  actionsEnabled?: boolean;
  defaultModelId?: string;
  canUndoAiEdit?: boolean;
  canRedoAiEdit?: boolean;
  onUndoAiEdit?: () => void;
  onRedoAiEdit?: () => void;
  /** Compact menu + single-line prompts for `UiInput` (EUA-4). */
  menuVariant?: 'multiline' | 'single-line';
};

function normalizeFieldText(text: string, fieldKind?: EuaFieldKind): string {
  if (fieldKind !== 'singleLine') {
    return text;
  }
  return text.replace(/\s*[\r\n]+\s*/g, ' ').trim();
}

const MENU_ITEM_DISABLED_CLASS =
  'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-slate-600';

type PendingTransform = {
  action: EuaTransformAction;
  customPrompt?: string;
  targetLanguage?: string;
  title: string;
};

export const AiTextContextMenu: React.FC<AiTextContextMenuProps> = ({
  children,
  getText,
  getSelection,
  onApply,
  fieldLabel,
  surface = 'admin',
  disabled = false,
  actionsEnabled = false,
  defaultModelId,
  canUndoAiEdit = false,
  canRedoAiEdit = false,
  onUndoAiEdit,
  onRedoAiEdit,
  menuVariant = 'multiline',
}) => {
  const fieldKind: EuaFieldKind | undefined = menuVariant === 'single-line' ? 'singleLine' : undefined;
  const textActions = menuVariant === 'single-line' ? SINGLE_LINE_TEXT_ACTIONS : MULTILINE_TEXT_ACTIONS;
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const menuRef = useSplitButtonMenu(menuOpen, setMenuOpen);

  const [previewTitle, setPreviewTitle] = useState('AI edit preview');
  const [customPromptOpen, setCustomPromptOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [beforeText, setBeforeText] = useState('');
  const [afterText, setAfterText] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assistActive = !disabled;
  const canRunActions = assistActive && actionsEnabled;

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    setMenuPosition(null);
  }, []);

  const handleContextMenu = useCallback((event: React.MouseEvent) => {
    if (!assistActive) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    setMenuPosition({ x: event.clientX, y: event.clientY });
    setMenuOpen(true);
  }, [assistActive]);

  const runTransform = useCallback(async (transform: PendingTransform) => {
    if (!canRunActions || !defaultModelId) {
      setError('No chat-capable AI model is configured. Enable a chat model in Settings → AI Models.');
      setPreviewTitle(transform.title);
      setPreviewOpen(true);
      return;
    }

    const fullText = getText();
    const selection = getSelection();
    const sourceSelection = selection?.text?.trim() ? selection.text : undefined;

    if (!fullText.trim() && !sourceSelection?.trim()) {
      setError('Enter some text before using AI assist.');
      setPreviewTitle(transform.title);
      setBeforeText('');
      setAfterText('');
      setPreviewOpen(true);
      return;
    }

    setPreviewTitle(transform.title);
    setIsRunning(true);
    setError(null);
    setBeforeText(fullText);

    try {
      const response = await transformFieldText({
        action: transform.action,
        text: fullText,
        selection: sourceSelection,
        selectionStart: selection?.start,
        selectionEnd: selection?.end,
        customPrompt: transform.customPrompt,
        targetLanguage: transform.targetLanguage,
        surface,
        fieldLabel,
        modelId: defaultModelId,
        fieldKind,
      });
      setAfterText(normalizeFieldText(response.text, fieldKind));
      setPreviewOpen(true);
    } catch (transformError) {
      const message = transformError instanceof Error ? transformError.message : 'AI transform failed.';
      setError(message);
      setPreviewOpen(true);
    } finally {
      setIsRunning(false);
      setCustomPromptOpen(false);
    }
  }, [canRunActions, defaultModelId, fieldKind, fieldLabel, getSelection, getText, surface]);

  const handleMenuAction = useCallback((item: MenuAction) => {
    closeMenu();
    const transform: PendingTransform = {
      action: item.action,
      targetLanguage: item.targetLanguage,
      title: item.label,
    };
    setPreviewTitle(item.label);
    void runTransform(transform);
  }, [closeMenu, runTransform]);

  const renderMenuItem = (item: MenuAction) => (
    <button
      key={item.id}
      type="button"
      role="menuitem"
      disabled={!canRunActions}
      className={cn(SPLIT_BUTTON_MENU_ITEM_CLASS, !canRunActions && MENU_ITEM_DISABLED_CLASS)}
      onClick={() => {
        if (!canRunActions) return;
        handleMenuAction(item);
      }}
    >
      {item.label}
    </button>
  );

  const handleCustomPromptSubmit = useCallback((prompt: string) => {
    const transform: PendingTransform = {
      action: 'custom',
      customPrompt: prompt,
      title: 'Custom AI edit',
    };
    setPreviewTitle(transform.title);
    void runTransform(transform);
  }, [runTransform]);

  const handleApplyPreview = useCallback(() => {
    if (!afterText.trim() || beforeText === afterText) {
      return;
    }
    onApply(afterText, beforeText);
    setPreviewOpen(false);
    setBeforeText('');
    setAfterText('');
    setError(null);
  }, [afterText, beforeText, onApply]);

  const menu = menuOpen && menuPosition && assistActive
    ? createPortal(
      <div
        ref={menuRef}
        role="menu"
        className={cn(SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS, 'min-w-[12rem]')}
        style={{ left: menuPosition.x, top: menuPosition.y }}
      >
        <div className="border-b border-slate-100 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" aria-hidden />
            AI assistant
          </span>
        </div>
        {!canRunActions ? (
          <div className="px-2.5 py-1.5 text-[10px] leading-snug text-slate-500">
            No chat-capable AI model is configured. Check Settings → AI Models.
          </div>
        ) : null}
        {textActions.map(renderMenuItem)}
        <div className="my-1 border-t border-slate-100" />
        {TRANSLATE_ACTIONS.map(renderMenuItem)}
        <div className="my-1 border-t border-slate-100" />
        <button
          type="button"
          role="menuitem"
          disabled={!canRunActions}
          className={cn(SPLIT_BUTTON_MENU_ITEM_CLASS, !canRunActions && MENU_ITEM_DISABLED_CLASS)}
          onClick={() => {
            if (!canRunActions) return;
            closeMenu();
            setCustomPromptOpen(true);
          }}
        >
          Edit with prompt…
        </button>
        {canUndoAiEdit || canRedoAiEdit ? (
          <>
            <div className="my-1 border-t border-slate-100" />
            <button
              type="button"
              role="menuitem"
              disabled={!canUndoAiEdit}
              className={cn(SPLIT_BUTTON_MENU_ITEM_CLASS, !canUndoAiEdit && MENU_ITEM_DISABLED_CLASS)}
              onClick={() => {
                if (!canUndoAiEdit) return;
                closeMenu();
                onUndoAiEdit?.();
              }}
            >
              Undo AI edit
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={!canRedoAiEdit}
              className={cn(SPLIT_BUTTON_MENU_ITEM_CLASS, !canRedoAiEdit && MENU_ITEM_DISABLED_CLASS)}
              onClick={() => {
                if (!canRedoAiEdit) return;
                closeMenu();
                onRedoAiEdit?.();
              }}
            >
              Redo AI edit
            </button>
          </>
        ) : null}
      </div>,
      document.body,
    )
    : null;

  const busyOverlay = isRunning
    ? createPortal(
      <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/10">
        <div className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 shadow-lg">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden />
          Running AI edit…
        </div>
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <div onContextMenu={handleContextMenu} className="contents">
        {children}
      </div>
      {menu}
      {busyOverlay}
      <AiCustomPromptDialog
        open={customPromptOpen}
        isRunning={isRunning}
        error={error ?? undefined}
        onClose={() => {
          if (!isRunning) {
            setCustomPromptOpen(false);
            setError(null);
          }
        }}
        onSubmit={handleCustomPromptSubmit}
      />
      <AiEditPreviewDialog
        open={previewOpen}
        title={previewTitle}
        beforeText={beforeText}
        afterText={afterText}
        isApplying={false}
        error={error ?? undefined}
        onClose={() => {
          setPreviewOpen(false);
          setError(null);
        }}
        onApply={handleApplyPreview}
      />
    </>
  );
};
