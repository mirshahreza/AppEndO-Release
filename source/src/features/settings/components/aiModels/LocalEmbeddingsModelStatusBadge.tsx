import React from 'react';
import { AlertCircle, Check, Download, Loader2 } from 'lucide-react';
import { useOptionalCulture } from '../../../../core/culture/CultureContext';
import { CULTURE_ACTION_FALLBACK_LABELS } from '../../../../core/culture/cultureShellKeys';
import { useLocalEmbeddingsModelStatusQuery, formatLocalEmbeddingsModelStatusError } from '../../../../shared/api/queries/localEmbeddingsModel';
import type { LocalEmbeddingsModelState } from '../../../../shared/api/contracts/ai/localEmbeddingsModel';
import { cn } from '../../../../lib/utils';
import { AI_MODELS_STATUS_BADGE_CLASS } from './constants';

const STATE_TONE_CLASS: Record<LocalEmbeddingsModelState, string> = {
  ready: 'border-emerald-200 text-emerald-700',
  downloading: 'border-sky-200 text-sky-700',
  missing: 'border-slate-200 text-slate-600',
  error: 'border-rose-200 text-rose-700',
};

const STATE_ICON: Record<LocalEmbeddingsModelState, React.ReactNode> = {
  ready: <Check className="h-2.5 w-2.5 shrink-0" aria-hidden />,
  downloading: <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" aria-hidden />,
  missing: <Download className="h-2.5 w-2.5 shrink-0" aria-hidden />,
  error: <AlertCircle className="h-2.5 w-2.5 shrink-0" aria-hidden />,
};

const labelKeyForState = (state: LocalEmbeddingsModelState) => {
  switch (state) {
    case 'ready':
      return 'settings.ai.localEmbeddings.ready';
    case 'downloading':
      return 'settings.ai.localEmbeddings.downloading';
    case 'error':
      return 'settings.ai.localEmbeddings.error';
    default:
      return 'settings.ai.localEmbeddings.missing';
  }
};

export const LocalEmbeddingsModelStatusBadge: React.FC = () => {
  const culture = useOptionalCulture();
  const statusQuery = useLocalEmbeddingsModelStatusQuery();
  const label = (key: string) => (
    culture?.ready ? culture.t(key) : CULTURE_ACTION_FALLBACK_LABELS[key] ?? key
  );

  if (statusQuery.isLoading) {
    return (
      <span
        className={cn(AI_MODELS_STATUS_BADGE_CLASS, 'border-slate-200 text-slate-500')}
        title={label('settings.ai.localEmbeddings.loading')}
      >
        <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin" aria-hidden />
        {label('settings.ai.localEmbeddings.loading')}
      </span>
    );
  }

  if (statusQuery.isError || !statusQuery.data) {
    const errorDetail = statusQuery.error
      ? formatLocalEmbeddingsModelStatusError(statusQuery.error)
      : label('settings.ai.localEmbeddings.statusUnavailable');
    return (
      <span
        className={cn(AI_MODELS_STATUS_BADGE_CLASS, STATE_TONE_CLASS.error)}
        title={errorDetail}
      >
        {STATE_ICON.error}
        {label('settings.ai.localEmbeddings.statusUnavailable')}
      </span>
    );
  }

  const { state, progressPercent, error } = statusQuery.data;
  const baseLabel = label(labelKeyForState(state));
  const detail = state === 'downloading' && progressPercent !== null
    ? `${baseLabel} (${progressPercent}%)`
    : baseLabel;
  const title = error?.trim() ? `${detail} — ${error}` : detail;

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
