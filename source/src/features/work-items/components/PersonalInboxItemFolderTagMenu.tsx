import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, FolderOpen, Tag } from 'lucide-react';
import { AppButton, UiCheckbox } from '../../../shared/ui';
import { ShellResponsivePopover } from '../../../shared/ui/shell-foundation/ShellResponsivePopover';
import type { PersonalInboxItem, PersonalInboxSummary, PersonalInboxUserFolder } from '../../../shared/api/contracts/personal-inbox/types';
import {
  notifyPersonalInboxChangedWithFallback,
  personalInboxApi,
} from '../../../shared/api/personalInboxApi';
import { showAppFeedbackToast } from '../../../shared/ui/appFeedbackToast';
import { useCultureT } from '../../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../../core/culture/cultureShellKeys';
import { cn } from '../../../lib/utils';
import {
  PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED,
  PERSONAL_INBOX_SYSTEM_FOLDER_DELETED,
} from '../../../shared/personal-inbox/personalInboxFolderRefs';

export type PersonalInboxItemFolderTagMenuProps = {
  item: PersonalInboxItem;
  userFolders: PersonalInboxUserFolder[];
  onItemUpdated: (item: PersonalInboxItem) => void;
  onItemRemovedFromList?: (itemKey: string) => void;
  activeFolderToken: string;
  defaultOpen?: boolean;
  onClosed?: () => void;
  buttonClassName?: string;
};

const SYSTEM_FOLDER_ICON = {
  [PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED]: Archive,
} as const;

export const PersonalInboxItemFolderTagMenu: React.FC<PersonalInboxItemFolderTagMenuProps> = ({
  item,
  userFolders,
  onItemUpdated,
  onItemRemovedFromList,
  activeFolderToken,
  defaultOpen = false,
  onClosed,
  buttonClassName,
}) => {
  const t = useCultureT();
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (defaultOpen) {
      setOpen(true);
    }
  }, [defaultOpen]);
  const [saving, setSaving] = useState(false);
  const [draftRefs, setDraftRefs] = useState<string[]>(() => [...(item.folderRefs ?? [])]);
  const draftRefsRef = useRef(draftRefs);
  const lastPersistedKeyRef = useRef(
    [...(item.folderRefs ?? [])].sort().join('|'),
  );
  const persistChainRef = useRef(Promise.resolve());

  useEffect(() => {
    draftRefsRef.current = draftRefs;
  }, [draftRefs]);

  useEffect(() => {
    const key = [...(item.folderRefs ?? [])].sort().join('|');
    lastPersistedKeyRef.current = key;
    draftRefsRef.current = [...(item.folderRefs ?? [])];
  }, [item.folderRefs]);

  const tagLabel = resolveCultureLabel(t, 'shell.inbox.folder.tag', 'Tag');
  const tagAriaLabel = resolveCultureLabel(t, 'shell.inbox.folder.tagAria', 'Tag inbox item with folders');
  const systemHeading = resolveCultureLabel(t, 'shell.inbox.folder.systemHeading', 'Built-in folders');
  const myFoldersHeading = resolveCultureLabel(t, 'shell.inbox.folder.myFoldersHeading', 'My folders');
  const personalEmptyLabel = resolveCultureLabel(
    t,
    'shell.inbox.folder.tagPersonalEmpty',
    'You do not have any personal folders yet.',
  );
  const saveFailedLabel = resolveCultureLabel(t, 'shell.inbox.folder.saveFailed', 'Could not update folders.');
  const archivedLabel = resolveCultureLabel(t, 'shell.inbox.folder.archived', 'Archived');
  const systemOptions = useMemo(() => ([
    { folderRef: PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED, label: archivedLabel, tone: 'amber' as const },
  ]), [archivedLabel]);

  const syncDraftFromItem = useCallback(() => {
    setDraftRefs([...(item.folderRefs ?? [])]);
  }, [item.folderRefs]);

  const persist = useCallback(async (nextRefs: string[]) => {
    const nextKey = [...nextRefs].sort().join('|');
    if (nextKey === lastPersistedKeyRef.current) {
      return;
    }
    setSaving(true);
    try {
      const { folderRefs, summary } = await personalInboxApi.setItemFolderRefs(item.id, nextRefs);
      lastPersistedKeyRef.current = [...folderRefs].sort().join('|');
      const updated = { ...item, folderRefs };
      onItemUpdated(updated);
      await notifyPersonalInboxChangedWithFallback(summary);
      const stillInFilter = itemMatchesFolderFilter(updated.folderRefs ?? [], activeFolderToken);
      if (!stillInFilter) {
        onItemRemovedFromList?.(item.id);
      }
    } catch (err) {
      const detail = err instanceof Error ? err.message : saveFailedLabel;
      showAppFeedbackToast(detail, { type: 'error' });
      syncDraftFromItem();
    } finally {
      setSaving(false);
    }
  }, [
    activeFolderToken,
    item,
    onItemRemovedFromList,
    onItemUpdated,
    saveFailedLabel,
    syncDraftFromItem,
  ]);

  const enqueuePersist = useCallback((nextRefs: string[]) => {
    persistChainRef.current = persistChainRef.current
      .then(() => persist(nextRefs))
      .catch(() => undefined);
  }, [persist]);

  const toggleRef = (folderRef: string, checked: boolean) => {
    setDraftRefs((prev) => {
      const set = new Set(prev);
      if (checked) {
        set.add(folderRef);
      } else {
        set.delete(folderRef);
      }
      const next = [...set];
      draftRefsRef.current = next;
      enqueuePersist(next);
      return next;
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (nextOpen) {
      syncDraftFromItem();
      return;
    }
    void (async () => {
      const pending = draftRefsRef.current;
      await persistChainRef.current;
      const pendingKey = [...pending].sort().join('|');
      if (pendingKey !== lastPersistedKeyRef.current) {
        await persist(pending);
      }
      onClosed?.();
    })();
  };

  const taggedCount = item.folderRefs?.length ?? 0;
  const userFolderScroll = userFolders.length > 8;
  const panelScroll = userFolders.length > 6;

  return (
    <ShellResponsivePopover
      open={open}
      onOpenChange={handleOpenChange}
      placement="bottom-end"
      portal
      portalMaxHeight={false}
      portalSkidPx={3}
      portalZIndex={2600}
      ariaLabel={tagAriaLabel}
      className={cn(
        'min-w-[15.5rem] max-w-[min(100vw-1.5rem,18rem)] overflow-hidden',
        'rounded-xl border border-slate-200/90 bg-white p-0 shadow-xl ring-1 ring-slate-900/5',
      )}
      trigger={(
        <AppButton
          type="button"
          size="sm"
          intent="ghost"
          aria-label={tagAriaLabel}
          title={tagLabel}
          className={cn('personal-inbox-grid-tag-btn', buttonClassName ?? 'min-h-8 min-w-8 px-1')}
          onMouseDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <Tag
            className={cn(
              'h-4 w-4 shrink-0',
              taggedCount > 0 ? 'text-primary-600' : 'text-slate-500',
            )}
            strokeWidth={1.75}
            aria-hidden
          />
        </AppButton>
      )}
    >
      <div
        className={cn(
          'flex flex-col',
          panelScroll && 'max-h-[min(calc(100dvh-4rem),28rem)] overflow-y-auto overscroll-contain',
        )}
      >
        <div className="flex flex-col gap-3 px-3 py-3">
          <section>
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {systemHeading}
            </p>
            <ul className="space-y-1">
              {systemOptions.map((option) => {
                const Icon = SYSTEM_FOLDER_ICON[option.folderRef as keyof typeof SYSTEM_FOLDER_ICON];
                const checked = draftRefs.includes(option.folderRef);
                return (
                  <li key={option.folderRef}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors',
                        checked
                          ? option.tone === 'amber'
                            ? 'border-amber-200/80 bg-amber-50/90'
                            : 'border-rose-200/80 bg-rose-50/90'
                          : 'border-transparent bg-slate-50/60 hover:bg-slate-100/80',
                        saving && 'pointer-events-none opacity-60',
                      )}
                    >
                      <UiCheckbox
                        size="sm"
                        checked={checked}
                        disabled={saving}
                        onChange={(event) => toggleRef(option.folderRef, event.target.checked)}
                      >
                        <span className="sr-only">{option.label}</span>
                      </UiCheckbox>
                      <Icon
                        className={cn(
                          'h-3.5 w-3.5 shrink-0',
                          option.tone === 'amber' ? 'text-amber-700' : 'text-rose-600',
                        )}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 text-xs font-medium text-slate-800">{option.label}</span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>

          <div className="h-px bg-slate-200/90" role="separator" />

          <section className="min-h-0">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              {myFoldersHeading}
            </p>
            {userFolders.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
                {personalEmptyLabel}
              </p>
            ) : (
              <ul
                className={cn(
                  'space-y-1',
                  userFolderScroll && 'max-h-48 overflow-y-auto overscroll-contain pe-0.5',
                )}
              >
                {userFolders.map((folder) => {
                  const checked = draftRefs.includes(folder.folderRef);
                  return (
                    <li key={folder.id}>
                      <label
                        className={cn(
                          'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 transition-colors',
                          checked
                            ? 'border-primary-200/80 bg-primary-subtle/25'
                            : 'border-transparent bg-slate-50/60 hover:bg-slate-100/80',
                          saving && 'pointer-events-none opacity-60',
                        )}
                      >
                        <UiCheckbox
                          size="sm"
                          checked={checked}
                          disabled={saving}
                          onChange={(event) => toggleRef(folder.folderRef, event.target.checked)}
                        >
                          <span className="sr-only">{folder.name}</span>
                        </UiCheckbox>
                        <FolderOpen className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={1.75} aria-hidden />
                        <span className="min-w-0 flex-1 truncate text-xs font-medium text-slate-800">{folder.name}</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </ShellResponsivePopover>
  );
};

function itemMatchesFolderFilter(folderRefs: string[], activeFolderToken: string): boolean {
  const token = activeFolderToken.trim().toLowerCase();
  if (!token || token === 'inbox') {
    const set = new Set(folderRefs);
    return !set.has(PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED) && !set.has(PERSONAL_INBOX_SYSTEM_FOLDER_DELETED);
  }
  if (token === 'archived') {
    return folderRefs.includes(PERSONAL_INBOX_SYSTEM_FOLDER_ARCHIVED);
  }
  if (token === 'deleted') {
    return folderRefs.includes(PERSONAL_INBOX_SYSTEM_FOLDER_DELETED);
  }
  if (token === 'all') {
    return true;
  }
  if (token.startsWith('u:')) {
    const userRef = `user:${token.slice(2)}`;
    return folderRefs.includes(userRef);
  }
  return true;
}

export type { PersonalInboxSummary };
