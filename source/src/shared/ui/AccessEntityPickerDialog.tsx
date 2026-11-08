import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { useCultureT } from '../../core/culture/CultureContext';
import { AppButton } from './AppButton';
import { CreateEditModalShell } from './CreateEditModalShell';
import { UiInput } from './HeroFieldControls';
import { DIALOG_NESTED_BACKDROP_Z_CLASS } from './surfaceClasses';

export type AccessEntityPickerItem = {
  value: string;
  label: string;
  detail?: string;
};

export type AccessEntityPickerDialogProps = {
  open: boolean;
  title: string;
  items: AccessEntityPickerItem[];
  excludedValues: ReadonlySet<string>;
  isLoading?: boolean;
  emptyMessage?: string;
  onClose: () => void;
  onSelect: (value: string) => void;
};

export const AccessEntityPickerDialog: React.FC<AccessEntityPickerDialogProps> = ({
  open,
  title,
  items,
  excludedValues,
  isLoading = false,
  emptyMessage,
  onClose,
  onSelect,
}) => {
  const t = useCultureT();
  const resolvedEmptyMessage = emptyMessage ?? t('picker.noMatchingItems');
  const [search, setSearch] = useState('');

  const availableItems = useMemo(
    () => items.filter((item) => !excludedValues.has(item.value)),
    [excludedValues, items],
  );

  const filteredItems = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return availableItems;
    }
    return availableItems.filter((item) => (
      item.value.toLowerCase().includes(needle)
      || item.label.toLowerCase().includes(needle)
      || (item.detail?.toLowerCase().includes(needle) ?? false)
    ));
  }, [availableItems, search]);

  if (!open) {
    return null;
  }

  const handleSelect = (value: string) => {
    onSelect(value);
    setSearch('');
    onClose();
  };

  return (
    <CreateEditModalShell
      size="lg"
      backdropClassName={DIALOG_NESTED_BACKDROP_Z_CLASS}
      title={title}
      onClose={onClose}
      onBackdropClick={onClose}
      footer={(
        <AppButton intent="cancel" size="sm" onClick={onClose}>{t('actions.cancel')}</AppButton>
      )}
    >
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-[2px]">
          <label className="ps-[4px] text-sm text-slate-600">{t('picker.search')}</label>
          <UiInput
            size="sm"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('picker.searchEllipsis')}
            ariaLabel={t('picker.searchTitle').replace('{title}', title.toLowerCase())}
          />
        </div>

        <div className="max-h-[min(52vh,420px)] overflow-auto rounded-lg border border-slate-200">
          {isLoading ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">{t('grid.loadingEllipsis')}</div>
          ) : filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-slate-500">{resolvedEmptyMessage}</div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {filteredItems.map((item) => (
                <li key={item.value}>
                  <button
                    type="button"
                    onClick={() => handleSelect(item.value)}
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-start transition-colors hover:bg-slate-50"
                  >
                    <Search className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{item.label}</span>
                      {item.detail ? (
                        <span className="mt-0.5 block truncate font-mono text-xs text-slate-500">{item.detail}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </CreateEditModalShell>
  );
};
