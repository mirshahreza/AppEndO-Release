import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, SlidersHorizontal } from 'lucide-react';
import {
  AppButton,
  AppGridRowActions,
  AppTableGrid,
  CreateEditModalShell,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  QueryErrorPanel,
  RetentionControlDialog,
  ToolbarFilterSelect,
  ToolbarActionGroupWithRefresh,
  ListPageToolbarFrame,
  ListPageShell,
} from '../../../shared/ui';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { useListPageToolbarScroll } from '../../../shared/lib/useListPageToolbarScroll';
import { useCulture, useCultureT } from '../../../core/culture/CultureContext';
import { resolveCultureLabel } from '../../../core/culture/cultureShellKeys';
import { resolveInboxItemTitle } from '../../../shared/lib/shellInboxCultureLabels';
import { operationsKey } from '../../../core/culture/translations/cultureKeyHelpers';
import {
  formatMessagesLedgerChannel,
  formatMessagesLedgerStatus,
  messagesLedgerChannelOptions,
  messagesLedgerStatusOptions,
} from '../lib/messagesLedgerCulture';
import type { AppTableGridColumnDef } from '../../../shared/lib/appTableGridQuery';
import { gridActionsColumnWidth } from '../../../shared/lib/gridRowActions';
import { cn } from '../../../lib/utils';
import { userMessageDispatchesApi, type UserMessageDispatchItem } from '../api/userMessageDispatchesApi';

const statusBadgeClass: Record<string, string> = {
  sent: 'bg-emerald-50 text-emerald-700',
  digest_pending: 'bg-sky-50 text-sky-700',
  failed: 'bg-rose-50 text-rose-700',
  fallback_in_app: 'bg-amber-50 text-amber-800',
};

const formatWhen = (iso: string, locale?: string): string => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString(locale || undefined);
};

const StatusBadge: React.FC<{ status: string; label: string }> = ({ status, label }) => (
  <span
    className={cn(
      'inline-flex max-w-full truncate rounded-md px-1.5 py-0.5 text-[11px] font-medium',
      statusBadgeClass[status] ?? 'bg-slate-100 text-slate-700',
    )}
  >
    {label}
  </span>
);

export const MyMessagesWorkspace: React.FC = () => {
  const t = useCultureT();
  const { cultureId } = useCulture();
  const dateLocale = cultureId === 'iq' || cultureId === 'ir' ? 'ar-IQ' : undefined;
  const controlLabel = t(operationsKey('recordEvents.control'));
  const channelFilterOptions = messagesLedgerChannelOptions(t);
  const statusFilterOptions = messagesLedgerStatusOptions(t);
  const emptyMessage = resolveCultureLabel(
    t,
    'shell.inbox.messagesLedger.empty',
    'No outbound messages match these filters. Notifications you receive in the bell also appear here after dispatch.',
  );
  const viewDetailsLabel = resolveCultureLabel(t, 'shell.inbox.messagesLedger.viewDetails', 'View details');
  const { listToolbarCollapsed, handleGridScroll } = useListPageToolbarScroll();
  const [channel, setChannel] = useState('');
  const [deliveryStatus, setDeliveryStatus] = useState('');
  const [items, setItems] = useState<UserMessageDispatchItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [selected, setSelected] = useState<UserMessageDispatchItem | null>(null);
  const [showControlDialog, setShowControlDialog] = useState(false);

  const load = useCallback(async (retry = false) => {
    if (retry) {
      setIsRetrying(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(null);
    try {
      const result = await userMessageDispatchesApi.list({
        channel: channel || undefined,
        deliveryStatus: deliveryStatus || undefined,
        take: 50,
      });
      setItems(result.items);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : resolveCultureLabel(t, 'shell.inbox.messagesLedger.loadFailed', 'Failed to load messages.'));
    } finally {
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [channel, deliveryStatus, t]);

  useEffect(() => {
    void load();
  }, [load]);

  const openDetail = useCallback((row: UserMessageDispatchItem) => {
    setSelected(row);
  }, []);

  const columns = useMemo((): AppTableGridColumnDef<UserMessageDispatchItem>[] => [
    {
      id: 'createdAt',
      label: resolveCultureLabel(t, 'shell.inbox.messagesLedger.column.when', 'When'),
      width: 168,
      card: { role: 'meta' },
      renderCell: (row) => (
        <span className="font-mono text-[11px] text-slate-500 whitespace-nowrap">
          {formatWhen(row.createdAt, dateLocale)}
        </span>
      ),
      getSortValue: (row) => row.createdAt,
      sort: { mode: 'client' },
      filter: false,
    },
    {
      id: 'channel',
      label: resolveCultureLabel(t, 'shell.inbox.messagesLedger.column.channel', 'Channel'),
      width: 96,
      card: { role: 'meta' },
      renderCell: (row) => formatMessagesLedgerChannel(t, row.channel),
      getSortValue: (row) => row.channel,
      sort: { mode: 'client' },
      filter: false,
    },
    {
      id: 'deliveryStatus',
      label: resolveCultureLabel(t, 'shell.inbox.messagesLedger.column.status', 'Status'),
      width: 132,
      card: { role: 'subtitle' },
      renderCell: (row) => (
        <StatusBadge
          status={row.deliveryStatus}
          label={formatMessagesLedgerStatus(t, row.deliveryStatus)}
        />
      ),
      getSortValue: (row) => row.deliveryStatus,
      sort: { mode: 'client' },
      filter: false,
    },
    {
      id: 'eventType',
      label: resolveCultureLabel(t, 'shell.inbox.messagesLedger.column.type', 'Type'),
      width: 140,
      card: { role: 'field', label: resolveCultureLabel(t, 'shell.inbox.messagesLedger.column.type', 'Type') },
      renderCell: (row) => (
        <span className="text-xs text-slate-600">{row.eventType}</span>
      ),
      getSortValue: (row) => row.eventType,
      sort: { mode: 'client' },
      filter: false,
    },
    {
      id: 'title',
      label: resolveCultureLabel(t, 'shell.inbox.messagesLedger.column.title', 'Title'),
      width: 240,
      card: { role: 'title' },
      renderCell: (row) => (
        <span className="font-medium text-slate-800">{resolveInboxItemTitle(t, row.title)}</span>
      ),
      getSortValue: (row) => resolveInboxItemTitle(t, row.title),
      sort: { mode: 'client' },
      filter: false,
    },
    {
      id: 'actions',
      label: '',
      layout: { hideable: false, resizable: false },
      headerClassName: 'text-start',
      cellClassName: 'text-start',
      width: gridActionsColumnWidth(1),
      card: { role: 'actions' },
      renderCell: (row) => (
        <AppGridRowActions
          actions={[
            {
              id: 'view',
              label: viewDetailsLabel,
              icon: <Eye className="h-3.5 w-3.5" />,
              intent: 'view',
              onClick: () => openDetail(row),
            },
          ]}
          align="start"
        />
      ),
      sort: false,
      filter: false,
    },
  ], [openDetail, t, dateLocale, viewDetailsLabel]);

  const isError = loadError !== null;

  return (
    <ListPageShell onGridScroll={handleGridScroll}>
      <ListPageToolbarFrame>

        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          <ToolbarFilterSelect
            value={channel}
            options={channelFilterOptions}
            onChange={setChannel}
            ariaLabel={resolveCultureLabel(t, 'shell.inbox.messagesLedger.filter.channelAria', 'Channel')}
            allLabel={resolveCultureLabel(t, 'shell.inbox.messagesLedger.channel.all', 'All channels')}
            className="min-w-[160px] max-w-[200px]"
          />
          <ToolbarFilterSelect
            value={deliveryStatus}
            options={statusFilterOptions}
            onChange={setDeliveryStatus}
            ariaLabel={resolveCultureLabel(t, 'shell.inbox.messagesLedger.filter.statusAria', 'Delivery status')}
            allLabel={resolveCultureLabel(t, 'shell.inbox.messagesLedger.status.all', 'All statuses')}
            className="min-w-[168px] max-w-[220px]"
          />
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <ToolbarActionGroupWithRefresh
            onRefresh={() => void load(true)}
            isRefreshing={isLoading || isRetrying}
            actions={[
              {
                id: 'message-retention',
                label: controlLabel,
                icon: <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />,
                intent: 'utility',
                onClick: () => setShowControlDialog(true),
              },
            ]}
          />
        </div>
      </ListPageToolbarFrame>
      <div className="flex min-h-0 w-full flex-1 flex-col">
        <AppTableGrid
          presentation="auto"
          size="sm"
          chrome="hero"
          tableClassName="text-slate-700"
          theadClassName="text-xs font-bold text-slate-500 uppercase tracking-wider"
          columns={columns}
          rows={items}
          getRowKey={(row) => row.id}
          onScroll={handleGridScroll}
          compact={{ tablet: { cardsPerRow: 2 } }}
          onRowClick={openDetail}
          isLoading={isLoading}
          loadingMessage={resolveCultureLabel(t, 'shell.inbox.messagesLedger.loading', 'Loading your messages…')}
          errorContent={
            isError && loadError ? (
              <QueryErrorPanel
                message={resolveCultureLabel(t, 'shell.inbox.messagesLedger.loadFailed', 'Could not load messages')}
                detail={loadError}
                onRetry={() => void load(true)}
                isRetrying={isRetrying}
                className="h-32"
              />
            ) : undefined
          }
          isEmpty={!isLoading && !isError && items.length === 0}
          emptyMessage={emptyMessage}
          emptyContent={(
            <div className="flex h-32 flex-col items-center justify-center gap-1 px-4 text-center text-sm text-slate-500">
              <p>{emptyMessage}</p>
            </div>
          )}
          getCardRowActions={(row: UserMessageDispatchItem) => [
            {
              id: 'view',
              label: viewDetailsLabel,
              icon: <Eye className="h-3.5 w-3.5" aria-hidden="true" />,
              intent: 'view',
              cardLabeled: true,
              onClick: () => openDetail(row),
            },
          ]}
        />
      </div>
      {selected ? (
        <CreateEditModalShell
          onClose={() => setSelected(null)}
          title={resolveInboxItemTitle(t, selected.title)}
          size="lg"
        >
          <div className="space-y-3 text-sm text-slate-700">
            <p>
              <span className="font-medium text-slate-900">Channel:</span>{' '}
              {formatMessagesLedgerChannel(t, selected.channel)}
            </p>
            <p>
              <span className="font-medium text-slate-900">Status:</span>{' '}
              <StatusBadge
                status={selected.deliveryStatus}
                label={formatMessagesLedgerStatus(t, selected.deliveryStatus)}
              />
            </p>
            <p>
              <span className="font-medium text-slate-900">Type:</span>{' '}
              {selected.eventType}
            </p>
            <p>
              <span className="font-medium text-slate-900">When:</span>{' '}
              {formatWhen(selected.createdAt, dateLocale)}
            </p>
            {selected.deliveredAt ? (
              <p>
                <span className="font-medium text-slate-900">Delivered:</span>{' '}
                {formatWhen(selected.deliveredAt, dateLocale)}
              </p>
            ) : null}
            {selected.errorSummary ? (
              <p className="text-rose-700">
                <span className="font-medium">Error:</span> {selected.errorSummary}
              </p>
            ) : null}
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Summary</p>
              <div className="whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-xs text-slate-700">
                {selected.bodySummary || 'No body text was recorded for this dispatch.'}
              </div>
            </div>
            {selected.href ? (
              <AppButton
                size="sm"
                intent="secondary"
                onClick={() => {
                  const href = selected.href!;
                  window.location.assign(href.startsWith('/') ? href : `/${href}`);
                }}
              >
                Open link
              </AppButton>
            ) : null}
          </div>
        </CreateEditModalShell>
      ) : null}
      <RetentionControlDialog
        open={showControlDialog}
        onClose={() => setShowControlDialog(false)}
        scope="recordEvents"
        onCleared={() => {
          setSelected(null);
          void load(true);
        }}
      />
    </ListPageShell>
  );
};
