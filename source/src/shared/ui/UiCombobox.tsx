import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ComboBox, Input, ListBox } from '@heroui/react';
import { cn } from '../../lib/utils';
import {
  DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  FieldFeedbackShell,
  type FieldFeedbackPlacement,
} from './fieldFeedback';
import { useOptionalCulture } from '../../core/culture/CultureContext';
import {
  resolveAutoDirEnabled,
  resolveFieldMenuDirection,
  resolveFieldTextDirection,
  type FieldTextDir,
} from './fieldTextDirection';
import {
  type HeroUiFieldSize,
  HERO_UI_FIELD_TEXT_ALIGN_CLASS,
  resolveHeroUiFieldSizeTokens,
} from './heroFieldSize';
import { useDesignerDialogHost } from './designerDialogHostContext';

const HeroComboBox = ComboBox as any;
const HeroInput = Input as any;
const HeroListBox = ListBox as any;
import {
  HEROUI_FIELD_FOCUS_CLIP_CLASS,
  HEROUI_FIELD_RADIUS_CLASS,
  resolveHeroUiFieldInputClass,
} from './heroFieldChrome';

export type UiComboboxItem = {
  id: string;
  textValue: string;
};

export type UiComboboxProps = {
  name?: string;
  /** Selected item id (empty string = none). */
  value?: string;
  items?: UiComboboxItem[];
  onChange?: (event: { target: { value: string } }) => void;
  /** Fires as the user types in the filter input (not only on selection). */
  onInputValueChange?: (inputValue: string) => void;
  /** Enter or comma commits the typed text (custom tags). Caller should prevent duplicate handling. */
  onCommitInputValue?: (inputValue: string) => void;
  onBlur?: React.FocusEventHandler<HTMLElement>;
  placeholder?: string;
  className?: string;
  size?: HeroUiFieldSize;
  isDisabled?: boolean;
  disabled?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  feedbackPlacement?: FieldFeedbackPlacement;
  ariaLabel?: string;
  isLoading?: boolean;
  isPending?: boolean;
  /** Allow values not present in `items` (default false). */
  allowCustomValue?: boolean;
  /**
   * When the suggestion list opens.
   * - `focus` (default): open the full list on focus.
   * - `input`: keep the list closed until the user types; then show matches for the typed text.
   * - `manual`: open only from the chevron.
   */
  menuTrigger?: 'focus' | 'input' | 'manual';
  dir?: FieldTextDir;
  /** Default on; pass false for character-restricted identifiers. */
  autoDir?: boolean;
};

const defaultContainsFilter = (textValue: string, inputValue: string): boolean => {
  if (!inputValue.trim()) {
    return true;
  }
  return textValue.toLowerCase().includes(inputValue.trim().toLowerCase());
};

/**
 * Typeable combobox: inline text input + filtered dropdown (HeroUI ComboBox).
 * Inside a native designer `<dialog>`, uses an in-tree listbox (no portaled popover, no datalist).
 * Use instead of `UiSelect` / button-style `UiAutocomplete` when users need to type to filter.
 */
export const UiCombobox: React.FC<UiComboboxProps> = ({
  name,
  value = '',
  items = [],
  onChange,
  onInputValueChange,
  onCommitInputValue,
  onBlur,
  placeholder,
  className,
  size = 'sm',
  isDisabled,
  disabled,
  isInvalid,
  errorMessage,
  feedbackPlacement = DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  ariaLabel,
  isLoading,
  isPending,
  allowCustomValue = false,
  menuTrigger = 'focus',
  dir,
  autoDir,
}) => {
  const insideDesignerDialog = useDesignerDialogHost();
  const culture = useOptionalCulture();
  const menuDirection = resolveFieldMenuDirection(dir, culture?.direction);
  const reactId = useId();
  const listboxId = `${reactId.replace(/:/g, '')}-combo-list`;
  const isControlDisabled = Boolean(isDisabled ?? disabled);
  const sizeTokens = resolveHeroUiFieldSizeTokens(size);
  const selectedItem = useMemo(
    () => (value.trim() ? items.find((item) => item.id === value) ?? null : null),
    [items, value],
  );

  const [inputValue, setInputValue] = useState(() => selectedItem?.textValue ?? '');
  const [listOpen, setListOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  /**
   * `menuTrigger="focus"` reopens the list after a selection because the input stays focused.
   * Ignore that one immediate open; a 0ms timer clears the guard so a later chevron/focus works.
   */
  const suppressFocusReopenRef = useRef(false);
  const suppressFocusReopenTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const closeMenuAfterSelect = () => {
    setListOpen(false);
    if (menuTrigger !== 'focus') {
      return;
    }
    suppressFocusReopenRef.current = true;
    if (suppressFocusReopenTimerRef.current != null) {
      window.clearTimeout(suppressFocusReopenTimerRef.current);
    }
    suppressFocusReopenTimerRef.current = window.setTimeout(() => {
      suppressFocusReopenRef.current = false;
      suppressFocusReopenTimerRef.current = null;
    }, 0);
  };

  const handleOpenChange = (open: boolean) => {
    if (open && suppressFocusReopenRef.current) {
      suppressFocusReopenRef.current = false;
      if (suppressFocusReopenTimerRef.current != null) {
        window.clearTimeout(suppressFocusReopenTimerRef.current);
        suppressFocusReopenTimerRef.current = null;
      }
      return;
    }
    setListOpen(open);
  };

  useEffect(() => () => {
    if (suppressFocusReopenTimerRef.current != null) {
      window.clearTimeout(suppressFocusReopenTimerRef.current);
    }
  }, []);

  const dialogFilteredItems = useMemo(() => {
    const query = inputValue.trim().toLowerCase();
    if (!query) {
      return menuTrigger === 'input' ? [] : items;
    }
    return items.filter((item) => (
      item.textValue.toLowerCase().includes(query) || item.id.toLowerCase().includes(query)
    ));
  }, [inputValue, items, menuTrigger]);

  useEffect(() => {
    setInputValue(selectedItem?.textValue ?? (allowCustomValue ? value : ''));
  }, [allowCustomValue, selectedItem?.textValue, value]);

  const autoDirEnabled = resolveAutoDirEnabled(autoDir);
  const resolvedDir = resolveFieldTextDirection(dir, autoDirEnabled, inputValue, placeholder);
  const heroErrorMessage = feedbackPlacement === 'below' ? errorMessage : undefined;

  const inputGroupClassName = cn(
    'flex w-full min-w-0 items-center',
    resolveHeroUiFieldInputClass({ size, isInvalid }),
    className,
  );

  const inputClassName = cn(
    'min-w-0 flex-1 !border-0 !bg-transparent !shadow-none !px-0',
    sizeTokens.textClass,
    HERO_UI_FIELD_TEXT_ALIGN_CLASS,
    HEROUI_FIELD_FOCUS_CLIP_CLASS,
  );

  const handleInputChange = (next: string) => {
    suppressFocusReopenRef.current = false;
    setInputValue(next);
    onInputValueChange?.(next);
    if (insideDesignerDialog && items.length > 0) {
      if (menuTrigger === 'input') {
        setListOpen(next.trim().length > 0);
      } else if (menuTrigger === 'focus') {
        setListOpen(true);
      }
    }

    if (allowCustomValue) {
      onChange?.({ target: { value: next } });
      return;
    }

    // Typing clears a stale selection when the text no longer matches the selected label.
    if (selectedItem && next.trim() !== selectedItem.textValue) {
      onChange?.({ target: { value: '' } });
    }
  };

  const selectDialogItem = (item: UiComboboxItem) => {
    onChange?.({ target: { value: item.id } });
    setInputValue('');
    onInputValueChange?.('');
    closeMenuAfterSelect();
  };

  const commitTypedValue = () => {
    onCommitInputValue?.(inputValue);
    if (allowCustomValue) {
      closeMenuAfterSelect();
      return;
    }
    setInputValue('');
    onInputValueChange?.('');
  };

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (insideDesignerDialog) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setListOpen(false);
        return;
      }
      if (event.key === 'ArrowDown') {
        if (menuTrigger === 'input' && !inputValue.trim()) {
          return;
        }
        event.preventDefault();
        setListOpen(true);
        setHighlightIndex((current) => (
          dialogFilteredItems.length === 0
            ? 0
            : Math.min(current + 1, dialogFilteredItems.length - 1)
        ));
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightIndex((current) => Math.max(current - 1, 0));
        return;
      }
      if (event.key === 'Enter' || event.key === ',') {
        event.preventDefault();
        event.stopPropagation();
        if (inputValue.trim()) {
          commitTypedValue();
        } else if (dialogFilteredItems[highlightIndex]) {
          selectDialogItem(dialogFilteredItems[highlightIndex]);
        }
        setListOpen(false);
        return;
      }
      return;
    }

    if (!onCommitInputValue) {
      return;
    }
    if (event.key !== 'Enter' && event.key !== ',') {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    commitTypedValue();
    closeMenuAfterSelect();
  };

  const handleSelectionChange = (key: React.Key | null) => {
    if (key === undefined) {
      return;
    }
    if (key === null) {
      if (!allowCustomValue) {
        onChange?.({ target: { value: '' } });
      }
      return;
    }

    const nextId = String(key);
    onChange?.({ target: { value: nextId } });
    // Tags-list parents keep `value=""` and need the input cleared. Size pickers
    // (`allowCustomValue`) keep the selected id — write the label now so we don't flash
    // empty text, which reopens a `menuTrigger="focus"` list while the input is still focused.
    if (allowCustomValue) {
      const selected = items.find((item) => item.id === nextId);
      setInputValue(selected?.textValue ?? nextId);
    } else {
      setInputValue('');
    }
    closeMenuAfterSelect();
  };

  useEffect(() => {
    setHighlightIndex(0);
  }, [inputValue, listOpen]);

  if (insideDesignerDialog) {
    const showSuggestions = listOpen && !isControlDisabled && dialogFilteredItems.length > 0;
    return (
      <FieldFeedbackShell
        errorMessage={errorMessage}
        isInvalid={isInvalid}
        placement={feedbackPlacement}
      >
        <div className="relative w-full min-w-0 overflow-visible">
          {name ? <input type="hidden" name={name} value={value} readOnly /> : null}
          <div className={inputGroupClassName}>
            <input
              type="text"
              role="combobox"
              aria-expanded={showSuggestions}
              aria-controls={listboxId}
              aria-autocomplete="list"
              value={inputValue}
              disabled={isControlDisabled}
              placeholder={placeholder}
              dir={resolvedDir}
              aria-label={ariaLabel || placeholder || 'combobox'}
              aria-invalid={isInvalid || undefined}
              autoComplete="off"
              className={inputClassName}
              onChange={(event) => handleInputChange(event.target.value)}
              onKeyDown={handleInputKeyDown}
              onFocus={() => {
                if (suppressFocusReopenRef.current) {
                  return;
                }
                if (items.length > 0 && menuTrigger === 'focus') {
                  setListOpen(true);
                }
              }}
              onBlur={(event) => {
                setListOpen(false);
                onBlur?.(event);
              }}
            />
            {items.length > 0 && menuTrigger !== 'input' ? (
              <button
                type="button"
                tabIndex={-1}
                disabled={isControlDisabled}
                aria-label="Show suggestions"
                className="inline-flex h-full shrink-0 items-center justify-center px-2 text-slate-500"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setListOpen((open) => !open)}
              >
                <ChevronDown className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
          {showSuggestions ? (
            <ul
              id={listboxId}
              role="listbox"
              dir={menuDirection}
              className={cn(
                'absolute inset-x-0 top-full z-[1100] mt-0.5 max-h-40 overflow-auto py-1',
                HEROUI_FIELD_RADIUS_CLASS,
                'border border-slate-200 bg-white shadow-lg',
              )}
            >
              {dialogFilteredItems.map((item, index) => {
                const isActive = index === highlightIndex;
                return (
                  <li key={item.id} role="none">
                    <button
                      type="button"
                      role="option"
                      aria-selected={isActive}
                      className={cn(
                        'flex w-full items-center px-2 py-1.5 text-start text-xs text-slate-700',
                        isActive ? 'bg-indigo-50 text-indigo-800' : 'hover:bg-slate-50',
                      )}
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlightIndex(index)}
                      onClick={() => selectDialogItem(item)}
                    >
                      <span className="truncate">{item.textValue}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </FieldFeedbackShell>
    );
  }

  return (
    <FieldFeedbackShell
      errorMessage={errorMessage}
      isInvalid={isInvalid}
      placement={feedbackPlacement}
    >
      <div className="w-full min-w-0">
        {name ? <input type="hidden" name={name} value={value} readOnly /> : null}
        <HeroComboBox
          aria-label={ariaLabel || placeholder || 'combobox'}
          selectedKey={value.trim() ? value : null}
          inputValue={inputValue}
          isOpen={listOpen}
          onOpenChange={handleOpenChange}
          onInputChange={handleInputChange}
          onSelectionChange={handleSelectionChange}
          onBlur={onBlur}
          isDisabled={isControlDisabled}
          isInvalid={isInvalid}
          errorMessage={heroErrorMessage}
          isPending={Boolean(isPending ?? isLoading)}
          allowsCustomValue={allowCustomValue}
          allowsEmptyCollection
          menuTrigger={menuTrigger}
          defaultFilter={defaultContainsFilter}
          fullWidth
          variant="secondary"
          className="w-full min-w-0"
        >
          <HeroComboBox.InputGroup className={inputGroupClassName}>
            <HeroInput
              placeholder={placeholder}
              disabled={isControlDisabled}
              dir={resolvedDir}
              className={inputClassName}
              onKeyDown={handleInputKeyDown}
            />
            <HeroComboBox.Trigger
              className="inline-flex h-full shrink-0 items-center justify-center px-2 text-slate-500"
            />
          </HeroComboBox.InputGroup>
          <HeroComboBox.Popover
            dir={menuDirection}
            className={cn(HEROUI_FIELD_RADIUS_CLASS, 'z-[600]')}
          >
            <HeroListBox className={HEROUI_FIELD_RADIUS_CLASS} dir={menuDirection}>
              {items.map((item) => (
                <HeroListBox.Item
                  key={`combo-item:${item.id}`}
                  id={item.id}
                  textValue={item.textValue}
                  className="text-start"
                >
                  <span className="min-w-0 flex-1 truncate text-start">{item.textValue}</span>
                </HeroListBox.Item>
              ))}
            </HeroListBox>
          </HeroComboBox.Popover>
        </HeroComboBox>
      </div>
    </FieldFeedbackShell>
  );
};
