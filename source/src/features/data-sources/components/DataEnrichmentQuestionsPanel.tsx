import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Ban, Check, Loader2, Sparkles, X } from 'lucide-react';
import type { DataSourceRecord } from '../../../shared/api/contracts/data-sources/types';
import type { DbEnrichmentQuestion } from '../../../shared/api/contracts/db-enrichment';
import { isAiModelChatCapable } from '../../../shared/api/contracts/ai/constants';
import { useAiSettingsQuery, useAvailableAiModelsQuery } from '../../../shared/api/queries/aiModels';
import { isAiGloballyEnabled } from '../../../shared/lib/aiAccess';
import {
  AppButton,
  AppTableGrid,
  ConfirmDialogShell,
  CreateEditModalShell,
  FormField,
  GridPagingFooter,
  PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS,
  PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS,
  PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS,
  QueryErrorPanel,
  TOOLBAR_FILTER_RADIO_ALL_VALUE,
  ToolbarFilterRadioGroup,
  ToolbarActionGroupWithRefresh,
  ToolbarSearchInput,
  UiSelect,
  UiTextarea,
  WorkspaceBackIcon,
  showAppFeedbackToast,
  ListPageToolbarFrame,
} from '../../../shared/ui';
import { APP_GRID_IDS } from '../../../shared/api/contracts/grids/gridIds';
import { APP_LIST_PREFERENCE_KEYS } from '../../../shared/lib/listPreferenceKeys';
import { useGridColumnLayout } from '../../../shared/lib/useGridColumnLayout';
import { useGridListPresentation } from '../../../shared/lib/useGridListPresentation';
import {
  usePersistedListFilters,
  usePersistedListPaging,
} from '../../../shared/lib/usePersistedListPreferences';
import { DEFAULT_GRID_PAGE_SIZE } from '../../../shared/lib/gridPagingConstants';
import {
  formatDbEnrichmentError,
  useAnswerDbEnrichmentQuestionMutation,
  useDbEnrichmentQuestionsQuery,
  useDismissDbEnrichmentQuestionMutation,
  useDraftDbEnrichmentQuestionMutation,
} from '../../../shared/api/queries/dbEnrichment';
import {
  createEnrichmentQuestionGridColumns,
  createEnrichmentQuestionRowActions,
  ENRICHMENT_QUESTION_KIND_LABEL,
  ENRICHMENT_QUESTION_SORT_OPTIONS,
  type EnrichmentQuestionSortField,
} from './dataEnrichmentQuestionGridColumns';
import { useListPageToolbarScroll } from '../../../shared/lib/useListPageToolbarScroll';
import { ListPageToolbarScrollRoot } from '../../../shared/ui/list-page/listPageToolbarChrome';
import { cn } from '../../../lib/utils';

type DataEnrichmentQuestionsPanelProps = {
  dataSource: DataSourceRecord;
  active: boolean;
  onBack?: () => void;
};

type QuestionsListFilters = {
  searchInput: string;
  statusFilter: string;
};

const DEFAULT_FILTERS: QuestionsListFilters = {
  searchInput: '',
  statusFilter: 'open',
};

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'answered', label: 'Answered' },
  { value: 'dismissed', label: 'Dismissed' },
];

function sanitizeFilters(raw: unknown): QuestionsListFilters | null {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return null;
  }
  const record = raw as Record<string, unknown>;
  const statusFilter = typeof record.statusFilter === 'string' ? record.statusFilter : 'open';
  const knownStatus = statusFilter === TOOLBAR_FILTER_RADIO_ALL_VALUE
    || STATUS_OPTIONS.some((option) => option.value === statusFilter);
  return {
    searchInput: typeof record.searchInput === 'string' ? record.searchInput : '',
    statusFilter: knownStatus ? statusFilter : 'open',
  };
}

const compareQuestions = (
  left: DbEnrichmentQuestion,
  right: DbEnrichmentQuestion,
  sortBy: EnrichmentQuestionSortField,
  direction: 'asc' | 'desc',
): number => {
  const dir = direction === 'asc' ? 1 : -1;
  const leftValue = sortBy === 'createdAt' ? (left.createdAt ?? '') : left[sortBy];
  const rightValue = sortBy === 'createdAt' ? (right.createdAt ?? '') : right[sortBy];
  return String(leftValue).localeCompare(String(rightValue), undefined, { numeric: true }) * dir;
};

export const DataEnrichmentQuestionsPanel: React.FC<DataEnrichmentQuestionsPanelProps> = ({
  dataSource,
  active,
  onBack,
}) => {
  const dataSourceId = dataSource.id;
  const [filters, setFilters] = usePersistedListFilters({
    listKey: APP_LIST_PREFERENCE_KEYS.dataSourceEnrichmentQuestions,
    defaultFilters: DEFAULT_FILTERS,
    sanitize: sanitizeFilters,
  });
  const { searchInput, statusFilter } = filters;
  const [searchText, setSearchText] = useState(searchInput);
  const { pageSize, setPageSize, listMode, setListMode } = usePersistedListPaging({
    listKey: APP_LIST_PREFERENCE_KEYS.dataSourceEnrichmentQuestions,
    defaultPageSize: DEFAULT_GRID_PAGE_SIZE,
  });
  const [sortBy, setSortBy] = useState<EnrichmentQuestionSortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [answerTarget, setAnswerTarget] = useState<DbEnrichmentQuestion | null>(null);
  const [answerDraft, setAnswerDraft] = useState('');
  const [draftModelId, setDraftModelId] = useState('');
  const [dismissTarget, setDismissTarget] = useState<DbEnrichmentQuestion | null>(null);

  const questionsQuery = useDbEnrichmentQuestionsQuery(dataSourceId, 'all', { enabled: active });
  const answerMutation = useAnswerDbEnrichmentQuestionMutation(dataSourceId);
  const draftMutation = useDraftDbEnrichmentQuestionMutation();
  const dismissMutation = useDismissDbEnrichmentQuestionMutation(dataSourceId);
  const isAnswerOpen = Boolean(answerTarget) && answerTarget?.status === 'open';
  const aiSettingsQuery = useAiSettingsQuery({ enabled: isAnswerOpen });
  const modelsQuery = useAvailableAiModelsQuery(isAnswerOpen);
  const chatModels = useMemo(
    () => (modelsQuery.data?.models ?? []).filter((model) => isAiModelChatCapable(model)),
    [modelsQuery.data?.models],
  );
  const aiEnabled = isAiGloballyEnabled(aiSettingsQuery.data?.enabled);
  const showGenerateAnswer = isAnswerOpen && aiEnabled && (modelsQuery.isLoading || chatModels.length > 0);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchText(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!answerTarget) {
      setAnswerDraft('');
      setDraftModelId('');
      return;
    }
    setAnswerDraft(answerTarget.answer ?? '');
    setDraftModelId('');
  }, [answerTarget]);

  useEffect(() => {
    if (!isAnswerOpen || draftModelId || chatModels.length === 0) {
      return;
    }
    const preferred = modelsQuery.data?.defaultModelId;
    const next = (preferred && chatModels.some((model) => model.id === preferred)
      ? preferred
      : chatModels.find((model) => model.isDefault)?.id)
      ?? chatModels[0].id;
    setDraftModelId(next);
  }, [chatModels, draftModelId, isAnswerOpen, modelsQuery.data?.defaultModelId]);

  const setSearchInput = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, searchInput: next }));
  }, [setFilters]);

  const setStatusFilter = useCallback((next: string) => {
    setFilters((prev) => ({ ...prev, statusFilter: next }));
  }, [setFilters]);

  const filteredRows = useMemo(() => {
    const items = questionsQuery.data ?? [];
    const textNeedle = searchText.trim().toLowerCase();
    return items
      .filter((row) => {
        if (statusFilter && row.status !== statusFilter) {
          return false;
        }
        if (!textNeedle) {
          return true;
        }
        return (
          row.question.toLowerCase().includes(textNeedle)
          || row.objectName.toLowerCase().includes(textNeedle)
          || (row.columnName?.toLowerCase().includes(textNeedle) ?? false)
          || (row.answer?.toLowerCase().includes(textNeedle) ?? false)
          || ENRICHMENT_QUESTION_KIND_LABEL[row.kind].toLowerCase().includes(textNeedle)
          || row.status.toLowerCase().includes(textNeedle)
        );
      })
      .sort((left, right) => compareQuestions(left, right, sortBy, sortDirection));
  }, [questionsQuery.data, searchText, statusFilter, sortBy, sortDirection]);

  const presentation = useGridListPresentation({
    items: filteredRows,
    pageSize,
    listMode,
    resetKeys: [searchText, statusFilter, sortBy, sortDirection, dataSourceId],
  });

  const { listToolbarCollapsed, handleGridScroll } = useListPageToolbarScroll(presentation.handleScrollEnd);

  const handlers = useMemo(() => ({
    onAnswer: (question: DbEnrichmentQuestion) => setAnswerTarget(question),
    onView: (question: DbEnrichmentQuestion) => setAnswerTarget(question),
    onDismiss: (question: DbEnrichmentQuestion) => setDismissTarget(question),
  }), []);

  const columns = useMemo(
    () => createEnrichmentQuestionGridColumns(handlers),
    [handlers],
  );
  const { layout: columnLayout, setLayout: handleColumnLayoutChange } = useGridColumnLayout({
    columns,
    gridId: APP_GRID_IDS.dataSourceEnrichmentQuestions,
  });

  const isAnswerReadOnly = answerTarget?.status !== 'open';

  const handleSaveAnswer = () => {
    if (!answerTarget || !answerDraft.trim()) {
      return;
    }
    answerMutation.mutate({ id: answerTarget.id, answer: answerDraft.trim() }, {
      onError: (error) => showAppFeedbackToast(formatDbEnrichmentError(error), { type: 'error' }),
      onSuccess: () => setAnswerTarget(null),
    });
  };

  const handleGenerateAnswer = () => {
    if (!answerTarget) {
      return;
    }
    draftMutation.mutate(
      { id: answerTarget.id, modelId: draftModelId || undefined },
      {
        onError: (error) => showAppFeedbackToast(formatDbEnrichmentError(error), { type: 'error' }),
        onSuccess: (draft) => setAnswerDraft(draft),
      },
    );
  };

  const handleConfirmDismiss = () => {
    if (!dismissTarget) {
      return;
    }
    dismissMutation.mutate(dismissTarget.id, {
      onError: (error) => showAppFeedbackToast(formatDbEnrichmentError(error), { type: 'error' }),
      onSuccess: () => setDismissTarget(null),
    });
  };

  if (!active) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <ListPageToolbarFrame>

        <div className={PAGE_TOOLBAR_FILTERS_CLUSTER_CLASS}>
          {onBack ? (
            <>
              <WorkspaceBackIcon
                ariaLabel="Back to Data Sources"
                title="Back to Data Sources"
                onClick={onBack}
              />
              <span className={PAGE_TOOLBAR_ACTION_SEPARATOR_CLASS} aria-hidden="true" />
            </>
          ) : null}
          <ToolbarSearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search questions"
            ariaLabel="Search questions"
          />
          <ToolbarFilterRadioGroup
            value={statusFilter}
            options={STATUS_OPTIONS}
            onChange={setStatusFilter}
            ariaLabel="Filter questions by status"
          />
        </div>
        <div className={PAGE_TOOLBAR_ACTIONS_CLUSTER_CLASS}>
          <ToolbarActionGroupWithRefresh
            onRefresh={() => { void questionsQuery.refetch(); }}
            isRefreshing={questionsQuery.isFetching && !questionsQuery.isLoading}
            actions={[]}
          />
        </div>
      </ListPageToolbarFrame>

      <div className="flex min-h-0 w-full flex-1 flex-col">
        <AppTableGrid
          presentation="auto"
          columns={columns}
          rows={presentation.displayItems}
          getRowKey={(row) => row.id}
          enableColumnLayout
          persistListKey={APP_LIST_PREFERENCE_KEYS.dataSourceEnrichmentQuestions}
          columnLayout={columnLayout}
          onColumnLayoutChange={handleColumnLayoutChange}
          getCardRowActions={(row) => createEnrichmentQuestionRowActions(row, handlers)}
          onScroll={handleGridScroll}
          isLoading={questionsQuery.isLoading}
          loadingMessage="Loading questions…"
          errorContent={
            questionsQuery.isError ? (
              <QueryErrorPanel
                message="Failed to load questions."
                detail={formatDbEnrichmentError(questionsQuery.error)}
                onRetry={() => { void questionsQuery.refetch(); }}
                isRetrying={questionsQuery.isFetching}
              />
            ) : undefined
          }
          isEmpty={!questionsQuery.isLoading && !questionsQuery.isError && presentation.displayItems.length === 0}
          emptyMessage="No questions found."
          footer={(
            <GridPagingFooter
              totalCount={presentation.totalCount}
              safePage={presentation.safePage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              sortBy={sortBy}
              sortOptions={ENRICHMENT_QUESTION_SORT_OPTIONS}
              onSortByChange={setSortBy}
              sortDirection={sortDirection}
              onToggleSortDirection={() => setSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))}
              showSortControls
              totalPages={presentation.totalPages}
              pageNumbers={presentation.pageNumbers}
              onPageChange={presentation.setPage}
              listMode={listMode}
              onListModeChange={setListMode}
              visibleInfiniteCount={presentation.visibleInfiniteCount}
            />
          )}
        />
      </div>

      {answerTarget ? (
        <CreateEditModalShell
          size="5xl"
          title={isAnswerReadOnly ? 'Question' : 'Answer question'}
          gradient={false}
          shellClassName="flex min-h-[32rem] max-h-[92vh] flex-col overflow-hidden"
          bodyOuterClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
          bodyClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
          onClose={() => setAnswerTarget(null)}
          onBackdropClick={() => setAnswerTarget(null)}
          footer={(
            <div className="flex items-center gap-2">
              <AppButton intent="cancel" size="sm" onClick={() => setAnswerTarget(null)}>
                <X className="h-3.5 w-3.5" />
                {isAnswerReadOnly ? 'Close' : 'Cancel'}
              </AppButton>
              {!isAnswerReadOnly ? (
                <AppButton
                  intent="primary"
                  size="sm"
                  disabled={answerMutation.isPending || !answerDraft.trim()}
                  onClick={handleSaveAnswer}
                >
                  <Check className="h-3.5 w-3.5" />
                  Save answer
                </AppButton>
              ) : null}
            </div>
          )}
        >
          <div className="flex h-full min-h-0 flex-1 flex-col gap-3">
            <div className="shrink-0 space-y-3 text-sm">
              <p className="font-medium text-slate-800">{answerTarget.question}</p>
              <p className="font-mono text-xs text-slate-500">
                {answerTarget.objectName}
                {answerTarget.columnName ? `.${answerTarget.columnName}` : ''}
                {' · '}
                {ENRICHMENT_QUESTION_KIND_LABEL[answerTarget.kind]}
              </p>
              {answerTarget.reason.length > 0 ? (
                <ul className="list-disc space-y-0.5 ps-4 text-xs text-slate-600">
                  {answerTarget.reason.map((reason, index) => (
                    <li key={index}>{reason}</li>
                  ))}
                </ul>
              ) : null}
              {!isAnswerReadOnly && answerTarget.candidates.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {answerTarget.candidates.map((candidate, index) => (
                    <AppButton
                      key={index}
                      type="button"
                      intent="secondary"
                      size="sm"
                      onClick={() => setAnswerDraft(candidate)}
                    >
                      {candidate}
                    </AppButton>
                  ))}
                </div>
              ) : null}
              {showGenerateAnswer ? (
                <div className="flex items-end gap-2">
                  <FormField label="Model" className="min-w-0 flex-1" reserveHintSlot={false}>
                    <UiSelect
                      size="sm"
                      value={draftModelId}
                      onChange={(event) => setDraftModelId(event.target.value)}
                      isDisabled={draftMutation.isPending || modelsQuery.isLoading || chatModels.length === 0}
                      ariaLabel="Answer model"
                    >
                      {chatModels.map((model) => (
                        <option key={model.id} value={model.id}>
                          {model.name}
                        </option>
                      ))}
                    </UiSelect>
                  </FormField>
                  <AppButton
                    intent="secondary"
                    size="sm"
                    disabled={draftMutation.isPending || !draftModelId}
                    onClick={handleGenerateAnswer}
                  >
                    {draftMutation.isPending
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Sparkles className="h-3.5 w-3.5" />}
                    Generate answer
                  </AppButton>
                </div>
              ) : null}
            </div>
            {isAnswerReadOnly ? (
              <p className="min-h-0 flex-1 overflow-auto text-sm text-slate-600">
                {answerTarget.status === 'answered' ? answerTarget.answer : 'Dismissed without an answer.'}
              </p>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden [&>div]:flex [&>div]:h-full [&>div]:min-h-0 [&>div]:flex-1 [&>div]:flex-col [&_textarea]:h-full [&_textarea]:min-h-0 [&_textarea]:resize-none">
                <UiTextarea
                  aiAssist={false}
                  value={answerDraft}
                  onChange={(event) => setAnswerDraft(event.target.value)}
                  placeholder="Type an answer…"
                  ariaLabel="Answer"
                  rows={12}
                  disabled={draftMutation.isPending}
                  className="h-full min-h-0"
                />
              </div>
            )}
          </div>
        </CreateEditModalShell>
      ) : null}

      <ConfirmDialogShell
        open={Boolean(dismissTarget)}
        title="Dismiss question"
        subtitle={dismissTarget?.objectName}
        confirmLabel="Dismiss"
        confirmIntent="destructive-soft"
        confirmIcon={<Ban className="h-3.5 w-3.5" />}
        isConfirming={dismissMutation.isPending}
        onClose={() => setDismissTarget(null)}
        onConfirm={handleConfirmDismiss}
      >
        <p className="text-sm text-slate-600">
          Dismiss this question without an answer?
        </p>
      </ConfirmDialogShell>
    </div>
  );
};
