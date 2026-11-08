import React from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Circle,
  Loader2,
  XCircle,
} from 'lucide-react';
import { cn } from '../../../lib/utils';
import { CreateEditModalShell } from '../../../shared/ui';
import type { SyncModelsModel } from '../hooks/useSyncModels';
import type { SyncModelItem, SyncModelItemStatus } from '../types/syncModels';

type SyncModelsDialogProps = {
  syncModels: SyncModelsModel;
  dataSourceName: string | null;
};

const STATUS_CARD_CLASS: Record<SyncModelItemStatus, string> = {
  done: 'border-emerald-200 bg-emerald-50/40',
  running: 'border-indigo-200 bg-indigo-50/50',
  stale: 'border-amber-200 bg-amber-50/50',
  error: 'border-rose-200 bg-rose-50/50',
  pending: 'border-slate-200 bg-white',
};

export const SyncModelsDialog: React.FC<SyncModelsDialogProps> = ({
  syncModels,
  dataSourceName,
}) => {
  const {
    state,
    completedCount,
    progressPercent,
    totalCount,
    successCount,
    staleCount,
    errorCount,
    createdCount,
    refreshedCount,
  } = syncModels;

  if (!state.open) {
    return null;
  }

  const canDismiss = state.finished && !state.isRunning;
  const currentItem = state.items.find((item) => item.status === 'running');

  return (
    <CreateEditModalShell
      size="maximized"
      title="Sync models"
      subtitle={dataSourceName ? `Connection: ${dataSourceName}` : undefined}
      showCloseButton={canDismiss}
      closeOnEscape={canDismiss}
      onClose={canDismiss ? syncModels.closeSyncModels : () => undefined}
      onBackdropClick={canDismiss ? syncModels.closeSyncModels : () => undefined}
      shellClassName="flex min-h-0 flex-col overflow-hidden"
      bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden !min-h-0"
    >
      <div className="flex min-h-0 flex-1 flex-col gap-4">
        <div className="shrink-0 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>
              {state.isRunning
                ? `Syncing ${completedCount + 1} of ${totalCount}…`
                : `Completed ${completedCount} of ${totalCount}`}
            </span>
            <span className="font-medium text-slate-700">{progressPercent}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-300',
                state.finished && errorCount > 0 ? 'bg-amber-500' : 'bg-indigo-500',
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {currentItem ? (
          <div className="shrink-0 rounded-lg border border-indigo-100 bg-indigo-50/70 px-3 py-2 text-xs text-indigo-700">
            <span className="font-medium">
              {currentItem.action === 'create' ? 'Now creating:' : 'Now refreshing:'}
            </span>
            {' '}
            {currentItem.objectName}
            <span className="text-indigo-400"> · </span>
            {currentItem.objectType}
          </div>
        ) : null}

        {state.finished ? (
          <div className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <span className="font-medium text-slate-700">Summary:</span>
            {' '}
            {createdCount} created
            {' · '}
            {refreshedCount} refreshed
            {successCount > 0 || staleCount > 0 || errorCount > 0
              ? ` · ${successCount} ok`
              : ''}
            {staleCount > 0 ? ` · ${staleCount} still out of sync` : ''}
            {errorCount > 0 ? ` · ${errorCount} failed` : ''}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto">
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {state.items.map((item) => (
              <li key={item.key}>
                <SyncModelItemCard item={item} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </CreateEditModalShell>
  );
};

const resolveCardStatusLabel = (item: SyncModelItem): string => {
  if (item.status === 'pending') {
    return 'pending';
  }
  if (item.status === 'running') {
    return item.action === 'create' ? 'creating' : 'refreshing';
  }
  if (item.status === 'error') {
    return item.message ?? 'failed';
  }
  if (item.status === 'stale') {
    return 'refreshed';
  }
  return item.action === 'create' ? 'created' : 'refreshed';
};

const SyncModelItemCard: React.FC<{ item: SyncModelItem }> = ({ item }) => {
  const statusLabel = resolveCardStatusLabel(item);

  return (
    <div
      className={cn(
        'flex h-full flex-col gap-1 rounded-lg border px-3 py-2.5 text-xs',
        STATUS_CARD_CLASS[item.status],
      )}
    >
      <div className="flex items-start gap-2">
        <StepStatusIcon status={item.status} />
        <p
          className={cn(
            'min-w-0 flex-1 truncate font-medium leading-snug',
            item.status === 'done' && 'text-slate-800',
            item.status === 'running' && 'text-indigo-800',
            item.status === 'stale' && 'text-amber-800',
            item.status === 'error' && 'text-rose-800',
            item.status === 'pending' && 'text-slate-400',
          )}
          title={item.objectName}
        >
          {item.objectName}
        </p>
      </div>
      <p
        className={cn(
          'ps-6 text-[11px] leading-snug',
          item.status === 'error' ? 'text-rose-600' : 'text-slate-500',
          item.status === 'pending' && 'text-slate-400',
          item.status === 'running' && 'text-indigo-600',
        )}
        title={statusLabel}
      >
        {statusLabel}
      </p>
    </div>
  );
};

const StepStatusIcon: React.FC<{ status: SyncModelItemStatus }> = ({ status }) => {
  if (status === 'done') {
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" aria-hidden />;
  }
  if (status === 'stale') {
    return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />;
  }
  if (status === 'running') {
    return <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-indigo-500" aria-hidden />;
  }
  if (status === 'error') {
    return <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" aria-hidden />;
  }
  return <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-300" aria-hidden />;
};
