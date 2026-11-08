import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { EuaAssistSurface, EuaContextNeighborField, EuaFieldKind } from '../../api/contracts/ai/euaFieldAssist';
import { suggestFieldContext, transformFieldText } from '../../api/queries/euaFieldAssist';
import {
  SPLIT_BUTTON_MENU_ITEM_CLASS,
  SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS,
  useFixedDropDownMenuStyle,
  useSplitButtonMenu,
} from '../AppSplitButton';
import { ICON_ACTION_BUTTON_XS_CLASS } from '../surfaceClasses';
import { AiEditPreviewDialog } from './AiEditPreviewDialog';

export type AiContextSuggestLabelButtonProps = {
  fieldLabel: string;
  fieldKind?: EuaFieldKind;
  sectionTitle?: string;
  sectionDescription?: string;
  neighborFields?: EuaContextNeighborField[];
  getValue: () => string;
  onApply: (nextValue: string, beforeValue: string) => void;
  surface?: EuaAssistSurface;
  modelId?: string;
  disabled?: boolean;
  actionsEnabled?: boolean;
};

const MENU_ITEM_DISABLED_CLASS =
  'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-slate-600';

function normalizeFieldText(text: string, fieldKind?: EuaFieldKind): string {
  if (fieldKind !== 'singleLine') {
    return text;
  }
  return text.replace(/\s*[\r\n]+\s*/g, ' ').trim();
}

type AssistantAction = 'suggest' | 'expand';

export const AiContextSuggestLabelButton: React.FC<AiContextSuggestLabelButtonProps> = ({
  fieldLabel,
  fieldKind,
  sectionTitle,
  sectionDescription,
  neighborFields,
  getValue,
  onApply,
  surface = 'admin',
  modelId,
  disabled = false,
  actionsEnabled = false,
}) => {
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const extraContainRefs = useMemo(() => [triggerRef], []);
  const menuRef = useSplitButtonMenu(menuOpen, setMenuOpen, extraContainRefs);
  const menuStyle = useFixedDropDownMenuStyle(menuOpen, triggerRef, {
    align: 'end',
    minWidth: 160,
    flip: true,
    panelRef: menuRef,
  });

  const [isRunning, setIsRunning] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewTitle, setPreviewTitle] = useState(`AI suggest — ${fieldLabel}`);
  const [beforeText, setBeforeText] = useState('');
  const [afterText, setAfterText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const canRun = !disabled && actionsEnabled && Boolean(modelId);

  const runAction = useCallback(async (action: AssistantAction) => {
    if (!canRun || !modelId) {
      return;
    }

    const currentValue = getValue();
    const title = action === 'expand' ? `Expand Text — ${fieldLabel}` : `AI suggest — ${fieldLabel}`;
    setPreviewTitle(title);
    setBeforeText(currentValue);
    setAfterText('');
    setError(null);
    setPreviewOpen(true);

    if (action === 'expand' && !currentValue.trim()) {
      setError('Enter some text before using Expand Text.');
      return;
    }

    setIsRunning(true);

    try {
      if (action === 'expand') {
        const result = await transformFieldText({
          action: 'expand',
          text: currentValue,
          surface,
          fieldLabel,
          modelId,
          fieldKind,
        });
        setAfterText(normalizeFieldText(result.text, fieldKind));
        return;
      }

      const result = await suggestFieldContext({
        mode: 'content',
        fieldLabel,
        fieldKind,
        sectionTitle,
        sectionDescription,
        neighborFields,
        currentValue,
        modelId,
        surface,
      });
      setAfterText(result.suggestion);
    } catch (assistError) {
      const fallback = action === 'expand' ? 'AI expand failed.' : 'AI suggest failed.';
      const message = assistError instanceof Error ? assistError.message : fallback;
      setError(message);
    } finally {
      setIsRunning(false);
    }
  }, [
    canRun,
    fieldKind,
    fieldLabel,
    getValue,
    modelId,
    neighborFields,
    sectionDescription,
    sectionTitle,
    surface,
  ]);

  const handleApply = useCallback(() => {
    if (!afterText.trim() || beforeText === afterText) {
      return;
    }
    onApply(afterText, beforeText);
    setPreviewOpen(false);
    setError(null);
  }, [afterText, beforeText, onApply]);

  const renderMenuItem = (id: AssistantAction, label: string) => (
    <button
      key={id}
      type="button"
      role="menuitem"
      disabled={!canRun}
      className={cn(SPLIT_BUTTON_MENU_ITEM_CLASS, !canRun && MENU_ITEM_DISABLED_CLASS)}
      onClick={() => {
        if (!canRun) return;
        setMenuOpen(false);
        void runAction(id);
      }}
    >
      {label}
    </button>
  );

  const menu = menuOpen
    ? createPortal(
      <div
        ref={menuRef}
        role="menu"
        aria-label={`AI assistant for ${fieldLabel}`}
        className={cn(SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS, 'min-w-[10rem]')}
        style={menuStyle}
      >
        <div className="border-b border-slate-100 px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-600">
          <span className="inline-flex items-center gap-1.5">
            <Sparkles className="h-3 w-3" aria-hidden />
            AI assistant
          </span>
        </div>
        {renderMenuItem('suggest', 'Suggest')}
        {renderMenuItem('expand', 'Expand Text')}
      </div>,
      document.body,
    )
    : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        tabIndex={-1}
        className={cn(
          ICON_ACTION_BUTTON_XS_CLASS,
          'text-indigo-500 hover:text-indigo-700',
          !canRun && 'cursor-not-allowed opacity-45',
        )}
        disabled={!canRun || isRunning}
        aria-label={`AI assistant for ${fieldLabel}`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        title={canRun ? 'AI assistant' : 'AI assistant unavailable'}
        onClick={() => {
          if (!canRun || isRunning) return;
          setMenuOpen((open) => !open);
        }}
      >
        {isRunning ? (
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="h-3 w-3" aria-hidden />
        )}
      </button>
      {menu}

      <AiEditPreviewDialog
        open={previewOpen}
        title={previewTitle}
        beforeText={beforeText}
        afterText={afterText}
        isApplying={false}
        error={error ?? undefined}
        onClose={() => {
          if (!isRunning) {
            setPreviewOpen(false);
            setError(null);
          }
        }}
        onApply={handleApply}
      />
    </>
  );
};
