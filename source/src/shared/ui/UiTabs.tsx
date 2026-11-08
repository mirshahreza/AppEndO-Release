import React from 'react';
import { Tabs } from '@heroui/react';
import type { LucideIcon } from 'lucide-react';
import { Circle, Ellipsis } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AppButton } from './AppButton';

export type UiTabVisualMode = 'label' | 'icon-label' | 'icon-only';
export type UiTabsVariant = 'line' | 'contained';
export type UiTabsPlacement = 'top' | 'start' | 'end';
export type UiTabsAlignment = 'start' | 'center' | 'end';
export type UiTabsWidth = 'fit' | 'equal';
export type UiTabsActivation = 'automatic' | 'manual';
export type UiTabsPanelLifecycle = 'lazy-keep' | 'eager' | 'unmount';
export type UiTabsOverflow = 'scroll' | 'menu';
export type UiTabsPanelAttachment = 'integrated' | 'separated';
export type UiTabStatus = 'none' | 'info' | 'success' | 'warning' | 'error';

export type UiTabItem = {
  id: string;
  label?: string;
  accessibleLabel?: string;
  icon?: LucideIcon;
  badge?: string | number;
  status?: UiTabStatus;
  content: React.ReactNode;
  disabled?: boolean;
};

export type UiTabsProps = {
  items: UiTabItem[];
  selectedKey?: string;
  defaultSelectedKey?: string;
  onSelectionChange?: (key: string) => void;
  visualMode?: UiTabVisualMode;
  variant?: UiTabsVariant;
  placement?: UiTabsPlacement;
  alignment?: UiTabsAlignment;
  width?: UiTabsWidth;
  activationMode?: UiTabsActivation;
  panelLifecycle?: UiTabsPanelLifecycle;
  overflow?: UiTabsOverflow;
  panelAttachment?: UiTabsPanelAttachment;
  startContent?: React.ReactNode;
  endContent?: React.ReactNode;
  isDisabled?: boolean;
  ariaLabel: string;
  className?: string;
};

const STATUS_CLASS: Record<Exclude<UiTabStatus, 'none'>, string> = {
  info: 'bg-cyan-500',
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-rose-500',
};

function getInitialKey(items: UiTabItem[], requested?: string): string {
  if (requested && items.some((item) => item.id === requested && !item.disabled)) return requested;
  return items.find((item) => !item.disabled)?.id ?? items[0]?.id ?? '';
}

function validateItems(items: UiTabItem[], visualMode: UiTabVisualMode): void {
  if (import.meta.env.PROD) return;

  for (const item of items) {
    if (visualMode === 'icon-only' && (!item.icon || !item.accessibleLabel)) {
      console.warn(`UiTabs: icon-only tab "${item.id}" requires icon and accessibleLabel.`);
    }
    if (visualMode !== 'icon-only' && !item.label) {
      console.warn(`UiTabs: ${visualMode} tab "${item.id}" requires label.`);
    }
  }
}

/** Content-panel tabs built on HeroUI v3's Tabs compound API. */
export const UiTabs: React.FC<UiTabsProps> = ({
  items,
  selectedKey,
  defaultSelectedKey,
  onSelectionChange,
  visualMode = 'label',
  variant = 'line',
  placement = 'top',
  alignment = 'start',
  width = 'fit',
  activationMode = 'manual',
  panelLifecycle = 'lazy-keep',
  overflow = 'scroll',
  panelAttachment = 'integrated',
  startContent,
  endContent,
  isDisabled = false,
  ariaLabel,
  className,
}) => {
  validateItems(items, visualMode);

  const [uncontrolledKey, setUncontrolledKey] = React.useState(() =>
    getInitialKey(items, defaultSelectedKey),
  );
  const resolvedSelectedKey = getInitialKey(
    items,
    selectedKey !== undefined ? selectedKey : uncontrolledKey,
  );
  const resolvedWidth = width === 'equal' && items.length >= 2 && items.length <= 5 ? 'equal' : 'fit';
  const resolvedActivation =
    panelLifecycle === 'eager' ? activationMode : 'manual';
  const orientation = placement === 'top' ? 'horizontal' : 'vertical';
  const [visitedKeys, setVisitedKeys] = React.useState<Set<string>>(
    () => new Set(resolvedSelectedKey ? [resolvedSelectedKey] : []),
  );
  const tabRefs = React.useRef(new Map<string, HTMLElement>());

  React.useEffect(() => {
    if (!resolvedSelectedKey) return;
    setVisitedKeys((current) => {
      if (current.has(resolvedSelectedKey)) return current;
      const next = new Set(current);
      next.add(resolvedSelectedKey);
      return next;
    });
  }, [resolvedSelectedKey]);

  React.useLayoutEffect(() => {
    const selectedTab = tabRefs.current.get(resolvedSelectedKey);
    selectedTab?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [resolvedSelectedKey, items.length]);

  const select = React.useCallback(
    (key: React.Key) => {
      const nextKey = String(key);
      if (selectedKey === undefined) setUncontrolledKey(nextKey);
      onSelectionChange?.(nextKey);
    },
    [onSelectionChange, selectedKey],
  );

  const mountedItems =
    panelLifecycle === 'eager'
      ? items
      : panelLifecycle === 'unmount'
        ? items.filter((item) => item.id === resolvedSelectedKey)
        : items.filter((item) => item.id === resolvedSelectedKey || visitedKeys.has(item.id));

  const list = (
    <Tabs.ListContainer
      className={cn(
        'min-w-0 shrink-0',
        orientation === 'horizontal'
          ? 'flex flex-1 items-center [&>.tabs__list-container__scroller]:w-full'
          : 'flex h-full max-h-full [&>.tabs__list-container__scroller]:h-full',
        '[&>.tabs__list-container__scroller]:[scrollbar-width:none]',
        '[&>.tabs__list-container__scroller::-webkit-scrollbar]:hidden',
        variant === 'line' && '!rounded-none !bg-transparent',
        variant === 'contained' && panelAttachment === 'integrated' && '!rounded-t-md !rounded-b-none',
        variant === 'contained' && panelAttachment === 'separated' && '!rounded-md',
      )}
    >
      <Tabs.List
        aria-label={ariaLabel}
        data-width={resolvedWidth}
        className={cn(
          'min-w-0 gap-1',
          orientation === 'horizontal'
            ? 'flex min-w-full flex-nowrap'
            : 'flex min-h-full flex-col',
          alignment === 'start' && 'justify-start',
          alignment === 'center' && 'justify-center',
          alignment === 'end' && 'justify-end',
          resolvedWidth === 'fit' && orientation === 'horizontal' && 'w-max',
          resolvedWidth === 'equal' && orientation === 'horizontal' && '!w-full',
          resolvedWidth === 'equal' && orientation === 'vertical' && 'w-full',
          variant === 'line' && '!p-0',
          variant === 'contained'
            && panelAttachment === 'integrated'
            && '!rounded-t-md !rounded-b-none bg-slate-100 px-1 pt-1 pb-0',
          variant === 'contained'
            && panelAttachment === 'separated'
            && '!rounded-md bg-slate-100 p-1',
        )}
      >
        {items.map((item) => {
          const Icon = item.icon;
          const accessibleName =
            visualMode === 'icon-only' ? item.accessibleLabel : item.label ?? item.accessibleLabel;
          return (
            <Tabs.Tab
              key={item.id}
              id={item.id}
              ref={(node) => {
                if (node) tabRefs.current.set(item.id, node);
                else tabRefs.current.delete(item.id);
              }}
              aria-label={accessibleName}
              isDisabled={isDisabled || item.disabled}
              data-width={resolvedWidth}
              className={cn(
                'relative flex min-h-8 min-w-0 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap px-2.5 text-xs font-semibold text-slate-600 outline-none transition-colors',
                'focus-visible:ring-2 focus-visible:ring-primary-400 focus-visible:ring-offset-1',
                'data-[disabled]:cursor-not-allowed data-[disabled]:opacity-40',
                'data-[selected]:text-primary-700',
                orientation === 'horizontal' && resolvedWidth === 'fit' && '!w-auto flex-none',
                orientation === 'horizontal' && resolvedWidth === 'equal' && '!w-auto min-w-0 flex-1 basis-0',
                orientation === 'vertical' && resolvedWidth === 'fit' && '!w-auto self-start',
                orientation === 'vertical' && resolvedWidth === 'equal' && 'w-full',
                variant === 'contained'
                  ? cn(
                      '!rounded-md bg-transparent data-[selected]:bg-white data-[selected]:shadow-sm',
                      panelAttachment === 'integrated'
                        && 'data-[selected]:!rounded-b-none data-[selected]:shadow-none',
                    )
                  : cn(
                      '!rounded-none border-transparent data-[selected]:border-primary-500',
                      placement === 'top' && 'border-b-2',
                      placement === 'start' && 'border-e-2',
                      placement === 'end' && 'border-s-2',
                    ),
              )}
            >
              {Icon && visualMode !== 'label' ? <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" /> : null}
              {visualMode !== 'icon-only' ? <span className="truncate">{item.label}</span> : null}
              {item.badge !== undefined ? (
                <span className="rounded-full bg-slate-200 px-1.5 text-[10px] font-bold text-slate-700">
                  {item.badge}
                </span>
              ) : null}
              {item.status && item.status !== 'none' ? (
                <span
                  aria-label={`${item.status} status`}
                  className={cn('h-1.5 w-1.5 shrink-0 rounded-full', STATUS_CLASS[item.status])}
                />
              ) : null}
              <Tabs.Indicator className="hidden" />
            </Tabs.Tab>
          );
        })}
      </Tabs.List>
    </Tabs.ListContainer>
  );

  const allTabsMenu =
    overflow === 'menu' ? (
      <details className="relative shrink-0">
        <summary
          aria-label="Show all tabs"
          className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded text-slate-500 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary-400"
        >
          <Ellipsis aria-hidden className="h-3.5 w-3.5" />
        </summary>
        <div
          role="menu"
          className="absolute end-0 z-20 mt-1 min-w-40 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
        >
          {items.map((item) => (
            <AppButton
              key={item.id}
              role="menuitem"
              disabled={isDisabled || item.disabled}
              onClick={() => select(item.id)}
              className="flex h-7 w-full items-center justify-start gap-2 rounded px-2 text-start text-xs text-slate-700 hover:bg-slate-100 disabled:opacity-40"
            >
              <Circle aria-hidden className="h-2.5 w-2.5 shrink-0 fill-current opacity-40" />
              {item.label ?? item.accessibleLabel}
            </AppButton>
          ))}
        </div>
      </details>
    ) : null;

  return (
    <Tabs
      selectedKey={resolvedSelectedKey}
      onSelectionChange={select}
      orientation={orientation}
      keyboardActivation={resolvedActivation}
      variant={variant === 'line' ? 'secondary' : 'primary'}
      data-visual-mode={visualMode}
      data-ui-variant={variant}
      data-placement={placement}
      data-alignment={alignment}
      data-width={resolvedWidth}
      data-activation={resolvedActivation}
      data-panel-lifecycle={panelLifecycle}
      data-overflow={overflow}
      data-panel-attachment={panelAttachment}
      className={cn(
        'flex min-h-0 min-w-0',
        panelAttachment === 'integrated' ? 'gap-0' : 'gap-2',
        placement === 'top' && 'flex-col',
        placement === 'start' && 'flex-row',
        placement === 'end' && '!flex-row-reverse',
        className,
      )}
    >
      <div
        className={cn(
          'flex min-w-0 shrink-0 gap-1',
          orientation === 'horizontal' ? 'w-full items-center' : 'flex-col items-stretch',
          orientation === 'vertical' && 'h-full',
        )}
      >
        {startContent}
        {list}
        {allTabsMenu}
        {endContent}
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        {mountedItems.map((item) => (
          <Tabs.Panel key={item.id} id={item.id} className="!m-0 h-full min-h-0 outline-none">
            {item.content}
          </Tabs.Panel>
        ))}
      </div>
    </Tabs>
  );
};
