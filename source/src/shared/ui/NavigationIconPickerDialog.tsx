import React, { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import {
  formatNavigationIconRef,
  parseNavigationIconRef,
} from '../lib/navigationIcons/navigationIconRef';
import { NAVIGATION_ICON_PACKS } from '../lib/navigationIcons/navigationIconPacks';
import { NavigationIcon } from '../lib/navigationIcons/NavigationIcon';
import type { NavigationIconPackId } from '../lib/navigationIcons/types';
import { useNavigationIconPackEntries } from '../lib/navigationIcons/useNavigationIconPackEntries';
import { cn } from '../../lib/utils';
import { CreateEditModalShell } from './CreateEditModalShell';
import { UiSelect } from './HeroFieldControls';
import { UiInput } from './ai-field-assist/AiAssistInput';
import { DIALOG_NESTED_BACKDROP_Z_CLASS } from './surfaceClasses';

const PICKER_ICON_BATCH = 120;

type NavigationIconPickerDialogProps = {
  open: boolean;
  selectedIcon?: string;
  onClose: () => void;
  onSelect: (iconName: string) => void;
};

export const NavigationIconPickerDialog: React.FC<NavigationIconPickerDialogProps> = ({
  open,
  selectedIcon,
  onClose,
  onSelect,
}) => {
  const parsedSelectedIcon = useMemo(
    () => parseNavigationIconRef(selectedIcon),
    [selectedIcon],
  );
  const [packId, setPackId] = useState<NavigationIconPackId>(
    parsedSelectedIcon?.packId ?? 'lucide',
  );
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(PICKER_ICON_BATCH);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const deferredSearch = useDeferredValue(search);
  const { iconNames, isLoading, loadError } = useNavigationIconPackEntries(packId, open);

  useEffect(() => {
    if (!open) {
      return;
    }

    setPackId(parsedSelectedIcon?.packId ?? 'lucide');
    setSearch('');
  }, [open, parsedSelectedIcon?.packId]);

  const filteredIconNames = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase();
    if (!needle) {
      return iconNames;
    }

    return iconNames.filter((name) => name.toLowerCase().includes(needle));
  }, [deferredSearch, iconNames]);

  const visibleIconNames = useMemo(
    () => filteredIconNames.slice(0, visibleCount),
    [filteredIconNames, visibleCount],
  );

  const hasMoreIcons = visibleIconNames.length < filteredIconNames.length;

  useEffect(() => {
    setVisibleCount(PICKER_ICON_BATCH);
  }, [packId, deferredSearch]);

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || !hasMoreIcons) {
      return;
    }

    const loadMoreIfNearEnd = () => {
      const remaining = container.scrollHeight - container.scrollTop - container.clientHeight;
      if (remaining < 280) {
        setVisibleCount((current) => Math.min(current + PICKER_ICON_BATCH, filteredIconNames.length));
      }
    };

    loadMoreIfNearEnd();
    container.addEventListener('scroll', loadMoreIfNearEnd, { passive: true });
    return () => container.removeEventListener('scroll', loadMoreIfNearEnd);
  }, [filteredIconNames.length, hasMoreIcons, visibleIconNames.length]);

  if (!open) {
    return null;
  }

  const handleSelect = (iconName: string) => {
    onSelect(formatNavigationIconRef(packId, iconName));
    setSearch('');
    onClose();
  };

  const handleClose = () => {
    setSearch('');
    onClose();
  };

  return (
    <CreateEditModalShell
      size="5xl"
      backdropClassName={DIALOG_NESTED_BACKDROP_Z_CLASS}
      bodyOuterClassName="-mb-[15px]"
      subtitleClassName="!overflow-visible !py-2 !text-inherit"
      title="Select icon"
      onClose={handleClose}
      onBackdropClick={handleClose}
      subtitle={(
        <div className="grid grid-cols-2 gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <label className="shrink-0 ps-[4px] text-sm text-slate-600">Pack</label>
            <div className="min-w-0 flex-1">
              <UiSelect
                size="sm"
                className="!h-8 !min-h-8 w-full"
                value={packId}
                onChange={(event) => setPackId(event.target.value as NavigationIconPackId)}
              >
                {NAVIGATION_ICON_PACKS.map((pack) => (
                  <option key={pack.id} value={pack.id}>{pack.label}</option>
                ))}
              </UiSelect>
            </div>
          </div>

          <div className="flex min-w-0 items-center gap-2">
            <label className="shrink-0 ps-[4px] text-sm text-slate-600">Search</label>
            <div className="min-w-0 flex-1">
              <UiInput
                size="sm"
                className="!h-8 !min-h-8 w-full"
                value={search}
                placeholder="Icon name…"
                onChange={(event) => setSearch(event.target.value)}
              />
            </div>
          </div>
        </div>
      )}
    >
      <div ref={scrollContainerRef} className="h-[min(60vh,560px)] overflow-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            Loading icons…
          </div>
        ) : loadError ? (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-rose-600">
            {loadError}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
            {visibleIconNames.map((name) => {
              const iconRef = formatNavigationIconRef(packId, name);
              const isSelected = parsedSelectedIcon
                ? parsedSelectedIcon.packId === packId && parsedSelectedIcon.iconName === name
                : iconRef === selectedIcon?.trim();
              return (
                <button
                  key={name}
                  type="button"
                  className={cn(
                    'flex items-center gap-2 rounded-md border px-3 py-2 text-left text-sm transition-colors',
                    isSelected
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-900'
                      : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50',
                  )}
                  onClick={() => handleSelect(name)}
                >
                  <NavigationIcon iconRef={iconRef} className="h-4 w-4 shrink-0 text-slate-600" />
                  <span className="truncate font-mono text-[11px]">{name}</span>
                </button>
              );
            })}
            {filteredIconNames.length === 0 ? (
              <p className="col-span-full py-8 text-center text-sm text-slate-400">
                No matching icons.
              </p>
            ) : null}
            {hasMoreIcons ? (
              <p className="col-span-full py-2 text-center text-xs text-slate-400">
                Scroll to load more icons…
              </p>
            ) : null}
          </div>
        )}
      </div>
    </CreateEditModalShell>
  );
};
