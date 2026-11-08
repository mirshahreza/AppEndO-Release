import * as React from 'react';
import * as LucideIcons from 'lucide-react';
import { resolveCanvasPreviewEventProps } from './bindingPreviewHandlers';
import { resolveCanvasMockEventProps } from './bindingCanvasResolver';
import { readBoolean, readString, resolveRuntimeNodeClassName } from './runtimeShared';
import { useDesignerOptionItems } from './useDesignerOptionItems';
import type { DesignerNode } from './types';
import type { RuntimeRenderOptions } from './runtimeTypes';

const resolveLucideIconForDropdown = (name: unknown): React.ReactNode => {
  if (typeof name !== 'string' || !name) return null;
  const icons = LucideIcons as unknown as Record<string, React.ComponentType<{ className?: string; size?: number }>>;
  const Icon = icons[name];
  return Icon ? <Icon className="h-3.5 w-3.5" /> : null;
};

type DesignerRuntimeDropdownProps = {
  node: DesignerNode;
  options: RuntimeRenderOptions;
  interactionClass?: string;
};

// Bug found (parity audit item P3.15): @heroui/react's real Dropdown component family has no
// size variant at all (see inspectorPaletteFields.ts's HEROUI_DROPDOWN_FIELDS), so the
// Inspector's "Size" field was removed entirely rather than left decorative. This single fixed
// class replaces the old node.props.size-driven lookup, which could never be changed by an
// author anymore anyway.
const DROPDOWN_TRIGGER_CLASS = 'h-9 min-h-9 px-3 text-sm';

/**
 * HeroUI Dropdown.Menu (RAC Menu) exposes `onAction(key)` — not onSelectionChange.
 * Designer Interactions handlers are Event-shaped; adapt key → event.target.value.
 */
const adaptActionToDesignerEvent = (
  onAction: ((event: Event) => void) | undefined,
  key: string,
): void => {
  if (!onAction) {
    return;
  }
  onAction({ target: { value: key } } as unknown as Event);
};

const resolveDropdownEventProps = (
  node: DesignerNode,
  options: RuntimeRenderOptions,
): Record<string, (event: Event) => void> =>
  options.mode === 'runtime' && options.previewEvents
    ? resolveCanvasPreviewEventProps(node, options.previewEvents)
    : resolveCanvasMockEventProps(node);

export const DesignerRuntimeDropdown: React.FC<DesignerRuntimeDropdownProps> = ({
  node,
  options,
  interactionClass,
}) => {
  const { items, isLoading } = useDesignerOptionItems(node, options);
  // Bug found (parity audit item 68): Export already resolves bound `label` via
  // renderBoundJsxTextExpression, but Canvas/Preview (this component) only read the static
  // prop — so a Property Binding on Label never appeared in the live designer. Mirror the
  // Card/Modal/Accordion resolveTextProp pattern.
  const label = options.previewBindings?.resolveTextProp?.(node, 'label', 'Actions')
    ?? readString(node.props.label, 'Actions');
  const isDisabled = readBoolean(node.props.isDisabled) || readBoolean(node.props.disabled);
  const shellClassName = resolveRuntimeNodeClassName(
    node,
    'flex w-full max-w-full flex-col items-stretch gap-1',
    interactionClass,
  );
  const triggerClassName = [
    DROPDOWN_TRIGGER_CLASS,
    'inline-flex w-full items-center justify-between gap-1 rounded-md border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50',
  ].join(' ');
  const eventProps = resolveDropdownEventProps(node, options);

  return (
    <div
      className={shellClassName}
      style={options.style}
      data-designer-component="heroui.dropdown"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        disabled={isDisabled || isLoading}
        className={triggerClassName}
        aria-haspopup="menu"
        aria-expanded="true"
        aria-label={readString(node.props.ariaLabel, label)}
      >
        {resolveLucideIconForDropdown(node.props.startIcon)}
        <span>{isLoading ? `${label}…` : label}</span>
        {resolveLucideIconForDropdown(node.props.endIcon)}
        <span aria-hidden="true" className="text-xs text-slate-500">▾</span>
      </button>

      <div
        role="menu"
        data-designer-dropdown-menu="true"
        className="overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-sm"
        aria-busy={isLoading || undefined}
      >
        {isLoading ? (
          <p className="px-3 py-2 text-xs text-slate-500">Loading options…</p>
        ) : items.length === 0 ? (
          <p className="px-3 py-2 text-xs text-slate-500">No options configured.</p>
        ) : (
          items.map((item) => (
            <button
              key={item.value}
              type="button"
              role="menuitem"
              disabled={isDisabled}
              className="block w-full px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={(event) => {
                event.stopPropagation();
                if (isDisabled) {
                  return;
                }
                adaptActionToDesignerEvent(eventProps.onAction, item.value);
              }}
            >
              {item.label}
            </button>
          ))
        )}
      </div>
    </div>
  );
};
