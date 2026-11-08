import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  normalizeNavColor,
  resolveNavigationColorLabel,
  resolveNavigationColorOptions,
} from '../lib/navigationTailwindColorOptions';
import { TailwindColorSwatch } from './NavigationGroupedField';

type NavigationTailwindColorPickerProps = {
  value: string;
  defaultColor: string;
  onChange: (value: string | undefined) => void;
  ariaLabel: string;
  /**
   * `labeled` — swatch + color name + chevron (navigation editors).
   * `swatch` — swatch-only trigger and dropdown (no name, no chevron).
   */
  variant?: 'labeled' | 'swatch';
};

/** Above admin dialog chrome (`DIALOG_ADMIN_BACKDROP_Z_CLASS` = z-[110]). */
const PICKER_MENU_Z_INDEX = 200;

export const NavigationTailwindColorPicker: React.FC<NavigationTailwindColorPickerProps> = ({
  value,
  defaultColor,
  onChange,
  ariaLabel,
  variant = 'labeled',
}) => {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuStyle, setMenuStyle] = useState<React.CSSProperties>({});
  const isSwatchOnly = variant === 'swatch';

  const options = useMemo(() => resolveNavigationColorOptions(value), [value]);
  const selectedLabel = resolveNavigationColorLabel(value);

  const updateMenuPosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) {
      return;
    }

    const rect = trigger.getBoundingClientRect();
    const menuWidth = isSwatchOnly ? 168 : Math.max(rect.width, 220);
    const viewportPadding = 8;
    let left = rect.left;
    if (left + menuWidth > window.innerWidth - viewportPadding) {
      left = window.innerWidth - menuWidth - viewportPadding;
    }
    left = Math.max(viewportPadding, left);

    setMenuStyle({
      position: 'fixed',
      top: rect.bottom + 4,
      left,
      width: menuWidth,
      zIndex: PICKER_MENU_Z_INDEX,
    });
  };

  useLayoutEffect(() => {
    if (!open) {
      return;
    }
    updateMenuPosition();
  }, [open, value, isSwatchOnly]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || menuRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const handleReposition = () => {
      updateMenuPosition();
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [open, isSwatchOnly]);

  const handleSelect = (nextValue: string) => {
    onChange(normalizeNavColor(nextValue, defaultColor));
    setOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          'transition-colors focus-visible:outline-none focus-visible:bg-slate-50',
          isSwatchOnly
            ? 'inline-flex h-6 w-6 items-center justify-center rounded text-slate-700 hover:bg-slate-100'
            : 'flex h-8 w-[9.5rem] items-center gap-2 px-2.5 text-left text-xs text-slate-700 hover:bg-slate-50',
        )}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <TailwindColorSwatch className={value} />
        {!isSwatchOnly ? (
          <>
            <span className="min-w-0 flex-1 truncate font-medium">{selectedLabel}</span>
            <ChevronDown
              className={cn(
                'h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform',
                open && 'rotate-180',
              )}
            />
          </>
        ) : null}
      </button>

      {open
        ? createPortal(
            <div
              ref={menuRef}
              style={menuStyle}
              role="listbox"
              aria-label={ariaLabel}
              className={cn(
                'rounded-md border border-slate-200 bg-white shadow-lg',
                isSwatchOnly
                  ? 'grid grid-cols-6 gap-0.5 p-1.5'
                  : 'max-h-64 overflow-y-auto p-1',
              )}
            >
              {options.map((option) => {
                const isSelected = option.value === value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    aria-label={option.label}
                    className={cn(
                      'transition-colors hover:bg-indigo-50',
                      isSwatchOnly
                        ? cn(
                          'inline-flex h-6 w-6 items-center justify-center rounded',
                          isSelected && 'bg-indigo-50 ring-1 ring-indigo-300',
                        )
                        : cn(
                          'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs',
                          isSelected && 'bg-indigo-50 text-indigo-700',
                        ),
                    )}
                    onClick={() => handleSelect(option.value)}
                  >
                    <TailwindColorSwatch className={option.value} />
                    {!isSwatchOnly ? (
                      <>
                        <span className="min-w-0 flex-1 truncate font-medium text-slate-700">
                          {option.label}
                        </span>
                        {isSelected ? (
                          <Check className="h-3.5 w-3.5 shrink-0 text-indigo-600" aria-hidden />
                        ) : (
                          <span className="w-3.5 shrink-0" aria-hidden />
                        )}
                      </>
                    ) : null}
                  </button>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </>
  );
};
