import * as React from 'react';
import { UiAutocomplete } from '../../shared/ui/HeroFieldControls';
import { resolveCanvasMockEventProps } from './bindingCanvasResolver';
import { resolveCanvasPreviewEventProps } from './bindingPreviewHandlers';
import {
  parseDesignerAutocompleteItems,
  type DesignerAutocompleteItem,
} from './designerAutocompleteItems';
import {
  resolveAutocompleteMenuProps,
  resolveInputValidationProps,
  resolveRegionFormFieldNameProps,
  resolveRuntimeComponentProps,
} from './runtimeNodeProps';
import { readBoolean, readString, resolveFieldSize, resolveRuntimeNodeClassName } from './runtimeShared';
import { useDesignerOptionItems } from './useDesignerOptionItems';
import { triggerPreviewFieldValidation } from './previewFieldValidation';
import type { DesignerNode } from './types';
import type { RuntimeRenderOptions } from './runtimeTypes';

type DesignerRuntimeAutocompleteProps = {
  node: DesignerNode;
  options: RuntimeRenderOptions;
  interactionClass?: string;
};

const MENU_ASYNC_EXCLUDE_KEYS = new Set(['isLoading', 'closeOnSelect', 'shouldCloseOnSelect', 'allowCustomValue']);
const INPUT_VALIDATION_EXCLUDE_KEYS = new Set([
  'isRequired',
  'required',
  'isInvalid',
  'errorMessage',
  'validationBehavior',
  'validate',
]);

const toAutocompleteItems = (items: Array<{ value: string; label: string }>): DesignerAutocompleteItem[] =>
  items.map((item) => ({
    id: item.value,
    textValue: item.label,
  }));

const resolveCanvasEventProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): Record<string, (event: Event) => void> =>
  options.mode === 'runtime' && options.previewEvents
    ? resolveCanvasPreviewEventProps(node, options.previewEvents)
    : resolveCanvasMockEventProps(node);

export const DesignerRuntimeAutocomplete: React.FC<DesignerRuntimeAutocompleteProps> = ({
  node,
  options,
  interactionClass,
}) => {
  const { items, isLoading: itemsLoading } = useDesignerOptionItems(node, options);
  const manualLoading = readBoolean(node.props.isLoading);
  const isLoading = itemsLoading || manualLoading;
  const staticItemsKey = typeof node.props.items === 'string'
    ? node.props.items
    : JSON.stringify(node.props.items ?? '');
  const autocompleteItems = React.useMemo(
    () => (items.length > 0
      ? toAutocompleteItems(items)
      : parseDesignerAutocompleteItems(node.props.items)),
    [items, staticItemsKey],
  );
  const boundSelectedKeys = options.previewBindings?.resolveSelectSelectedKeys?.(node);
  const staticSelectedKey = readString(node.props.selectedKeys).split(',')[0]?.trim() ?? '';
  const initialValue = boundSelectedKeys ?? staticSelectedKey;
  const [selectedValue, setSelectedValue] = React.useState(initialValue);
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const eventProps = resolveCanvasEventProps(node, options);
  const libraryPassthrough = resolveRuntimeComponentProps(node, {
    libraryComponent: true,
    excludeKeys: new Set(['label', 'placeholder', 'items', ...INPUT_VALIDATION_EXCLUDE_KEYS, ...MENU_ASYNC_EXCLUDE_KEYS]),
  });
  const label = options.previewBindings?.resolveTextProp?.(node, 'label', 'Autocomplete')
    ?? readString(node.props.label, 'Autocomplete');
  const placeholder = options.previewBindings?.resolveTextProp?.(node, 'placeholder', 'Select…')
    ?? readString(node.props.placeholder, 'Select…');
  const name = resolveRegionFormFieldNameProps(node).name
    ?? (typeof node.props.name === 'string' ? node.props.name : undefined);

  React.useEffect(() => {
    setSelectedValue(initialValue);
  }, [initialValue]);

  return (
    <UiAutocomplete
      {...libraryPassthrough}
      {...resolveInputValidationProps(node, options.previewFieldErrors)}
      {...resolveAutocompleteMenuProps(node)}
      label={label}
      name={name}
      value={selectedValue}
      placeholder={placeholder}
      items={autocompleteItems}
      isDisabled={isDisabled || isLoading}
      isPending={isLoading}
      size={resolveFieldSize(node.props.size)}
      className={resolveRuntimeNodeClassName(node, interactionClass)}
      onChange={(event: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedValue(event.target.value);
        triggerPreviewFieldValidation(node.id, node.props, event.target.value, options.onPreviewFieldValidation, options.designerStore);
        (eventProps.onChange as React.ChangeEventHandler<HTMLSelectElement> | undefined)?.(event);
      }}
      onBlur={eventProps.onBlur as React.FocusEventHandler<HTMLDivElement> | undefined}
      onMouseEnter={eventProps.onMouseEnter as React.MouseEventHandler<HTMLDivElement> | undefined}
    />
  );
};
