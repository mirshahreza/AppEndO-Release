import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FolderKanban, ListChecks, Mail, MailOpen, Paperclip, Tag, Trash2, X } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AppButton,
  AppTableGrid,
  ListPageShell,
  ListPageToolbarFrame,
  ListPageToolbarScrollRoot,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  PAGE_TOOLBAR_INNER_ROW_CLASS,
  PAGE_TOOLBAR_MULTI_ROW_CLASS,
  QueryErrorPanel,
  ToolbarFilterSelect,
  ToolbarSearchInput,
  useListPageToolbarScrollContext,
} from '../../../shared/ui';
import { useListPageToolbarScroll } from '../../../shared/lib/useListPageToolbarScroll';
import {
  notifyPersonalInboxChangedWithFallback,
  PERSONAL_INBOX_CHANGED_EVENT,
  personalInboxApi,
} from '../../../shared/api/personalInboxApi';
import type { GridRowActionItem } from '../../../shared/ui/AppGridRowActions';
import { showAppFeedbackToast } from '../../../shared/ui/appFeedbackToast';
import type {
  PersonalInboxItem,
  PersonalInboxItemKind,
  PersonalInboxKindFilter,
  PersonalInboxSummary,
  PersonalInboxUserFolder,
} from '../../../shared/api/contracts/personal-inbox/types';
import { cn } from '../../../lib/utils';
import type { AppTableGridColumnDef } from '../../../shared/lib/appTableGridQuery';
import { MountGridDateText } from '../../../app/platform/MountGridDateText';
import { usePlatformConfig } from '../../../app/platform/PlatformConfigProvider';
import { useOptionalPlatformMount } from '../../../app/platform/PlatformMountContext';
import { resolveStudioRelativeHref } from '../../../shared/lib/studioRelativeHref';
import { useCulture, useCultureT } from '../../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../../core/culture/cultureShellKeys';
import {
  resolveInboxItemTitle,
  resolveInboxOriginLabel,
  resolveInboxSourceDetailLabel,
} from '../../../shared/lib/shellInboxCultureLabels';
import { inboxSupportsCorrespondenceAction } from '../../../shared/personal-inbox/inboxCorrespondencePolicy';
import { PersonalInboxCorrespondenceDialog } from '../../../shared/personal-inbox/PersonalInboxCorrespondenceDialog';
import {
  buildPersonalInboxAlertFocusHref,
  buildPersonalInboxDispatchFocusHref,
} from '../lib/personalInboxSearchParams';
import {
  distinctOriginDetails,
  itemMatchesAlertSourceFilter,
  itemMatchesAttentionFilter,
  itemMatchesCorrespondenceFilter,
  itemMatchesFeedbackScopeFilter,
  itemMatchesWorkItemTypeFilter,
  personalInboxAttentionFilterFromToggles,
  personalInboxAttentionTogglesFromFilter,
  type PersonalInboxAttentionToggles,
  type PersonalInboxCorrespondenceFilter,
  type PersonalInboxFeedbackScopeFilter,
} from '../../../shared/lib/personalInboxKindFieldFilters';
import { HwyMemberDirectoryLegacyFilterBarPanel } from '../../../domain/hwy/HwyMemberDirectoryLegacyFilterBarPanel';
import { resolveHwyLegacyFieldFilterToolbarChrome } from '../../../domain/hwy/hwyMemberListToolbarLegacyFilterChrome';
import { HwyMemberListToolbarActionsEnd } from '../../../domain/hwy/HwyMemberListToolbarActionsEnd';
import { HwyMemberListToolbarRefreshControl } from '../../../domain/hwy/hwyMemberListToolbarRefreshControl';
import { HwyLegacyFieldFilterBarToggle } from '../../../shared/ui/hwy/HwyLegacyFieldFilterBarToggle';
import { useHwyLegacyFieldFilterBarMode } from '../../../shared/ui/hwy/useHwyLegacyFieldFilterBarMode';
import {
  messagesLedgerChannelOptions,
  messagesLedgerStatusOptions,
} from '../../../shared/lib/messagesLedgerCulture';
import { buildPersonalInboxFeedbackFocusHref } from '../../../shared/lib/personalInboxFeedbackDeepLink';
import {
  applyPersonalInboxFolderFilter,
  applyPersonalInboxKindFilter,
  applyPersonalInboxListUiFilters,
  type PersonalInboxListUiFilters,
} from '../lib/personalInboxSearchParams';
import { PersonalInboxFolderManageDialog } from './PersonalInboxFolderManageDialog';
import { PersonalInboxItemFolderTagMenu } from './PersonalInboxItemFolderTagMenu';
import { PersonalInboxItemDeleteButton } from './PersonalInboxItemDeleteButton';
import {
  itemHasInboxSoftDeletedFolderTag,
  PERSONAL_INBOX_SYSTEM_FOLDER_DELETED,
} from '../../../shared/personal-inbox/personalInboxFolderRefs';
import {
  PersonalInboxForwardIcon,
  PersonalInboxReplyIcon,
} from '../../../shared/personal-inbox/personalInboxCorrespondenceIcons';

const PERSONAL_INBOX_PAGE_KEY = 'my-inbox';

const kindFilterOptions = (t: ReturnType<typeof useCultureT>): Array<{ value: PersonalInboxKindFilter; label: string }> => [
  { value: 'all', label: resolveCultureLabel(t, 'shell.inbox.filter.all', 'All') },
  { value: 'work_item', label: resolveCultureLabel(t, 'shell.inbox.filter.workItems', 'Work items') },
  { value: 'feedback', label: resolveCultureLabel(t, 'shell.inbox.filter.feedback', 'Feedback') },
  { value: 'alert', label: resolveCultureLabel(t, 'shell.inbox.filter.alerts', 'Alerts') },
  { value: 'message_dispatch', label: resolveCultureLabel(t, 'shell.inbox.filter.dispatchLedger', 'Send log') },
  { value: 'direct_message', label: resolveCultureLabel(t, 'shell.inbox.filter.directMessage', 'Direct messages') },
];

const KIND_BADGE_CLASS: Record<PersonalInboxItemKind, string> = {
  work_item: 'bg-sky-50 text-sky-800',
  feedback: 'bg-violet-50 text-violet-800',
  alert: 'bg-amber-50 text-amber-900',
  message_dispatch: 'bg-slate-100 text-slate-800',
  direct_message: 'bg-emerald-50 text-emerald-900',
};

const inboxItemUnseen = (item: PersonalInboxItem): boolean =>
  item.attention === 'action_required' || item.attention === 'unread';

/** Unread mail icon: accent ink (`--color-primary-600`). Read: neutral slate icon. */
const INBOX_UNREAD_MAIL_ICON_CLASS = 'text-primary-600';
const INBOX_READ_MAIL_ICON_CLASS = 'text-slate-600';

/** Gmail-style row wash: unread = white; read = light neutral grey. */
const INBOX_UNREAD_ROW_CLASS = 'bg-white hover:bg-white';
const INBOX_READ_ROW_CLASS = 'bg-slate-50 hover:bg-slate-100/80';

/** Actions column (reply, forward, tag, delete) — read/unread is before title. */
/** 4×28px slots + gaps + cell padding + reduced last-column overlay inset (see index.css). */
const INBOX_ACTIONS_COLUMN_WIDTH_PX = 142;
const INBOX_ATTENTION_COLUMN_WIDTH_PX = 40;
const INBOX_GRID_ACTION_BTN_CLASS =
  'box-border !h-7 !w-7 !min-h-7 !min-w-7 !max-h-7 !max-w-7 shrink-0 !p-0';

const INBOX_CORRESPONDENCE_BADGE_BASE_CLASS =
  'shrink-0 rounded px-1 py-px text-[9px] font-medium leading-none ring-1 ring-inset';
const INBOX_REPLIED_BADGE_CLASS = cn(
  INBOX_CORRESPONDENCE_BADGE_BASE_CLASS,
  'bg-cyan-50/70 text-cyan-700 ring-cyan-200/50',
);
const INBOX_FORWARDED_BADGE_CLASS = cn(
  INBOX_CORRESPONDENCE_BADGE_BASE_CLASS,
  'bg-indigo-50/70 text-indigo-700 ring-indigo-200/50',
);

const FOLDER_FILTER_SEPARATOR = '__folder_sep__';

const EMPTY_LIST_UI_FILTERS: PersonalInboxListUiFilters = {
  attention: '',
  correspondence: '',
  workItemType: '',
  feedbackScope: '',
  alertSource: '',
  dispatchChannel: '',
  dispatchStatus: '',
};

export type PersonalInboxWorkspaceProps = {
  initialKind?: PersonalInboxKindFilter;
  initialFolder?: string;
  initialListUiFilters?: PersonalInboxListUiFilters;
  composeToolbarAction?: React.ReactNode;
};

export const PersonalInboxWorkspace: React.FC<PersonalInboxWorkspaceProps> = ({
  initialKind = 'all',
  initialFolder = '',
  initialListUiFilters = EMPTY_LIST_UI_FILTERS,
  composeToolbarAction = null,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { config } = usePlatformConfig();
  const mountId = useOptionalPlatformMount()?.id;
  const studioHrefOptions = { config, mountId };
  const t = useCultureT();
  const culture = useCulture();
  const gridTextDirection = culture.direction === 'rtl' ? 'rtl' as const : 'culture' as const;
  const listToolbarScroll = useListPageToolbarScrollContext();
  const { handleGridScroll } = useListPageToolbarScroll();
  const kindOptions = kindFilterOptions(t);
  const channelFilterOptions = messagesLedgerChannelOptions(t);
  const statusFilterOptions = messagesLedgerStatusOptions(t);
  const loadingLabel = resolveCultureLabel(t, 'shell.inbox.loading', 'Loading inbox…');
  const dispatchEmptyLabel = resolveCultureLabel(
    t,
    'shell.inbox.messagesLedger.empty',
    'No outbound messages match these filters.',
  );
  const emptyLabel = resolveCultureLabel(t, 'shell.inbox.empty', 'Nothing in your inbox right now.');
  const loadFailedLabel = resolveCultureLabel(t, 'shell.inbox.loadFailed', 'Failed to load inbox.');
  const searchPlaceholder = resolveCultureLabel(t, 'shell.inbox.search.placeholder', 'Search inbox…');
  const searchAriaLabel = resolveCultureLabel(t, 'shell.inbox.search.aria', 'Search inbox items');
  const folderFilterAria = resolveCultureLabel(t, 'shell.inbox.filter.folderAria', 'Inbox folder');
  const inboxFolderLabel = resolveCultureLabel(t, 'shell.inbox.filter.folderInbox', 'Inbox');
  const inboxFolderTitle = resolveCultureLabel(
    t,
    'shell.inbox.filter.folderInboxTitle',
    'Main inbox only — items you archived or moved to Deleted are hidden here.',
  );
  const archivedFolderLabel = resolveCultureLabel(t, 'shell.inbox.folder.archived', 'Archived');
  const deletedFolderLabel = resolveCultureLabel(t, 'shell.inbox.folder.deleted', 'Deleted');
  const allFolderLabel = resolveCultureLabel(t, 'shell.inbox.filter.viewAll', 'All items');
  const allFolderTitle = resolveCultureLabel(
    t,
    'shell.inbox.filter.folderAllTitle',
    'One list with everything — inbox, archived, and deleted (except permanently removed).',
  );
  const attentionFilterAria = resolveCultureLabel(t, 'shell.inbox.filter.attentionAria', 'Read state');
  const attentionUnreadLabel = resolveCultureLabel(t, 'shell.inbox.filter.attentionUnread', 'Unread');
  const attentionReadLabel = resolveCultureLabel(t, 'shell.inbox.filter.attentionRead', 'Read');
  const folderEmptyLabel = resolveCultureLabel(t, 'shell.inbox.emptyFolder', 'No items in this folder.');
  const manageFoldersLabel = resolveCultureLabel(t, 'shell.inbox.folder.manage', 'Manage folders');
  const manageFoldersAria = resolveCultureLabel(t, 'shell.inbox.folder.manageAria', 'Manage your personal inbox folders');
  const showingPartialLabel = (shown: number, totalCount: number) => (
    resolveCultureLabel(t, 'shell.inbox.showingPartial', `Showing ${shown} of ${totalCount}.`)
      .replace('{shown}', String(shown))
      .replace('{total}', String(totalCount))
  );

  const syncKindToAddressBar = useCallback((nextKind: PersonalInboxKindFilter) => {
    const nextParams = applyPersonalInboxKindFilter(searchParams, nextKind);
    const current = searchParams.toString();
    const serialized = nextParams.toString();
    if (serialized === current) {
      return;
    }
    setSearchParams(nextParams, { replace: false });
  }, [searchParams, setSearchParams]);

  const syncFolderToAddressBar = useCallback((nextFolder: string) => {
    const nextParams = applyPersonalInboxFolderFilter(searchParams, nextFolder);
    const current = searchParams.toString();
    const serialized = nextParams.toString();
    if (serialized === current) {
      return;
    }
    setSearchParams(nextParams, { replace: false });
  }, [searchParams, setSearchParams]);

  const handleFolderFilterChange = useCallback((value: string) => {
    if (value === FOLDER_FILTER_SEPARATOR) {
      return;
    }
    const nextFolder = value.trim();
    setFolderFilter(nextFolder);
    syncFolderToAddressBar(nextFolder);
  }, [syncFolderToAddressBar]);

  const handleKindFilterChange = useCallback((value: string) => {
    const nextKind = (value || 'all') as PersonalInboxKindFilter;
    setKind(nextKind);
    if (nextKind !== 'message_dispatch') {
      setDispatchChannel('');
      setDispatchStatus('');
    }
    if (nextKind !== 'work_item') {
      setWorkItemTypeFilter('');
    }
    if (nextKind !== 'feedback') {
      setFeedbackScopeFilter('');
    }
    if (nextKind !== 'alert') {
      setAlertSourceFilter('');
    }
    syncKindToAddressBar(nextKind);
  }, [syncKindToAddressBar]);

  const [kind, setKind] = useState<PersonalInboxKindFilter>(initialKind);
  const [folderFilter, setFolderFilter] = useState(initialFolder);
  const [userFolders, setUserFolders] = useState<PersonalInboxUserFolder[]>([]);
  const [cardDeleteItem, setCardDeleteItem] = useState<PersonalInboxItem | null>(null);
  const [cardTagItem, setCardTagItem] = useState<PersonalInboxItem | null>(null);
  const [folderManageOpen, setFolderManageOpen] = useState(false);
  const [correspondenceOpen, setCorrespondenceOpen] = useState(false);
  const [correspondenceMode, setCorrespondenceMode] = useState<'reply' | 'forward'>('reply');
  const [correspondenceItem, setCorrespondenceItem] = useState<PersonalInboxItem | null>(null);
  const [dispatchChannel, setDispatchChannel] = useState(initialListUiFilters.dispatchChannel);
  const [dispatchStatus, setDispatchStatus] = useState(initialListUiFilters.dispatchStatus);
  const [workItemTypeFilter, setWorkItemTypeFilter] = useState(initialListUiFilters.workItemType);
  const [feedbackScopeFilter, setFeedbackScopeFilter] = useState<PersonalInboxFeedbackScopeFilter>(
    initialListUiFilters.feedbackScope,
  );
  const [alertSourceFilter, setAlertSourceFilter] = useState(initialListUiFilters.alertSource);
  const [attentionToggles, setAttentionToggles] = useState<PersonalInboxAttentionToggles>(() => (
    personalInboxAttentionTogglesFromFilter(initialListUiFilters.attention)
  ));
  const listAttentionFilter = useMemo(
    () => personalInboxAttentionFilterFromToggles(attentionToggles),
    [attentionToggles],
  );
  const [correspondenceFilter, setCorrespondenceFilter] = useState<PersonalInboxCorrespondenceFilter>(
    initialListUiFilters.correspondence,
  );

  const syncListUiFiltersToAddressBar = useCallback((filters: PersonalInboxListUiFilters) => {
    const nextParams = applyPersonalInboxListUiFilters(searchParams, filters);
    if (nextParams.toString() === searchParams.toString()) {
      return;
    }
    setSearchParams(nextParams, { replace: false });
  }, [searchParams, setSearchParams]);

  const buildListUiFiltersFromState = useCallback((): PersonalInboxListUiFilters => ({
    attention: listAttentionFilter,
    correspondence: correspondenceFilter,
    workItemType: workItemTypeFilter,
    feedbackScope: feedbackScopeFilter,
    alertSource: alertSourceFilter,
    dispatchChannel,
    dispatchStatus,
  }), [
    alertSourceFilter,
    correspondenceFilter,
    dispatchChannel,
    dispatchStatus,
    feedbackScopeFilter,
    listAttentionFilter,
    workItemTypeFilter,
  ]);

  const commitListUiFilters = useCallback((patch: Partial<PersonalInboxListUiFilters>) => {
    syncListUiFiltersToAddressBar({ ...buildListUiFiltersFromState(), ...patch });
  }, [buildListUiFiltersFromState, syncListUiFiltersToAddressBar]);

  const resetLegacyFieldFilters = useCallback(() => {
    setKind('all');
    setFolderFilter('');
    setDispatchChannel('');
    setDispatchStatus('');
    setWorkItemTypeFilter('');
    setFeedbackScopeFilter('');
    setAlertSourceFilter('');
    setAttentionToggles({ unread: false, read: false });
    setCorrespondenceFilter('');
    syncKindToAddressBar('all');
    syncFolderToAddressBar('');
    syncListUiFiltersToAddressBar(EMPTY_LIST_UI_FILTERS);
  }, [syncFolderToAddressBar, syncKindToAddressBar, syncListUiFiltersToAddressBar]);

  const {
    legacyFieldFiltersVisible,
    toggleLegacyFieldFilters,
  } = useHwyLegacyFieldFilterBarMode(PERSONAL_INBOX_PAGE_KEY, resetLegacyFieldFilters);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [items, setItems] = useState<PersonalInboxItem[]>([]);
  const [total, setTotal] = useState(0);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const [inboxAttentionCount, setInboxAttentionCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [bulkSelectMode, setBulkSelectMode] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [bulkActionBusy, setBulkActionBusy] = useState(false);
  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedSearch(searchInput), 250);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const load = useCallback(async (retry = false) => {
    if (retry) setIsRetrying(true);
    else setIsLoading(true);
    setLoadError(null);
    try {
      const result = await personalInboxApi.list({
        kind,
        folder: folderFilter || undefined,
        take: 80,
        dispatchChannel: kind === 'message_dispatch' ? dispatchChannel || undefined : undefined,
        dispatchStatus: kind === 'message_dispatch' ? dispatchStatus || undefined : undefined,
      });
      setItems(result.items ?? []);
      setTotal(result.total ?? 0);
      setUnreadTotal(result.unreadTotal ?? 0);
      setInboxAttentionCount(result.inboxAttentionCount ?? result.unreadTotal ?? 0);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : loadFailedLabel);
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [dispatchChannel, dispatchStatus, folderFilter, kind, loadFailedLabel]);

  const reloadFolders = useCallback(async () => {
    try {
      setUserFolders(await personalInboxApi.listFolders());
    } catch {
      // Folder list is optional for first paint.
    }
  }, []);

  useEffect(() => {
    void reloadFolders();
  }, [reloadFolders]);

  useEffect(() => {
    setKind(initialKind);
  }, [initialKind]);

  useEffect(() => {
    setFolderFilter(initialFolder);
  }, [initialFolder]);

  useEffect(() => {
    setAttentionToggles(personalInboxAttentionTogglesFromFilter(initialListUiFilters.attention));
    setCorrespondenceFilter(initialListUiFilters.correspondence);
    setWorkItemTypeFilter(initialListUiFilters.workItemType);
    setFeedbackScopeFilter(initialListUiFilters.feedbackScope);
    setAlertSourceFilter(initialListUiFilters.alertSource);
    setDispatchChannel(initialListUiFilters.dispatchChannel);
    setDispatchStatus(initialListUiFilters.dispatchStatus);
  }, [initialListUiFilters]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const syncListTotalFromServer = (event: Event) => {
      const detail = (event as CustomEvent<PersonalInboxSummary | null>).detail;
      if (detail && typeof detail.attentionCount === 'number') {
        setInboxAttentionCount(Math.max(0, detail.attentionCount));
        return;
      }
      void load(true);
    };
    window.addEventListener(PERSONAL_INBOX_CHANGED_EVENT, syncListTotalFromServer);
    return () => window.removeEventListener(PERSONAL_INBOX_CHANGED_EVENT, syncListTotalFromServer);
  }, [load]);

  const kindScopedItems = useMemo(() => {
    let scoped: PersonalInboxItem[];
    if (kind === 'all') {
      scoped = items;
    } else {
      scoped = items.filter((item) => {
        if (kind === 'work_item') {
          if (item.kind !== 'work_item') {
            return false;
          }
          return itemMatchesWorkItemTypeFilter(item, workItemTypeFilter);
        }
        if (kind === 'feedback') {
          if (item.kind !== 'feedback') {
            return false;
          }
          return itemMatchesFeedbackScopeFilter(item, feedbackScopeFilter);
        }
        if (kind === 'alert') {
          if (item.kind !== 'alert') {
            return false;
          }
          return itemMatchesAlertSourceFilter(item, alertSourceFilter);
        }
        return item.kind === kind;
      });
    }
    if (correspondenceFilter) {
      scoped = scoped.filter((item) => itemMatchesCorrespondenceFilter(item, correspondenceFilter));
    }
    if (listAttentionFilter) {
      scoped = scoped.filter((item) => itemMatchesAttentionFilter(item, listAttentionFilter));
    }
    return scoped;
  }, [
    alertSourceFilter,
    correspondenceFilter,
    feedbackScopeFilter,
    items,
    kind,
    listAttentionFilter,
    workItemTypeFilter,
  ]);

  const filteredItems = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    if (!query) {
      return kindScopedItems;
    }
    return kindScopedItems.filter((item) => {
      const haystack = [item.title, item.summary, item.originDetail]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [debouncedSearch, kindScopedItems]);

  useEffect(() => {
    const visible = new Set(filteredItems.map((row) => row.id));
    setSelectedRowKeys((prev) => prev.filter((key) => visible.has(key)));
  }, [filteredItems]);

  const folderScopeToken = folderFilter.trim();
  /** Row actions (read, reply, forward, wide actions column) — not on Deleted-only narrow views. */
  const showInboxGridPrimaryActions = !folderScopeToken
    || folderScopeToken === 'inbox'
    || folderScopeToken === 'all'
    || folderScopeToken === 'archived'
    || folderScopeToken.startsWith('u:');
  const tagLabel = resolveCultureLabel(t, 'shell.inbox.folder.tag', 'Tag');
  const moveToDeletedLabel = resolveCultureLabel(t, 'shell.inbox.delete.moveToDeleted', 'Move to Deleted');
  const permanentDeleteLabel = resolveCultureLabel(t, 'shell.inbox.delete.permanent', 'Delete permanently');
  const bulkSelectEnableLabel = resolveCultureLabel(t, 'shell.inbox.bulkSelect.enable', 'Select items');
  const bulkSelectDisableLabel = resolveCultureLabel(t, 'shell.inbox.bulkSelect.disable', 'Done selecting');
  const bulkClearSelectionLabel = resolveCultureLabel(t, 'shell.inbox.bulk.clearSelection', 'Clear selection');
  const bulkSelectedCountLabel = (count: number) => (
    resolveCultureLabel(t, 'shell.inbox.bulkSelect.selectedCount', '{count} selected')
      .replace('{count}', String(count))
  );
  const markReadLabel = resolveCultureLabel(t, 'shell.inbox.markRead', 'Mark as read');
  const markUnreadLabel = resolveCultureLabel(t, 'shell.inbox.markUnread', 'Mark as unread');
  const replyLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.reply', 'Reply');
  const forwardLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.forward', 'Forward');
  const repliedBadgeLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.repliedBadge', 'Replied');
  const forwardedBadgeLabel = resolveCultureLabel(t, 'shell.inbox.correspondence.forwardedBadge', 'Forwarded');

  const openCorrespondence = useCallback((row: PersonalInboxItem, mode: 'reply' | 'forward') => {
    setCorrespondenceItem(row);
    setCorrespondenceMode(mode);
    setCorrespondenceOpen(true);
  }, []);

  const handleItemTagged = useCallback((updated: PersonalInboxItem) => {
    setItems((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
  }, []);

  const handleItemRemovedFromList = useCallback((itemKey: string) => {
    setItems((prev) => {
      const removed = prev.find((row) => row.id === itemKey);
      if (removed && inboxItemUnseen(removed)) {
        setUnreadTotal((count) => Math.max(0, count - 1));
      }
      return prev.filter((row) => row.id !== itemKey);
    });
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  const dismissInboxItemAttention = useCallback((item: PersonalInboxItem) => {
    if (!showInboxGridPrimaryActions || !inboxItemUnseen(item)) {
      return;
    }
    void personalInboxApi.dismissAttention(item.id).then(({ dismissed, summary }) => {
      if (summary) {
        setInboxAttentionCount(Math.max(0, summary.attentionCount));
        void notifyPersonalInboxChangedWithFallback(summary);
      } else if (dismissed) {
        setInboxAttentionCount((count) => Math.max(0, count - 1));
        void notifyPersonalInboxChangedWithFallback();
      }
      if (!dismissed && !summary) {
        return;
      }
      setItems((prev) => {
        const wasUnseen = prev.some((row) => row.id === item.id && inboxItemUnseen(row));
        if (wasUnseen) {
          setUnreadTotal((count) => Math.max(0, count - 1));
        }
        return prev.map((row) => (
          row.id === item.id ? { ...row, attention: 'none' } : row
        ));
      });
    }).catch(() => undefined);
  }, [showInboxGridPrimaryActions]);

  const applyAttentionSummary = useCallback((summary: PersonalInboxSummary | undefined) => {
    if (summary && typeof summary.attentionCount === 'number') {
      setInboxAttentionCount(Math.max(0, summary.attentionCount));
      void notifyPersonalInboxChangedWithFallback(summary);
    } else {
      void notifyPersonalInboxChangedWithFallback();
    }
  }, []);

  const toggleItemReadState = useCallback((item: PersonalInboxItem) => {
    if (!showInboxGridPrimaryActions || item.kind === 'message_dispatch') {
      return;
    }
    const unseen = inboxItemUnseen(item);
    const request = unseen
      ? personalInboxApi.dismissAttention(item.id)
      : personalInboxApi.markUnread(item.id);
    void request.then(({ summary, ...result }) => {
      const changed = unseen
        ? ('dismissed' in result && result.dismissed)
        : ('updated' in result && result.updated);
      if (!changed) {
        return;
      }
      setItems((prev) => prev.map((row) => (
        row.id === item.id
          ? { ...row, attention: unseen ? 'none' as const : (item.kind === 'work_item' ? 'action_required' as const : 'unread' as const) }
          : row
      )));
      if (unseen && inboxItemUnseen(item)) {
        setUnreadTotal((count) => Math.max(0, count - 1));
        setInboxAttentionCount((count) => Math.max(0, count - 1));
      } else if (!unseen) {
        setUnreadTotal((count) => count + 1);
        setInboxAttentionCount((count) => count + 1);
      }
      applyAttentionSummary(summary);
      void load(true);
    }).catch(() => undefined);
  }, [applyAttentionSummary, load, showInboxGridPrimaryActions]);

  const selectedInboxItems = useMemo(
    () => filteredItems.filter((row) => selectedRowKeys.includes(row.id)),
    [filteredItems, selectedRowKeys],
  );

  const toggleBulkSelectMode = useCallback(() => {
    setBulkSelectMode((prev) => {
      if (prev) {
        setSelectedRowKeys([]);
      }
      return !prev;
    });
  }, []);

  const clearBulkSelection = useCallback(() => {
    setSelectedRowKeys([]);
  }, []);

  const applyBulkItemFolderUpdate = useCallback(async (
    item: PersonalInboxItem,
    folderRefs: string[],
  ): Promise<boolean> => {
    try {
      const { folderRefs: nextRefs, summary } = await personalInboxApi.setItemFolderRefs(item.id, folderRefs);
      const updated = { ...item, folderRefs: nextRefs };
      handleItemTagged(updated);
      const token = folderFilter.trim().toLowerCase();
      const refs = updated.folderRefs ?? [];
      const stillInFilter = token === 'deleted'
        ? refs.includes(PERSONAL_INBOX_SYSTEM_FOLDER_DELETED)
        : !token || token === 'inbox'
          ? !refs.includes(PERSONAL_INBOX_SYSTEM_FOLDER_DELETED)
          : true;
      if (!stillInFilter) {
        handleItemRemovedFromList(item.id);
      }
      if (summary) {
        applyAttentionSummary(summary);
      }
      return true;
    } catch {
      return false;
    }
  }, [applyAttentionSummary, folderFilter, handleItemRemovedFromList, handleItemTagged]);

  const runBulkInboxAction = useCallback(async (
    targets: PersonalInboxItem[],
    action: (item: PersonalInboxItem) => Promise<boolean>,
  ) => {
    if (targets.length === 0 || bulkActionBusy) {
      return;
    }
    setBulkActionBusy(true);
    const results = await Promise.all(targets.map(async (item) => {
      try {
        return await action(item);
      } catch {
        return false;
      }
    }));
    const okCount = results.filter(Boolean).length;
    if (okCount < targets.length) {
      showAppFeedbackToast(
        resolveCultureLabel(t, 'shell.inbox.bulk.failed', 'Some items could not be updated.'),
        { type: 'error' },
      );
    } else if (okCount > 0) {
      showAppFeedbackToast(
        resolveCultureLabel(t, 'shell.inbox.bulk.completed', 'Updated {count} items.')
          .replace('{count}', String(okCount)),
        { type: 'success' },
      );
    }
    setBulkActionBusy(false);
    setSelectedRowKeys([]);
    void load(true);
  }, [bulkActionBusy, load, t]);

  const bulkMarkSelectedRead = useCallback(() => {
    const targets = selectedInboxItems.filter(
      (item) => showInboxGridPrimaryActions && item.kind !== 'message_dispatch' && inboxItemUnseen(item),
    );
    void runBulkInboxAction(targets, async (item) => {
      let dismissed = false;
      let summary;
      try {
        ({ dismissed, summary } = await personalInboxApi.dismissAttention(item.id));
      } catch {
        return false;
      }
      if (!dismissed) {
        return false;
      }
      setItems((prev) => prev.map((row) => (
        row.id === item.id ? { ...row, attention: 'none' as const } : row
      )));
      applyAttentionSummary(summary);
      return true;
    });
  }, [applyAttentionSummary, runBulkInboxAction, selectedInboxItems, showInboxGridPrimaryActions]);

  const bulkMarkSelectedUnread = useCallback(() => {
    const targets = selectedInboxItems.filter(
      (item) => showInboxGridPrimaryActions && item.kind !== 'message_dispatch' && !inboxItemUnseen(item),
    );
    void runBulkInboxAction(targets, async (item) => {
      let updated = false;
      let summary;
      try {
        ({ updated, summary } = await personalInboxApi.markUnread(item.id));
      } catch {
        return false;
      }
      if (!updated) {
        return false;
      }
      setItems((prev) => prev.map((row) => (
        row.id === item.id
          ? {
            ...row,
            attention: item.kind === 'work_item' ? 'action_required' as const : 'unread' as const,
          }
          : row
      )));
      applyAttentionSummary(summary);
      return true;
    });
  }, [applyAttentionSummary, runBulkInboxAction, selectedInboxItems, showInboxGridPrimaryActions]);

  const bulkMoveSelectedToDeleted = useCallback(() => {
    const targets = selectedInboxItems.filter(
      (item) => !itemHasInboxSoftDeletedFolderTag(item.folderRefs ?? []),
    );
    void runBulkInboxAction(targets, async (item) => {
      const nextRefs = [...new Set([...(item.folderRefs ?? []), PERSONAL_INBOX_SYSTEM_FOLDER_DELETED])];
      return applyBulkItemFolderUpdate(item, nextRefs);
    });
  }, [applyBulkItemFolderUpdate, runBulkInboxAction, selectedInboxItems]);

  const openItem = useCallback((item: PersonalInboxItem) => {
    if (bulkSelectMode) {
      return;
    }
    dismissInboxItemAttention(item);
    if (item.kind === 'alert' && item.ref.type === 'notification') {
      navigate(resolveStudioRelativeHref(
        location.pathname,
        buildPersonalInboxAlertFocusHref(item.ref.id),
        studioHrefOptions,
      ));
      return;
    }
    if (item.kind === 'message_dispatch' && item.ref.type === 'message_dispatch') {
      navigate(resolveStudioRelativeHref(
        location.pathname,
        buildPersonalInboxDispatchFocusHref(item.ref.id),
        studioHrefOptions,
      ));
      return;
    }
    let href = item.href;
    if (item.kind === 'feedback' && item.ref.type === 'feedback') {
      const scope = item.href.includes('my-feedback') ? 'mine' : 'staff';
      href = buildPersonalInboxFeedbackFocusHref(item.ref.id, scope);
    }
    navigate(resolveStudioRelativeHref(location.pathname, href, studioHrefOptions));
  }, [
    bulkSelectMode,
    dismissInboxItemAttention,
    location.pathname,
    navigate,
    studioHrefOptions,
  ]);

  const unreadRowAriaLabel = resolveCultureLabel(
    t,
    'shell.inbox.grid.unreadRowAria',
    'Not opened yet',
  );

  const columns = useMemo((): AppTableGridColumnDef<PersonalInboxItem>[] => {
    const attachmentsColumnLabel = resolveCultureLabel(
      t,
      'shell.inbox.grid.column.attachments',
      'Attachments',
    );
    const attachmentsCountLabel = (count: number) => {
      if (count === 1) {
        return resolveCultureLabel(t, 'shell.inbox.grid.attachmentsCountOne', '1 attachment');
      }
      return resolveCultureLabel(t, 'shell.inbox.grid.attachmentsCount', '{count} attachments')
        .replace('{count}', String(count));
    };
    const titleLabel = resolveCultureLabel(t, 'shell.inbox.grid.column.title', 'Title');
    const dateLabel = resolveCultureLabel(t, 'shell.inbox.grid.column.date', 'Date');

    return [
      {
        id: 'attentionMark',
        label: '',
        width: INBOX_ATTENTION_COLUMN_WIDTH_PX,
        headerClassName: 'text-center personal-inbox-grid-attention-cell',
        cellClassName: 'text-center personal-inbox-grid-attention-cell',
        card: { role: 'meta' },
        renderCell: (row) => {
          const showMark = showInboxGridPrimaryActions && row.kind !== 'message_dispatch';
          if (!showMark) {
            return <span className="personal-inbox-grid-attention-empty" aria-hidden />;
          }
          const unseen = inboxItemUnseen(row);
          return (
            <AppButton
              type="button"
              size="sm"
              intent="ghost"
              aria-label={unseen ? markReadLabel : markUnreadLabel}
              title={unseen ? markReadLabel : markUnreadLabel}
              className={INBOX_GRID_ACTION_BTN_CLASS}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                toggleItemReadState(row);
              }}
            >
              {unseen ? (
                <Mail
                  className={cn('h-4 w-4 shrink-0', INBOX_UNREAD_MAIL_ICON_CLASS)}
                  strokeWidth={1.75}
                  aria-hidden
                />
              ) : (
                <MailOpen
                  className={cn('h-4 w-4 shrink-0', INBOX_READ_MAIL_ICON_CLASS)}
                  strokeWidth={1.75}
                  aria-hidden
                />
              )}
            </AppButton>
          );
        },
        sort: false,
        filter: false,
      },
      {
        id: 'title',
        label: titleLabel,
        textDirection: gridTextDirection,
        headerClassName: 'text-start',
        cellClassName: 'text-start font-medium text-slate-800 personal-inbox-grid-title-cell',
        card: { role: 'title' },
        renderCell: (row) => {
          const unseen = inboxItemUnseen(row);
          const displayTitle = resolveInboxItemTitle(t, row.title);
          return (
            <span
              className="personal-inbox-grid-title-row block min-w-0 w-full"
              title={unseen ? `${unreadRowAriaLabel}: ${displayTitle}` : displayTitle}
            >
              <span className="personal-inbox-grid-title-text flex min-w-0 items-center gap-1.5">
                <span
                  className={cn(
                    'block min-w-0 truncate',
                    unseen ? 'font-semibold text-slate-900' : 'font-normal text-slate-700',
                    gridTextDirection === 'rtl' ? 'text-end' : 'text-start',
                  )}
                  dir={gridTextDirection === 'rtl' ? 'rtl' : undefined}
                  aria-label={unseen ? `${unreadRowAriaLabel}: ${displayTitle}` : undefined}
                >
                  {displayTitle}
                </span>
                {row.correspondence?.replied ? (
                  <span className={INBOX_REPLIED_BADGE_CLASS}>
                    {repliedBadgeLabel}
                  </span>
                ) : null}
                {row.correspondence?.forwarded ? (
                  <span className={INBOX_FORWARDED_BADGE_CLASS}>
                    {forwardedBadgeLabel}
                  </span>
                ) : null}
                <span
                  className={cn(
                    INBOX_CORRESPONDENCE_BADGE_BASE_CLASS,
                    'ring-slate-200/60',
                    KIND_BADGE_CLASS[row.kind],
                  )}
                  title={resolveInboxOriginLabel(t, row)}
                >
                  {resolveInboxOriginLabel(t, row)}
                </span>
              </span>
            </span>
          );
        },
        getSortValue: (row) => resolveInboxItemTitle(t, row.title),
        sort: { mode: 'client' },
        filter: false,
      },
      {
        id: 'attachments',
        label: (
          <span className="personal-inbox-grid-attachments-header" title={attachmentsColumnLabel}>
            <Paperclip className="h-3.5 w-3.5 text-slate-500" strokeWidth={1.75} aria-hidden />
            <span className="sr-only">{attachmentsColumnLabel}</span>
          </span>
        ),
        width: 52,
        headerClassName: 'text-center personal-inbox-grid-attachments-cell',
        cellClassName: 'text-center personal-inbox-grid-attachments-cell',
        card: { role: 'meta' },
        renderCell: (row) => {
          const count = row.attachmentCount ?? 0;
          if (count <= 0) {
            return <span className="personal-inbox-grid-attachments-empty" aria-hidden />;
          }
          const label = attachmentsCountLabel(count);
          return (
            <span
              className="personal-inbox-grid-attachments-row inline-flex items-center justify-center gap-0.5 text-xs font-medium tabular-nums text-slate-600"
              title={label}
              aria-label={label}
            >
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-slate-500" strokeWidth={1.75} aria-hidden />
              <span>{count}</span>
            </span>
          );
        },
        getSortValue: (row) => row.attachmentCount ?? 0,
        sort: { mode: 'client' },
        filter: false,
      },
      {
        id: 'surfacedAt',
        label: dateLabel,
        width: 112,
        headerClassName: 'text-center',
        cellClassName: 'text-center',
        card: { role: 'field', label: dateLabel },
        renderCell: (row) => (
          <MountGridDateText
            value={row.surfacedAt}
            align="center"
            className="font-mono text-xs text-slate-500"
          />
        ),
        getSortValue: (row) => row.surfacedAt,
        sort: { mode: 'client' },
        filter: false,
      },
      ...(bulkSelectMode ? [] : [{
        id: 'actions',
        label: '',
        width: INBOX_ACTIONS_COLUMN_WIDTH_PX,
        headerClassName: 'text-center personal-inbox-grid-actions-cell',
        cellClassName: 'text-center personal-inbox-grid-actions-cell',
        card: { role: 'actions' as const },
        renderCell: (row: PersonalInboxItem) => {
          const showInboxAttentionActions =
            showInboxGridPrimaryActions && row.kind !== 'message_dispatch';
          const showReply =
            showInboxAttentionActions &&
            inboxSupportsCorrespondenceAction(row.kind, 'reply');
          const showForward =
            showInboxAttentionActions &&
            inboxSupportsCorrespondenceAction(row.kind, 'forward');

          return (
            <span
              className="personal-inbox-grid-actions-row"
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <span className="personal-inbox-grid-actions-slot">
                {showReply ? (
                  <AppButton
                    type="button"
                    size="sm"
                    intent="ghost"
                    aria-label={replyLabel}
                    title={replyLabel}
                    className={INBOX_GRID_ACTION_BTN_CLASS}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      openCorrespondence(row, 'reply');
                    }}
                  >
                    <PersonalInboxReplyIcon className="text-slate-600" />
                  </AppButton>
                ) : null}
              </span>
              <span className="personal-inbox-grid-actions-slot">
                {showForward ? (
                  <AppButton
                    type="button"
                    size="sm"
                    intent="ghost"
                    aria-label={forwardLabel}
                    title={forwardLabel}
                    className={INBOX_GRID_ACTION_BTN_CLASS}
                    onMouseDown={(event) => event.stopPropagation()}
                    onClick={(event) => {
                      event.stopPropagation();
                      openCorrespondence(row, 'forward');
                    }}
                  >
                    <PersonalInboxForwardIcon className="text-slate-600" />
                  </AppButton>
                ) : null}
              </span>
              <span className="personal-inbox-grid-actions-slot">
                <PersonalInboxItemFolderTagMenu
                  item={row}
                  userFolders={userFolders}
                  activeFolderToken={folderFilter}
                  onItemUpdated={handleItemTagged}
                  onItemRemovedFromList={handleItemRemovedFromList}
                  buttonClassName={INBOX_GRID_ACTION_BTN_CLASS}
                />
              </span>
              <span className="personal-inbox-grid-actions-slot personal-inbox-grid-actions-slot--delete">
                <PersonalInboxItemDeleteButton
                  item={row}
                  activeFolderToken={folderFilter}
                  onItemUpdated={handleItemTagged}
                  onItemRemovedFromList={handleItemRemovedFromList}
                  buttonClassName={INBOX_GRID_ACTION_BTN_CLASS}
                />
              </span>
            </span>
          );
        },
        sort: false as const,
        filter: false as const,
      }]),
    ];
  }, [
    bulkSelectMode,
    folderFilter,
    gridTextDirection,
    handleItemRemovedFromList,
    handleItemTagged,
    showInboxGridPrimaryActions,
    forwardLabel,
    forwardedBadgeLabel,
    markReadLabel,
    markUnreadLabel,
    openCorrespondence,
    repliedBadgeLabel,
    replyLabel,
    t,
    toggleItemReadState,
    unreadRowAriaLabel,
    userFolders,
  ]);

  const getInboxRowClassName = useCallback(
    (row: PersonalInboxItem) => (
      inboxItemUnseen(row) ? INBOX_UNREAD_ROW_CLASS : INBOX_READ_ROW_CLASS
    ),
    [],
  );

  const isError = loadError !== null;
  const isRefreshing = isLoading || isRetrying;
  const hasClientOnlyListFilters = Boolean(
    correspondenceFilter
    || listAttentionFilter
    || debouncedSearch.trim()
    || (kind === 'work_item' && workItemTypeFilter.trim())
    || (kind === 'feedback' && feedbackScopeFilter)
    || (kind === 'alert' && alertSourceFilter.trim()),
  );
  const listToolbarMatchesServerPage = !hasClientOnlyListFilters
    && (kind === 'all' || kind === 'message_dispatch' || kindScopedItems.length === items.length);
  const listToolbarCountValue = !isLoading && !isError
    ? (
        listToolbarMatchesServerPage && total > items.length
          ? total
          : filteredItems.length
      )
    : undefined;
  const legacyFilterToolbarChrome = resolveHwyLegacyFieldFilterToolbarChrome({
    hasLegacyFilterModeSwitch: true,
    legacyFieldFilterModeActive: legacyFieldFiltersVisible,
    refreshEnabled: true,
  });

  const folderFilterButtonOptions = useMemo(() => {
    const builtInLead: Array<{ value: string; label: string; title?: string }> = [
      { value: '', label: inboxFolderLabel, title: inboxFolderTitle },
      { value: 'archived', label: archivedFolderLabel },
      { value: 'deleted', label: deletedFolderLabel },
    ];
    const allItemsOption = { value: 'all', label: allFolderLabel, title: allFolderTitle };
    return [
      ...builtInLead,
      ...userFolders.map((folder): { value: string; label: string; title?: string } => ({
        value: `u:${folder.id}`,
        label: folder.name,
      })),
      allItemsOption,
    ];
  }, [
    allFolderLabel,
    allFolderTitle,
    archivedFolderLabel,
    deletedFolderLabel,
    inboxFolderLabel,
    inboxFolderTitle,
    userFolders,
  ]);

  const isFolderFilterActive = useCallback((token: string) => {
    if (token === '') {
      return !folderFilter || folderFilter === 'inbox';
    }
    if (token === 'all') {
      return folderFilter === 'all';
    }
    return folderFilter === token;
  }, [folderFilter]);

  const toggleAttentionUnread = useCallback(() => {
    setAttentionToggles((prev) => {
      const next = { ...prev, unread: !prev.unread };
      commitListUiFilters({ attention: personalInboxAttentionFilterFromToggles(next) });
      return next;
    });
  }, [commitListUiFilters]);

  const toggleAttentionRead = useCallback(() => {
    setAttentionToggles((prev) => {
      const next = { ...prev, read: !prev.read };
      commitListUiFilters({ attention: personalInboxAttentionFilterFromToggles(next) });
      return next;
    });
  }, [commitListUiFilters]);

  const folderScopeFilter = (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5">
      <div
        role="group"
        aria-label={folderFilterAria}
        className="flex min-w-0 flex-wrap items-center gap-1.5"
      >
        {folderFilterButtonOptions.map((option) => {
          const active = isFolderFilterActive(option.value);
          return (
            <AppButton
              key={option.value || 'inbox'}
              type="button"
              size="sm"
              intent={active ? 'secondary' : 'utility'}
              aria-pressed={active}
              title={option.title}
              onClick={() => handleFolderFilterChange(option.value)}
            >
              {option.label}
            </AppButton>
          );
        })}
      </div>
      <div
        role="group"
        aria-label={attentionFilterAria}
        className="flex min-w-0 flex-wrap items-center gap-1.5 sm:ms-auto"
      >
        <AppButton
          type="button"
          size="sm"
          intent={attentionToggles.unread ? 'secondary' : 'utility'}
          aria-pressed={attentionToggles.unread}
          onClick={toggleAttentionUnread}
        >
          {attentionUnreadLabel}
        </AppButton>
        <AppButton
          type="button"
          size="sm"
          intent={attentionToggles.read ? 'secondary' : 'utility'}
          aria-pressed={attentionToggles.read}
          onClick={toggleAttentionRead}
        >
          {attentionReadLabel}
        </AppButton>
      </div>
    </div>
  );

  const kindFilterSelect = (
    <ToolbarFilterSelect
      value={kind === 'all' ? '' : kind}
      options={kindOptions.filter((option) => option.value !== 'all')}
      onChange={handleKindFilterChange}
      ariaLabel={resolveCultureLabel(t, 'shell.inbox.filter.typeAria', 'Inbox item type')}
      allLabel={resolveCultureLabel(t, 'shell.inbox.filter.allTypes', 'All types')}
      allOptionPrefixWithAriaLabel={false}
    />
  );

  const toolbarFiltersRow = (
    <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
      {legacyFilterToolbarChrome.quickSearchVisible ? (
        <ToolbarSearchInput
          value={searchInput}
          onChange={setSearchInput}
          placeholder={searchPlaceholder}
          ariaLabel={searchAriaLabel}
        />
      ) : null}
      {legacyFilterToolbarChrome.refreshInFiltersCluster ? (
        <HwyMemberListToolbarRefreshControl
          listTotalCount={listToolbarCountValue}
          onRefresh={() => void load(true)}
          isRefreshing={isRefreshing}
          separatorBefore={legacyFilterToolbarChrome.quickSearchVisible}
        />
      ) : null}
    </div>
  );

  const manageFoldersControl = (
    <AppButton
      size="sm"
      intent="utility"
      aria-label={manageFoldersAria}
      title={manageFoldersLabel}
      onClick={() => setFolderManageOpen(true)}
    >
      <FolderKanban className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {manageFoldersLabel}
    </AppButton>
  );

  const bulkSelectToggleControl = (
    <AppButton
      type="button"
      size="sm"
      intent={bulkSelectMode ? 'secondary' : 'utility'}
      aria-pressed={bulkSelectMode}
      aria-label={bulkSelectMode ? bulkSelectDisableLabel : bulkSelectEnableLabel}
      title={bulkSelectMode ? bulkSelectDisableLabel : bulkSelectEnableLabel}
      onClick={toggleBulkSelectMode}
    >
      <ListChecks className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {bulkSelectMode ? bulkSelectDisableLabel : bulkSelectEnableLabel}
    </AppButton>
  );

  const toolbarActionsRow = (
    <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
      <HwyMemberListToolbarActionsEnd
        helpPageKey={PERSONAL_INBOX_PAGE_KEY}
        actionsLeading={(
          <>
            {composeToolbarAction}
            {manageFoldersControl}
            {bulkSelectToggleControl}
          </>
        )}
        legacyFieldFilterToggle={(
          <HwyLegacyFieldFilterBarToggle
            active={legacyFieldFiltersVisible}
            onToggle={toggleLegacyFieldFilters}
          />
        )}
        onRefresh={legacyFieldFiltersVisible ? undefined : () => void load(true)}
        isRefreshing={isRefreshing}
        listTotalCount={legacyFieldFiltersVisible ? undefined : listToolbarCountValue}
      />
    </div>
  );

  const originDetailOptionLabel = useCallback((itemKind: PersonalInboxItemKind, originDetail: string) => (
    resolveInboxSourceDetailLabel(t, {
      id: `${itemKind}:filter`,
      kind: itemKind,
      origin: itemKind === 'work_item' ? 'Workflow' : itemKind === 'feedback' ? 'Feedback' : 'Alert',
      originDetail,
      title: '',
      summary: null,
      surfacedAt: new Date(0).toISOString(),
      attention: 'none',
      href: '',
      ref: itemKind === 'work_item'
        ? { type: 'work_item', id: 0 }
        : itemKind === 'feedback'
          ? { type: 'feedback', id: 0 }
          : { type: 'notification', id: 0 },
    })
  ), [t]);

  const workItemTypeFilterOptions = useMemo(() => (
    distinctOriginDetails(items, 'work_item').map((value) => ({
      value,
      label: originDetailOptionLabel('work_item', value),
    }))
  ), [items, originDetailOptionLabel]);

  const alertSourceFilterOptions = useMemo(() => (
    distinctOriginDetails(items, 'alert').map((value) => ({
      value,
      label: originDetailOptionLabel('alert', value),
    }))
  ), [items, originDetailOptionLabel]);

  const feedbackScopeFilterOptions = useMemo(() => ([
    { value: 'my_submission', label: resolveCultureLabel(t, 'shell.inbox.filter.feedback.mySubmission', 'My submission') },
    { value: 'assigned_to_me', label: resolveCultureLabel(t, 'shell.inbox.filter.feedback.assignedToMe', 'Assigned to me') },
    { value: 'role', label: resolveCultureLabel(t, 'shell.inbox.filter.feedback.roleQueue', 'Role queue') },
  ]), [t]);

  const correspondenceFilterOptions = useMemo(() => ([
    { value: 'replied', label: repliedBadgeLabel },
    { value: 'forwarded', label: forwardedBadgeLabel },
  ]), [forwardedBadgeLabel, repliedBadgeLabel]);

  const correspondenceFilterSelect = (
    <ToolbarFilterSelect
      value={correspondenceFilter}
      options={correspondenceFilterOptions}
      onChange={(value) => {
        const next = value as PersonalInboxCorrespondenceFilter;
        setCorrespondenceFilter(next);
        commitListUiFilters({ correspondence: next });
      }}
      ariaLabel={resolveCultureLabel(t, 'shell.inbox.filter.correspondenceAria', 'Reply / forward state')}
      allLabel={resolveCultureLabel(t, 'shell.inbox.filter.correspondenceAll', 'Any state')}
      allOptionPrefixWithAriaLabel={false}
    />
  );

  const kindSpecificFiltersRow = (() => {
    if (kind === 'message_dispatch') {
      return (
        <>
          <ToolbarFilterSelect
            value={dispatchChannel}
            options={channelFilterOptions}
            onChange={(value) => {
              setDispatchChannel(value);
              commitListUiFilters({ dispatchChannel: value });
            }}
            ariaLabel={resolveCultureLabel(t, 'shell.inbox.messagesLedger.filter.channelAria', 'Channel')}
            allLabel={resolveCultureLabel(t, 'shell.inbox.messagesLedger.channel.all', 'All channels')}
            allOptionPrefixWithAriaLabel={false}
          />
          <ToolbarFilterSelect
            value={dispatchStatus}
            options={statusFilterOptions}
            onChange={(value) => {
              setDispatchStatus(value);
              commitListUiFilters({ dispatchStatus: value });
            }}
            ariaLabel={resolveCultureLabel(t, 'shell.inbox.messagesLedger.filter.statusAria', 'Delivery status')}
            allLabel={resolveCultureLabel(t, 'shell.inbox.messagesLedger.status.all', 'All statuses')}
            allOptionPrefixWithAriaLabel={false}
          />
          {correspondenceFilterSelect}
        </>
      );
    }
    if (kind === 'work_item') {
      return (
        <>
          <ToolbarFilterSelect
            value={workItemTypeFilter}
            options={workItemTypeFilterOptions}
            onChange={(value) => {
              setWorkItemTypeFilter(value);
              commitListUiFilters({ workItemType: value });
            }}
            ariaLabel={resolveCultureLabel(t, 'shell.inbox.filter.workItem.typeAria', 'Work item type')}
            allLabel={resolveCultureLabel(t, 'shell.inbox.filter.workItem.typeAll', 'All types')}
            allOptionPrefixWithAriaLabel={false}
          />
          {correspondenceFilterSelect}
        </>
      );
    }
    if (kind === 'feedback') {
      return (
        <>
          <ToolbarFilterSelect
            value={feedbackScopeFilter}
            options={feedbackScopeFilterOptions}
            onChange={(value) => {
              const next = value as PersonalInboxFeedbackScopeFilter;
              setFeedbackScopeFilter(next);
              commitListUiFilters({ feedbackScope: next });
            }}
            ariaLabel={resolveCultureLabel(t, 'shell.inbox.filter.feedback.scopeAria', 'Feedback role')}
            allLabel={resolveCultureLabel(t, 'shell.inbox.filter.feedback.scopeAll', 'All roles')}
            allOptionPrefixWithAriaLabel={false}
          />
          {correspondenceFilterSelect}
        </>
      );
    }
    if (kind === 'alert') {
      return (
        <>
          <ToolbarFilterSelect
            value={alertSourceFilter}
            options={alertSourceFilterOptions}
            onChange={(value) => {
              setAlertSourceFilter(value);
              commitListUiFilters({ alertSource: value });
            }}
            ariaLabel={resolveCultureLabel(t, 'shell.inbox.filter.alert.sourceAria', 'Alert source')}
            allLabel={resolveCultureLabel(t, 'shell.inbox.filter.alert.sourceAll', 'All sources')}
            allOptionPrefixWithAriaLabel={false}
          />
          {correspondenceFilterSelect}
        </>
      );
    }
    return correspondenceFilterSelect;
  })();

  const legacyKindFiltersRow = (
    <div className="flex w-full min-w-0 flex-col">
      {folderScopeFilter}
      <div className="mt-[10px] flex w-full min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-slate-100 pb-[10px] pt-[10px]">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {kindFilterSelect}
        </div>
        <div className="flex min-w-0 flex-wrap items-center justify-end gap-2 sm:ms-auto">
          {kindSpecificFiltersRow}
        </div>
      </div>
    </div>
  );

  const partialFooter = !isLoading && !isError && total > items.length
    ? (
      <div className="border-t border-slate-200 px-4 py-2 text-xs text-slate-500">
        {showingPartialLabel(items.length, total)}
      </div>
    )
    : undefined;

  const toolbar = legacyFieldFiltersVisible ? (
    <ListPageToolbarScrollRoot
      collapsed={listToolbarScroll?.listToolbarCollapsed ?? false}
      className={PAGE_TOOLBAR_MULTI_ROW_CLASS}
    >
      <div className={PAGE_TOOLBAR_INNER_ROW_CLASS}>
        {toolbarFiltersRow}
        {toolbarActionsRow}
      </div>
      <HwyMemberDirectoryLegacyFilterBarPanel fieldFilterRow={legacyKindFiltersRow} />
    </ListPageToolbarScrollRoot>
  ) : (
    <ListPageToolbarFrame>
      {toolbarFiltersRow}
      {toolbarActionsRow}
    </ListPageToolbarFrame>
  );

  const gridEmpty = !isLoading && !isError && filteredItems.length === 0;
  const listEmptyLabel = folderFilter && folderFilter !== 'all'
    ? folderEmptyLabel
    : kind === 'message_dispatch'
      ? dispatchEmptyLabel
      : emptyLabel;
  const emptyMessage = debouncedSearch.trim() && items.length > 0
    ? resolveCultureLabel(t, 'shell.inbox.search.noMatches', 'No inbox items match this search.')
    : listEmptyLabel;

  const inboxCardRowActions = useCallback((row: PersonalInboxItem): GridRowActionItem[] => {
    if (bulkSelectMode) {
      return [];
    }
    const actions: GridRowActionItem[] = [];
    if (showInboxGridPrimaryActions && row.kind !== 'message_dispatch') {
      const unseen = inboxItemUnseen(row);
      if (inboxSupportsCorrespondenceAction(row.kind, 'reply')) {
        actions.push({
          id: 'reply',
          label: replyLabel,
          title: replyLabel,
          icon: <PersonalInboxReplyIcon className="h-3.5 w-3.5" />,
          intent: 'utility',
          onClick: () => openCorrespondence(row, 'reply'),
        });
      }
      if (inboxSupportsCorrespondenceAction(row.kind, 'forward')) {
        actions.push({
          id: 'forward',
          label: forwardLabel,
          title: forwardLabel,
          icon: <PersonalInboxForwardIcon className="h-3.5 w-3.5" />,
          intent: 'utility',
          onClick: () => openCorrespondence(row, 'forward'),
        });
      }
      actions.push({
        id: unseen ? 'mark-read' : 'mark-unread',
        label: unseen ? markReadLabel : markUnreadLabel,
        title: unseen ? markReadLabel : markUnreadLabel,
        icon: unseen
          ? <Mail className={cn('h-3.5 w-3.5', INBOX_UNREAD_MAIL_ICON_CLASS)} aria-hidden />
          : <MailOpen className={cn('h-3.5 w-3.5', INBOX_READ_MAIL_ICON_CLASS)} aria-hidden />,
        intent: 'utility',
        onClick: () => toggleItemReadState(row),
      });
    }
    actions.push({
      id: 'tag',
      label: tagLabel,
      title: tagLabel,
      icon: <Tag className="h-3.5 w-3.5" aria-hidden />,
      intent: 'utility',
      cardLabeled: true,
      onClick: () => setCardTagItem(row),
    });
    const softDeleted = itemHasInboxSoftDeletedFolderTag(row.folderRefs ?? []);
    const deleteLabel = softDeleted && row.kind !== 'work_item' ? permanentDeleteLabel : moveToDeletedLabel;
    actions.push({
      id: 'delete',
      label: deleteLabel,
      title: deleteLabel,
      icon: (
        <Trash2
          className={cn(
            'h-3.5 w-3.5',
            softDeleted && row.kind !== 'work_item' ? 'text-rose-600' : 'text-slate-600',
          )}
          aria-hidden
        />
      ),
      intent: 'utility',
      cardLabeled: true,
      disabled: softDeleted && row.kind === 'work_item',
      onClick: () => setCardDeleteItem(row),
    });
    return actions;
  }, [
    forwardLabel,
    markReadLabel,
    markUnreadLabel,
    moveToDeletedLabel,
    openCorrespondence,
    permanentDeleteLabel,
    replyLabel,
    bulkSelectMode,
    showInboxGridPrimaryActions,
    tagLabel,
    toggleItemReadState,
  ]);

  const bulkSelectionHasTargets = selectedRowKeys.length > 0;
  const bulkSelectionBar = bulkSelectMode ? (
    <div className="flex w-full min-w-0 flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-3 py-2 sm:px-5">
      <span className="text-xs font-medium text-slate-600">{bulkSelectedCountLabel(selectedRowKeys.length)}</span>
      <AppButton
        type="button"
        size="sm"
        intent="utility"
        disabled={bulkActionBusy || !bulkSelectionHasTargets}
        onClick={bulkMarkSelectedRead}
      >
        {markReadLabel}
      </AppButton>
      <AppButton
        type="button"
        size="sm"
        intent="utility"
        disabled={bulkActionBusy || !bulkSelectionHasTargets}
        onClick={bulkMarkSelectedUnread}
      >
        {markUnreadLabel}
      </AppButton>
      <AppButton
        type="button"
        size="sm"
        intent="destructive-soft"
        disabled={bulkActionBusy || !bulkSelectionHasTargets}
        onClick={bulkMoveSelectedToDeleted}
      >
        {moveToDeletedLabel}
      </AppButton>
      <AppButton
        type="button"
        size="icon-md"
        intent="utility"
        aria-label={bulkClearSelectionLabel}
        title={bulkClearSelectionLabel}
        disabled={bulkActionBusy || !bulkSelectionHasTargets}
        onClick={clearBulkSelection}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
      </AppButton>
    </div>
  ) : null;

  return (
    <ListPageShell onGridScroll={handleGridScroll}>
      {toolbar}
      {bulkSelectionBar}

      <div className="flex min-h-0 w-full flex-1 flex-col">
        <AppTableGrid
          presentation="auto"
          size="xs"
          chrome="classic"
          tableClassName="personal-inbox-grid-table text-slate-700"
          theadClassName="text-xs font-bold text-slate-500 uppercase tracking-wider"
          columns={columns}
          rows={filteredItems}
          getRowKey={(row) => row.id}
          onScroll={handleGridScroll}
          compact={{ tablet: { cardsPerRow: 2 } }}
          selectionMode={bulkSelectMode ? 'multiple' : 'none'}
          selectionControlClassName="personal-inbox-grid-selection-checkbox"
          selectedKeys={selectedRowKeys}
          onSelectionChange={setSelectedRowKeys}
          onRowClick={bulkSelectMode ? undefined : openItem}
          getRowClassName={getInboxRowClassName}
          getCardRowActions={inboxCardRowActions}
          isLoading={isLoading}
          loadingMessage={loadingLabel}
          errorContent={
            isError && loadError ? (
              <QueryErrorPanel
                message={loadFailedLabel}
                detail={loadError}
                onRetry={() => void load(true)}
                isRetrying={isRetrying}
                className="h-32"
              />
            ) : undefined
          }
          isEmpty={gridEmpty}
          emptyMessage={emptyMessage}
          footer={partialFooter}
        />
      </div>
      {cardTagItem ? (
        <div className="fixed bottom-4 end-4 z-[3000]">
          <PersonalInboxItemFolderTagMenu
            item={cardTagItem}
            userFolders={userFolders}
            activeFolderToken={folderFilter}
            defaultOpen
            onItemUpdated={handleItemTagged}
            onItemRemovedFromList={handleItemRemovedFromList}
            onClosed={() => setCardTagItem(null)}
          />
        </div>
      ) : null}
      {cardDeleteItem ? (
        <div className="sr-only" aria-hidden>
          <PersonalInboxItemDeleteButton
            key={cardDeleteItem.id}
            item={cardDeleteItem}
            activeFolderToken={folderFilter}
            autoActivate
            onAutoActivateDone={() => setCardDeleteItem(null)}
            onItemUpdated={handleItemTagged}
            onItemRemovedFromList={handleItemRemovedFromList}
          />
        </div>
      ) : null}
      <PersonalInboxFolderManageDialog
        open={folderManageOpen}
        onClose={() => setFolderManageOpen(false)}
        folders={userFolders}
        onFoldersChange={setUserFolders}
        activeFolderToken={folderFilter}
        onActiveFolderChange={(token) => {
          setFolderFilter(token);
          syncFolderToAddressBar(token);
        }}
      />
      <PersonalInboxCorrespondenceDialog
        open={correspondenceOpen}
        mode={correspondenceMode}
        item={correspondenceItem}
        onOpenChange={setCorrespondenceOpen}
        onCompleted={() => void load(true)}
      />
    </ListPageShell>
  );
};
