import React from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Autocomplete, Checkbox, Input, ListBox, Radio, RadioGroup, Select, TextArea } from '@heroui/react';
import type { DesignerAutocompleteItem } from '../../domain/component-designer/designerAutocompleteItems';
import { useOptionalCulture, useOptionalCultureT } from '../../core/culture/CultureContext';
import { cn } from '../../lib/utils';
import {
  formatLocalizedSelectValue,
  resolveNativeOptionLabel,
} from '../lib/formatLocalizedSelectValue';
import { pickPageGuideDomProps } from './shell/pageGuide/pageGuide.attrs';
import { PhoneNumberDisplay } from './PhoneNumberDisplay';
import { resolvePhoneContactLinks } from '../lib/phoneContactLinks';
import { useDesignerDialogHost } from './designerDialogHostContext';
import {
  DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  FieldFeedbackShell,
  type FieldFeedbackPlacement,
} from './fieldFeedback';
import { NavigationIcon } from '../lib/navigationIcons/NavigationIcon';
import { isExplicitNavigationIconRef } from '../lib/navigationIcons/navigationIconRef';
import { resolveHeroUiFieldBorderClass } from './surfaceClasses';
import {
  HEROUI_FIELD_FOCUS_CLIP_CLASS,
  HEROUI_FIELD_RADIUS_CLASS,
  HEROUI_FIELD_SURFACE_CLASS,
  resolveHeroUiFieldInputClass,
  resolveHeroUiFieldTextareaClass,
  resolveHeroUiFieldSelectTriggerClass,
  resolveHeroUiFieldSelectValueClass,
  resolveHeroUiNativeSelectClass,
} from './heroFieldChrome';
import {
  HERO_UI_FIELD_VALUE_CLASS,
  type HeroUiFieldSize,
  resolveHeroUiFieldSizeTokens,
} from './heroFieldSize';
import {
  resolveAutoDirEnabled,
  resolveFieldTextDirection,
  toFieldTextValue,
  type FieldTextDir,
} from './fieldTextDirection';
import {
  FIELD_NUMERIC_DATE_INPUT_CENTER_CLASS,
  isNumericOrDateFieldInput,
} from '../lib/fieldNumericDateAlign';
import { UiCombobox } from './UiCombobox';
import { FormAccessorySlot } from './formTabOrder';
import { FORM_FIELD_LABEL_CLASS } from './FormSection';

export type { HeroUiFieldSize } from './heroFieldSize';
export type { FieldTextDir } from './fieldTextDirection';

/** HeroUI select popovers inside portaled shells (pickers, dialogs). */
const NESTED_FIELD_POPOVER_Z_CLASS = 'z-[1100]';
const NESTED_FIELD_POPOVER_SURFACE_CLASS = 'border border-slate-200 bg-white shadow-lg';

/** Label-over-input chrome — same token as `FormField` / Base Components text-fields. */
const renderFieldLabel = (label: string | undefined): React.ReactNode => (
  label ? <span className={FORM_FIELD_LABEL_CLASS}>{label}</span> : null
);

type NativeLikeChangeEvent = {
  target: {
    value: string;
  };
};

type NativeLikeCheckboxEvent = {
  target: {
    checked: boolean;
  };
};

type NativeOption = {
  value: string;
  label: React.ReactNode;
};

type UiSelectProps = {
  name?: string;
  /** Visible label above the control (label-over-input) — parity with UiAutocomplete/UiInput. */
  label?: string;
  /**
   * Selected value. When `multiple`, use a comma-separated list of option values
   * (e.g. `draft,published`). Empty string means no selection.
   */
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: NativeLikeChangeEvent) => void;
  onBlur?: React.FocusEventHandler<HTMLSelectElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
  /** Fires when the dropdown opens/closes (LOV refresh, analytics, …). */
  onOpenChange?: (isOpen: boolean) => void;
  className?: string;
  size?: HeroUiFieldSize;
  children?: React.ReactNode;
  placeholder?: string;
  isDisabled?: boolean;
  disabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  feedbackPlacement?: FieldFeedbackPlacement;
  ariaLabel?: string;
  isLoading?: boolean;
  isPending?: boolean;
  /** Inspector / legacy alias — mapped to HeroUI `shouldCloseOnSelect`. */
  closeOnSelect?: boolean;
  shouldCloseOnSelect?: boolean;
  /**
   * Allow selecting several options. `value` / `onChange` use a comma-separated
   * string of option values; the dropdown stays open while picking.
   */
  multiple?: boolean;
  /**
   * Phase 13 border-stacking: set when this control already sits inside a
   * bordered/ring-divided nested card — suppresses the control's own enclosure
   * border (see `HEROUI_FIELD_NESTED_BORDER_CLASS` in `surfaceClasses.ts`).
   */
  nested?: boolean;
  /** Non-option chrome at the top of the open menu (match logic, hints). */
  popoverHeader?: React.ReactNode;
  /** Menu placement for the HeroUI list (default bottom). */
  popoverPlacement?: string;
  /** Flip menu when viewport or scroll ancestor is tight (default true). */
  shouldFlip?: boolean;
  /** Raise menu z-index inside overflow-hidden shells without nested trigger chrome. */
  clipSafePopover?: boolean;
  /**
   * Escape hatch — native `<select>`. **Do not use on product forms** (see ui-core §Closed-set pickers).
   * Allowed: Appearance shell prefs only; designer dialog host still auto-falls back to native.
   */
  preferNativeSelect?: boolean;
};

export type { UiSelectProps };

/** Parse a CSV select value into trimmed non-empty keys (multi-select protocol). */
export const parseUiSelectCsvValue = (value: string | number | undefined | null): string[] => {
  if (value === undefined || value === null) {
    return [];
  }
  return String(value)
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const serializeUiSelectCsvValue = (keys: readonly string[]): string => keys
  .map((entry) => entry.trim())
  .filter((entry) => entry.length > 0)
  .join(',');

type UiAutocompleteProps = {
  name?: string;
  label?: string;
  placeholder?: string;
  value?: string;
  items?: DesignerAutocompleteItem[];
  onChange?: (event: NativeLikeChangeEvent) => void;
  onBlur?: React.FocusEventHandler<HTMLDivElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLDivElement>;
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
  /** Inspector / legacy alias — mapped to HeroUI `shouldCloseOnSelect`. */
  closeOnSelect?: boolean;
  shouldCloseOnSelect?: boolean;
  /** Render a text-entry combobox instead of the button-style autocomplete trigger. */
  typeable?: boolean;
  /** Maximum matching options shown by the typeable variant. */
  maxVisibleItems?: number;
};

type UiInputProps = {
  name?: string;
  value?: string | number;
  defaultValue?: string | number;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>;
  className?: string;
  size?: HeroUiFieldSize;
  placeholder?: string;
  isDisabled?: boolean;
  disabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  feedbackPlacement?: FieldFeedbackPlacement;
  pattern?: string;
  maxLength?: number;
  minLength?: number;
  min?: number | string;
  max?: number | string;
  step?: number | string;
  readOnly?: boolean;
  id?: string;
  type?: string;
  /** Visible field label above the control (label-over-input). */
  label?: string;
  ariaLabel?: string;
  description?: string;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  startContentClassName?: string;
  endContentClassName?: string;
  isClearable?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric' | 'email' | 'tel' | 'url';
  dir?: FieldTextDir;
  /**
   * When true (default), set `dir` from the first meaningful character (RTL scripts → rtl).
   * Skipped for password/number/email/tel/url and similar machine-oriented types.
   * Explicit `dir="ltr"|"rtl"` always wins.
   */
  autoDir?: boolean;
  'aria-expanded'?: boolean;
  'aria-autocomplete'?: 'none' | 'inline' | 'list' | 'both';
  /** Id of a <datalist> element to attach native browser suggestions to. */
  list?: string;
  /** When false, skips EUA single-line assist wrapper (password fields, chat panels). */
  aiAssist?: boolean;
  /**
   * Phase 13 border-stacking: set when this control already sits inside a
   * bordered/ring-divided nested card — suppresses the control's own enclosure
   * border (see `HEROUI_FIELD_NESTED_BORDER_CLASS` in `surfaceClasses.ts`).
   */
  nested?: boolean;
  /** Dial + WhatsApp oval actions in the trailing corner when the value is dialable. */
  phoneContactActions?: boolean;
};

export type { UiInputProps };

type UiTextareaProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (event: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onBlur?: React.FocusEventHandler<HTMLTextAreaElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLTextAreaElement>;
  onKeyDown?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onKeyUp?: (event: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  onPointerDown?: (event: React.PointerEvent<HTMLTextAreaElement>) => void;
  className?: string;
  size?: HeroUiFieldSize;
  placeholder?: string;
  isDisabled?: boolean;
  disabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  feedbackPlacement?: FieldFeedbackPlacement;
  pattern?: string;
  maxLength?: number;
  minLength?: number;
  id?: string;
  rows?: number;
  /** Soft cap used by some callers; applied as `maxLength`-style rows hint when supported. */
  maxRows?: number;
  /** Visible field label above the control (label-over-input). */
  label?: string;
  ariaLabel?: string;
  dir?: FieldTextDir;
  /**
   * When true (default), set `dir` from the first meaningful character (RTL scripts → rtl).
   * Explicit `dir="ltr"|"rtl"` always wins.
   */
  autoDir?: boolean;
  description?: string;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  isClearable?: boolean;
  autoFocus?: boolean;
  autoComplete?: string;
  inputMode?: 'text' | 'numeric' | 'email' | 'tel' | 'url';
  surfaceClassName?: string;
  /** When false, skips EUA context-menu wrapper (chat panels, nested prompts). */
  aiAssist?: boolean;
  /**
   * Phase 13 border-stacking: set when this control already sits inside a
   * bordered/ring-divided nested card — suppresses the control's own enclosure
   * border (see `HEROUI_FIELD_NESTED_BORDER_CLASS` in `surfaceClasses.ts`).
   */
  nested?: boolean;
};

export type { UiTextareaProps };

const flattenOptionElements = (children: React.ReactNode): React.ReactElement[] => {
  const result: React.ReactElement[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      return;
    }

    if (child.type === React.Fragment) {
      result.push(...flattenOptionElements(child.props.children));
      return;
    }

    if (typeof child.type === 'string') {
      if (child.type === 'option') {
        result.push(child);
        return;
      }
      if (child.type === 'optgroup') {
        result.push(...flattenOptionElements(child.props.children));
      }
    }
  });

  return result;
};

const toOptions = (children: React.ReactNode): NativeOption[] =>
  flattenOptionElements(children)
    .map((child) => ({
      value: String(child.props.value ?? child.props.children ?? ''),
      label: child.props.children,
    }))
    .filter((option) => option.value.trim() !== '');

const resolveUiSelectMenuDirection = (cultureDirection?: 'ltr' | 'rtl'): 'ltr' | 'rtl' => {
  if (cultureDirection) {
    return cultureDirection;
  }
  if (typeof document !== 'undefined' && document.documentElement.getAttribute('dir') === 'rtl') {
    return 'rtl';
  }
  return 'ltr';
};

/** HeroUI multi/single select options — include Item.Indicator so selected rows show a checkmark. */
const renderHeroSelectOptions = (options: NativeOption[]): React.ReactNode => options.map((option) => (
  <HeroListBox.Item
    key={option.value}
    id={option.value}
    data-testid={`ui-select-option-${option.value}`}
    textValue={resolveNativeOptionLabel(option.label, option.value)}
    className="text-start"
  >
    <span className="min-w-0 flex-1 truncate text-start">{option.label}</span>
    <HeroListBox.Item.Indicator />
  </HeroListBox.Item>
));

type HeroSelectValueRenderProps = {
  isPlaceholder: boolean;
  selectedText: string;
  selectedItems?: Array<{ textValue?: string } | null>;
};

const renderHeroSelectValueText = (
  renderProps: HeroSelectValueRenderProps,
  placeholder: string | undefined,
  selectedKeys: readonly string[],
  optionLabelByValue: ReadonlyMap<string, string>,
  t: ReturnType<typeof useOptionalCultureT>,
) => {
  const labels = selectedKeys
    .map((key) => optionLabelByValue.get(key))
    .map((label) => (label == null ? '' : String(label).trim()))
    .filter((label): label is string => label.length > 0);

  if (labels.length > 0) {
    return formatLocalizedSelectValue(labels, t);
  }

  if (renderProps.isPlaceholder || selectedKeys.length === 0) {
    return placeholder ?? '';
  }

  return formatLocalizedSelectValue(
    selectedKeys.map((key) => optionLabelByValue.get(key) ?? key),
    t,
  );
};

const renderAdornmentContent = (content?: React.ReactNode): React.ReactNode | undefined => {
  if (content === undefined || content === null || content === '') {
    return undefined;
  }

  if (typeof content === 'string') {
    if (isExplicitNavigationIconRef(content)) {
      return (
        <NavigationIcon
          iconRef={content}
          className="h-3.5 w-3.5 shrink-0 text-slate-500"
        />
      );
    }

    return <span className="text-xs text-slate-500">{content}</span>;
  }

  return content;
};

type UiCheckboxProps = {
  name?: string;
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (event: NativeLikeCheckboxEvent) => void;
  className?: string;
  size?: HeroUiFieldSize;
  isDisabled?: boolean;
  disabled?: boolean;
  id?: string;
  ariaLabel?: string;
  children?: React.ReactNode;
};

const HeroCheckbox = Checkbox as any;
const HeroSelect = Select as any;
const HeroAutocomplete = Autocomplete as any;
const HeroListBox = ListBox as any;
const HeroInput = Input as any;
const HeroTextarea = TextArea as any;
const HEROUI_TEXTAREA_SURFACE_CLASS = '!bg-white hover:!bg-white data-[hover=true]:!bg-white';

const resolveControlRequired = (isRequired?: boolean): boolean => Boolean(isRequired);

export const UiSelect: React.FC<UiSelectProps> = ({
  name,
  label,
  value,
  defaultValue,
  onChange,
  onBlur,
  onMouseEnter,
  onOpenChange,
  className,
  size = 'sm',
  children,
  placeholder,
  isDisabled,
  disabled,
  isRequired,
  isInvalid,
  errorMessage,
  feedbackPlacement = DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  ariaLabel,
  isLoading,
  isPending,
  closeOnSelect,
  shouldCloseOnSelect,
  multiple = false,
  nested,
  popoverHeader,
  popoverPlacement = 'bottom',
  shouldFlip = true,
  clipSafePopover = false,
  preferNativeSelect = false,
  ...rest
}) => {
  const pageGuideDomProps = pickPageGuideDomProps(rest);
  const insideDesignerDialog = useDesignerDialogHost();
  const culture = useOptionalCulture();
  const t = useOptionalCultureT();
  const menuDirection = resolveUiSelectMenuDirection(culture?.direction);
  const options = React.useMemo(() => toOptions(children), [children]);
  const optionLabelByValue = React.useMemo(() => {
    const map = new Map<string, string>();
    for (const option of options) {
      map.set(option.value, resolveNativeOptionLabel(option.label, option.value));
    }
    return map;
  }, [options]);
  const isControlDisabled = Boolean(isDisabled ?? disabled);
  const isControlRequired = resolveControlRequired(isRequired);
  const valueClassName = resolveHeroUiFieldSelectValueClass(size);
  const resolvedShouldCloseOnSelect = multiple
    ? false
    : (shouldCloseOnSelect ?? closeOnSelect);

  const selectedKeysList = React.useMemo(
    () => parseUiSelectCsvValue(value),
    [value],
  );
  const defaultSelectedKeysList = React.useMemo(
    () => parseUiSelectCsvValue(defaultValue),
    [defaultValue],
  );
  const selectedKey = !multiple && selectedKeysList[0] ? selectedKeysList[0] : undefined;
  const defaultSelectedKey = !multiple && defaultSelectedKeysList[0]
    ? defaultSelectedKeysList[0]
    : undefined;
  const [formValue, setFormValue] = React.useState(() => (
    value !== undefined
      ? String(value)
      : defaultValue !== undefined
        ? String(defaultValue)
        : ''
  ));

  React.useEffect(() => {
    if (value !== undefined) {
      setFormValue(String(value));
    }
  }, [value]);

  React.useEffect(() => {
    if (value === undefined && defaultValue !== undefined) {
      setFormValue(String(defaultValue));
    }
  }, [defaultValue, value]);

  const emitChange = (nextValue: string) => {
    setFormValue(nextValue);
    onChange?.({ target: { value: nextValue } });
  };

  if (insideDesignerDialog || preferNativeSelect) {
    const nativeValue = value !== undefined ? String(value) : formValue;
    const nativeSelected = parseUiSelectCsvValue(nativeValue);
    return (
      <div className="flex w-full flex-col gap-[2px]" onMouseEnter={onMouseEnter} {...pageGuideDomProps}>
        {renderFieldLabel(label)}
        <FieldFeedbackShell
          errorMessage={errorMessage}
          isInvalid={isInvalid}
          placement={feedbackPlacement}
        >
          <div className="w-full">
            {name ? <input type="hidden" name={name} value={nativeValue} readOnly /> : null}
            <select
              aria-label={ariaLabel || label || placeholder || 'select'}
              aria-invalid={isInvalid || undefined}
              className={resolveHeroUiNativeSelectClass({
                size,
                isInvalid,
                nested,
                className,
              })}
              multiple={multiple}
              value={multiple ? nativeSelected : nativeValue}
              disabled={isControlDisabled}
              required={isControlRequired}
              onChange={(event) => {
                if (multiple) {
                  const nextValue = serializeUiSelectCsvValue(
                    Array.from(event.target.selectedOptions).map((option) => option.value),
                  );
                  emitChange(nextValue);
                  return;
                }
                emitChange(event.target.value);
              }}
              onBlur={onBlur}
            >
              {!multiple && placeholder ? <option value="">{placeholder}</option> : null}
              {children}
            </select>
          </div>
        </FieldFeedbackShell>
      </div>
    );
  }

  const heroErrorMessage = feedbackPlacement === 'below' ? errorMessage : undefined;
  const accessibleName = ariaLabel || label || placeholder || 'select';
  const popoverClassName = cn(
    HEROUI_FIELD_RADIUS_CLASS,
    (nested || clipSafePopover) && NESTED_FIELD_POPOVER_Z_CLASS,
    (nested || clipSafePopover) && NESTED_FIELD_POPOVER_SURFACE_CLASS,
  );
  const popover = (
    <HeroSelect.Popover
      className={popoverClassName}
      dir={menuDirection}
      placement={popoverPlacement}
      shouldFlip={shouldFlip}
    >
      {popoverHeader ? (
        <div
          data-testid="ui-select-popover-header"
          className="border-b border-slate-200 px-2 py-1.5"
          dir={menuDirection}
          onPointerDown={(event) => event.stopPropagation()}
        >
          {popoverHeader}
        </div>
      ) : null}
      <HeroListBox className={HEROUI_FIELD_RADIUS_CLASS} dir={menuDirection}>
        {renderHeroSelectOptions(options)}
      </HeroListBox>
    </HeroSelect.Popover>
  );

  return (
    <div className="flex w-full flex-col gap-[2px]" onMouseEnter={onMouseEnter} {...pageGuideDomProps}>
      {renderFieldLabel(label)}
      <FieldFeedbackShell
        errorMessage={errorMessage}
        isInvalid={isInvalid}
        placement={feedbackPlacement}
      >
        <div className="w-full">
          {name ? <input type="hidden" name={name} value={formValue} readOnly /> : null}
          {multiple ? (
            <HeroSelect
              aria-label={accessibleName}
              placeholder={placeholder}
              selectionMode="multiple"
              value={selectedKeysList}
              defaultValue={value === undefined ? defaultSelectedKeysList : undefined}
              isDisabled={isControlDisabled}
              disabled={isControlDisabled}
              isRequired={isControlRequired}
              isInvalid={isInvalid}
              errorMessage={heroErrorMessage}
              isPending={Boolean(isPending ?? isLoading)}
              shouldCloseOnSelect={false}
              variant="secondary"
              size={size}
              onOpenChange={(isOpen: boolean) => {
                onOpenChange?.(isOpen);
              }}
              onChange={(keys: Iterable<React.Key> | React.Key[] | null) => {
                const list = keys == null
                  ? []
                  : Array.isArray(keys)
                    ? keys.map(String)
                    : Array.from(keys as Iterable<React.Key>).map(String);
                emitChange(serializeUiSelectCsvValue(list));
              }}
              onBlur={onBlur as any}
              className="w-full"
            >
              <HeroSelect.Trigger
                title={placeholder}
                className={resolveHeroUiFieldSelectTriggerClass({
                  size,
                  isInvalid,
                  nested,
                  className,
                })}
              >
                <HeroSelect.Value className={valueClassName} dir={menuDirection}>
                  {(renderProps: HeroSelectValueRenderProps) => renderHeroSelectValueText(
                    renderProps,
                    placeholder,
                    selectedKeysList,
                    optionLabelByValue,
                    t,
                  )}
                </HeroSelect.Value>
                <HeroSelect.Indicator />
              </HeroSelect.Trigger>

              {popover}
            </HeroSelect>
          ) : (
            <HeroSelect
              aria-label={accessibleName}
              placeholder={placeholder}
              selectedKey={selectedKey}
              defaultSelectedKey={defaultSelectedKey}
              isDisabled={isControlDisabled}
              disabled={isControlDisabled}
              isRequired={isControlRequired}
              isInvalid={isInvalid}
              errorMessage={heroErrorMessage}
              isPending={Boolean(isPending ?? isLoading)}
              shouldCloseOnSelect={resolvedShouldCloseOnSelect}
              variant="secondary"
              size={size}
              onOpenChange={(isOpen: boolean) => {
                onOpenChange?.(isOpen);
              }}
              onSelectionChange={(key: React.Key | null) => {
                if (key === undefined || key === null) {
                  return;
                }
                emitChange(String(key));
              }}
              onBlur={onBlur as any}
              className="w-full"
            >
              <HeroSelect.Trigger
                title={placeholder}
                className={resolveHeroUiFieldSelectTriggerClass({
                  size,
                  isInvalid,
                  nested,
                  className,
                })}
              >
                <HeroSelect.Value className={valueClassName} dir={menuDirection}>
                  {(renderProps: HeroSelectValueRenderProps) => renderHeroSelectValueText(
                    renderProps,
                    placeholder,
                    selectedKey ? [selectedKey] : [],
                    optionLabelByValue,
                    t,
                  )}
                </HeroSelect.Value>
                <HeroSelect.Indicator />
              </HeroSelect.Trigger>

              {popover}
            </HeroSelect>
          )}
        </div>
      </FieldFeedbackShell>
    </div>
  );
};

export const UiAutocomplete: React.FC<UiAutocompleteProps> = ({
  name,
  label,
  placeholder,
  value,
  items = [],
  onChange,
  onBlur,
  onMouseEnter,
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
  closeOnSelect,
  shouldCloseOnSelect,
  typeable = false,
  maxVisibleItems = 5,
}) => {
  const isControlDisabled = Boolean(isDisabled ?? disabled);
  const valueClassName = resolveHeroUiFieldSelectValueClass(size);
  const triggerClassName = resolveHeroUiFieldSelectTriggerClass({
    size,
    isInvalid,
    className,
  });
  const normalizedValue = value !== undefined ? String(value).trim() : '';
  const selectedKey = value !== undefined
    ? (normalizedValue === '' ? '__not_set__' : normalizedValue)
    : undefined;
  const resolvedShouldCloseOnSelect = shouldCloseOnSelect ?? closeOnSelect;
  const [inputValue, setInputValue] = React.useState('');
  const typeableItems = React.useMemo(() => {
    const normalizedQuery = inputValue.trim().toLocaleLowerCase();
    const matchingItems = normalizedQuery
      ? items.filter((item) => item.textValue.toLocaleLowerCase().includes(normalizedQuery))
      : items;
    const limit = Number.isFinite(maxVisibleItems) && maxVisibleItems > 0
      ? Math.floor(maxVisibleItems)
      : 5;
    const limitedItems = matchingItems.slice(0, limit);
    const selectedItem = value ? items.find((item) => item.id === value) : undefined;
    if (selectedItem && !limitedItems.some((item) => item.id === selectedItem.id)) {
      return [selectedItem, ...limitedItems].slice(0, limit);
    }
    return limitedItems;
  }, [inputValue, items, maxVisibleItems, value]);

  const heroErrorMessage = feedbackPlacement === 'below' ? errorMessage : undefined;

  if (typeable) {
    return (
      <div className="flex w-full flex-col gap-[2px]" onMouseEnter={onMouseEnter}>
        {renderFieldLabel(label)}
        <UiCombobox
          name={name}
          value={value}
          items={typeableItems}
          onChange={onChange}
          onInputValueChange={setInputValue}
          onBlur={onBlur}
          placeholder={placeholder}
          className={className}
          size={size}
          isDisabled={isControlDisabled}
          isInvalid={isInvalid}
          errorMessage={errorMessage}
          feedbackPlacement={feedbackPlacement}
          ariaLabel={ariaLabel || label || placeholder}
          isPending={Boolean(isPending ?? isLoading)}
          allowCustomValue={false}
          menuTrigger="input"
        />
      </div>
    );
  }

  return (
    <div className="flex w-full flex-col gap-[2px]" onMouseEnter={onMouseEnter}>
      {renderFieldLabel(label)}
      <FieldFeedbackShell
        errorMessage={errorMessage}
        isInvalid={isInvalid}
        placement={feedbackPlacement}
      >
        <HeroAutocomplete
          name={name}
          aria-label={ariaLabel || label || placeholder || 'autocomplete'}
          placeholder={placeholder}
          selectedKey={selectedKey}
          isDisabled={isControlDisabled}
          disabled={isControlDisabled}
          isInvalid={isInvalid}
          errorMessage={heroErrorMessage}
          isPending={Boolean(isPending ?? isLoading)}
          shouldCloseOnSelect={resolvedShouldCloseOnSelect}
          variant="secondary"
          size={size}
          className="w-full"
          onSelectionChange={(key: React.Key) => {
            if (onChange && key !== undefined && key !== null) {
              const normalized = String(key) === '__not_set__' ? '' : String(key);
              onChange({ target: { value: normalized } });
            }
          }}
          onBlur={onBlur as any}
        >
          <HeroAutocomplete.Trigger className={triggerClassName}>
            <HeroAutocomplete.Value className={valueClassName} />
            <HeroAutocomplete.Indicator />
          </HeroAutocomplete.Trigger>
          <HeroAutocomplete.Popover className={HEROUI_FIELD_RADIUS_CLASS}>
            <HeroListBox className={HEROUI_FIELD_RADIUS_CLASS}>
              {items.map((item) => (
                <HeroListBox.Item key={item.id} id={item.id} textValue={item.textValue}>
                  {item.textValue}
                </HeroListBox.Item>
              ))}
            </HeroListBox>
          </HeroAutocomplete.Popover>
        </HeroAutocomplete>
      </FieldFeedbackShell>
    </div>
  );
};

export const UiCheckbox: React.FC<UiCheckboxProps> = ({
  name,
  checked,
  defaultChecked,
  onChange,
  className,
  size = 'sm',
  isDisabled,
  disabled,
  id,
  ariaLabel,
  children,
}) => {
  const isControlled = checked !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = React.useState(Boolean(defaultChecked));
  const isSelected = isControlled ? checked : uncontrolledValue;
  const isControlDisabled = Boolean(isDisabled ?? disabled);
  const sizeTokens = resolveHeroUiFieldSizeTokens(size);
  const controlSizeClass = sizeTokens.checkboxControlClass;
  const labelTextClass = sizeTokens.choiceLabelClass;

  const control = (
    <HeroCheckbox
      name={name}
      id={id}
      aria-label={ariaLabel}
      className={cn('shrink-0', !children && className)}
      disabled={isControlDisabled}
      isDisabled={isControlDisabled}
      isSelected={isSelected}
      onChange={(nextValue: boolean | React.ChangeEvent<HTMLInputElement>) => {
        if (isControlDisabled) return;
        const checked = typeof nextValue === 'boolean'
          ? nextValue
          : Boolean(nextValue.target?.checked);
        if (!isControlled) {
          setUncontrolledValue(checked);
        }
        if (onChange) {
          onChange({ target: { checked } });
        }
      }}
    >
      <HeroCheckbox.Content>
        <HeroCheckbox.Control className={controlSizeClass}>
          <HeroCheckbox.Indicator />
        </HeroCheckbox.Control>
      </HeroCheckbox.Content>
    </HeroCheckbox>
  );

  if (!children) {
    return control;
  }

  return (
    <label
      htmlFor={id}
      className={cn(
        'inline-flex cursor-pointer items-center gap-2',
        labelTextClass,
        className,
      )}
    >
      <span className="inline-flex shrink-0 items-center justify-center leading-none">
        {control}
      </span>
      <span className="inline-flex min-w-0 items-center leading-none translate-y-px">
        {children}
      </span>
    </label>
  );
};

export const UiInputCore: React.FC<UiInputProps> = ({
  name,
  value,
  defaultValue,
  onChange,
  onFocus,
  onBlur,
  onMouseEnter,
  onKeyDown,
  onKeyUp,
  className,
  size = 'sm',
  placeholder,
  isDisabled,
  disabled,
  isRequired,
  isInvalid,
  errorMessage,
  feedbackPlacement = DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  pattern,
  maxLength,
  minLength,
  min,
  max,
  step,
  readOnly,
  id,
  type,
  label,
  ariaLabel,
  description,
  startContent,
  endContent,
  startContentClassName,
  endContentClassName,
  isClearable: _isClearable,
  autoFocus,
  autoComplete,
  inputMode,
  dir,
  autoDir,
  'aria-expanded': ariaExpanded,
  'aria-autocomplete': ariaAutocomplete,
  list,
  aiAssist: _aiAssist,
  nested,
  phoneContactActions = false,
  ...rest
}) => {
  const pageGuideDomProps = pickPageGuideDomProps(rest);
  const inputWrapperClassName = className || '';
  const sizeTokens = resolveHeroUiFieldSizeTokens(size);
  const isControlDisabled = Boolean(isDisabled ?? disabled);
  const isControlRequired = resolveControlRequired(isRequired);
  const hasAdornments = Boolean(startContent || endContent);
  const isControlled = value !== undefined;
  const [uncontrolledText, setUncontrolledText] = React.useState(() => toFieldTextValue(defaultValue));
  const hasUncontrolledUserInputRef = React.useRef(false);
  const defaultTextForDir = toFieldTextValue(defaultValue);
  const textForDir = isControlled ? toFieldTextValue(value) : uncontrolledText;
  const autoDirEnabled = resolveAutoDirEnabled(autoDir, type);
  const resolvedDir = resolveFieldTextDirection(dir, autoDirEnabled, textForDir, placeholder);
  const phoneContactLinks = phoneContactActions ? resolvePhoneContactLinks(textForDir) : null;
  const useGroupedFieldShell = hasAdornments || Boolean(phoneContactLinks);

  React.useLayoutEffect(() => {
    if (!isControlled && !hasUncontrolledUserInputRef.current) {
      setUncontrolledText(defaultTextForDir);
    }
  }, [defaultTextForDir, isControlled]);

  const handleChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      hasUncontrolledUserInputRef.current = true;
      setUncontrolledText(event.target.value);
    }
    onChange?.(event);
  }, [isControlled, onChange]);

  const fieldBorderClass = resolveHeroUiFieldBorderClass(isInvalid, { nested });
  const numericDateCenterClass = isNumericOrDateFieldInput(type, inputMode)
    ? FIELD_NUMERIC_DATE_INPUT_CENTER_CLASS
    : undefined;
  const inputClassName = useGroupedFieldShell
    ? cn(
      'w-full !rounded-none !border-0 !shadow-none',
      inputWrapperClassName,
      sizeTokens.textClass,
      HERO_UI_FIELD_VALUE_CLASS,
      numericDateCenterClass,
      HEROUI_FIELD_FOCUS_CLIP_CLASS,
      HEROUI_FIELD_SURFACE_CLASS,
    )
    : resolveHeroUiFieldInputClass({
      size,
      isInvalid,
      nested,
      className: cn(inputWrapperClassName, numericDateCenterClass),
    });

  const formSubmitValue = textForDir;

  const inputElement = (
    <HeroInput
      name={name ? undefined : name}
      id={id}
      type={type as any}
      value={value as any}
      defaultValue={defaultValue as any}
      onChange={handleChange as any}
      onFocus={onFocus as any}
      onBlur={onBlur as any}
      onMouseEnter={onMouseEnter as any}
      onKeyDown={onKeyDown as any}
      onKeyUp={onKeyUp as any}
      placeholder={placeholder}
      disabled={isControlDisabled}
      readOnly={readOnly}
      required={isControlRequired}
      aria-invalid={isInvalid || undefined}
      autoFocus={autoFocus}
      autoComplete={autoComplete}
      inputMode={inputMode}
      pattern={pattern}
      maxLength={maxLength}
      minLength={minLength}
      min={min}
      max={max}
      step={step}
      dir={resolvedDir}
      aria-label={ariaLabel || label || placeholder || 'input'}
      aria-expanded={ariaExpanded}
      aria-autocomplete={ariaAutocomplete}
      list={list}
      variant="secondary"
      size={size}
      className={inputClassName}
    />
  );

  const fieldBody = useGroupedFieldShell ? (
    <FieldFeedbackShell
      description={description}
      errorMessage={errorMessage}
      isInvalid={isInvalid}
      placement={feedbackPlacement}
    >
      <div
        dir={phoneContactLinks ? 'ltr' : undefined}
        className={cn(
          'flex w-full items-stretch overflow-hidden !bg-white',
          sizeTokens.controlHeightClass,
          sizeTokens.controlMaxHeightClass,
          fieldBorderClass,
          HEROUI_FIELD_RADIUS_CLASS,
        )}
      >
        {startContent ? (
          <FormAccessorySlot className={cn('flex shrink-0 items-center border-e border-slate-300 px-2', startContentClassName)}>
            {renderAdornmentContent(startContent)}
          </FormAccessorySlot>
        ) : null}
        <div className="relative min-w-0 flex-1">{inputElement}</div>
        {phoneContactLinks ? (
          <FormAccessorySlot className="flex shrink-0 items-center border-s border-slate-300 px-1.5">
            <PhoneNumberDisplay phone={textForDir} actionsOnly badgeSize="field" />
          </FormAccessorySlot>
        ) : null}
        {endContent ? (
          <FormAccessorySlot className={cn('flex shrink-0 items-center border-s border-slate-300 px-2', endContentClassName)}>
            {renderAdornmentContent(endContent)}
          </FormAccessorySlot>
        ) : null}
      </div>
    </FieldFeedbackShell>
  ) : (
    <FieldFeedbackShell
      description={description}
      errorMessage={errorMessage}
      isInvalid={isInvalid}
      placement={feedbackPlacement}
    >
      <div className="w-full min-w-0 [&_[data-slot=input-wrapper]]:w-full [&_[data-slot=input]]:w-full">
        {inputElement}
      </div>
    </FieldFeedbackShell>
  );

  return (
    <div className="flex w-full flex-col gap-[2px]" {...pageGuideDomProps}>
      {renderFieldLabel(label)}
      {name ? <input type="hidden" name={name} value={formSubmitValue} readOnly /> : null}
      {fieldBody}
    </div>
  );
};

type UiPasswordInputProps = Omit<UiInputProps, 'type' | 'endContent' | 'startContent'> & {
  /** Rendered in the leading adornment before the password field. */
  leadingAddon?: React.ReactNode;
  /** Optional class on the leading adornment slot (e.g. tighter horizontal padding). */
  leadingAddonClassName?: string;
};

export const UiPasswordInput: React.FC<UiPasswordInputProps> = ({ leadingAddon, leadingAddonClassName, ...props }) => {
  const [visible, setVisible] = React.useState(false);

  return (
    <UiInputCore
      {...props}
      type={visible ? 'text' : 'password'}
      autoDir={false}
      aiAssist={false}
      startContent={leadingAddon}
      startContentClassName={leadingAddonClassName}
      endContent={(
        <button
          type="button"
          className="inline-flex h-full items-center justify-center px-2 text-slate-500 transition-colors hover:text-slate-700"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          tabIndex={-1}
        >
          <span className="relative inline-flex h-3.5 w-3.5">
            <Eye
              className={cn(
                'absolute inset-0 h-3.5 w-3.5 transition-opacity duration-200 ease-out',
                visible ? 'opacity-0' : 'opacity-100',
              )}
              aria-hidden
            />
            <EyeOff
              className={cn(
                'absolute inset-0 h-3.5 w-3.5 transition-opacity duration-200 ease-out',
                visible ? 'opacity-100' : 'opacity-0',
              )}
              aria-hidden
            />
          </span>
        </button>
      )}
    />
  );
};

export const UiTextareaCore: React.FC<UiTextareaProps> = ({
  name,
  value,
  defaultValue,
  onChange,
  onBlur,
  onMouseEnter,
  onKeyDown,
  onKeyUp,
  onPointerDown,
  className,
  size = 'sm',
  placeholder,
  isDisabled,
  disabled,
  isRequired,
  isInvalid,
  errorMessage,
  feedbackPlacement = DEFAULT_FIELD_FEEDBACK_PLACEMENT,
  pattern,
  maxLength,
  minLength,
  id,
  rows = 3,
  maxRows: _maxRows,
  label,
  ariaLabel,
  dir,
  autoDir,
  description,
  startContent,
  endContent,
  isClearable: _isClearable,
  autoFocus,
  autoComplete,
  inputMode,
  surfaceClassName = HEROUI_TEXTAREA_SURFACE_CLASS,
  aiAssist: _aiAssist,
  nested,
  ...rest
}) => {
  const pageGuideDomProps = pickPageGuideDomProps(rest);
  const inputWrapperClassName = className || '';
  const sizeTokens = resolveHeroUiFieldSizeTokens(size);
  const textareaTextClass = sizeTokens.textClass;
  const isControlRequired = resolveControlRequired(isRequired);
  const isControlDisabled = Boolean(isDisabled ?? disabled);
  const hasAdornments = Boolean(startContent || endContent);
  const isControlled = value !== undefined;
  const [uncontrolledText, setUncontrolledText] = React.useState(() => toFieldTextValue(defaultValue));
  const hasUncontrolledUserInputRef = React.useRef(false);
  const defaultTextForDir = toFieldTextValue(defaultValue);
  const textForDir = isControlled ? toFieldTextValue(value) : uncontrolledText;
  const autoDirEnabled = resolveAutoDirEnabled(autoDir);
  const resolvedDir = resolveFieldTextDirection(dir, autoDirEnabled, textForDir, placeholder);

  React.useLayoutEffect(() => {
    if (!isControlled && !hasUncontrolledUserInputRef.current) {
      setUncontrolledText(defaultTextForDir);
    }
  }, [defaultTextForDir, isControlled]);

  const handleChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!isControlled) {
      hasUncontrolledUserInputRef.current = true;
      setUncontrolledText(event.target.value);
    }
    onChange?.(event);
  }, [isControlled, onChange]);

  const fieldBorderClass = resolveHeroUiFieldBorderClass(isInvalid, { nested });
  const textareaClassName = hasAdornments
    ? cn(
      'w-full !rounded-none !border-0 !shadow-none',
      inputWrapperClassName,
      textareaTextClass,
      HEROUI_FIELD_FOCUS_CLIP_CLASS,
      surfaceClassName,
    )
    : cn(
      resolveHeroUiFieldTextareaClass({
        size,
        isInvalid,
        nested,
        className: inputWrapperClassName,
      }),
      surfaceClassName,
    );

  const formSubmitValue = textForDir;

  const textareaElement = (
    <HeroTextarea
      name={name ? undefined : name}
      id={id}
      value={value as any}
      defaultValue={defaultValue as any}
      onChange={handleChange as any}
      onBlur={onBlur as any}
      onMouseEnter={onMouseEnter as any}
      onKeyDown={onKeyDown as any}
      onKeyUp={onKeyUp as any}
      onPointerDown={onPointerDown as any}
      placeholder={placeholder}
      disabled={isControlDisabled}
      required={isControlRequired}
      aria-invalid={isInvalid || undefined}
      autoFocus={autoFocus}
      autoComplete={autoComplete}
      inputMode={inputMode}
      pattern={pattern}
      maxLength={maxLength}
      minLength={minLength}
      aria-label={ariaLabel || label || placeholder || 'textarea'}
      dir={resolvedDir}
      variant="secondary"
      size={size}
      rows={rows}
      className={textareaClassName}
    />
  );

  const fieldBody = hasAdornments ? (
    <FieldFeedbackShell
      description={description}
      errorMessage={errorMessage}
      isInvalid={isInvalid}
      placement={feedbackPlacement}
    >
      <div className={cn(
        'flex w-full items-start overflow-hidden !bg-white',
        fieldBorderClass,
        HEROUI_FIELD_RADIUS_CLASS,
      )}>
        {startContent ? (
          <FormAccessorySlot className="flex shrink-0 items-center self-stretch border-e border-slate-300 px-2">
            {renderAdornmentContent(startContent)}
          </FormAccessorySlot>
        ) : null}
        <div className="min-w-0 flex-1">{textareaElement}</div>
        {endContent ? (
          <FormAccessorySlot className="flex shrink-0 items-center border-s border-slate-300 px-2">
            {renderAdornmentContent(endContent)}
          </FormAccessorySlot>
        ) : null}
      </div>
    </FieldFeedbackShell>
  ) : (
    <FieldFeedbackShell
      description={description}
      errorMessage={errorMessage}
      isInvalid={isInvalid}
      placement={feedbackPlacement}
    >
      {textareaElement}
    </FieldFeedbackShell>
  );

  return (
    <div className="flex w-full flex-col gap-[2px]" {...pageGuideDomProps}>
      {renderFieldLabel(label)}
      {name ? <input type="hidden" name={name} value={formSubmitValue} readOnly /> : null}
      {fieldBody}
    </div>
  );
};

export { UiInput } from './ai-field-assist/AiAssistInput';
export { UiTextarea } from './ai-field-assist/AiAssistTextarea';

const HeroRadioGroup = RadioGroup as any;
const HeroRadio = Radio as any;

/** Radio option labels stay at baseline with the control (see ui-core.md). */
export const HERO_UI_RADIO_LABEL_NUDGE_CLASS = 'translate-y-0';

/** Vertical gap between stacked checkbox/radio choice rows in boxed lists. */
export const UI_CHOICE_STACK_GAP_CLASS = 'gap-1';

export type UiRadioOption = {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
};

export type UiRadioGroupProps = {
  name?: string;
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  options: UiRadioOption[];
  size?: HeroUiFieldSize;
  isDisabled?: boolean;
  disabled?: boolean;
  className?: string;
  optionClassName?: string;
  ariaLabel?: string;
  orientation?: 'vertical' | 'horizontal';
  /** `contents` lets rows use the parent stack gap (boxed choice lists beside checkboxes). */
  layout?: 'stack' | 'contents';
};

export const resolveUiChoiceLabelRowClass = (
  size: HeroUiFieldSize = 'sm',
  className?: string,
) => {
  const tokens = resolveHeroUiFieldSizeTokens(size);
  return cn(
    'inline-flex w-full min-w-0 cursor-pointer items-center gap-2',
    tokens.choiceLabelClass,
    className,
  );
};

/** Shared option label typography for boxed checkbox/radio lists. */
export const resolveUiChoiceOptionLabelClass = (
  size: HeroUiFieldSize = 'sm',
  className?: string,
) => {
  const tokens = resolveHeroUiFieldSizeTokens(size);
  const forcedTextSizeClass = tokens.textClass.startsWith('text-')
    ? `!${tokens.textClass}`
    : tokens.textClass;

  return cn(
    'min-w-0 !font-normal leading-tight',
    tokens.choiceLabelClass,
    forcedTextSizeClass,
    className,
  );
};

export const resolveUiRadioRowClass = (className?: string) => cn(
  'inline-flex w-full min-w-0 cursor-pointer items-center gap-2',
  className,
);

/** Resets HeroUI radio chrome so boxed lists match checkbox row footprint. */
export const resolveUiRadioOptionRootClass = (className?: string) => cn(
  'group w-full min-w-0 !m-0 !h-auto !max-w-none cursor-pointer border-0 bg-transparent p-0 shadow-none',
  className,
);

export const resolveUiRadioLabelClass = (
  size: HeroUiFieldSize = 'sm',
  className?: string,
) => cn(
  resolveUiChoiceOptionLabelClass(size),
  HERO_UI_RADIO_LABEL_NUDGE_CLASS,
  className,
);

export const UiRadioGroup: React.FC<UiRadioGroupProps> = ({
  name,
  value,
  defaultValue,
  onChange,
  options,
  size = 'sm',
  isDisabled,
  disabled,
  className,
  optionClassName,
  ariaLabel,
  orientation = 'vertical',
  layout = 'stack',
}) => {
  const isControlDisabled = Boolean(isDisabled ?? disabled);
  const sizeTokens = resolveHeroUiFieldSizeTokens(size);
  const isHorizontal = orientation === 'horizontal';
  const usesContentsLayout = layout === 'contents';

  return (
    <HeroRadioGroup
      name={name}
      value={value}
      defaultValue={defaultValue}
      onChange={onChange}
      isDisabled={isControlDisabled}
      className={cn(
        usesContentsLayout
          ? 'contents'
          : cn(
            'flex w-full',
            isHorizontal ? 'flex-row flex-wrap gap-x-5 gap-y-1' : cn('flex-col', UI_CHOICE_STACK_GAP_CLASS),
          ),
        className,
      )}
      aria-label={ariaLabel}
    >
      {options.map((option) => (
        <HeroRadio
          key={option.value}
          value={option.value}
          isDisabled={option.disabled}
          className={resolveUiRadioOptionRootClass(
            cn(isHorizontal && '!w-auto shrink-0', optionClassName),
          )}
        >
          <div className={resolveUiRadioRowClass(isHorizontal ? '!w-auto' : undefined)}>
            <HeroRadio.Control className={cn(sizeTokens.radioControlClass, 'shrink-0')}>
              <HeroRadio.Indicator />
            </HeroRadio.Control>
            <HeroRadio.Content className={resolveUiRadioLabelClass(size)}>
              {option.label}
            </HeroRadio.Content>
          </div>
        </HeroRadio>
      ))}
    </HeroRadioGroup>
  );
};
