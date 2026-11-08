import type { HeroUiFieldSize } from '../../shared/ui/heroFieldSize';
import { resolveCanvasInputValue, resolveCanvasMockEventProps } from './bindingCanvasResolver';
import { resolveCanvasPreviewEventProps } from './bindingPreviewHandlers';
import { getNodePropertyBinding } from './bindingEngine';
import { sanitizeDesignerHtml } from './sanitizeDesignerHtml';
import { resolveDesignerRichTextToolbarProps } from '../../shared/lib/designerRichTextConfig';
import {
  resolveInputValidationProps,
  resolveInputUxProps,
  resolveRegionFormFieldNameProps,
} from './runtimeNodeProps';
import { readBoolean, readNumber, readString, resolveFieldSize } from './runtimeShared';
import { triggerPreviewFieldValidation } from './previewFieldValidation';
import type { DesignerNode } from './types';
import type { RuntimeRenderOptions } from './runtimeTypes';
import { resolveDesignerMaskInputPreview } from '../../shared/lib/designerMaskInputConfig';
import { normalizeHexColor } from '../../shared/lib/uiColorUtils';

export type DesignerFormFieldRenderProps = {
  label?: string;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  description?: string;
  isDisabled?: boolean;
  isRequired?: boolean;
  isInvalid?: boolean;
  errorMessage?: string;
  readOnly?: boolean;
  className?: string;
  name?: string;
  ariaLabel?: string;
  size?: HeroUiFieldSize;
  onChange?: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLElement>;
  onMouseEnter?: React.MouseEventHandler<HTMLElement>;
};

const readPropString = (node: DesignerNode, key: string, fallback = ''): string =>
  readString(node.props[key], fallback);

const readPropBoolean = (node: DesignerNode, key: string): boolean =>
  readBoolean(node.props[key]);

const readPropNumber = (node: DesignerNode, key: string, fallback: number): number =>
  readNumber(node.props[key], fallback);

export const resolveDesignerFormFieldBaseProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): DesignerFormFieldRenderProps => {
  // Bug found: this shared base was always using the inert console.log-only mock handler, even in
  // interactive runtime preview — so a configured onChange/onBlur action for every widget built on
  // top of it (form.code-editor, form.html-editor, form.mask-input, form.calculator,
  // heroui.color-control, heroui.date-picker) silently never fired on the live canvas, though it
  // worked fine in exported/published code. Same class of bug already fixed for heroui.select and
  // heroui.entity-picker / form.date-range.
  const mockEvents = options.mode === 'runtime' && options.previewEvents
    ? resolveCanvasPreviewEventProps(node, options.previewEvents)
    : resolveCanvasMockEventProps(node);
  const validation = resolveInputValidationProps(node, options.previewFieldErrors);
  const ux = resolveInputUxProps(node);
  const isDisabled = readPropBoolean(node, 'isDisabled') || readPropBoolean(node, 'disabled');
  const canvasValue = options.previewBindings?.resolveInputValue?.(node)
    ?? resolveCanvasInputValue(node);
  const staticValue = typeof node.props.value === 'string' ? node.props.value : undefined;
  const resolvedValue = canvasValue ?? staticValue;

  // Bug found (parity audit item 1): live per-keystroke/on-blur validation
  // (isInvalid/errorMessage) never fired for any widget built on this shared base
  // (form.code-editor/html-editor/mask-input/calculator, heroui.color-control/date-picker) —
  // only heroui.input-text/number-input/textarea had it wired (runtimeRenderer.tsx's
  // sharedFieldEventProps). This shared base is the single choke point for all six, so wiring
  // it once here covers all of them.
  const baseOnBlur = mockEvents.onBlur as React.FocusEventHandler<HTMLElement> | undefined;

  // Bug found (parity audit items 42/61): onBlur previously validated `resolvedValue` captured
  // from node.props at render time. Interactive preview never mutates node.props while the user
  // types (local component state only), so a freshly typed valid value still failed as required/
  // stale. Keep a mutable live box updated by onChange (same render's props object) and always
  // validate that — do NOT read event.target.value here: nested controls like UiColorField's
  // type="color" input report a non-empty default hex even when the text value is empty.
  const liveValueBox = { current: resolvedValue ?? '' };

  return {
    label: readPropString(node, 'label'),
    value: resolvedValue,
    placeholder: readPropString(node, 'placeholder'),
    description: typeof ux.description === 'string' ? ux.description : undefined,
    isDisabled,
    isRequired: readPropBoolean(node, 'isRequired') || readPropBoolean(node, 'required'),
    isInvalid: validation.isInvalid === true,
    errorMessage: typeof validation.errorMessage === 'string' ? validation.errorMessage : undefined,
    readOnly: readPropBoolean(node, 'readOnly'),
    name: resolveRegionFormFieldNameProps(node).name
      ?? (typeof node.props.name === 'string' ? node.props.name : undefined),
    ariaLabel: readPropString(node, 'ariaLabel'),
    size: resolveFieldSize(node.props.size),
    onBlur: (event) => {
      baseOnBlur?.(event);
      triggerPreviewFieldValidation(
        node.id,
        node.props,
        liveValueBox.current,
        options.onPreviewFieldValidation,
        options.designerStore,
      );
    },
    onMouseEnter: mockEvents.onMouseEnter as React.MouseEventHandler<HTMLElement> | undefined,
    onChange: mockEvents.onChange || options.onPreviewFieldValidation
      ? (nextValue: string) => {
        liveValueBox.current = nextValue;
        options.onPreviewFieldValidation?.(node.id, null);
        mockEvents.onChange?.({ target: { value: nextValue } } as unknown as Event);
      }
      : undefined,
  };
};

export const resolveDesignerMonacoFieldProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
) => ({
  ...resolveDesignerFormFieldBaseProps(node, options),
  language: readPropString(node, 'language', 'typescript'),
  theme: readPropString(node, 'theme', 'vs'),
  editorHeight: node.props.editorHeight,
  lineNumbers: readPropBoolean(node, 'lineNumbers'),
  wordWrap: node.props.wordWrap !== false,
  readOnly: readPropBoolean(node, 'readOnly'),
  minimap: readPropBoolean(node, 'minimap'),
  tabSize: readPropNumber(node, 'tabSize', 2),
  fontSize: readPropNumber(node, 'fontSize', 13),
});

export const resolveDesignerHtmlEditorFieldProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
) => {
  const base = resolveDesignerFormFieldBaseProps(node, options);
  return {
    ...base,
    value: typeof base.value === 'string' ? sanitizeDesignerHtml(base.value) : base.value,
    defaultValue: typeof base.defaultValue === 'string'
      ? sanitizeDesignerHtml(base.defaultValue)
      : base.defaultValue,
    placeholder: readPropString(node, 'placeholder', 'Start writing…'),
    editorHeight: node.props.editorHeight,
    fontSize: readPropNumber(node, 'fontSize', 14),
    ...resolveDesignerRichTextToolbarProps(node.props),
  };
};

export const resolveDesignerMarkdownEditorFieldProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
) => {
  const base = resolveDesignerFormFieldBaseProps(node, options);
  return {
    ...base,
    placeholder: readPropString(node, 'placeholder', 'Write in Markdown…'),
    editorHeight: node.props.editorHeight,
    fontSize: readPropNumber(node, 'fontSize', 14),
    ...resolveDesignerRichTextToolbarProps(node.props),
  };
};

export const resolveDesignerColorEditorFieldProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
) => {
  const base = resolveDesignerFormFieldBaseProps(node, options);
  const resolvedValue = typeof base.value === 'string'
    ? (normalizeHexColor(base.value) ?? base.value)
    : base.value;
  return {
    ...base,
    value: resolvedValue,
    placeholder: readPropString(node, 'placeholder', '#RRGGBB'),
    showAlpha: readPropBoolean(node, 'showAlpha'),
    presetColors: readPropString(node, 'presetColors'),
  };
};

export const resolveDesignerDatePickerFieldProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
) => {
  const firstDayOfWeek = readPropString(node, 'firstDayOfWeek');
  const pageBehavior = readPropString(node, 'pageBehavior', 'visible');

  return {
    ...resolveDesignerFormFieldBaseProps(node, options),
    placeholder: readPropString(node, 'placeholder', 'Select date'),
    calendarSystem: readPropString(node, 'calendarSystem', 'gregorian'),
    locale: readPropString(node, 'locale'),
    granularity: readPropString(node, 'granularity', 'day'),
    hourCycle: readPropString(node, 'hourCycle', 'auto'),
    hideTimeZone: node.props.hideTimeZone === true,
    shouldForceLeadingZeros: node.props.shouldForceLeadingZeros !== false,
    minValue: readPropString(node, 'minValue'),
    maxValue: readPropString(node, 'maxValue'),
    placeholderValue: readPropString(node, 'placeholderValue'),
    firstDayOfWeek: firstDayOfWeek === 'sun'
      || firstDayOfWeek === 'mon'
      || firstDayOfWeek === 'tue'
      || firstDayOfWeek === 'wed'
      || firstDayOfWeek === 'thu'
      || firstDayOfWeek === 'fri'
      || firstDayOfWeek === 'sat'
      ? firstDayOfWeek
      : '',
    timeZone: readPropString(node, 'timeZone'),
    isReadOnly: readPropBoolean(node, 'isReadOnly') || readPropBoolean(node, 'readOnly'),
    autoFocus: readPropBoolean(node, 'autoFocus'),
    visibleMonths: readPropNumber(node, 'visibleMonths', 1),
    pageBehavior: pageBehavior === 'single' ? 'single' as const : 'visible' as const,
  };
};

export const resolveDesignerMaskInputFieldProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
) => {
  const base = resolveDesignerFormFieldBaseProps(node, options);
  const maskProps = {
    maskKind: readPropString(node, 'maskKind', 'pattern'),
    maskPreset: readPropString(node, 'maskPreset', 'phone-ir-mobile'),
    maskPattern: readPropString(node, 'maskPattern'),
    maskPlaceholderChar: readPropString(node, 'maskPlaceholderChar', '_'),
    maskLazy: node.props.maskLazy !== false,
    maskEager: node.props.maskEager === true,
    maskOverwrite: node.props.maskOverwrite !== false,
    maskAutofix: node.props.maskAutofix !== false,
    maskDefinitions: readPropString(node, 'maskDefinitions'),
    maskBlocks: readPropString(node, 'maskBlocks'),
    maskEnum: readPropString(node, 'maskEnum'),
    maskRegExp: readPropString(node, 'maskRegExp'),
    maskNumberScale: readPropString(node, 'maskNumberScale'),
    maskNumberRadix: readPropString(node, 'maskNumberRadix', '.'),
    maskNumberThousandsSeparator: readPropString(node, 'maskNumberThousandsSeparator', ','),
    maskNumberPadFractionalZeros: node.props.maskNumberPadFractionalZeros === true,
    maskNumberNormalizeZeros: node.props.maskNumberNormalizeZeros !== false,
    maskNumberMin: readPropString(node, 'maskNumberMin'),
    maskNumberMax: readPropString(node, 'maskNumberMax'),
    maskDatePattern: readPropString(node, 'maskDatePattern', 'Y-m-d'),
    maskOptionsJson: readPropString(node, 'maskOptionsJson'),
    unmask: readPropBoolean(node, 'unmask'),
  };
  const preview = resolveDesignerMaskInputPreview(maskProps);
  const boundValue = typeof base.value === 'string'
    ? base.value
    : resolveCanvasInputValue(node);
  const hasValueBinding = Boolean(getNodePropertyBinding(node, 'value'));
  const staticValue = typeof node.props.value === 'string' ? node.props.value : undefined;
  const useControlledValue = hasValueBinding
    || boundValue !== undefined
    || (options.mode === 'runtime' && staticValue !== undefined && staticValue !== '');

  const { value: _ignoredValue, ...baseWithoutValue } = base;

  return {
    ...baseWithoutValue,
    ...maskProps,
    value: useControlledValue ? (boundValue ?? staticValue ?? '') : undefined,
    defaultValue: useControlledValue ? undefined : (staticValue ?? ''),
    placeholder: base.placeholder?.trim().length ? base.placeholder : preview.inputPlaceholder,
    showMaskFormatHint: node.props.showMaskFormatHint === true,
  };
};

export const resolveDesignerCalculatorFieldProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
) => ({
  ...resolveDesignerFormFieldBaseProps(node, options),
  min: readPropString(node, 'min'),
  max: readPropString(node, 'max'),
  step: readPropString(node, 'step'),
  decimalPlaces: readPropNumber(node, 'decimalPlaces', 2),
  showKeypad: node.props.showKeypad !== false,
  keypadMode: readPropString(node, 'keypadMode', 'basic') === 'scientific' ? 'scientific' as const : 'basic' as const,
  allowManualInput: node.props.allowManualInput !== false,
});
