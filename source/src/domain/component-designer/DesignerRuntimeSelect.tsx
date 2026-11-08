import * as React from 'react';
import { readBoolean, readString, resolveFieldSize, resolveRuntimeNodeClassName } from './runtimeShared';
import { resolveInputValidationProps, resolveRegionFormFieldNameProps } from './runtimeNodeProps';
import { useDesignerOptionItems } from './useDesignerOptionItems';
import { resolveCanvasMockEventProps } from './bindingCanvasResolver';
import { resolveCanvasPreviewEventProps } from './bindingPreviewHandlers';
import { triggerPreviewFieldValidation } from './previewFieldValidation';
import { useDesignerDialogHost } from '../../shared/ui/designerDialogHostContext';
import { resolveHeroUiNativeSelectClass } from '../../shared/ui/heroFieldChrome';
import { UiSelect } from '../../shared/ui/HeroFieldControls';
import { FORM_FIELD_LABEL_CLASS } from '../../shared/ui/FormSection';
import type { DesignerNode } from './types';
import type { RuntimeRenderOptions } from './runtimeTypes';

/** Adapt HeroUI value callbacks (`onChange(next)`) to designer Event-shaped handlers (same as runtimeRenderer.tsx). */
const adaptValueChangeToDesignerEvent = (
  onChange: ((event: Event) => void) | undefined,
  nextValue: unknown,
): void => {
  if (!onChange) {
    return;
  }
  onChange({ target: { value: String(nextValue ?? '') } } as unknown as Event);
};

type DesignerRuntimeSelectProps = {
  node: DesignerNode;
  options: RuntimeRenderOptions;
  interactionClass?: string;
};

export const resolveLanguageSelectedKey = (node: DesignerNode): string => {
  const rawMap = node.props.selectedKeyByLanguage;
  if (typeof rawMap !== 'string' || !rawMap.trim() || typeof document === 'undefined') {
    return '';
  }

  try {
    const parsed = JSON.parse(rawMap) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return '';
    }

    const language = document.documentElement.lang.trim().toLowerCase();
    const baseLanguage = language.split('-')[0] ?? language;
    const map = parsed as Record<string, unknown>;
    const selected = map[language] ?? map[baseLanguage];
    return typeof selected === 'string' ? selected.trim() : '';
  } catch {
    return '';
  }
};

const SELECT_TRIGGER_SIZE_CLASS: Record<'sm' | 'md', string> = {
  sm: 'h-8 min-h-8 px-2.5 text-xs',
  md: 'h-9 min-h-9 px-3 text-sm',
};

export const DesignerRuntimeSelect: React.FC<DesignerRuntimeSelectProps> = ({
  node,
  options,
  interactionClass,
}) => {
  const insideDesignerDialog = useDesignerDialogHost();
  const { items: selectOptions, isLoading: itemsLoading } = useDesignerOptionItems(node, options);
  const manualLoading = readBoolean(node.props.isLoading);
  const isLoading = itemsLoading || manualLoading;
  const placeholder = options.previewBindings?.resolveTextProp?.(node, 'placeholder', 'Select…')
    ?? readString(node.props.placeholder, 'Select…');
  const label = options.previewBindings?.resolveTextProp?.(node, 'label', '')
    ?? readString(node.props.label);
  const boundSelectedKeys = options.previewBindings?.resolveSelectSelectedKeys?.(node);
  const staticSelectedKeys = readString(node.props.selectedKeys);
  const languageSelectedKey = resolveLanguageSelectedKey(node);
  const staticSelectedKey = staticSelectedKeys.split(',')[0]?.trim() ?? '';
  const initialValue = boundSelectedKeys ?? (staticSelectedKey || languageSelectedKey);
  const [selectedValue, setSelectedValue] = React.useState(initialValue);
  const [isOpen, setIsOpen] = React.useState(false);
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const name = resolveRegionFormFieldNameProps(node).name
    ?? (typeof node.props.name === 'string' ? node.props.name : undefined);
  const size = resolveFieldSize(node.props.size);
  const validation = resolveInputValidationProps(node, options.previewFieldErrors);
  const isInvalid = Boolean(validation.isInvalid);
  const errorMessage = typeof validation.errorMessage === 'string' ? validation.errorMessage : '';
  const eventProps = options.mode === 'runtime' && options.previewEvents
    ? resolveCanvasPreviewEventProps(node, options.previewEvents)
    : resolveCanvasMockEventProps(node);

  React.useEffect(() => {
    if (initialValue) {
      setSelectedValue(initialValue);
    }
  }, [initialValue]);

  const selectedLabel = selectOptions.find((item) => item.value === selectedValue)?.label;
  const displayLabel = selectedLabel ?? placeholder;
  const hasSelection = Boolean(selectedLabel);

  const shellClassName = resolveRuntimeNodeClassName(
    node,
    'flex w-full min-w-0 max-w-full flex-col items-stretch gap-[2px]',
    interactionClass,
  );
  const triggerClassName = [
    SELECT_TRIGGER_SIZE_CLASS[size],
    'inline-flex w-full items-center justify-between gap-1 rounded-md border bg-white hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
    isInvalid ? 'border-rose-400' : 'border-slate-300',
    hasSelection ? 'text-slate-700' : 'text-slate-500',
  ].join(' ');

  const handleTriggerClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!isDisabled && !isLoading) {
      setIsOpen((previous) => !previous);
    }
  };

  const handleOptionClick = (value: string) => (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (!isDisabled) {
      setSelectedValue(value);
      // Bug found (parity audit item 47, re-verified): a "Close On Select" Inspector field used
      // to gate this. Removed — the real exported `@heroui/react` Select/Autocomplete always
      // closes its popover on selection with no override (`shouldCloseOnSelect` is not a real
      // prop on Select/Autocomplete, only on Menu/DatePicker; verified against the installed
      // react-aria-components type defs). Always closing here keeps this hand-rolled
      // Canvas/Preview dropdown's behavior honest with what Export can actually produce.
      setIsOpen(false);
      adaptValueChangeToDesignerEvent(eventProps.onChange, value);
      triggerPreviewFieldValidation(node.id, node.props, value, options.onPreviewFieldValidation, options.designerStore);
    }
  };

  const handleNativeSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const nextValue = event.target.value;
    setSelectedValue(nextValue);
    adaptValueChangeToDesignerEvent(eventProps.onChange, nextValue);
    triggerPreviewFieldValidation(node.id, node.props, nextValue, options.onPreviewFieldValidation, options.designerStore);
  };

  if (options.mode === 'runtime' && !insideDesignerDialog) {
    return (
      <div
        className={shellClassName}
        style={options.style}
        data-designer-component="heroui.select"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        <UiSelect
          label={label || undefined}
          ariaLabel={readString(node.props.ariaLabel, label || placeholder)}
          name={name}
          value={selectedValue}
          placeholder={placeholder}
          size={size}
          isDisabled={isDisabled}
          isRequired={readBoolean(node.props.isRequired)}
          isInvalid={isInvalid}
          errorMessage={errorMessage}
          isLoading={isLoading}
          className={readString(node.props.className)}
          onChange={(event) => {
            const nextValue = event.target.value;
            setSelectedValue(nextValue);
            adaptValueChangeToDesignerEvent(eventProps.onChange, nextValue);
            triggerPreviewFieldValidation(node.id, node.props, nextValue, options.onPreviewFieldValidation, options.designerStore);
          }}
        >
          {selectOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </UiSelect>
      </div>
    );
  }

  if (insideDesignerDialog) {
    return (
      <div
        className={shellClassName}
        style={options.style}
        data-designer-component="heroui.select"
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => event.stopPropagation()}
      >
        {label ? <span className={FORM_FIELD_LABEL_CLASS}>{label}</span> : null}
        <select
          aria-label={readString(node.props.ariaLabel, label || placeholder)}
          aria-invalid={isInvalid || undefined}
          name={name}
          value={selectedValue}
          disabled={isDisabled || isLoading}
          required={readBoolean(node.props.isRequired)}
          className={resolveHeroUiNativeSelectClass({
            size,
            isInvalid,
            className: readString(node.props.className),
          })}
          onChange={handleNativeSelectChange}
        >
          {placeholder ? <option value="">{placeholder}</option> : null}
          {selectOptions.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        {isInvalid && errorMessage ? (
          <p className="ps-[4px] text-xs text-rose-600" data-designer-field-error="true">{errorMessage}</p>
        ) : null}
      </div>
    );
  }

  const menuClassName = options.mode === 'runtime'
    ? 'absolute left-0 right-0 top-full z-[100] mt-1 max-h-60 overflow-y-auto overflow-x-hidden rounded-md border border-slate-200 bg-white py-1 shadow-sm'
    : 'overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-sm';

  return (
    <div
      className={[
        shellClassName,
        options.mode === 'runtime' ? 'relative' : '',
      ].filter(Boolean).join(' ')}
      style={options.style}
      data-designer-component="heroui.select"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      {label ? <span className={FORM_FIELD_LABEL_CLASS}>{label}</span> : null}
      {name ? <input type="hidden" name={name} value={selectedValue} readOnly /> : null}
      <button
        type="button"
        disabled={isDisabled || isLoading}
        className={triggerClassName}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-invalid={isInvalid || undefined}
        aria-label={readString(node.props.ariaLabel, label || placeholder)}
        onClick={handleTriggerClick}
      >
        <span className="min-w-0 flex-1 truncate text-left">
          {isLoading ? `${placeholder}…` : displayLabel}
        </span>
        <span aria-hidden="true" className="text-xs text-slate-500">▾</span>
      </button>

      {isOpen ? (
        <div
          role="listbox"
          data-designer-select-menu="true"
          className={menuClassName}
          aria-label={readString(node.props.ariaLabel, label || placeholder)}
          aria-busy={isLoading || undefined}
        >
          {isLoading ? (
            <p className="px-3 py-2 text-xs text-slate-500">Loading options…</p>
          ) : selectOptions.length === 0 ? (
            <p className="px-3 py-2 text-xs text-slate-500">No options configured.</p>
          ) : (
            selectOptions.map((item) => {
              const isSelected = selectedValue === item.value;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={isDisabled}
                  className={`block w-full px-3 py-2 text-left text-sm ${
                    isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
                  } ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  onClick={handleOptionClick(item.value)}
                >
                  {item.label}
                </button>
              );
            })
          )}
        </div>
      ) : null}
      {isInvalid && errorMessage ? (
        <p className="ps-[4px] text-xs text-rose-600" data-designer-field-error="true">{errorMessage}</p>
      ) : null}
    </div>
  );
};
