import React, { useEffect, useMemo, useState } from 'react';
import { cn } from '../../lib/utils';
import { AppButton } from './AppButton';
import { AppDialogShell } from './dialog/AppDialogShell';
import { AppSearchBox } from './AppSearchBox';
import { UiKbd } from './UiKbd';

export type UiCommandPaletteItem = {
  id: string;
  label: string;
  hint?: string;
};

export type UiCommandPaletteProps = {
  items: readonly UiCommandPaletteItem[];
  placeholder?: string;
  triggerLabel?: string;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onAction?: (id: string) => void;
  contained?: boolean;
  className?: string;
};

/** Quick command search overlay — trigger button plus Ctrl+K. */
export const UiCommandPalette: React.FC<UiCommandPaletteProps> = ({
  items,
  placeholder = 'Search commands…',
  triggerLabel = 'Open commands',
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  onAction,
  contained = true,
  className,
}) => {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
  const [query, setQuery] = useState('');
  const open = openProp ?? uncontrolledOpen;
  const openRef = React.useRef(open);
  openRef.current = open;

  const setOpen = (next: boolean) => {
    if (openProp === undefined) {
      setUncontrolledOpen(next);
    }
    onOpenChange?.(next);
    if (!next) {
      setQuery('');
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(!openRef.current);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) {
      return items;
    }
    return items.filter((item) => (
      item.label.toLowerCase().includes(needle)
      || (item.hint ?? '').toLowerCase().includes(needle)
    ));
  }, [items, query]);

  return (
    <div className={cn('inline-flex items-center gap-2', className)}>
      <AppButton
        type="button"
        intent="secondary"
        size="sm"
        onClick={() => setOpen(true)}
      >
        {triggerLabel}
      </AppButton>
      <UiKbd keys={['Ctrl', 'K']} />
      <AppDialogShell
        open={open}
        contained={contained}
        size="lg"
        ariaLabel="Command palette"
        onClose={() => setOpen(false)}
        shellClassName="w-full max-w-lg p-3"
      >
        <div className="flex flex-col gap-2">
          <AppSearchBox
            value={query}
            onChange={setQuery}
            placeholder={placeholder}
            ariaLabel="Search commands"
            autoComplete="off"
          />
          <ul className="max-h-64 overflow-auto">
            {filtered.length === 0 ? (
              <li className="px-2 py-4 text-sm text-slate-500">No commands match this query.</li>
            ) : filtered.map((item) => (
              <li key={item.id}>
                <AppButton
                  type="button"
                  intent="utility"
                  size="sm"
                  className="w-full justify-between px-2.5"
                  onClick={() => {
                    onAction?.(item.id);
                    setOpen(false);
                  }}
                >
                  <span className="truncate text-slate-800">{item.label}</span>
                  {item.hint ? <span className="ms-3 shrink-0 text-[11px] text-indigo-600">{item.hint}</span> : null}
                </AppButton>
              </li>
            ))}
          </ul>
        </div>
      </AppDialogShell>
    </div>
  );
};
