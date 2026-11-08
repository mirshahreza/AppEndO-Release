import React, { useState } from 'react';
import { AlertTriangle, Check, ChevronDown, FileText } from 'lucide-react';
import type { ChangeSet, ChangeSetKind, ProposalViolation } from '../../shared/api/contracts/ai/agentTypes';
import {
  CHANGE_SET_KIND_LABELS,
  getChangeSetArtifactPreview,
  type DiffPreviewLine,
  type DiffLineStats,
} from '../../shared/lib/changeSetPreview';
import { formatDiffZoneLabel, type DiffZone } from '../../shared/lib/appendoo/diffZones';
import { AppButton } from '../../shared/ui/AppButton';
import { cn } from '../../lib/utils';
import { getProposalConfirmLabel, getProposalPanelTitle } from '../../shared/lib/vibeProposalUi';

const KIND_BADGE_CLASS: Record<ChangeSetKind, string> = {
  component_layout_patch: 'text-indigo-700 bg-indigo-50 border-indigo-200',
  function_source_patch: 'text-cyan-700 bg-cyan-50 border-cyan-200',
  file_patch: 'text-amber-700 bg-amber-50 border-amber-200',
  settings_block_patch: 'text-violet-700 bg-violet-50 border-violet-200',
  git_operation: 'text-slate-700 bg-slate-100 border-slate-200',
};

const DIFF_LINE_CLASS: Record<DiffPreviewLine['kind'], string> = {
  add: 'bg-emerald-50 text-emerald-900',
  remove: 'bg-rose-50 text-rose-900',
  same: 'text-slate-600',
  context: 'text-slate-400 italic',
};

export type VibeProposalPanelProps = {
  proposal: { proposalId: string; changeSets: ChangeSet[] };
  validation?: { ok: boolean; violations: ProposalViolation[] };
  onConfirm: () => void;
  onReject: () => void;
  onRevertZone?: (changeSetId: string, zone: DiffZone) => void;
  busy?: boolean;
  applied?: boolean;
  applyBlockedReason?: string;
};

const ChangeSetKindBadge = ({ kind }: { kind: ChangeSetKind }) => (
  <span
    className={cn(
      'inline-flex shrink-0 items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
      KIND_BADGE_CLASS[kind],
    )}
  >
    {CHANGE_SET_KIND_LABELS[kind]}
  </span>
);

const DiffStatsBadges = ({ stats }: { stats: DiffLineStats }) => (
  <div className="flex shrink-0 items-center gap-1">
    {stats.insertions > 0 ? (
      <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 ring-1 ring-emerald-100">
        +{stats.insertions}
      </span>
    ) : null}
    {stats.deletions > 0 ? (
      <span className="rounded bg-rose-50 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 ring-1 ring-rose-100">
        −{stats.deletions}
      </span>
    ) : null}
    {stats.insertions === 0 && stats.deletions === 0 ? (
      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
        No line changes
      </span>
    ) : null}
  </div>
);

const InlineDiffPreview = ({ lines }: { lines: DiffPreviewLine[] }) => (
  <div
    dir="ltr"
    className="max-h-36 overflow-auto rounded-md border border-slate-200 bg-white text-left font-mono text-[10px]"
  >
    {lines.map((line, index) => (
      <div
        key={`${line.kind}-${index}`}
        className={cn('whitespace-pre-wrap break-all px-2 py-0.5', DIFF_LINE_CLASS[line.kind])}
      >
        {line.kind === 'add' ? `+ ${line.text}` : null}
        {line.kind === 'remove' ? `- ${line.text}` : null}
        {line.kind === 'same' ? `  ${line.text}` : null}
        {line.kind === 'context' ? line.text : null}
      </div>
    ))}
  </div>
);

const ChangeSetArtifactCard = ({
  changeSet,
  defaultExpanded,
  onRevertZone,
}: {
  changeSet: ChangeSet;
  defaultExpanded: boolean;
  onRevertZone?: (changeSetId: string, zone: DiffZone) => void;
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const preview = getChangeSetArtifactPreview(changeSet);

  return (
    <article
      className="rounded-md border border-slate-200 bg-slate-50/60"
      data-testid={`change-set-card-${changeSet.id}`}
    >
      <button
        type="button"
        className="flex w-full items-start gap-2 px-2.5 py-2 text-start"
        aria-expanded={expanded}
        onClick={() => setExpanded((open) => !open)}
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <ChangeSetKindBadge kind={changeSet.kind} />
            <span className="font-medium text-slate-800">{changeSet.title}</span>
            <DiffStatsBadges stats={preview.stats} />
          </div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-slate-500" title={preview.artifactLabel}>
            {preview.artifactLabel}
          </p>
          {changeSet.summary ? (
            <p className="mt-0.5 text-[10px] text-slate-500">{changeSet.summary}</p>
          ) : null}
          {preview.diffZones?.length ? (
            <div className="mt-1 flex flex-wrap items-center gap-1">
              <span className="text-[10px] text-slate-500">Change zones:</span>
              {preview.diffZones.map((zone) => (
                <span key={`${zone.startLine}-${zone.endLine}`} className="inline-flex items-center gap-0.5">
                  <span className="rounded bg-slate-100 px-1 py-0.5 font-mono text-[9px] text-slate-600">
                    {formatDiffZoneLabel(zone)}
                  </span>
                  {onRevertZone && changeSet.kind === 'file_patch' && changeSet.beforeContent ? (
                    <AppButton
                      intent="cancel"
                      size="xs"
                      className="!h-5 !min-h-5 !px-1 !text-[9px]"
                      onClick={(event) => {
                        event.stopPropagation();
                        onRevertZone(changeSet.id, zone);
                      }}
                    >
                      Revert
                    </AppButton>
                  ) : null}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <ChevronDown
          className={cn('mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform', expanded && 'rotate-180')}
        />
      </button>
      {expanded ? (
        <div className="border-t border-slate-200 px-2.5 pb-2.5 pt-1.5">
          <InlineDiffPreview lines={preview.lines} />
        </div>
      ) : null}
    </article>
  );
};

export const VibeProposalPanel = ({
  proposal,
  validation,
  onConfirm,
  onReject,
  onRevertZone,
  busy,
  applied,
  applyBlockedReason,
}: VibeProposalPanelProps) => {
  const hasErrors = validation?.violations.some((violation) => violation.severity === 'error') ?? false;
  const hasWarnings = validation?.violations.some((violation) => violation.severity === 'warning') ?? false;
  const hasPreApplyCheckpoint = proposal.changeSets.some((changeSet) => (
    changeSet.kind === 'file_patch' && changeSet.beforeContent !== undefined
  ));

  const confirmLabel = getProposalConfirmLabel(proposal.changeSets, { applied, busy });
  const panelTitle = getProposalPanelTitle(proposal.changeSets);

  return (
    <div className="mb-2 space-y-2 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-[11px]">
      <div className="flex items-center gap-1.5 font-semibold text-slate-800">
        <FileText className="h-3.5 w-3.5 text-indigo-600" />
        {panelTitle}
      </div>

      {validation ? (
        <div className={cn(
          'rounded-md border px-2.5 py-2',
          validation.ok ? 'border-emerald-200 bg-emerald-50/70 text-emerald-800' : 'border-rose-200 bg-rose-50/70 text-rose-800',
        )}
        >
          <div className="flex items-center gap-1.5 font-medium">
            {validation.ok ? <Check className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
            {validation.ok ? 'Validation passed' : 'Validation blocked confirm'}
          </div>
          {validation.violations.length ? (
            <ul className="mt-1 space-y-1 ps-4 text-[10px]">
              {validation.violations.map((violation) => (
                <li key={violation.id} className={violation.severity === 'warning' ? 'text-amber-800' : undefined}>
                  {violation.message}
                  {violation.ruleId ? ` (${violation.ruleId})` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {applyBlockedReason ? (
        <div className="rounded-md border border-amber-200 bg-amber-50/80 px-2.5 py-2 text-amber-900">
          {applyBlockedReason}
        </div>
      ) : null}

      {hasPreApplyCheckpoint && !applied ? (
        <div className="rounded-md border border-sky-200 bg-sky-50/70 px-2.5 py-2 text-sky-900">
          Checkpoint saved — you can Reject before apply; after apply use Revert in the panel footer.
        </div>
      ) : null}

      <div className="space-y-2" role="list" aria-label="Proposed file changes">
        {proposal.changeSets.map((changeSet, index) => (
          <ChangeSetArtifactCard
            key={changeSet.id}
            changeSet={changeSet}
            defaultExpanded={proposal.changeSets.length === 1 || index === 0}
            onRevertZone={onRevertZone}
          />
        ))}
      </div>

      <div className="flex gap-2 pt-1">
        {!applied ? (
          <AppButton
            intent="cancel"
            size="sm"
            onClick={onReject}
            disabled={busy}
            title={hasPreApplyCheckpoint ? 'Reject proposal — files on disk will not change' : undefined}
          >
            {hasPreApplyCheckpoint ? 'Revert / Reject' : 'Reject'}
          </AppButton>
        ) : null}
        <AppButton
          intent="confirm"
          size="sm"
          onClick={onConfirm}
          disabled={busy || hasErrors || applied || Boolean(applyBlockedReason)}
          title={applyBlockedReason ?? (hasErrors ? 'Resolve validation errors before applying' : hasWarnings ? 'Warnings present — confirm to override' : undefined)}
        >
          {confirmLabel}
        </AppButton>
      </div>
    </div>
  );
};
