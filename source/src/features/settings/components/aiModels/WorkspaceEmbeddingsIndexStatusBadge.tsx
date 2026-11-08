import React from 'react';
import { AlertCircle, Check, Database, Loader2, PauseCircle } from 'lucide-react';
import { useOptionalCulture } from '../../../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../../../core/culture/cultureShellKeys';
import {
  formatWorkspaceEmbeddingsIndexStatusError,
  useWorkspaceEmbeddingsIndexStatusQuery,
} from '../../../../shared/api/queries/workspaceEmbeddingsIndex';
import type { WorkspaceEmbeddingsIndexState } from '../../../../shared/api/contracts/ai/workspaceEmbeddingsIndexStatus';
import { cn } from '../../../../lib/utils';
import { AI_MODELS_STATUS_BADGE_CLASS } from './constants';

const STATE_TONE_CLASS: Record<WorkspaceEmbeddingsIndexState, string> = {
  ready: 'border-emerald-200 text-emerald-700',
  indexing: 'border-sky-200 text-sky-700',
  pending: 'border-amber-200 text-amber-700',
  empty: 'border-slate-200 text-slate-600',
  unavailable: 'border-slate-200 text-slate-500',
  error: 'border-rose-200 text-rose-700',
};

const STATE_ICON: Record<WorkspaceEmbeddingsIndexState, React.ReactNode> = {
  ready: <Check className="h-2.5 w-2.5 shrink-0" aria-hidden />,
  indexing: <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" aria-hidden />,
  pending: <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" aria-hidden />,
  empty: <Database className="h-2.5 w-2.5 shrink-0" aria-hidden />,
  unavailable: <PauseCircle className="h-2.5 w-2.5 shrink-0" aria-hidden />,
  error: <AlertCircle className="h-2.5 w-2.5 shrink-0" aria-hidden />,
};

const labelKeyForState = (state: WorkspaceEmbeddingsIndexState) => {
  switch (state) {
    case 'ready':
      return 'settings.ai.workspaceIndex.ready';
    case 'indexing':
      return 'settings.ai.workspaceIndex.indexing';
    case 'pending':
      return 'settings.ai.workspaceIndex.pending';
    case 'empty':
      return 'settings.ai.workspaceIndex.empty';
    case 'error':
      return 'settings.ai.workspaceIndex.error';
    default:
      return 'settings.ai.workspaceIndex.unavailable';
  }
};

export const WorkspaceEmbeddingsIndexStatusBadge: React.FC = () => {
  const culture = useOptionalCulture();
  const statusQuery = useWorkspaceEmbeddingsIndexStatusQuery();
  const label = (key: string) => (
    culture?.ready ? culture.t(key) : CULTURE_ACTION_FALLBACK_LABELS[key] ?? key
  );

  if (statusQuery.isLoading) {
    return (
      <span
        className={cn(AI_MODELS_STATUS_BADGE_CLASS, 'border-slate-200 text-slate-500')}
        title={label('settings.ai.workspaceIndex.loading')}
      >
        <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" aria-hidden />
        {label('settings.ai.workspaceIndex.loading')}
      </span>
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    const errorDetail = statusQuery.error
      ? formatWorkspaceEmbeddingsIndexStatusError(statusQuery.error)
      : label('settings.ai.workspaceIndex.statusUnavailable');
    return (
      <span
        className={cn(AI_MODELS_STATUS_BADGE_CLASS, STATE_TONE_CLASS.error)}
        title={errorDetail}
      >
        {STATE_ICON.error}
        {label('settings.ai.workspaceIndex.statusUnavailable')}
      </span>
    );
  }

  const { state, progressPercent, indexedChunks, totalChunks, error } = statusQuery.data;
  const baseLabel = label(labelKeyForState(state));
  const showProgress = (state === 'indexing' || state === 'pending') && progressPercent !== null;
  const detail = showProgress
    ? `${baseLabel} (${progressPercent}%)`
    : baseLabel;
  const chunkDetail = totalChunks > 0 ? `${indexedChunks}/${totalChunks} chunks` : undefined;
  const titleParts = [detail, chunkDetail, error?.trim()].filter(Boolean);
  const title = titleParts.join(' — ');

  return (
    <span
      className={cn(AI_MODELS_STATUS_BADGE_CLASS, STATE_TONE_CLASS[state])}
      title={title}
      aria-label={title}
    >
      {STATE_ICON[state]}
      {detail}
    </span>
  );
};
