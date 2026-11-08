import React from 'react';
import { Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import {
  AppButton,
  AppSearchBox,
  ICON_ACTION_BUTTON_SM_CLASS,
  ICON_ACTION_CANCEL_CLASS,
} from '../../../shared/ui';
import { useCultureT } from '../../../core/culture/CultureContext';
import type { SshHubConnectionPublic } from '../../../shared/api/contracts/ssh-hub/types';
import type { SshHubPageState } from '../hooks/useSshHubPage';

const matchesSearch = (item: SshHubConnectionPublic, query: string): boolean => {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return true;
  }
  const haystack = [item.name, item.host, item.username].join(' ').toLowerCase();
  return haystack.includes(needle);
};

export const SshHubConnectionList: React.FC<{ page: SshHubPageState }> = ({ page }) => {
  const t = useCultureT();
  const filteredItems = React.useMemo(() => {
    return page.connections
      .filter((item) => page.authFilter === 'ALL' || item.authMethod === page.authFilter)
      .filter((item) => matchesSearch(item, page.searchQuery))
      .sort((left, right) => left.name.localeCompare(right.name, undefined, { sensitivity: 'base' }));
  }, [page.authFilter, page.connections, page.searchQuery]);

  return (
    <aside className="flex h-full min-h-0 w-full flex-col overflow-hidden border-r border-slate-200 bg-slate-50/40">
      <AppSearchBox
        value={page.searchQuery}
        onChange={page.setSearchQuery}
        placeholder={t('sshHub.searchPlaceholder')}
        ariaLabel="Search SSH connections"
        trailing={(
          <div className="flex items-center gap-0.5">
            <AppButton
              type="button"
              aria-label="Create SSH connection"
              className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_CANCEL_CLASS, 'shrink-0')}
              onClick={page.openCreate}
            >
              <Plus aria-hidden className="h-3.5 w-3.5" strokeWidth={1.5} />
            </AppButton>
            <AppButton
              type="button"
              aria-label={t('actions.refresh')}
              title={t('actions.refresh')}
              className={cn(ICON_ACTION_BUTTON_SM_CLASS, ICON_ACTION_CANCEL_CLASS, 'shrink-0')}
              onClick={page.onRefreshCatalog}
              disabled={page.isCatalogFetching && !page.isCatalogLoading}
            >
              <RefreshCw
                aria-hidden
                className={cn('h-3.5 w-3.5', page.isCatalogFetching && !page.isCatalogLoading && 'animate-spin')}
                strokeWidth={1.5}
              />
            </AppButton>
          </div>
        )}
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {page.isCatalogLoading ? (
          <p className="p-2 text-[11px] text-slate-400">{t('sshHub.loading')}</p>
        ) : filteredItems.length === 0 ? (
          <p className="p-2 text-[11px] text-slate-400">{t('sshHub.emptyHint')}</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filteredItems.map((item) => {
              const isOpen = page.sessionTabs.some((tab) => tab.connectionId === item.id);
              const endpoint = `${item.username}@${item.host}:${item.port}`;
              return (
                <div
                  key={item.id}
                  className={cn(
                    'group flex items-center gap-1.5 rounded px-1 py-1 hover:bg-slate-200/60',
                    isOpen && 'bg-white',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => page.openConnection(item)}
                    className="flex min-w-0 flex-1 flex-col text-left"
                  >
                    <span className="truncate text-[12px] text-slate-700">{item.name}</span>
                    <span className="truncate font-mono text-[10px] text-slate-400">{endpoint}</span>
                  </button>
                  <button
                    type="button"
                    title="Edit"
                    aria-label={`Edit ${item.name}`}
                    onClick={() => page.openSettings(item)}
                    className="hidden shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 group-hover:block"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    aria-label={`Delete ${item.name}`}
                    disabled={page.isDeleting}
                    onClick={() => page.setDeleteTarget(item)}
                    className="hidden shrink-0 rounded p-0.5 text-slate-400 hover:bg-rose-100 hover:text-rose-600 group-hover:block"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
};
