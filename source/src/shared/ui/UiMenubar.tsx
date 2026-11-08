import React, { useState } from 'react';
import { cn } from '../../lib/utils';
import { AppButton } from './AppButton';
import { ShellResponsivePopover } from './shell-foundation/ShellResponsivePopover';

export type UiMenubarItem = {
  id: string;
  label: string;
};

export type UiMenubarMenu = {
  id: string;
  label: string;
  items?: string | readonly UiMenubarItem[];
};

export type UiMenubarProps = {
  menus: readonly UiMenubarMenu[];
  onAction?: (menuId: string, itemId: string) => void;
  className?: string;
};

const parseItems = (items: UiMenubarMenu['items']): UiMenubarItem[] => {
  if (Array.isArray(items)) {
    return items.map((item, index) => ({
      id: item.id || `item-${index}`,
      label: item.label || item.id || `Item ${index + 1}`,
    }));
  }
  if (typeof items !== 'string') {
    return [];
  }
  return items.split(',').map((label, index) => {
    const trimmed = label.trim();
    return { id: trimmed.toLowerCase().replace(/\s+/g, '-') || `item-${index}`, label: trimmed || `Item ${index + 1}` };
  }).filter((item) => item.label.length > 0);
};

/** Compact desktop File/Edit/View menubar built from existing popover chrome. */
export const UiMenubar: React.FC<UiMenubarProps> = ({ menus, onAction, className }) => {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div
      role="menubar"
      className={cn('inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-slate-50 px-1 py-0.5', className)}
    >
      {menus.map((menu) => {
        const items = parseItems(menu.items);
        return (
          <ShellResponsivePopover
            key={menu.id}
            open={openId === menu.id}
            onOpenChange={(open) => setOpenId(open ? menu.id : null)}
            placement="bottom-start"
            fallbackPlacement="bottom-end"
            ariaLabel={menu.label}
            className="min-w-36 p-1"
            trigger={(
              <AppButton type="button" intent="utility" size="sm" className="px-2.5">
                {menu.label}
              </AppButton>
            )}
          >
            <div role="menu" aria-label={menu.label}>
              {items.map((item) => (
                <AppButton
                  key={item.id}
                  type="button"
                  intent="utility"
                  size="sm"
                  role="menuitem"
                  className="w-full justify-start px-2.5"
                  onClick={() => {
                    onAction?.(menu.id, item.id);
                    setOpenId(null);
                  }}
                >
                  {item.label}
                </AppButton>
              ))}
            </div>
          </ShellResponsivePopover>
        );
      })}
    </div>
  );
};
