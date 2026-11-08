import React, { useEffect, useMemo, useRef, useState } from 'react';
import { UiInput } from '../../../shared/ui';
import { friendlyActionLabel, type ActionCatalogEntry } from './actionCatalogUtils';

/**
 * Replaces the old blind free-text `actionKey` input with a searchable combobox sourced from
 * `projection.actionCatalog` (the same real, registered Actions the floating palette's Actions
 * section lists — see `actionCatalogUtils.ts`). Still accepts free text so a workflow authored
 * against a since-renamed/removed Action isn't blocked from loading or being hand-edited.
 */
export const ActionKeyCombobox: React.FC<{
  value: string;
  onChange: (actionKey: string) => void;
  actionCatalog: ActionCatalogEntry[];
}> = ({ value, onChange, actionCatalog }) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const matches = useMemo(() => {
    const q = value.trim().toLowerCase();
    return actionCatalog
      .filter((a) => !q || a.key.toLowerCase().includes(q) || friendlyActionLabel(a.key).toLowerCase().includes(q))
      .slice(0, 30);
  }, [actionCatalog, value]);

  const isKnown = useMemo(() => actionCatalog.some((a) => a.key === value), [actionCatalog, value]);

  return (
    <div ref={containerRef} className="relative">
      <UiInput
        size="sm"
        aiAssist={false}
        className="w-full text-xs font-normal"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="e.g. text.template"
      />
      {value && !isKnown ? <p className="mt-0.5 text-[10px] text-amber-600">Not in the current Action registry — double-check the key.</p> : null}
      {open && matches.length > 0 ? (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-border-subtle bg-white text-xs shadow-lg">
          {matches.map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={() => {
                onChange(action.key);
                setOpen(false);
              }}
              className="flex w-full flex-col items-start px-2 py-1 text-left hover:bg-primary-50"
            >
              <span className="font-medium text-slate-700">{friendlyActionLabel(action.key)}</span>
              <span className="text-[10px] text-slate-400">{action.key}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};
