import React, { useCallback, useEffect, useRef, useState } from 'react';
import type { EuaAssistSurface, EuaContextNeighborField } from '../../api/contracts/ai/euaFieldAssist';
import { UiInputCore, type UiInputProps } from '../HeroFieldControls';
import { AiAutocompleteGhostLayer } from './AiAutocompleteGhostLayer';
import { AiTextContextMenu } from './AiTextContextMenu';
import { ensureEuaStatusLoaded } from './euaStatusCache';
import {
  findInputElement,
  isAiAssistInputType,
  readInputCursorPosition,
  readInputSelection,
  readInputValue,
  writeInputValue,
} from './inputValue';
import { useAiContextPlaceholder } from './useAiContextPlaceholder';
import { useAiFieldAutocomplete } from './useAiFieldAutocomplete';
import { useAiFieldEditHistory } from './useAiFieldEditHistory';
import {
  useEuaDefaultModelId,
  useEuaFieldAssistReady,
  useEuaStatusSnapshot,
} from './useEuaCapability';

export type AiAssistInputProps = UiInputProps & {
  aiAssist?: boolean;
  aiAssistSurface?: EuaAssistSurface;
  /** Ghost Tab-to-complete, same as `UiTextarea`. Off by default so search/identifier fields stay quiet. */
  aiAutocomplete?: boolean;
  fieldLabel?: string;
  contextSuggest?: boolean;
  sectionTitle?: string;
  sectionDescription?: string;
  neighborFields?: EuaContextNeighborField[];
};

export const AiAssistInput: React.FC<AiAssistInputProps> = ({
  aiAssist = true,
  aiAssistSurface = 'admin',
  aiAutocomplete = false,
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
  type,
  readOnly,
  ...rest
}) => {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [wrapperNode, setWrapperNode] = useState<HTMLDivElement | null>(null);
  const status = useEuaStatusSnapshot();
  const actionsEnabled = useEuaFieldAssistReady();
  const defaultModelId = useEuaDefaultModelId();
  const editHistory = useAiFieldEditHistory();
  const isControlDisabled = Boolean(disabled ?? isDisabled);
  const singleLineDisabled = status?.capabilities['eua.singleLineAssist'] === false;
  const autocompleteDisabled = status?.capabilities['eua.autocomplete'] === false;
  const contextSuggestDisabled = status?.capabilities['eua.contextSuggest'] === false;
  const diffUndoDisabled = status?.capabilities['eua.diffUndo'] === false;
  const assistableType = isAiAssistInputType(type);
  const shouldEnableAssist = aiAssist && !isControlDisabled && !readOnly && assistableType;
  const shouldAssist = shouldEnableAssist && !singleLineDisabled;
  const shouldAutocomplete = shouldEnableAssist && aiAutocomplete && !autocompleteDisabled && actionsEnabled;
  const shouldContextSuggest = shouldEnableAssist && contextSuggest && !contextSuggestDisabled && actionsEnabled;
  const resolvedFieldLabel = fieldLabel ?? ariaLabel ?? placeholder;
  const controlledValue = value !== undefined ? String(value) : undefined;

  const aiGeneratedPlaceholder = useAiContextPlaceholder({
    enabled: shouldContextSuggest,
    fieldLabel: resolvedFieldLabel,
    fieldKind: 'singleLine',
    sectionTitle,
    sectionDescription,
    neighborFields,
    currentValue: controlledValue,
    hasExplicitPlaceholder: Boolean(placeholder?.trim()),
    modelId: defaultModelId,
    surface: aiAssistSurface,
  });
  const resolvedPlaceholder = placeholder ?? aiGeneratedPlaceholder;

  useEffect(() => {
    if (shouldEnableAssist) {
      void ensureEuaStatusLoaded();
    }
  }, [shouldEnableAssist]);

  const getInput = useCallback(
    () => findInputElement(wrapperRef.current),
    [],
  );

  const getText = useCallback(
    () => readInputValue(getInput(), value),
    [getInput, value],
  );

  const getSelection = useCallback(() => {
    const selection = readInputSelection(getInput());
    if (!selection) {
      return null;
    }
    return selection;
  }, [getInput]);

  const getCursorPosition = useCallback(
    () => readInputCursorPosition(getInput()),
    [getInput],
  );

  const applyValue = useCallback((nextValue: string) => {
    writeInputValue(getInput(), nextValue, onChange);
  }, [getInput, onChange]);

  const autocomplete = useAiFieldAutocomplete({
    enabled: shouldAutocomplete,
    getText,
    getCursorPosition,
    fieldLabel: resolvedFieldLabel,
    modelId: defaultModelId,
    surface: aiAssistSurface,
  });

  const setWrapperRef = useCallback((node: HTMLDivElement | null) => {
    wrapperRef.current = node;
    setWrapperNode(node);
  }, []);

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

  const handleChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(event);
    if (shouldAutocomplete) {
      autocomplete.handleInputChange({
        text: event.target.value,
        cursorPosition: event.target.selectionStart ?? event.target.value.length,
      });
    }
  }, [autocomplete, onChange, shouldAutocomplete]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLInputElement>) => {
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
  ]);

  const showGhost = shouldAutocomplete && Boolean(autocomplete.completion);
  const ghostDisplayValue = showGhost ? getText() : '';
  const interceptKeys = shouldAssist || shouldAutocomplete;

  const inputElement = (
    <div ref={setWrapperRef} className="relative w-full">
      {showGhost ? (
        <AiAutocompleteGhostLayer
          wrapper={wrapperNode}
          value={ghostDisplayValue}
          completion={autocomplete.completion}
        />
      ) : null}
      <UiInputCore
        {...rest}
        type={type}
        value={value}
        onChange={handleChange}
        onKeyDown={interceptKeys ? handleKeyDown : onKeyDown}
        disabled={disabled}
        isDisabled={isDisabled}
        readOnly={readOnly}
        ariaLabel={ariaLabel}
        placeholder={resolvedPlaceholder}
        aiAssist={false}
      />
    </div>
  );

  if (!shouldAssist) {
    return inputElement;
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
      menuVariant="single-line"
      canUndoAiEdit={!diffUndoDisabled && editHistory.canUndo}
      canRedoAiEdit={!diffUndoDisabled && editHistory.canRedo}
      onUndoAiEdit={diffUndoDisabled ? undefined : handleUndoAiEdit}
      onRedoAiEdit={diffUndoDisabled ? undefined : handleRedoAiEdit}
    >
      {inputElement}
    </AiTextContextMenu>
  );
};

/** Default input export — includes EUA single-line assist when enabled. */
export const UiInput = AiAssistInput;
