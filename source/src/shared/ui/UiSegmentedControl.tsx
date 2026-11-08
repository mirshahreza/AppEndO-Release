import * as React from 'react';
import { ToggleButton, ToggleButtonGroup } from '@heroui/react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export type UiSegmentedControlVisualMode = 'label' | 'icon-label' | 'icon-only';

export type UiSegmentedControlItem = {
  id: string;
  label?: string;
  accessibleLabel?: string;
  icon?: LucideIcon;
  disabled?: boolean;
  /** Merged onto the segment button; use `data-[selected]:` variants to override selected chrome. */
  className?: string;
};

export type UiSegmentedControlProps = {
  items: UiSegmentedControlItem[];
  selectedKey?: string;
  defaultSelectedKey?: string;
  onSelectionChange?: (key: string) => void;
  visualMode?: UiSegmentedControlVisualMode;
  width?: 'fit' | 'equal';
  orientation?: 'horizontal' | 'vertical';
  isDisabled?: boolean;
  /** When true, no segment is selected until the user picks one (form fields with no default). */
  allowEmptySelection?: boolean;
  ariaLabel: string;
  className?: string;
};

function initialSelection(items: UiSegmentedControlItem[], requested?: string): string {
  if (requested && items.some((item) => item.id === requested && !item.disabled)) return requested;
  return items.find((item) => !item.disabled)?.id ?? items[0]?.id ?? '';
}

function validateItems(
  items: UiSegmentedControlItem[],
  visualMode: UiSegmentedControlVisualMode,
): void {
  if (import.meta.env.PROD) return;
  for (const item of items) {
    if (visualMode === 'icon-only' && (!item.icon || !item.accessibleLabel)) {
      console.warn(
        `UiSegmentedControl: icon-only segment "${item.id}" requires icon and accessibleLabel.`,
      );
    }
    if (visualMode !== 'icon-only' && !item.label) {
      console.warn(`UiSegmentedControl: ${visualMode} segment "${item.id}" requires label.`);
    }
  }
}

export const UiSegmentedControl = React.forwardRef<HTMLDivElement, UiSegmentedControlProps>(
  function UiSegmentedControl(
    {
      items,
      selectedKey,
      defaultSelectedKey,
      onSelectionChange,
      visualMode = 'label',
      width = 'fit',
      orientation = 'horizontal',
      isDisabled = false,
      allowEmptySelection = false,
      ariaLabel,
      className,
    },
    ref,
  ) {
    validateItems(items, visualMode);

    const [uncontrolledKey, setUncontrolledKey] = React.useState(() =>
      initialSelection(items, defaultSelectedKey),
    );
    const resolvedKey =
      selectedKey !== undefined ? selectedKey : initialSelection(items, uncontrolledKey);

    const handleSelectionChange = React.useCallback(
      (keys: Set<React.Key>) => {
        const nextKey = Array.from(keys, String)[0];
        if (!nextKey) return;
        if (selectedKey === undefined) setUncontrolledKey(nextKey);
        onSelectionChange?.(nextKey);
      },
      [onSelectionChange, selectedKey],
    );

    return (
      <ToggleButtonGroup
        ref={ref}
        aria-label={ariaLabel}
        selectionMode="single"
        disallowEmptySelection={!allowEmptySelection}
        selectedKeys={new Set(resolvedKey ? [resolvedKey] : [])}
        onSelectionChange={handleSelectionChange}
        orientation={orientation}
        isDisabled={isDisabled}
        fullWidth={width === 'equal'}
        size="sm"
        data-visual-mode={visualMode}
        data-width={width}
        data-orientation={orientation}
        className={cn(
          'rounded-md border border-slate-200 bg-slate-100 p-0.5',
          orientation === 'vertical' && 'flex-col',
          width === 'equal' && '[&>[role=button]]:flex-1',
          className,
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const accessibleName =
            visualMode === 'icon-only' ? item.accessibleLabel : item.label ?? item.accessibleLabel;
          return (
            <ToggleButton
              key={item.id}
              id={item.id}
              aria-label={accessibleName}
              isDisabled={item.disabled}
              isIconOnly={visualMode === 'icon-only'}
              variant="ghost"
              className={cn(
                'group relative min-h-7 gap-1.5 rounded px-2 text-xs font-semibold text-slate-600',
                'data-[selected]:bg-white data-[selected]:text-primary-700 data-[selected]:shadow-sm',
                'focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1',
                width === 'equal' && 'flex-1',
                item.className,
              )}
            >
              {Icon && visualMode !== 'label' ? <Icon aria-hidden className="h-3.5 w-3.5" /> : null}
              {visualMode !== 'icon-only' ? <span>{item.label}</span> : null}
              {visualMode === 'icon-only' && item.accessibleLabel ? (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute start-1/2 top-full z-20 mt-1 hidden -translate-x-1/2 whitespace-nowrap rounded bg-slate-900 px-1.5 py-1 text-[10px] font-medium text-white shadow-lg group-hover:block group-focus-visible:block"
                >
                  {item.accessibleLabel}
                </span>
              ) : null}
            </ToggleButton>
          );
        })}
      </ToggleButtonGroup>
    );
  },
);
