import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '../../lib/utils';
import { NativeButton } from './NativeButton';

export type FooterLabelDropdownOption<TValue extends string | number> = {
  value: TValue;
  label: string;
};

export type FooterLabelDropdownProps<TValue extends string | number> = {
  value: TValue;
  options: ReadonlyArray<FooterLabelDropdownOption<TValue>>;
  onChange: (value: TValue) => void;
  ariaLabel: string;
  activeLabel?: string;
  menuAlign?: 'start' | 'end' | 'left' | 'right';
  /** `top` opens above (paging footer). `bottom` opens below (page toolbars). */
  placement?: 'top' | 'bottom';
  triggerClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
  /** Chevron next to the label. Off by default so paging footers stay text-only. */
  showChevron?: boolean;
};

function resolveFooterMenuAlign(align: 'start' | 'end' | 'left' | 'right'): 'start' | 'end' {
  if (align === 'right' || align === 'end') {
    return 'end';
  }
  return 'start';
}

/** Label-style dropdown used by grid paging (page size / sort / list mode). */
export function FooterLabelDropdown<TValue extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
  activeLabel,
  menuAlign = 'start',
  placement = 'top',
  triggerClassName,
  menuClassName,
  disabled = false,
  showChevron = false,
}: FooterLabelDropdownProps<TValue>) {
  const [isOpen, setIsOpen] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const selectedOption = options.find((option) => option.value === value);
  const displayLabel = activeLabel ?? selectedOption?.label ?? String(value);
  const resolvedMenuAlign = resolveFooterMenuAlign(menuAlign);

  React.useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={menuRef} className="relative">
      <NativeButton
        type="button"
        className={cn(
          'inline-flex items-center border-0 bg-transparent p-0 text-xs font-medium transition-colors cursor-pointer',
          showChevron ? 'gap-1' : 'gap-0.5',
          triggerClassName ?? 'text-slate-600 hover:text-indigo-700',
          disabled && 'cursor-not-allowed opacity-40 hover:text-slate-600',
        )}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        disabled={disabled}
        onClick={() => {
          if (disabled) {
            return;
          }
          setIsOpen((previous) => !previous);
        }}
      >
        <span>{displayLabel}</span>
        {showChevron ? (
          <ChevronDown
            className={cn('h-3.5 w-3.5 shrink-0 transition-transform', isOpen && 'rotate-180')}
            aria-hidden
          />
        ) : null}
      </NativeButton>
      {isOpen ? (
        <div
          className={cn(
            'absolute z-30 min-w-[8.5rem] rounded-md border border-slate-200 bg-white py-0.5 shadow-md',
            placement === 'bottom' ? 'top-full mt-1' : 'bottom-full mb-1',
            resolvedMenuAlign === 'end' ? 'end-0' : 'start-0',
            menuClassName,
          )}
          role="listbox"
          aria-label={ariaLabel}
        >
          {options.map((option) => (
            <NativeButton
              key={String(option.value)}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={cn(
                'flex w-full items-center px-2.5 py-1.5 text-start text-xs font-medium transition-colors cursor-pointer',
                option.value === value
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-indigo-700',
              )}
              onClick={() => {
                onChange(option.value);
                setIsOpen(false);
              }}
            >
              {option.label}
            </NativeButton>
          ))}
        </div>
      ) : null}
    </div>
  );
}
