import * as React from 'react';
import { Tabs } from '@heroui/react';
import type { LucideIcon } from 'lucide-react';
import {
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleAlert,
  Ellipsis,
  LoaderCircle,
  Pin,
  PinOff,
  Plus,
  TriangleAlert,
  X,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { AppButton } from './AppButton';
import {
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_CANCEL_CLASS,
} from './surfaceClasses';

export type UiWorkspaceTabStatus = 'none' | 'loading' | 'warning' | 'error';

export type UiWorkspaceTabItem = {
  id: string;
  label: string;
  accessibleLabel?: string;
  /** Native hover hint (e.g. full title plus connection). */
  hint?: string;
  icon?: LucideIcon;
  dirty?: boolean;
  status?: UiWorkspaceTabStatus;
  pinned?: boolean;
  closeable?: boolean;
  content: React.ReactNode;
};

export type UiWorkspaceTabsProps = {
  items: UiWorkspaceTabItem[];
  selectedKey: string;
  onSelectionChange: (key: string) => void;
  onClose: (key: string) => void;
  onAdd?: () => void;
  /** Replaces the default plus control (e.g. a connection picker). */
  addSlot?: React.ReactNode;
  /** Extra controls on the right of the tab strip (after add). */
  endSlot?: React.ReactNode;
  onReorder?: (orderedKeys: string[]) => void;
  onPinChange?: (key: string, pinned: boolean) => void;
  onRequestCloseDirty?: (key: string) => Promise<'save' | 'discard' | 'cancel'>;
  showAddButton?: boolean;
  showAllTabsMenu?: boolean;
  allowReorder?: boolean;
  allowPin?: boolean;
  width?: 'fit';
  overflow?: 'scroll-menu';
  panelAttachment?: 'integrated' | 'separated';
  ariaLabel: string;
  className?: string;
};

function WorkspaceStatus({ status }: { status?: UiWorkspaceTabStatus }) {
  if (!status || status === 'none') return null;
  if (status === 'loading') {
    return <LoaderCircle aria-label="Loading" className="h-3 w-3 shrink-0 animate-spin text-cyan-600" />;
  }
  if (status === 'warning') {
    return <TriangleAlert aria-label="Warning" className="h-3 w-3 shrink-0 text-amber-600" />;
  }
  return <CircleAlert aria-label="Error" className="h-3 w-3 shrink-0 text-rose-600" />;
}

export const UiWorkspaceTabs = React.forwardRef<HTMLDivElement, UiWorkspaceTabsProps>(
  function UiWorkspaceTabs(
    {
      items,
      selectedKey,
      onSelectionChange,
      onClose,
      onAdd,
      addSlot,
      endSlot,
      onReorder,
      onPinChange,
      onRequestCloseDirty,
      showAddButton = false,
      showAllTabsMenu = true,
      allowReorder = false,
      allowPin = false,
      panelAttachment = 'integrated',
      ariaLabel,
      className,
    },
    ref,
  ) {
    const stripFallbackRef = React.useRef<HTMLDivElement | null>(null);
    const addButtonRef = React.useRef<HTMLButtonElement | null>(null);
    const tabRefs = React.useRef(new Map<string, HTMLElement>());
    const pendingFocusKey = React.useRef<string | null>(null);

    React.useLayoutEffect(() => {
      const target = pendingFocusKey.current;
      if (target === null) return;
      pendingFocusKey.current = null;
      if (target) {
        tabRefs.current.get(target)?.focus();
        return;
      }
      if (showAddButton && onAdd) addButtonRef.current?.focus();
      else stripFallbackRef.current?.focus();
    }, [items, onAdd, showAddButton]);

    React.useLayoutEffect(() => {
      tabRefs.current
        .get(selectedKey)
        ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
    }, [items.length, selectedKey]);

    const requestClose = React.useCallback(
      async (key: string) => {
        const index = items.findIndex((item) => item.id === key);
        const item = items[index];
        if (!item?.closeable) return;

        if (item.dirty) {
          if (!onRequestCloseDirty) return;
          const result = await onRequestCloseDirty(key);
          if (result === 'cancel') return;
        }

        const focusTarget = items[index + 1]?.id ?? items[index - 1]?.id ?? '';
        pendingFocusKey.current = focusTarget;
        if (selectedKey === key && focusTarget) onSelectionChange(focusTarget);
        onClose(key);
      },
      [items, onClose, onRequestCloseDirty, onSelectionChange, selectedKey],
    );

    const moveSelected = React.useCallback(
      (offset: -1 | 1) => {
        const index = items.findIndex((item) => item.id === selectedKey);
        const target = index + offset;
        if (!allowReorder || !onReorder || index < 0 || target < 0 || target >= items.length) return;
        const orderedKeys = items.map((item) => item.id);
        [orderedKeys[index], orderedKeys[target]] = [orderedKeys[target], orderedKeys[index]];
        onReorder(orderedKeys);
        pendingFocusKey.current = selectedKey;
      },
      [allowReorder, items, onReorder, selectedKey],
    );

    const handleStripKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key !== 'Delete') return;
      const tab = (event.target as HTMLElement).closest<HTMLElement>('[data-workspace-tab-id]');
      const key = tab?.dataset.workspaceTabId;
      if (!key) return;
      const item = items.find((candidate) => candidate.id === key);
      if (!item?.closeable) return;
      event.preventDefault();
      void requestClose(key);
    };

    const selectedItem = items.find((item) => item.id === selectedKey);
    const selectedIndex = items.findIndex((item) => item.id === selectedKey);

    return (
      <div
        ref={ref}
        data-workspace-tabs=""
        data-allow-close={items.some((item) => item.closeable)}
        data-allow-add={Boolean(addSlot) || (showAddButton && Boolean(onAdd))}
        data-allow-reorder={allowReorder && Boolean(onReorder)}
        data-allow-pin={allowPin && Boolean(onPinChange)}
        data-panel-attachment={panelAttachment}
        className={cn(
          'flex min-h-0 min-w-0 flex-col',
          panelAttachment === 'integrated' ? 'gap-0' : 'gap-2',
          className,
        )}
      >
        <Tabs
          selectedKey={selectedKey}
          onSelectionChange={(key) => onSelectionChange(String(key))}
          orientation="horizontal"
          keyboardActivation="manual"
          variant="secondary"
          className="flex min-w-0 shrink-0 flex-col"
        >
        <div className="flex min-w-0 shrink-0 items-center border-b border-slate-200 bg-slate-50/80">
          <Tabs.ListContainer
            ref={stripFallbackRef}
            tabIndex={-1}
            onKeyDown={handleStripKeyDown}
            className="min-w-0 flex-1 overflow-hidden !rounded-none !bg-transparent [&>.tabs__list-container__scroller]:w-full [&>.tabs__list-container__scroller]:[scrollbar-width:none] [&>.tabs__list-container__scroller::-webkit-scrollbar]:hidden"
          >
            <Tabs.List
              aria-label={ariaLabel}
              className="flex w-max min-w-full flex-nowrap !p-0"
            >
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Tabs.Tab
                    key={item.id}
                    id={item.id}
                    ref={(node) => {
                      if (node) tabRefs.current.set(item.id, node);
                      else tabRefs.current.delete(item.id);
                    }}
                    data-workspace-tab-id={item.id}
                    aria-label={item.accessibleLabel ?? item.label}
                    title={item.hint}
                    className={cn(
                      'group relative flex h-9 !w-auto min-w-0 max-w-60 flex-none items-center gap-1.5 !rounded-none border-e border-slate-200 px-2.5 text-xs font-semibold text-slate-600 outline-none',
                      'data-[selected]:border-b-2 data-[selected]:border-b-primary-500 data-[selected]:bg-white data-[selected]:text-primary-700',
                      'focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-400',
                    )}
                  >
                    {Icon ? <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" /> : null}
                    {item.pinned ? <Pin aria-label="Pinned" className="h-3 w-3 shrink-0 text-indigo-500" /> : null}
                    <span className="truncate" title={item.hint}>{item.label}</span>
                    {item.dirty ? (
                      <span aria-label="Unsaved changes" className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                    ) : null}
                    <WorkspaceStatus status={item.status} />
                    {item.closeable ? (
                      <AppButton
                        aria-label={`Close ${item.label}`}
                        className={cn(
                          ICON_ACTION_BUTTON_SM_CLASS,
                          ICON_ACTION_CANCEL_CLASS,
                          'ms-0.5 shrink-0 opacity-60 group-hover:opacity-100 group-focus-within:opacity-100',
                        )}
                        onClick={(event) => {
                          event.stopPropagation();
                          void requestClose(item.id);
                        }}
                      >
                        <X aria-hidden className="h-3 w-3" />
                      </AppButton>
                    ) : null}
                    <Tabs.Indicator className="hidden" />
                  </Tabs.Tab>
                );
              })}
            </Tabs.List>
          </Tabs.ListContainer>

          {allowReorder && onReorder ? (
            <div className="flex shrink-0 items-center border-s border-slate-200 px-1">
              <AppButton
                aria-label="Move selected tab previous"
                className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_CANCEL_CLASS)}
                disabled={selectedIndex <= 0}
                onClick={() => moveSelected(-1)}
              >
                <ChevronLeft aria-hidden className="h-3.5 w-3.5 rtl:rotate-180" />
              </AppButton>
              <AppButton
                aria-label="Move selected tab next"
                className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_CANCEL_CLASS)}
                disabled={selectedIndex < 0 || selectedIndex >= items.length - 1}
                onClick={() => moveSelected(1)}
              >
                <ChevronRight aria-hidden className="h-3.5 w-3.5 rtl:rotate-180" />
              </AppButton>
            </div>
          ) : null}

          {allowPin && selectedItem ? (
            <AppButton
              aria-label={selectedItem.pinned ? `Unpin ${selectedItem.label}` : `Pin ${selectedItem.label}`}
              className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_CANCEL_CLASS, 'mx-1 shrink-0')}
              disabled={!onPinChange}
              onClick={() => onPinChange?.(selectedItem.id, !selectedItem.pinned)}
            >
              {selectedItem.pinned ? (
                <PinOff aria-hidden className="h-3.5 w-3.5" />
              ) : (
                <Pin aria-hidden className="h-3.5 w-3.5" />
              )}
            </AppButton>
          ) : null}

          {showAllTabsMenu ? (
            <details className="relative shrink-0">
              <summary
                aria-label="Show all open tabs"
                className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded text-slate-500 outline-none hover:bg-slate-100 focus-visible:ring-2 focus-visible:ring-primary-400"
              >
                <Ellipsis aria-hidden className="h-3.5 w-3.5" />
              </summary>
              <div
                role="menu"
                className="absolute end-0 z-20 mt-1 min-w-48 rounded-md border border-slate-200 bg-white p-1 shadow-lg"
              >
                {items.map((item) => (
                  <AppButton
                    key={item.id}
                    role="menuitem"
                    onClick={() => onSelectionChange(item.id)}
                    className="flex h-7 w-full items-center justify-start gap-2 rounded px-2 text-xs text-slate-700 hover:bg-slate-100"
                  >
                    {item.pinned ? (
                      <Pin aria-hidden className="h-3 w-3 shrink-0 text-indigo-500" />
                    ) : (
                      <Circle aria-hidden className="h-2.5 w-2.5 shrink-0 fill-current opacity-40" />
                    )}
                    <span className="truncate">{item.label}</span>
                  </AppButton>
                ))}
              </div>
            </details>
          ) : null}

          {addSlot ?? (showAddButton && onAdd ? (
            <AppButton
              ref={addButtonRef}
              aria-label="Add tab"
              className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_CANCEL_CLASS, 'mx-1 shrink-0')}
              onClick={onAdd}
            >
              <Plus aria-hidden className="h-3.5 w-3.5" />
            </AppButton>
          ) : null)}
          {endSlot ? (
            <div className="ms-auto flex shrink-0 items-center pe-2">
              {endSlot}
            </div>
          ) : null}
        </div>
        </Tabs>
        <div className="min-h-0 min-w-0 flex-1">
          {items.map((item) => (
            <div
              key={item.id}
              role="tabpanel"
              id={`${item.id}-panel`}
              aria-labelledby={item.id}
              hidden={item.id !== selectedKey}
              className={cn(
                '!m-0 !p-0 h-full min-h-0 outline-none',
                item.id === selectedKey ? 'block' : 'hidden',
              )}
            >
              {item.content}
            </div>
          ))}
        </div>
      </div>
    );
  },
);
