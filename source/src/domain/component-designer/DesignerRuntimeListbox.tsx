import * as React from 'react';
import { resolveCanvasPreviewEventProps } from './bindingPreviewHandlers';
import { resolveCanvasMockEventProps } from './bindingCanvasResolver';
import { readBoolean, readString, resolveRuntimeNodeClassName } from './runtimeShared';
import { useDesignerOptionItems } from './useDesignerOptionItems';
import type { DesignerNode } from './types';
import type { RuntimeRenderOptions } from './runtimeTypes';

type DesignerRuntimeListboxProps = {
  node: DesignerNode;
  options: RuntimeRenderOptions;
  interactionClass?: string;
};

/**
 * HeroUI ListBox Root (via RAC MultipleSelection) exposes `onSelectionChange(keys)`.
 * Designer Interactions handlers are Event-shaped; adapt selected keys → event.target.value.
 */
const adaptSelectionChangeToDesignerEvent = (
  onSelectionChange: ((event: Event) => void) | undefined,
  nextKeys: Iterable<string> | string,
): void => {
  if (!onSelectionChange) {
    return;
  }
  const serialized = typeof nextKeys === 'string'
    ? nextKeys
    : Array.from(nextKeys).join(',');
  onSelectionChange({ target: { value: serialized } } as unknown as Event);
};

const resolveListboxEventProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): Record<string, (event: Event) => void> =>
  options.mode === 'runtime' && options.previewEvents
    ? resolveCanvasPreviewEventProps(node, options.previewEvents)
    : resolveCanvasMockEventProps(node);

export const DesignerRuntimeListbox: React.FC<DesignerRuntimeListboxProps> = ({
  node,
  options,
  interactionClass,
}) => {
  const { items, isLoading } = useDesignerOptionItems(node, options);
  // Bug found (parity audit item 69): "Selected Keys" Property Binding was ignored in Preview/
  // Canvas — only the static Inspector string was read. Mirror DesignerRuntimeSelect's
  // resolveSelectSelectedKeys wiring so a bound CSV (or single key) seeds selection.
  const boundSelectedKeys = options.previewBindings?.resolveSelectSelectedKeys?.(node);
  const staticSelectedKeys = boundSelectedKeys ?? readString(node.props.selectedKeys);
  const [selectedKey, setSelectedKey] = React.useState(
    staticSelectedKeys.split(',')[0]?.trim() ?? '',
  );
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const shellClassName = resolveRuntimeNodeClassName(node, interactionClass);
  const eventProps = resolveListboxEventProps(node, options);

  React.useEffect(() => {
    const nextKey = staticSelectedKeys.split(',')[0]?.trim() ?? '';
    if (nextKey) {
      setSelectedKey(nextKey);
    }
  }, [staticSelectedKeys]);

  if (isLoading) {
    return (
      <div className={`${shellClassName} text-xs text-slate-500`} aria-busy="true">
        Loading options…
      </div>
    );
  }

  return (
    <div className={shellClassName} role="listbox" aria-label={readString(node.props.ariaLabel, 'Listbox')}>
      {items.map((item) => {
        const isSelected = selectedKey === item.value;
        return (
          <button
            key={item.value}
            type="button"
            role="option"
            aria-selected={isSelected}
            disabled={isDisabled}
            className={`block w-full rounded px-2 py-1.5 text-left text-sm ${
              isSelected ? 'bg-indigo-50 text-indigo-700' : 'text-slate-700 hover:bg-slate-50'
            } ${isDisabled ? 'cursor-not-allowed opacity-50' : ''}`}
            onClick={() => {
              if (isDisabled) {
                return;
              }
              setSelectedKey(item.value);
              adaptSelectionChangeToDesignerEvent(eventProps.onSelectionChange, [item.value]);
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
};
