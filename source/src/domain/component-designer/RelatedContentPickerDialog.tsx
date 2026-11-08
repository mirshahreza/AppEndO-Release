/**
 * Maximized related-content picker — Base Components CreateEditModalShell with
 * header #2 (subtitle DialogBand) as AppSearchBox, then selectable result rows.
 */
import * as React from 'react';
import { Check } from 'lucide-react';
import {
  AppButton,
  AppSearchBox,
  CreateEditModalShell,
} from '../../shared/ui';
import { cn } from '../../lib/utils';
import {
  DESIGNER_MODAL_SHELL_BODY_INNER_FILL_CLASS,
  DESIGNER_MODAL_SHELL_BODY_OUTER_FILL_FLUSH_CLASS,
} from './designerModalChrome';

export type RelatedContentPickerItem = {
  id: string;
  label: string;
  detail?: string;
};

export type RelatedContentPickerDialogProps = {
  open: boolean;
  title?: string;
  items: RelatedContentPickerItem[];
  excludedIds?: ReadonlySet<string>;
  isLoading?: boolean;
  isSelecting?: boolean;
  emptyMessage?: string;
  searchPlaceholder?: string;
  onClose: () => void;
  onSelect: (id: string) => void | Promise<void>;
};

export const RelatedContentPickerDialog: React.FC<RelatedContentPickerDialogProps> = ({
  open,
  title = 'Create relation',
  items,
  excludedIds,
  isLoading = false,
  isSelecting = false,
  emptyMessage = 'No matching contents.',
  searchPlaceholder = 'Search contents…',
  onClose,
  onSelect,
}) => {
  const [search, setSearch] = React.useState('');
  const [pendingId, setPendingId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) {
      setSearch('');
      setPendingId(null);
    }
  }, [open]);

  const availableItems = React.useMemo(() => {
    if (!excludedIds || excludedIds.size === 0) {
      return items;
    }
    return items.filter((item) => {
      const id = String(item.id).trim();
      return id.length > 0 && !excludedIds.has(id);
    });
  }, [excludedIds, items]);

  const filteredItems = React.useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) {
      return availableItems;
    }
    return availableItems.filter((item) => (
      item.id.toLowerCase().includes(needle)
      || item.label.toLowerCase().includes(needle)
      || (item.detail?.toLowerCase().includes(needle) ?? false)
    ));
  }, [availableItems, search]);

  if (!open) {
    return null;
  }

  const busy = isSelecting || pendingId != null;

  const handleSelect = async (id: string) => {
    const normalizedId = String(id).trim();
    if (busy || !normalizedId || excludedIds?.has(normalizedId)) {
      return;
    }
    setPendingId(normalizedId);
    try {
      await onSelect(normalizedId);
    } finally {
      setPendingId(null);
    }
  };

  return (
    <CreateEditModalShell
      size="maximized"
      title={title}
      onClose={onClose}
      onBackdropClick={busy ? undefined : onClose}
      closeOnEscape={!busy}
      gradient={false}
      shellClassName="flex flex-col overflow-hidden"
      subtitle={(
        <AppSearchBox
          value={search}
          onChange={setSearch}
          placeholder={searchPlaceholder}
          ariaLabel="Search related contents"
          disabled={busy}
          showClear
          className="w-full"
        />
      )}
      subtitleClassName="!p-0 !px-0 !py-0"
      bodyOuterClassName={DESIGNER_MODAL_SHELL_BODY_OUTER_FILL_FLUSH_CLASS}
      bodyClassName={DESIGNER_MODAL_SHELL_BODY_INNER_FILL_CLASS}
    >
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border border-slate-200">
          <div className="min-h-0 flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">Loading contents…</div>
            ) : filteredItems.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">{emptyMessage}</div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filteredItems.map((item) => {
                  const rowBusy = pendingId === item.id;
                  return (
                    <li
                      key={item.id}
                      className="flex min-w-0 items-center gap-3 px-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-slate-800">
                          {item.label}
                        </span>
                        {item.detail ? (
                          <span className="mt-0.5 block truncate font-mono text-xs text-slate-500">
                            {item.detail}
                          </span>
                        ) : (
                          <span className="mt-0.5 block truncate font-mono text-xs text-slate-400">
                            {item.id}
                          </span>
                        )}
                      </span>
                      <AppButton
                        type="button"
                        intent="secondary"
                        size="sm"
                        disabled={busy}
                        aria-label={`Select ${item.label}`}
                        className={cn('shrink-0', rowBusy && 'opacity-70')}
                        onClick={() => { void handleSelect(item.id); }}
                      >
                        <Check className="h-3.5 w-3.5" aria-hidden />
                        {rowBusy ? 'Selecting…' : 'Select'}
                      </AppButton>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </CreateEditModalShell>
  );
};
