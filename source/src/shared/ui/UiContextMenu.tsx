import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { AppButton } from './AppButton';

export type UiContextMenuItem = {
  id: string;
  label: string;
  danger?: boolean;
};

export type UiContextMenuProps = {
  items: readonly UiContextMenuItem[];
  children: React.ReactNode;
  onAction?: (id: string) => void;
  className?: string;
};

/** Right-click action menu anchored at the pointer. */
export const UiContextMenu: React.FC<UiContextMenuProps> = ({
  items,
  children,
  onAction,
  className,
}) => {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!position) {
      return undefined;
    }
    const close = () => setPosition(null);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close();
      }
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('scroll', close, true);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('scroll', close, true);
    };
  }, [position]);

  return (
    <>
      <div
        className={cn('inline-flex', className)}
        onContextMenu={(event) => {
          event.preventDefault();
          setPosition({ x: event.clientX, y: event.clientY });
        }}
      >
        {children}
      </div>
      {position && typeof document !== 'undefined'
        ? createPortal(
          <div
            role="menu"
            aria-label="Context menu"
            className="fixed z-[1200] min-w-40 rounded-lg border border-slate-200 bg-white p-1 shadow-md"
            style={{ left: position.x, top: position.y }}
            onPointerDown={(event) => event.stopPropagation()}
          >
            {items.map((item) => (
              <AppButton
                key={item.id}
                type="button"
                intent={item.danger ? 'destructive-soft' : 'utility'}
                size="sm"
                role="menuitem"
                className="w-full justify-start px-2.5"
                onClick={() => {
                  onAction?.(item.id);
                  setPosition(null);
                }}
              >
                {item.label}
              </AppButton>
            ))}
          </div>,
          document.body,
        )
        : null}
    </>
  );
};
