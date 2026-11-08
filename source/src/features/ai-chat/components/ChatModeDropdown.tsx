import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  SPLIT_BUTTON_DROP_UP_MENU_FIXED_CLASS,
  SPLIT_BUTTON_MENU_ITEM_CLASS,
  useFixedDropUpMenuStyle,
  useSplitButtonMenu,
} from '../../../shared/ui/AppSplitButton';
import { PANEL_CHAT_MODES, getPanelChatModeIcon, type PanelChatMode } from '../constants/chatModes';

export type ChatModeDropdownProps = {
  mode: PanelChatMode;
  onChange: (mode: PanelChatMode) => void;
  compact?: boolean;
  /** When set, only these modes appear in the menu (e.g. Ask + Agent on Server Functions). */
  allowedIds?: readonly PanelChatMode[];
};

export const ChatModeDropdown: React.FC<ChatModeDropdownProps> = ({
  mode,
  onChange,
  compact = false,
  allowedIds,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useSplitButtonMenu(isOpen, setIsOpen);
  const menuStyle = useFixedDropUpMenuStyle(isOpen, menuRef, { minWidth: 128 });
  const visibleModes = allowedIds && allowedIds.length > 0
    ? PANEL_CHAT_MODES.filter((item) => allowedIds.includes(item.id))
    : PANEL_CHAT_MODES;
  const activeMode = visibleModes.find((item) => item.id === mode) ?? visibleModes[0] ?? PANEL_CHAT_MODES[0];
  const ActiveIcon = getPanelChatModeIcon(activeMode.id);

  return (
    <div ref={menuRef} className="relative shrink-0">
      <button
        type="button"
        className={cn(
          'flex items-center rounded text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700',
          compact ? 'h-5 gap-1 px-1 text-[10px] leading-none' : 'gap-1 px-1.5 py-0.5 text-[11px]',
        )}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`Chat mode: ${activeMode.label}`}
        title={activeMode.label}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => setIsOpen((open) => !open)}
      >
        <ActiveIcon className="h-3 w-3 shrink-0" />
        <span className="truncate font-medium">{activeMode.label}</span>
        <ChevronDown className={cn('shrink-0 transition-transform', compact ? 'h-2.5 w-2.5' : 'h-3 w-3', isOpen && 'rotate-180')} />
      </button>

      {isOpen ? (
        <div
          className={cn(SPLIT_BUTTON_DROP_UP_MENU_FIXED_CLASS, 'min-w-[8rem] py-1')}
          style={menuStyle}
          role="listbox"
          aria-label="Chat mode"
        >
          {visibleModes.map((item) => {
            const ItemIcon = getPanelChatModeIcon(item.id);
            const isSelected = item.id === mode;
            return (
              <button
                key={item.id}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={cn(
                  SPLIT_BUTTON_MENU_ITEM_CLASS,
                  'gap-2',
                  isSelected && 'bg-indigo-50 text-indigo-700',
                )}
                onClick={() => {
                  onChange(item.id);
                  setIsOpen(false);
                }}
              >
                <ItemIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
};
