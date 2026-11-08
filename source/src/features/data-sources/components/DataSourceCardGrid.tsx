import React, { useState } from 'react';
import { BookOpen, Pencil, Sparkles, Trash2, Wifi } from 'lucide-react';
import type { DataSourceRecord, DataSourceStatus } from '../../../shared/api/contracts/data-sources/types';
import {
  AppButton,
  DevelopmentCatalogCard,
  DevelopmentCatalogCardGrid,
  QueryErrorPanel,
} from '../../../shared/ui';
import { ActionTooltip } from '../../../shared/ui/ActionTooltip';
import { FLOATING_ACTION_SEPARATOR_CLASS } from '../../../shared/ui/surfaceClasses';
import { useDataSourceEnrichmentStats } from '../hooks/useDataSourceEnrichmentStats';
import { ACTION_BUTTON_BASE_CLASS } from '../constants';
import {
  formatCardDateTime,
  formatDataSourceActorLabel,
  formatEnrichedAtDate,
  getConnectionLabel,
  stopButtonEvent,
} from '../utils';
import { DATA_SOURCE_CARD_BADGE_BASE_CLASS } from './ConnectivityStatusBadge';
import { DataSourceConfidenceGuideModal } from './DataSourceConfidenceGuideModal';
import { DataSourceTypeIcon } from './DataSourceTypeIcon';

/** Equal py so label sits between the two hairlines — do not reuse card-actions `pt-2` (no pb). */
const CARD_FOOTER_BAND_CLASS =
  'flex min-h-11 items-center border-t border-slate-100 px-0 py-2.5 text-base leading-5 text-slate-600';

const DataSourceEnrichmentFooters: React.FC<{
  item: DataSourceRecord;
  questionsHref: string;
  onOpenQuestions: (item: DataSourceRecord) => void;
  onOpenConfidence: (item: DataSourceRecord) => void;
}> = ({ item, questionsHref, onOpenQuestions, onOpenConfidence }) => {
  const stats = useDataSourceEnrichmentStats(item.id);
  const enrichedAtLabel = formatEnrichedAtDate(stats.enrichedAt);
  const confidenceLabel = stats.overallConfidence !== null
    ? `${Math.round(stats.overallConfidence * 100)}% conf.`
    : '— conf.';
  return (
    <>
      <div className={CARD_FOOTER_BAND_CLASS} title={stats.enrichedAt ?? undefined}>
        <span className="min-w-0 truncate font-semibold">
          {`Enriched at : ${enrichedAtLabel || '—'}`}
        </span>
      </div>
      <div className={`${CARD_FOOTER_BAND_CLASS} justify-between gap-1.5 font-medium`}>
        <ActionTooltip content={`${stats.tablesEnriched} / ${stats.tablesTotal} tables enriched`}>
          <span className="inline-flex min-w-0 items-center gap-1 truncate">
            <Sparkles className="h-4 w-4 shrink-0 text-violet-500" aria-hidden="true" />
            {stats.tablesTotal > 0 ? `${Math.round(stats.coverage * 100)}%` : '—'}
          </span>
        </ActionTooltip>
        <ActionTooltip content="How to raise knowledge confidence">
          <button
            type="button"
            onClick={(event) => {
              stopButtonEvent(event);
              onOpenConfidence(item);
            }}
            className="min-w-0 truncate font-semibold text-emerald-700 hover:text-emerald-800 hover:underline"
            aria-label="How to raise confidence"
          >
            {confidenceLabel}
          </button>
        </ActionTooltip>
        {stats.openQuestionCount > 0 ? (
          <ActionTooltip content="Open questions awaiting your input">
            <a
              href={questionsHref}
              onClick={(event) => {
                event.stopPropagation();
                if (
                  event.defaultPrevented
                  || event.metaKey
                  || event.ctrlKey
                  || event.shiftKey
                  || event.altKey
                  || event.button !== 0
                ) {
                  return;
                }
                event.preventDefault();
                onOpenQuestions(item);
              }}
              className="min-w-0 truncate font-semibold text-amber-600 hover:text-amber-800 hover:underline"
              aria-label={`Open ${stats.openQuestionCount} questions`}
            >
              {stats.openQuestionCount} open Q
            </a>
          </ActionTooltip>
        ) : (
          <span className="min-w-0 truncate text-slate-400">0 open Q</span>
        )}
      </div>
    </>
  );
};

export type DataSourceCardGridProps = {
  isLoading: boolean;
  isError: boolean;
  error: string | null;
  onRetry?: () => void;
  isRetrying?: boolean;
  items: DataSourceRecord[];
  testingId: string | null;
  onTest: (id: string) => void;
  onEdit: (item: DataSourceRecord) => void;
  onDelete: (item: DataSourceRecord) => void;
  onEnrich: (item: DataSourceRecord) => void;
  onGenerateDocs: (item: DataSourceRecord) => void;
  resolveQuestionsHref: (item: DataSourceRecord) => string;
  onOpenQuestions: (item: DataSourceRecord) => void;
  onScroll?: React.UIEventHandler<HTMLDivElement>;
};

const getTestButtonClass = (status: DataSourceStatus) => (
  status === 'connected'
    ? 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50'
    : 'text-rose-600 hover:text-rose-700 hover:bg-rose-50'
);

export const DataSourceCardGrid: React.FC<DataSourceCardGridProps> = ({
  isLoading,
  isError,
  error,
  onRetry,
  isRetrying = false,
  items,
  testingId,
  onTest,
  onEdit,
  onDelete,
  onEnrich,
  onGenerateDocs,
  resolveQuestionsHref,
  onOpenQuestions,
  onScroll,
}) => {
  const [confidenceTarget, setConfidenceTarget] = useState<DataSourceRecord | null>(null);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center text-sm font-medium text-slate-400">
        Loading data sources…
      </div>
    );
  }

  if (isError && error) {
    return (
      <QueryErrorPanel
        message="Failed to load data sources."
        detail={error}
        onRetry={onRetry}
        isRetrying={isRetrying}
      />
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm font-medium text-slate-400">
        No data source found.
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-auto" onScroll={onScroll}>
      <DevelopmentCatalogCardGrid className="grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4">
        {items.map((item) => {
          const updatedAtLabel = formatCardDateTime(item.updated_at, '');
          const updatedByLabel = formatDataSourceActorLabel(item.updated_by, '');
          const updatedTitle = [item.updated_at, updatedByLabel].filter(Boolean).join(' · ');

          return (
          <DevelopmentCatalogCard
            key={item.id}
            isLoading={testingId === item.id}
            className="group relative !px-3 !py-2.5"
          >
            {item.isDefault ? (
              <div className="absolute end-3 top-3">
                <span className={`${DATA_SOURCE_CARD_BADGE_BASE_CLASS} bg-emerald-100 text-emerald-700`}>
                  Default
                </span>
              </div>
            ) : (
              <div className="absolute end-3 top-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                <ActionTooltip content="Delete">
                  <button
                    type="button"
                    onClick={(event) => {
                      stopButtonEvent(event);
                      onDelete(item);
                    }}
                    className={`${ACTION_BUTTON_BASE_CLASS} text-rose-600 hover:text-rose-700 hover:bg-rose-50`}
                    aria-label="Delete"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </ActionTooltip>
              </div>
            )}

            <div className="pe-6">
              <div className="flex items-start gap-2">
                <DataSourceTypeIcon type={item.type} className="mt-0.5 shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-slate-900" title={item.name}>
                    {item.name}
                  </h3>
                  <p
                    className="mt-0.5 truncate font-mono text-[11px] leading-snug text-slate-500"
                    title={getConnectionLabel(item)}
                  >
                    {getConnectionLabel(item)}
                  </p>
                </div>
              </div>

              <p className="mt-2 text-xs font-medium text-slate-600">{item.type}</p>

              <div className="mt-2 space-y-0.5 text-[10px] font-mono text-slate-400">
                <p title={`${item.created_at ?? ''} · ${formatDataSourceActorLabel(item.created_by)}`}>
                  <span className="font-semibold text-slate-500">Created</span>
                  {' '}
                  {formatCardDateTime(item.created_at)}
                  {' '}
                  <span className="text-slate-300" aria-hidden="true">·</span>
                  {' '}
                  <span className="font-medium text-slate-500">
                    {formatDataSourceActorLabel(item.created_by)}
                  </span>
                </p>
                <p title={updatedTitle || undefined}>
                  <span className="font-semibold text-slate-500">Updated</span>
                  {updatedAtLabel ? (
                    <>
                      {' '}
                      {updatedAtLabel}
                    </>
                  ) : null}
                  {updatedAtLabel && updatedByLabel ? (
                    <>
                      {' '}
                      <span className="text-slate-300" aria-hidden="true">·</span>
                      {' '}
                    </>
                  ) : null}
                  {updatedByLabel ? (
                    <span className="font-medium text-slate-500">
                      {updatedByLabel}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>

            <div className="mt-auto">
              <DataSourceEnrichmentFooters
                item={item}
                questionsHref={resolveQuestionsHref(item)}
                onOpenQuestions={onOpenQuestions}
                onOpenConfidence={setConfidenceTarget}
              />
              <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <AppButton
                  intent="secondary"
                  size="sm"
                  onClick={(event) => {
                    stopButtonEvent(event);
                    onEnrich(item);
                  }}
                  aria-label="Enrich with AI"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Enrich
                </AppButton>
                <ActionTooltip content="Generate Documentation">
                  <AppButton
                    intent="secondary"
                    size="sm"
                    onClick={(event) => {
                      stopButtonEvent(event);
                      onGenerateDocs(item);
                    }}
                    aria-label="Generate Documentation"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    Docs
                  </AppButton>
                </ActionTooltip>
              </div>
              <div className="flex shrink-0 items-center justify-end">
                <ActionTooltip content="Test">
                  <button
                    type="button"
                    onClick={(event) => {
                      stopButtonEvent(event);
                      onTest(item.id);
                    }}
                    disabled={testingId === item.id}
                    className={`${ACTION_BUTTON_BASE_CLASS} ${getTestButtonClass(item.status)}`}
                    aria-label="Test"
                  >
                    <Wifi className="h-3.5 w-3.5" />
                  </button>
                </ActionTooltip>
                <span className={FLOATING_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
                <ActionTooltip content="Edit">
                  <button
                    type="button"
                    onClick={(event) => {
                      stopButtonEvent(event);
                      onEdit(item);
                    }}
                    className={`${ACTION_BUTTON_BASE_CLASS} text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50`}
                    aria-label="Edit"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                </ActionTooltip>
              </div>
            </div>
            </div>
          </DevelopmentCatalogCard>
          );
        })}
      </DevelopmentCatalogCardGrid>
      <DataSourceConfidenceGuideModal
        dataSource={confidenceTarget}
        onClose={() => setConfidenceTarget(null)}
        onOpenQuestions={(item) => {
          setConfidenceTarget(null);
          onOpenQuestions(item);
        }}
      />
    </div>
  );
};
