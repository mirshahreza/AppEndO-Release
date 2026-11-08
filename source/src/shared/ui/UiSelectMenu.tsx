import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { ListBox, Select } from '@heroui/react';
import { cn } from '../../lib/utils';
import {
  useFixedDropDownMenuStyle,
} from './AppSplitButton';
import { useIsInsideDialogHost } from './dialog/DialogHostContext';
import { useDesignerDialogHost } from './designerDialogHostContext';
import {
  HEROUI_FIELD_RADIUS_CLASS,
  resolveHeroUiFieldSelectTriggerClass,
  resolveHeroUiFieldSelectValueClass,
  resolveHeroUiNativeSelectClass,
} from './heroFieldChrome';
import { NativeButton } from './NativeButton';
import type { HeroUiFieldSize } from './heroFieldSize';

const HeroSelect = Select as any;
const HeroListBox = ListBox as any;

/** Body-portaled select menu — no overlay-motion (avoids stretched empty panel chrome). */
const UI_SELECT_MENU_PORTAL_PANEL_CLASS =
  'fixed rounded-md border border-slate-200 bg-white py-0.5 shadow-lg';

export type UiSelectMenuOption = {
  id: string;
  textValue: string;
  content: React.ReactNode;
  className?: string;
};

export type UiSelectMenuProps = {
  ariaLabel: string;
  selectedKey?: string;
  isDisabled?: boolean;
  size?: HeroUiFieldSize;
  /** `Select` root className. */
  className?: string;
  triggerClassName?: string;
  valueClassName?: string;
  indicatorClassName?: string;
  popoverClassName?: string;
  popoverPlacement?: string;
  popoverShouldFlip?: boolean;
  listBoxClassName?: string;
  options: UiSelectMenuOption[];
  onSelectionChange: (key: string) => void;
  /** Custom trigger value content — falls back to HeroUI's default `Select.Value` + `placeholder`. */
  renderValue?: (selected: UiSelectMenuOption | undefined) => React.ReactNode;
  placeholder?: string;
  /**
   * When `auto`, body-portaled fixed menus replace HeroUI popovers inside dialog shells.
   * HeroUI popovers break inside overflow-hidden modal bodies (stretched listboxes).
   */
  portaledMenu?: boolean | 'auto';
};

const UiSelectMenuPortaled: React.FC<UiSelectMenuProps> = ({
  ariaLabel,
  selectedKey,
  isDisabled,
  size = 'sm',
  className,
  triggerClassName,
  valueClassName,
  listBoxClassName,
  options,
  onSelectionChange,
  renderValue,
  placeholder,
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const panelStyle = useFixedDropDownMenuStyle(open, triggerRef, {
    align: 'start',
    flip: true,
    matchAnchorWidth: true,
    panelRef,
  });
  const selected = options.find((option) => option.id === selectedKey);
  const resolvedTriggerClass = cn(
    resolveHeroUiFieldSelectTriggerClass({ size }),
    triggerClassName,
  );
  const resolvedValueClass = cn(resolveHeroUiFieldSelectValueClass(size), valueClassName);

  useEffect(() => {
    if (!open) {
      return;
    }
    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const panel = open ? (
    <div
      ref={panelRef}
      className={cn(
        UI_SELECT_MENU_PORTAL_PANEL_CLASS,
        HEROUI_FIELD_RADIUS_CLASS,
        listBoxClassName,
        'z-[1100] w-max min-w-0 max-w-[min(100vw-1rem,28rem)] overflow-y-auto',
      )}
      style={panelStyle}
      role="listbox"
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        option.id ? (
          <NativeButton
            key={option.id}
            type="button"
            role="option"
            aria-selected={option.id === selectedKey}
            className={cn(
              'flex w-full min-w-0 px-2.5 py-1.5 text-start text-xs font-medium text-slate-700',
              option.className,
              option.id === selectedKey
                ? 'bg-indigo-50 text-indigo-700'
                : 'hover:bg-slate-50 hover:text-indigo-700',
            )}
            onClick={() => {
              setOpen(false);
              onSelectionChange(option.id);
            }}
          >
            <span className="min-w-0 flex-1 truncate">{option.content ?? option.textValue}</span>
          </NativeButton>
        ) : null
      ))}
    </div>
  ) : null;

  const triggerValue = renderValue
    ? renderValue(selected)
    : (
      <span className={resolvedValueClass}>
        {selected?.textValue ?? placeholder ?? ''}
      </span>
    );

  return (
    <div className={cn('min-w-0', className)}>
      <NativeButton
        ref={triggerRef}
        type="button"
        className={resolvedTriggerClass}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isDisabled}
        onClick={() => setOpen((current) => !current)}
      >
        {triggerValue}
        <ChevronDown className="ms-auto h-3.5 w-3.5 shrink-0 text-slate-500" aria-hidden />
      </NativeButton>
      {typeof document !== 'undefined' && panel ? createPortal(panel, document.body) : null}
    </div>
  );
};

const UiSelectMenuNative: React.FC<UiSelectMenuProps> = ({
  ariaLabel,
  selectedKey,
  isDisabled,
  size = 'sm',
  className,
  triggerClassName,
  options,
  onSelectionChange,
  placeholder,
}) => {
  const resolvedClass = cn(resolveHeroUiNativeSelectClass({ size }), triggerClassName);
  const value = selectedKey ?? '';

  return (
    <select
      aria-label={ariaLabel}
      className={cn(resolvedClass, className)}
      value={value}
      disabled={isDisabled}
      onChange={(event) => onSelectionChange(event.target.value)}
    >
      {placeholder && !selectedKey ? <option value="">{placeholder}</option> : null}
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.textValue}
        </option>
      ))}
    </select>
  );
};

/**
 * Lower-level `Select`/`ListBox` composition wrapper for call sites needing custom
 * option/trigger content (icon + label rows) — `UiSelect` in `HeroFieldControls.tsx`
 * only flattens plain-text `<option>` children.
 */
export const UiSelectMenu: React.FC<UiSelectMenuProps> = ({
  portaledMenu = 'auto',
  ...props
}) => {
  const insideDialogHost = useIsInsideDialogHost();
  const insideDesignerDialog = useDesignerDialogHost();
  const usePortaledMenu = portaledMenu === 'auto' ? insideDialogHost : portaledMenu;

  if (insideDesignerDialog) {
    return <UiSelectMenuNative {...props} />;
  }

  if (usePortaledMenu) {
    return <UiSelectMenuPortaled {...props} />;
  }

  const {
    ariaLabel,
    selectedKey,
    isDisabled,
    size = 'sm',
    className,
    triggerClassName,
    valueClassName,
    indicatorClassName,
    popoverClassName,
    popoverPlacement,
    popoverShouldFlip,
    listBoxClassName,
    options,
    onSelectionChange,
    renderValue,
    placeholder,
  } = props;

  const selected = options.find((option) => option.id === selectedKey);

  return (
    <HeroSelect
      aria-label={ariaLabel}
      selectedKey={selectedKey}
      isDisabled={isDisabled}
      variant="secondary"
      size={size}
      className={cn('w-full', className)}
      onSelectionChange={(key: React.Key) => {
        if (key !== undefined && key !== null) {
          onSelectionChange(String(key));
        }
      }}
    >
      <HeroSelect.Trigger className={triggerClassName}>
        {renderValue ? (
          renderValue(selected)
        ) : (
          <HeroSelect.Value className={valueClassName} placeholder={placeholder} />
        )}
        <HeroSelect.Indicator className={indicatorClassName} />
      </HeroSelect.Trigger>

      <HeroSelect.Popover className={popoverClassName} placement={popoverPlacement} shouldFlip={popoverShouldFlip}>
        <HeroListBox className={listBoxClassName}>
          {options.map((option) => (
            <HeroListBox.Item key={option.id} id={option.id} textValue={option.textValue} className={option.className}>
              {option.content}
            </HeroListBox.Item>
          ))}
        </HeroListBox>
      </HeroSelect.Popover>
    </HeroSelect>
  );
};
