import React, { useEffect, useMemo, useRef, useState } from 'react';
import { HelpCircle, Sparkles } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import type { DataSourceRecord } from '../../../shared/api/contracts/data-sources/types';
import {
  AppButton,
  CreateEditModalShell,
  FormField,
  UiSelect,
  showAppFeedbackToast,
} from '../../../shared/ui';
import { useAiSettingsQuery, useAvailableAiModelsQuery } from '../../../shared/api/queries/aiModels';
import { isAiGloballyEnabled } from '../../../shared/lib/aiAccess';
import { isAiModelChatCapable } from '../../../shared/api/contracts/ai/constants';
import {
  dbEnrichmentQueryKeys,
  formatDbEnrichmentError,
  useDbEnrichmentRunsQuery,
  useTriggerDbEnrichmentMutation,
} from '../../../shared/api/queries/dbEnrichment';
import { useDataSourceEnrichmentStats } from '../hooks/useDataSourceEnrichmentStats';

const LARGE_SCHEMA_TABLE_WARNING_THRESHOLD = 50;

type DataEnrichmentModalProps = {
  dataSource: DataSourceRecord | null;
  onClose: () => void;
  onOpenQuestions: () => void;
};

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const formatLogTime = (iso: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const DataEnrichmentModal: React.FC<DataEnrichmentModalProps> = ({
  dataSource,
  onClose,
  onOpenQuestions,
}) => {
  const dataSourceId = dataSource?.id ?? '';
  const open = Boolean(dataSource);
  const queryClient = useQueryClient();
  const logEndRef = useRef<HTMLDivElement>(null);
  const [sessionActive, setSessionActive] = useState(false);
  const [awaitingNewRun, setAwaitingNewRun] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('');

  const aiSettingsQuery = useAiSettingsQuery({ enabled: open });
  const modelsQuery = useAvailableAiModelsQuery(open);
  const chatModels = useMemo(
    () => (modelsQuery.data?.models ?? []).filter((model) => isAiModelChatCapable(model)),
    [modelsQuery.data?.models],
  );
  const aiEnabled = isAiGloballyEnabled(aiSettingsQuery.data?.enabled);
  const hasChatModel = chatModels.length > 0;
  const canEnrich = aiEnabled && hasChatModel;

  const runsQuery = useDbEnrichmentRunsQuery(dataSourceId, {
    enabled: open,
    refetchInterval: (query) => {
      const latest = query.state.data?.[0];
      return latest && (latest.status === 'pending' || latest.status === 'running') ? 1000 : false;
    },
  });
  const latestRun = runsQuery.data?.[0];
  const isRunActive = latestRun?.status === 'pending' || latestRun?.status === 'running';
  const stats = useDataSourceEnrichmentStats(dataSourceId, { enabled: open });
  const triggerMutation = useTriggerDbEnrichmentMutation();
  const tablesTotal = stats.tablesTotal;
  const hasStats = stats.isReady && (
    stats.tablesEnriched > 0
    || stats.openQuestionCount > 0
    || stats.overallConfidence !== null
    || Boolean(stats.enrichedAt)
  );
  const showLargeSchemaWarning = tablesTotal > LARGE_SCHEMA_TABLE_WARNING_THRESHOLD;
  const progressLog = awaitingNewRun ? [] : (latestRun?.progressLog ?? []);
  const runFinished = latestRun?.status === 'completed' || latestRun?.status === 'failed';
  const showQuestionsButton = sessionActive && !isRunActive && runFinished;

  useEffect(() => {
    setSessionActive(false);
    setAwaitingNewRun(false);
    setSelectedModelId('');
  }, [dataSourceId]);

  useEffect(() => {
    if (!open || selectedModelId || chatModels.length === 0) {
      return;
    }
    const preferred = modelsQuery.data?.defaultModelId;
    const next = (preferred && chatModels.some((model) => model.id === preferred)
      ? preferred
      : chatModels.find((model) => model.isDefault)?.id)
      ?? chatModels[0].id;
    setSelectedModelId(next);
  }, [chatModels, modelsQuery.data?.defaultModelId, open, selectedModelId]);

  useEffect(() => {
    if (isRunActive) {
      setSessionActive(true);
      setAwaitingNewRun(false);
    }
  }, [isRunActive]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ block: 'end' });
  }, [progressLog.length]);

  useEffect(() => {
    if (!dataSourceId) {
      return;
    }
    if (latestRun?.status !== 'completed' && latestRun?.status !== 'failed') {
      return;
    }
    void queryClient.invalidateQueries({ queryKey: dbEnrichmentQueryKeys.metrics(dataSourceId) });
    void queryClient.invalidateQueries({ queryKey: [...dbEnrichmentQueryKeys.all, 'questions', dataSourceId] });
  }, [dataSourceId, latestRun?.status, queryClient]);

  if (!open || !dataSource) {
    return null;
  }

  const handleRun = () => {
    setSessionActive(true);
    setAwaitingNewRun(true);
    triggerMutation.mutate({
      dataSourceId,
      scope: 'FULL',
      modelId: selectedModelId || undefined,
    }, {
      onError: (error) => {
        setSessionActive(false);
        setAwaitingNewRun(false);
        showAppFeedbackToast(formatDbEnrichmentError(error), { type: 'error' });
      },
    });
  };

  return (
    <CreateEditModalShell
      size="maximized"
      title={(
        <span className="truncate">{`Enrich "${dataSource.name}"`}</span>
      )}
      ariaLabel={`Enrich ${dataSource.name}`}
      gradient={false}
      onClose={onClose}
      onBackdropClick={onClose}
      bodyOuterClassName="flex min-h-0 flex-1 flex-col"
      bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      metaBandClassName="py-2.5"
      metaBand={(
        <div className="grid w-full min-w-0 flex-1 grid-cols-3 gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">Coverage</p>
            <p className="truncate text-sm font-semibold text-slate-800">
              {hasStats && stats.tablesTotal > 0 ? formatPercent(stats.coverage) : '—'}
            </p>
            <p className="truncate text-[10px] text-slate-500">
              {hasStats ? `${stats.tablesEnriched} / ${stats.tablesTotal} tables` : ''}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Confidence</p>
            <p className="truncate text-sm font-semibold text-slate-800">
              {stats.overallConfidence !== null ? formatPercent(stats.overallConfidence) : '—'}
            </p>
            <p className="truncate text-[10px] text-slate-500">
              {stats.humanShare > 0 ? `${formatPercent(stats.humanShare)} human-verified` : ''}
            </p>
          </div>
          <button
            type="button"
            className="min-w-0 rounded-sm text-start hover:bg-amber-50/60"
            onClick={onOpenQuestions}
            aria-label="Open questions"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Open questions</p>
            <p className="truncate text-sm font-semibold text-slate-800">
              {stats.isReady ? stats.openQuestionCount : '—'}
            </p>
            <p className="truncate text-[10px] text-slate-500">
              {hasStats
                ? `${stats.columnsResolved} resolved, ${stats.columnsAmbiguous} ambiguous`
                : ''}
            </p>
          </button>
        </div>
      )}
    >
      {sessionActive ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3">
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 font-mono text-[11px] leading-relaxed text-slate-700">
            {progressLog.length === 0 ? (
              <p className="text-slate-400">Starting enrichment…</p>
            ) : (
              progressLog.map((entry, index) => (
                <div key={`${entry.at}-${index}`} className="flex gap-2 py-0.5">
                  <span className="shrink-0 text-slate-400">{formatLogTime(entry.at)}</span>
                  <span>{entry.message}</span>
                </div>
              ))
            )}
            {isRunActive ? (
              <p className="mt-1 animate-pulse text-violet-600">Working…</p>
            ) : null}
            {latestRun?.status === 'failed' && latestRun.errorMessage ? (
              <p className="mt-1 text-rose-600">{latestRun.errorMessage}</p>
            ) : null}
            <div ref={logEndRef} />
          </div>
          {showQuestionsButton ? (
            <div className="flex shrink-0 justify-start">
              <AppButton
                intent="warning"
                size="sm"
                onClick={onOpenQuestions}
              >
                <HelpCircle className="h-3.5 w-3.5" />
                Open questions
              </AppButton>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 text-center">
          <p className="max-w-xl text-xs text-slate-500">
            Builds a persistent knowledge base for this database — table purposes, column meanings, and
            value glossaries — so the SQL Console AI assistant can answer questions faster and more accurately.
          </p>
          {!aiEnabled ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
              AI is disabled in platform settings. Enable it before running the DB Enricher.
            </p>
          ) : !hasChatModel ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
              No chat-capable AI model is configured. Configure one in AI settings before running the DB Enricher.
            </p>
          ) : null}
          {showLargeSchemaWarning ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              This database has {tablesTotal} tables/views — a full run means roughly that many sequential AI
              calls and can take a while.
            </p>
          ) : null}
          {canEnrich ? (
            <FormField
              label="Model"
              className="w-full max-w-sm text-start"
              hint="Chat model used for this enrichment run."
              reserveHintSlot={false}
            >
              <UiSelect
                size="sm"
                value={selectedModelId}
                onChange={(event) => setSelectedModelId(event.target.value)}
                isDisabled={modelsQuery.isLoading || chatModels.length === 0 || triggerMutation.isPending}
                ariaLabel="Enrichment model"
              >
                {chatModels.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.name}
                  </option>
                ))}
              </UiSelect>
            </FormField>
          ) : null}
          <AppButton
            intent="primary"
            size="sm"
            disabled={!canEnrich || triggerMutation.isPending || !selectedModelId}
            onClick={handleRun}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Start Enrichment
          </AppButton>
        </div>
      )}
    </CreateEditModalShell>
  );
};
