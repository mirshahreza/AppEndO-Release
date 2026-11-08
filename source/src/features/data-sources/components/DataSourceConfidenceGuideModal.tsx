import React from 'react';
import { HelpCircle, X } from 'lucide-react';
import type { DataSourceRecord } from '../../../shared/api/contracts/data-sources/types';
import { DB_ENRICHMENT_CONFIDENCE_BY_BASIS } from '../../../shared/api/contracts/db-enrichment';
import { AppButton, CreateEditModalShell, FormSection } from '../../../shared/ui';
import { useDataSourceEnrichmentStats } from '../hooks/useDataSourceEnrichmentStats';

type DataSourceConfidenceGuideModalProps = {
  dataSource: DataSourceRecord | null;
  onClose: () => void;
  onOpenQuestions: (item: DataSourceRecord) => void;
};

const formatPercent = (value: number): string => `${Math.round(value * 100)}%`;

const EVIDENCE_ROWS = [
  {
    basis: 'human_answered' as const,
    title: 'Answer open questions',
    detail: 'Your answers become the source of truth for that table or column and score 100%.',
  },
  {
    basis: 'human_authored' as const,
    title: 'Write meanings yourself',
    detail: 'Human-authored table purpose and column meanings also score 100%.',
  },
  {
    basis: 'fk_lookup_sampled' as const,
    title: 'Keep foreign keys intact',
    detail: 'The enricher samples lookup tables through declared FKs and scores those columns at 90%.',
  },
  {
    basis: 'value_sampled' as const,
    title: 'Let the enricher sample values',
    detail: 'Distinct stored values and glossaries raise a column to 70% when names alone are not enough.',
  },
  {
    basis: 'name_pattern_only' as const,
    title: 'Avoid name-only guesses',
    detail: 'Columns inferred only from the identifier sit at 40%. Stronger evidence replaces this floor.',
  },
  {
    basis: 'unresolved' as const,
    title: 'Clear unresolved columns',
    detail: 'Ambiguous columns score 0% until a later run or a human answer fills them in.',
  },
] as const;

export const DataSourceConfidenceGuideModal: React.FC<DataSourceConfidenceGuideModalProps> = ({
  dataSource,
  onClose,
  onOpenQuestions,
}) => {
  const open = Boolean(dataSource);
  const stats = useDataSourceEnrichmentStats(dataSource?.id ?? '', { enabled: open });

  if (!open || !dataSource) {
    return null;
  }

  const confidenceLabel = stats.overallConfidence !== null
    ? formatPercent(stats.overallConfidence)
    : '—';

  return (
    <CreateEditModalShell
      size="maximized"
      title={`Confidence for "${dataSource.name}"`}
      ariaLabel={`How to raise confidence for ${dataSource.name}`}
      gradient={false}
      onClose={onClose}
      onBackdropClick={onClose}
      metaBandClassName="py-2.5"
      metaBand={(
        <div className="grid w-full min-w-0 flex-1 grid-cols-3 gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-600">Current</p>
            <p className="truncate text-sm font-semibold text-slate-800">{confidenceLabel}</p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-500">Coverage</p>
            <p className="truncate text-sm font-semibold text-slate-800">
              {stats.tablesTotal > 0 ? `${stats.tablesEnriched} / ${stats.tablesTotal} tables` : '—'}
            </p>
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-600">Open questions</p>
            <p className="truncate text-sm font-semibold text-slate-800">{stats.isReady ? stats.openQuestionCount : '—'}</p>
          </div>
        </div>
      )}
      footer={(
        <AppButton intent="secondary" size="sm" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
          Close
        </AppButton>
      )}
    >
      <div className="flex flex-col gap-1">
        <FormSection
          title="Score"
          ink="accent"
          hint="Overall confidence is a column-weighted average of stored table knowledge after the last enrichment run."
        >
          <p className="text-sm leading-relaxed text-slate-600">
            Each column keeps an evidence basis. The card percentage is the average of those scores,
            weighted by column count. Stronger evidence on more columns raises the number.
          </p>
        </FormSection>

        <FormSection
          title="Evidence"
          ink="complement"
          divided
          hint="Replace weaker bases with stronger ones. Unresolved columns pull the average down."
        >
          <ul className="flex flex-col gap-3">
            {EVIDENCE_ROWS.map((row) => (
              <li key={row.basis} className="flex items-start gap-3">
                <span className="w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-slate-800">
                  {formatPercent(DB_ENRICHMENT_CONFIDENCE_BY_BASIS[row.basis])}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-800">{row.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-500">{row.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </FormSection>

        <FormSection
          title="Next"
          ink="contrast"
          divided
          hint="Human answers move a column to 100% immediately. A fresh AI run can fill remaining name-only and unresolved columns."
        >
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed text-slate-600">
              {stats.openQuestionCount > 0
                ? `There are ${stats.openQuestionCount} open questions on this data source. Answering them is the fastest way to raise confidence.`
                : 'No open questions right now. Re-run Enrich with AI with a stronger chat model so remaining name-only and unresolved columns can pick up sampled values or lookup evidence.'}
            </p>
            {stats.openQuestionCount > 0 ? (
              <div>
                <AppButton
                  intent="warning"
                  size="sm"
                  onClick={() => onOpenQuestions(dataSource)}
                >
                  <HelpCircle className="h-3.5 w-3.5" />
                  Open questions
                </AppButton>
              </div>
            ) : (
              <p className="text-xs font-medium text-slate-500">
                Use Enrich with AI on the card when you want another automated pass.
              </p>
            )}
          </div>
        </FormSection>
      </div>
    </CreateEditModalShell>
  );
};
