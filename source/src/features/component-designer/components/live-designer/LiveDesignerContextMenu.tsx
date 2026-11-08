import * as React from 'react';
import { createPortal } from 'react-dom';
import { ClipboardPaste, Copy, CopyPlus, Settings2, Trash2 } from 'lucide-react';
import {
  SPLIT_BUTTON_MENU_ITEM_CLASS,
  SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS,
  useSplitButtonMenu,
} from '../../../../shared/ui/AppSplitButton';
import { cn } from '../../../../lib/utils';

export type LiveDesignerContextMenuAction =
  | 'properties'
  | 'duplicate'
  | 'copy'
  | 'paste'
  | 'delete';

export type LiveDesignerContextMenuState = {
  x: number;
  y: number;
  nodeId: string;
};

export type LiveDesignerContextMenuProps = {
  menu: LiveDesignerContextMenuState | null;
  canDelete: boolean;
  canDuplicate: boolean;
  canCopy: boolean;
  canPaste: boolean;
  onClose: () => void;
  onAction: (action: LiveDesignerContextMenuAction, nodeId: string) => void;
};

const MENU_WIDTH = 200;
const MENU_APPROX_HEIGHT = 220;

function clampMenuPosition(x: number, y: number): { x: number; y: number } {
  const maxX = Math.max(8, window.innerWidth - MENU_WIDTH - 8);
  const maxY = Math.max(8, window.innerHeight - MENU_APPROX_HEIGHT - 8);
  return {
    x: Math.min(Math.max(8, x), maxX),
    y: Math.min(Math.max(8, y), maxY),
  };
}

export const LiveDesignerContextMenu: React.FC<LiveDesignerContextMenuProps> = ({
  menu,
  canDelete,
  canDuplicate,
  canCopy,
  canPaste,
  onClose,
  onAction,
}) => {
  const isOpen = menu !== null;
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setOpen(isOpen);
  }, [isOpen]);

  const handleOpenChange = React.useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      onClose();
    }
  }, [onClose]);

  const menuRef = useSplitButtonMenu(open, handleOpenChange);

  if (!menu || !open) {
    return null;
  }

  const position = clampMenuPosition(menu.x, menu.y);

  const run = (action: LiveDesignerContextMenuAction, enabled = true) => {
    if (!enabled) {
      return;
    }
    onAction(action, menu.nodeId);
    onClose();
  };

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label="Live Designer node actions"
      data-testid="live-designer-context-menu"
      className={cn(SPLIT_BUTTON_MENU_PANEL_FIXED_CLASS, 'min-w-[12rem]')}
      style={{ left: position.x, top: position.y }}
    >
      <button
        type="button"
        role="menuitem"
        className={SPLIT_BUTTON_MENU_ITEM_CLASS}
        onClick={() => run('properties')}
      >
        <Settings2 className="h-3.5 w-3.5 text-slate-500" />
        Properties
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!canDuplicate}
        className={cn(
          SPLIT_BUTTON_MENU_ITEM_CLASS,
          !canDuplicate && 'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-slate-600',
        )}
        onClick={() => run('duplicate', canDuplicate)}
      >
        <CopyPlus className={cn('h-3.5 w-3.5', canDuplicate ? 'text-slate-500' : 'text-slate-400')} />
        Duplicate
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!canCopy}
        className={cn(
          SPLIT_BUTTON_MENU_ITEM_CLASS,
          !canCopy && 'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-slate-600',
        )}
        onClick={() => run('copy', canCopy)}
      >
        <Copy className={cn('h-3.5 w-3.5', canCopy ? 'text-slate-500' : 'text-slate-400')} />
        Copy
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!canPaste}
        className={cn(
          SPLIT_BUTTON_MENU_ITEM_CLASS,
          !canPaste && 'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-slate-600',
        )}
        onClick={() => run('paste', canPaste)}
      >
        <ClipboardPaste className={cn('h-3.5 w-3.5', canPaste ? 'text-slate-500' : 'text-slate-400')} />
        Paste
      </button>
      <div className="my-1 border-t border-slate-100" />
      <button
        type="button"
        role="menuitem"
        disabled={!canDelete}
        className={cn(
          SPLIT_BUTTON_MENU_ITEM_CLASS,
          !canDelete && 'cursor-not-allowed opacity-45 hover:bg-transparent hover:text-slate-600',
          canDelete && 'hover:bg-rose-50 hover:text-rose-700',
        )}
        onClick={() => run('delete', canDelete)}
      >
        <Trash2 className={cn('h-3.5 w-3.5', canDelete ? 'text-rose-600' : 'text-slate-400')} />
        Delete
      </button>
    </div>,
    document.body,
  );
};
