import * as React from 'react';
import { Autocomplete, ListBox } from '@heroui/react';
import {
  DesignerCalculatorField,
  DesignerCodeEditorField,
  DesignerColorEditorField,
  DesignerDatePickerField,
  DesignerHtmlEditorField,
  DesignerMarkdownEditorField,
} from '../../shared/ui/DesignerFormFields';
import { DesignerMaskInputField } from '../../shared/ui/DesignerMaskInputField';
import { UiSplitPane } from '../../shared/ui/UiSplitPane';
import { readUiDockPaneDock, UiDockPane } from '../../shared/ui/UiDockPane';
import { DesignerRuntimeDataGrid } from './DesignerRuntimeDataGrid';
import { DesignerRuntimeAppTableGrid } from './DesignerRuntimeAppTableGrid';
import { DesignerRuntimeCrudSet } from './DesignerRuntimeCrudSet';
import { DesignerRuntimeRecordForm } from './DesignerRuntimeRecordForm';
import { parseDesignerAutocompleteItems } from './designerAutocompleteItems';
import { resolveCanvasMockEventProps } from './bindingCanvasResolver';
import { resolveCanvasPreviewEventProps } from './bindingPreviewHandlers';
import {
  resolveDesignerCalculatorFieldProps,
  resolveDesignerColorEditorFieldProps,
  resolveDesignerDatePickerFieldProps,
  resolveDesignerHtmlEditorFieldProps,
  resolveDesignerMarkdownEditorFieldProps,
  resolveDesignerMaskInputFieldProps,
  resolveDesignerMonacoFieldProps,
} from './designerFormFieldRuntime';
import { resolveDateRangeProps, resolveEntityPickerProps, resolveInputValidationProps, validateDateRangeOrdering } from './runtimeNodeProps';
import { triggerPreviewFieldValidation } from './previewFieldValidation';
import type { DesignerNode } from './types';
import {
  mergeClassNames,
  readBoolean,
  readNumber,
  readString,
  resolveFieldSize,
  resolveRuntimeNodeClassName,
  wrapDesignerChildSlot,
} from './runtimeShared';
import type { RuntimeRenderMode, RuntimeRenderOptions } from './runtimeTypes';
import { DesignerDateRangeField } from './DesignerDateRangeField';
import { formatDesignerDatePickerValue } from '../../shared/lib/designerDatePickerConfig';

const HAutocomplete = Autocomplete as unknown as React.FC<Record<string, unknown>> & {
  Trigger: React.FC<Record<string, unknown>>;
  Value: React.FC<Record<string, unknown>>;
  Indicator: React.FC<Record<string, unknown>>;
  Popover: React.FC<Record<string, unknown>>;
};
const HListBox = ListBox as unknown as React.FC<Record<string, unknown>> & {
  Item: React.FC<Record<string, unknown>>;
};

const designInteractionClass = (mode: RuntimeRenderMode): string | undefined =>
  mode === 'design' ? 'pointer-events-none' : undefined;

/**
 * HeroUI DateRangePicker (react-aria) calls onChange with a {start,end} RangeValue<DateValue>,
 * not a DOM Event. Bug found: this was previously passed straight through to code that blindly
 * reads event.target.value, which would throw/no-op — Date Range's onChange never worked.
 * Serialize both dates into one "<start>,<end>" CSV designer event value.
 */
const adaptDateRangeChangeToDesignerEvent = (
  onChange: ((event: Event) => void) | undefined,
  range: { start: unknown; end: unknown } | null | undefined,
): void => {
  if (!onChange || !range) {
    return;
  }
  const start = formatDesignerDatePickerValue(range.start, 'day');
  const end = formatDesignerDatePickerValue(range.end, 'day');
  onChange({ target: { value: `${start},${end}` } } as unknown as Event);
};

/**
 * In interactive runtime preview (mode: 'runtime' + previewEvents present), dispatch through the
 * real designer event system (mutations, store writes, dynamic actions). Otherwise (static design
 * canvas), fall back to the console.log-only mock handler. Bug found: renderEntityPickerLeafNode
 * and renderDateRangeLeafNode previously always used the mock handler, even in interactive preview
 * — so a configured onChange/onBlur action for Entity Picker or Date Range silently never fired on
 * the live canvas (same class of bug already fixed for heroui.select's onChange wiring).
 */
const resolvePhase2CanvasEventProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): Record<string, (event: Event) => void> =>
  options.mode === 'runtime' && options.previewEvents
    ? resolveCanvasPreviewEventProps(node, options.previewEvents)
    : resolveCanvasMockEventProps(node);

export const renderDataGridStructuralNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions & { className?: string; children?: React.ReactNode },
): React.ReactNode => (
  <DesignerRuntimeDataGrid node={node} options={options} />
);

export const renderAppTableGridStructuralNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions & { className?: string; children?: React.ReactNode },
): React.ReactNode => (
  <DesignerRuntimeAppTableGrid node={node} options={options} />
);

export const renderCrudSetStructuralNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions & { className?: string },
): React.ReactNode => (
  <DesignerRuntimeCrudSet node={node} options={options} />
);

export const renderRecordFormStructuralNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions & { className?: string },
): React.ReactNode => (
  <DesignerRuntimeRecordForm node={node} options={options} />
);

export const renderEntityPickerLeafNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): React.ReactNode => {
  const entityProps = resolveEntityPickerProps(node);
  const { label: entityLabel, ...autocompleteEntityProps } = entityProps;
  const validation = resolveInputValidationProps(node, options.previewFieldErrors);
  const isInvalid = Boolean(validation.isInvalid);
  const errorMessage = typeof validation.errorMessage === 'string' ? validation.errorMessage : '';
  const mockEvents = resolvePhase2CanvasEventProps(node, options);
  const placeholder = options.previewBindings?.resolveTextProp?.(node, 'placeholder', 'Select entity…')
    ?? readString(node.props.placeholder, 'Select entity…');
  const label = options.previewBindings?.resolveTextProp?.(node, 'label', '')
    ?? (typeof entityLabel === 'string' ? entityLabel : readString(node.props.label));
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const items = parseDesignerAutocompleteItems(node.props.items ?? '[{"id":"entity-1","textValue":"Sample entity"}]');
  const fieldSize = resolveFieldSize(node.props.size);
  const triggerSizeClass = fieldSize === 'sm'
    ? 'h-8 min-h-8 px-2.5 text-xs'
    : 'h-9 min-h-9 px-3 text-sm';
  const triggerClassName = `${designInteractionClass(options.mode) ?? ''} rounded-[6px] border ${isInvalid ? 'border-rose-400' : 'border-slate-300'} bg-white ${triggerSizeClass}`;

  return (
    <div
      className={resolveRuntimeNodeClassName(node, 'flex w-full flex-col gap-[2px]')}
      style={options.style}
      data-designer-component="heroui.entity-picker"
    >
      {label ? <span className="ps-[4px] text-sm text-slate-700">{label}</span> : null}
      <HAutocomplete
        {...autocompleteEntityProps}
        aria-label={label || 'Entity picker'}
        aria-invalid={isInvalid || undefined}
        placeholder={placeholder}
        isDisabled={isDisabled || Boolean(autocompleteEntityProps.isPending)}
        isInvalid={isInvalid || undefined}
        size={resolveFieldSize(node.props.size)}
        className="w-full"
        onSelectionChange={(key: React.Key) => {
          if (key !== undefined && key !== null) {
            mockEvents.onChange?.({ target: { value: String(key) } } as unknown as Event);
            triggerPreviewFieldValidation(node.id, node.props, String(key), options.onPreviewFieldValidation, options.designerStore);
          }
        }}
        onBlur={mockEvents.onBlur as React.FocusEventHandler<HTMLDivElement> | undefined}
      >
        <HAutocomplete.Trigger className={triggerClassName}>
          <HAutocomplete.Value />
          <HAutocomplete.Indicator />
        </HAutocomplete.Trigger>
        <HAutocomplete.Popover>
          <HListBox>
            {items.map((item) => (
              <HListBox.Item key={item.id} id={item.id} textValue={item.textValue}>
                {item.textValue}
              </HListBox.Item>
            ))}
          </HListBox>
        </HAutocomplete.Popover>
      </HAutocomplete>
      {isInvalid && errorMessage ? (
        <p className="ps-[4px] text-xs text-rose-600" data-designer-field-error="true">{errorMessage}</p>
      ) : null}
    </div>
  );
};

export const renderDatePickerLeafNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): React.ReactNode => {
  const fieldProps = resolveDesignerDatePickerFieldProps(node, options);
  return (
    <div
      className={resolveRuntimeNodeClassName(node, 'w-full min-w-[220px]')}
      style={options.style}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <DesignerDatePickerField {...fieldProps} className="w-full" />
    </div>
  );
};

export const renderDateRangeLeafNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): React.ReactNode => {
  const dateRangeProps = resolveDateRangeProps(node, options);
  const validation = resolveInputValidationProps(node, options.previewFieldErrors);
  const isInvalid = Boolean(validation.isInvalid);
  const errorMessage = typeof validation.errorMessage === 'string' ? validation.errorMessage : '';
  const mockEvents = resolvePhase2CanvasEventProps(node, options);
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const fieldSize = resolveFieldSize(node.props.size);
  const triggerSizeClass = fieldSize === 'sm'
    ? 'h-8 min-h-8 px-2.5 text-xs'
    : 'h-9 min-h-9 px-3 text-sm';
  const triggerClassName = `${designInteractionClass(options.mode) ?? ''} rounded-[6px] border ${isInvalid ? 'border-rose-400' : 'border-slate-300'} bg-white ${triggerSizeClass} text-slate-600`;
  const granularity = readString(node.props.granularity, 'day');
  const startIso = options.previewBindings?.resolveTextProp?.(node, 'startValue', '')
    ?? readString(node.props.startValue);
  const endIso = options.previewBindings?.resolveTextProp?.(node, 'endValue', '')
    ?? readString(node.props.endValue);
  const label = options.previewBindings?.resolveTextProp?.(node, 'label', '')
    ?? readString(node.props.label);

  const commitRangeValidation = (start: string, end: string): void => {
    const orderingMessage = validateDateRangeOrdering(start, end);
    if (orderingMessage) {
      options.onPreviewFieldValidation?.(node.id, orderingMessage);
      return;
    }
    triggerPreviewFieldValidation(
      node.id,
      node.props,
      start.trim() && end.trim() ? `${start}/${end}` : '',
      options.onPreviewFieldValidation,
      options.designerStore,
    );
  };

  return (
    <div
      className={resolveRuntimeNodeClassName(node, '')}
      style={options.style}
      data-designer-component="form.date-range"
    >
      <DesignerDateRangeField
        label={label}
        startValue={startIso}
        endValue={endIso}
        presetsJson={readString(node.props.presets)}
        timeZone={readString(node.props.timeZone) || readString(dateRangeProps.timeZone as string | undefined)}
        granularity={granularity}
        minValue={readString(node.props.minValue)}
        maxValue={readString(node.props.maxValue)}
        isDisabled={isDisabled}
        isRequired={readBoolean(node.props.isRequired) || readBoolean(node.props.required)}
        isReadOnly={readBoolean(node.props.isReadOnly) || readBoolean(node.props.readOnly)}
        isInvalid={isInvalid}
        errorMessage={errorMessage}
        triggerClassName={triggerClassName}
        className="w-full"
        onChange={(start, end) => {
          adaptDateRangeChangeToDesignerEvent(mockEvents.onChange, start && end ? { start, end } : null);
          commitRangeValidation(start, end);
        }}
        onBlur={(event) => {
          const nextTarget = event.relatedTarget as Node | null;
          if (nextTarget && event.currentTarget.contains(nextTarget)) {
            return;
          }
          (mockEvents.onBlur as React.FocusEventHandler<HTMLDivElement> | undefined)?.(event);
          commitRangeValidation(startIso, endIso);
        }}
      />
    </div>
  );
};

export const renderCodeEditorLeafNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): React.ReactNode => {
  const fieldProps = resolveDesignerMonacoFieldProps(node, options);
  return (
    <DesignerCodeEditorField
      {...fieldProps}
      className={resolveRuntimeNodeClassName(node, 'w-full', designInteractionClass(options.mode))}
    />
  );
};

export const renderHtmlEditorLeafNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): React.ReactNode => {
  const fieldProps = resolveDesignerHtmlEditorFieldProps(node, options);
  return (
    <DesignerHtmlEditorField
      {...fieldProps}
      className={resolveRuntimeNodeClassName(node, 'w-full', designInteractionClass(options.mode))}
    />
  );
};

export const renderMarkdownEditorLeafNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): React.ReactNode => {
  const fieldProps = resolveDesignerMarkdownEditorFieldProps(node, options);
  return (
    <DesignerMarkdownEditorField
      {...fieldProps}
      className={resolveRuntimeNodeClassName(node, 'w-full', designInteractionClass(options.mode))}
    />
  );
};

export const renderColorEditorLeafNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): React.ReactNode => {
  const fieldProps = resolveDesignerColorEditorFieldProps(node, options);
  return (
    <DesignerColorEditorField
      {...fieldProps}
      className={resolveRuntimeNodeClassName(node, 'w-full', designInteractionClass(options.mode))}
    />
  );
};

export const renderMaskInputLeafNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): React.ReactNode => {
  const fieldProps = resolveDesignerMaskInputFieldProps(node, options);
  return (
    <div
      className={resolveRuntimeNodeClassName(node, 'w-full min-w-[220px]')}
      style={options.style}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <DesignerMaskInputField {...fieldProps} className="w-full" />
    </div>
  );
};

export const renderCalculatorLeafNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): React.ReactNode => {
  const fieldProps = resolveDesignerCalculatorFieldProps(node, options);
  return (
    <div
      className={resolveRuntimeNodeClassName(node, 'w-full min-w-[220px]')}
      style={options.style}
      data-designer-component="form.calculator"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <DesignerCalculatorField {...fieldProps} className="w-full" />
    </div>
  );
};

export const renderSplitPaneContainerNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions & { className?: string; children?: React.ReactNode[] },
): React.ReactNode => {
  // Bug found (parity audit item 38): direction/defaultSplit were always read from static
  // `node.props`, so Property Bindings were dead in Canvas/Preview (Export had the same gap).
  const direction = (
    options.previewBindings?.resolveTextProp?.(
      node,
      'direction',
      readString(node.props.direction, 'horizontal'),
    ) ?? readString(node.props.direction, 'horizontal')
  ).trim() || 'horizontal';
  const defaultSplit = options.previewBindings?.resolveNumberProp?.(
    node,
    'defaultSplit',
    readNumber(node.props.defaultSplit, 50),
  ) ?? readNumber(node.props.defaultSplit, 50);
  const isVertical = direction === 'vertical';
  const childElements = options.children ?? [];
  const panes = childElements.length > 0
    ? childElements
    : [
      <div key="split-placeholder-a" className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/80 p-3 text-xs text-slate-500">
        Pane
      </div>,
      <div key="split-placeholder-b" className="flex min-h-[120px] items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50/60 p-3 text-xs text-slate-500">
        Pane
      </div>,
    ];

  return (
    <UiSplitPane
      direction={isVertical ? 'vertical' : 'horizontal'}
      defaultSplit={defaultSplit}
      className={options.className}
      style={options.style}
      data-designer-component="layout.split-pane"
      data-default-split={defaultSplit}
      data-split-pane-count={String(panes.length)}
    >
      {panes.map((child, index) => (
        <React.Fragment key={index}>
          {wrapDesignerChildSlot(child, options.mode)}
        </React.Fragment>
      ))}
    </UiSplitPane>
  );
};

export const renderDockPaneContainerNode = (
  node: DesignerNode,
  options: RuntimeRenderOptions & { className?: string; children?: React.ReactNode[] },
): React.ReactNode => {
  const dock = readUiDockPaneDock(
    options.previewBindings?.resolveTextProp?.(
      node,
      'dock',
      readString(node.props.dock, 'left'),
    ) ?? readString(node.props.dock, 'left'),
  );

  return (
    <UiDockPane
      dock={dock}
      className={options.className}
      style={options.style}
      data-designer-component="layout.dock-pane"
    >
      {(options.children ?? []).map((child, index) => (
        <React.Fragment key={index}>
          {wrapDesignerChildSlot(child, options.mode)}
        </React.Fragment>
      ))}
    </UiDockPane>
  );
};