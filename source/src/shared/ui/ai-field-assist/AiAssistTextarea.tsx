import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { EuaAssistSurface, EuaContextNeighborField } from '../../api/contracts/ai/euaFieldAssist';
import { UiTextareaCore, type UiTextareaProps } from '../HeroFieldControls';
import { AiAutocompleteGhostLayer } from './AiAutocompleteGhostLayer';
import { AiTextContextMenu } from './AiTextContextMenu';
import { ensureEuaStatusLoaded } from './euaStatusCache';
import {
  findTextareaElement,
  readTextareaCursorPosition,
  readTextareaSelection,
  readTextareaValue,
  writeTextareaValue,
} from './textareaValue';
import { useAiContextPlaceholder } from './useAiContextPlaceholder';
import { useAiFieldAutocomplete } from './useAiFieldAutocomplete';
import { useAiFieldEditHistory } from './useAiFieldEditHistory';
import {
  useEuaDefaultModelId,
  useEuaFieldAssistReady,
  useEuaStatusSnapshot,
} from './useEuaCapability';

export type AiAssistTextareaProps = UiTextareaProps & {
  aiAssist?: boolean;
  aiAssistSurface?: EuaAssistSurface;
  fieldLabel?: string;
  contextSuggest?: boolean;
  sectionTitle?: string;
  sectionDescription?: string;
  neighborFields?: EuaContextNeighborField[];
};

const transparentTextareaSurfaceClass =
  '!bg-transparent hover:!bg-transparent data-[hover=true]:!bg-transparent';

export const AiAssistTextarea: React.FC<AiAssistTextareaProps> = ({
  aiAssist = true,
  aiAssistSurface = 'admin',
  fieldLabel,
  contextSuggest = false,
  sectionTitle,
  sectionDescription,
  neighborFields,
  value,
  onChange,
  onKeyDown,
  ariaLabel,
  placeholder,
  disabled,
  isDisabled,
  className,
  surfaceClassName,
  size = 'sm',
  dir,
  ...rest
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [wrapperNode, setWrapperNode] = useState<HTMLDivElement | null>(null);
  const status = useEuaStatusSnapshot();
  const actionsEnabled = useEuaFieldAssistReady();
  const defaultModelId = useEuaDefaultModelId();
  const editHistory = useAiFieldEditHistory();
  const isControlDisabled = Boolean(disabled ?? isDisabled);
  const contextMenuDisabled = status?.capabilities['eua.contextMenu'] === false;
  const autocompleteDisabled = status?.capabilities['eua.autocomplete'] === false;
  const contextSuggestDisabled = status?.capabilities['eua.contextSuggest'] === false;
  const diffUndoDisabled = status?.capabilities['eua.diffUndo'] === false;
  const shouldEnableAssist = aiAssist && !isControlDisabled;
  const shouldAssistContextMenu = shouldEnableAssist && !contextMenuDisabled;
  const shouldAutocomplete = shouldEnableAssist && !autocompleteDisabled && actionsEnabled;
  const shouldContextSuggest = shouldEnableAssist && contextSuggest && !contextSuggestDisabled && actionsEnabled;
  const resolvedFieldLabel = fieldLabel ?? ariaLabel ?? placeholder;
  const controlledValue = value !== undefined ? String(value) : undefined;

  const aiGeneratedPlaceholder = useAiContextPlaceholder({
    enabled: shouldContextSuggest,
    fieldLabel: resolvedFieldLabel,
    fieldKind: 'multiline',
    sectionTitle,
    sectionDescription,
    neighborFields,
    currentValue: controlledValue,
    hasExplicitPlaceholder: Boolean(placeholder?.trim()),
    modelId: defaultModelId,
    surface: aiAssistSurface,
  });
  const resolvedPlaceholder = placeholder ?? aiGeneratedPlaceholder;

  const setWrapperRef = useCallback((node: HTMLDivElement | null) => {
    wrapperRef.current = node;
    setWrapperNode(node);
  }, []);

  useEffect(() => {
    if (shouldEnableAssist) {
      void ensureEuaStatusLoaded();
    }
  }, [shouldEnableAssist]);

  const getTextarea = useCallback(
    () => findTextareaElement(wrapperRef.current),
    [],
  );

  const getText = useCallback(
    () => readTextareaValue(getTextarea(), value),
    [getTextarea, value],
  );

  const getCursorPosition = useCallback(
    () => readTextareaCursorPosition(getTextarea()),
    [getTextarea],
  );

  const getSelection = useCallback(() => {
    const selection = readTextareaSelection(getTextarea());
    if (!selection) {
      return null;
    }
    return selection;
  }, [getTextarea]);

  const applyValue = useCallback((nextValue: string) => {
    writeTextareaValue(getTextarea(), nextValue, onChange);
  }, [getTextarea, onChange]);

  const autocomplete = useAiFieldAutocomplete({
    enabled: shouldAutocomplete,
    getText,
    getCursorPosition,
    fieldLabel: resolvedFieldLabel,
    modelId: defaultModelId,
    surface: aiAssistSurface,
  });

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

  const handleChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange?.(event);
    if (shouldAutocomplete) {
      const cursorPosition = event.target.selectionStart ?? event.target.value.length;
      autocomplete.handleInputChange({
        text: event.target.value,
        cursorPosition,
      });
    }
  }, [autocomplete, onChange, shouldAutocomplete]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
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

    if (shouldAssistContextMenu && (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'a') {
      event.preventDefault();
      const element = findTextareaElement(wrapperNode);
      if (element) {
        const rect = element.getBoundingClientRect();
        element.dispatchEvent(new MouseEvent('contextmenu', {
          bubbles: true,
          cancelable: true,
          clientX: rect.left + 12,
          clientY: rect.top + 12,
        }));
      }
      return;
    }

    if (!diffUndoDisabled) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        if (event.shiftKey) {
          if (editHistory.canRedo) {
            event.preventDefault();
            handleRedoAiEdit();
            return;
          }
        } else if (editHistory.canUndo) {
          event.preventDefault();
          handleUndoAiEdit();
          return;
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'y' && editHistory.canRedo) {
        event.preventDefault();
        handleRedoAiEdit();
        return;
      }
    }

    onKeyDown?.(event);
  }, [
    applyValue,
    autocomplete,
    diffUndoDisabled,
    editHistory.canRedo,
    editHistory.canUndo,
    handleRedoAiEdit,
    handleUndoAiEdit,
    onKeyDown,
    shouldAutocomplete,
    shouldAssistContextMenu,
    wrapperNode,
  ]);

  const showGhost = shouldAutocomplete && Boolean(autocomplete.completion);
  const ghostDisplayValue = showGhost ? getText() : '';
  const textareaElement = (
    <div ref={setWrapperRef} className="relative w-full">
      {showGhost ? (
        <AiAutocompleteGhostLayer
          wrapper={wrapperNode}
          value={ghostDisplayValue}
          completion={autocomplete.completion}
        />
      ) : null}
      <UiTextareaCore
        {...rest}
        size={size}
        dir={dir}
        value={value}
        onChange={handleChange}
        onKeyDown={shouldAssistContextMenu || shouldAutocomplete ? handleKeyDown : onKeyDown}
        disabled={disabled}
        isDisabled={isDisabled}
        ariaLabel={ariaLabel}
        placeholder={resolvedPlaceholder}
        className={showGhost ? `relative z-10 ${className ?? ''}`.trim() : className}
        surfaceClassName={showGhost
          ? `${transparentTextareaSurfaceClass} ${surfaceClassName ?? ''}`.trim()
          : surfaceClassName}
        aiAssist={false}
      />
    </div>
  );

  if (!shouldAssistContextMenu) {
    return textareaElement;
  }

  return (
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
      {textareaElement}
    </AiTextContextMenu>
  );
};

/** Default textarea export — includes EUA context menu when enabled. */
export const UiTextarea = AiAssistTextarea;
