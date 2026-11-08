import { Check, Copy, ListTree, Loader2, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { cn } from '../../../lib/utils';
import type { ToolResult } from '../../../shared/api/contracts/ai/agentTypes';

export type AgentActivityStep = {
  id: string;
  name: string;
  args: Record<string, unknown>;
  status: 'running' | 'done' | 'error';
  result?: ToolResult;
  activityTitle?: string;
  intention?: string;
  argsOneLiner?: string;
};

type AgentActivityFeedProps = {
  steps?: AgentActivityStep[];
  thinking?: string;
  isActive?: boolean;
  defaultExpanded?: boolean;
  copyStepsText?: string;
};

const summarizeSteps = (steps: AgentActivityStep[]): string => {
  if (steps.length === 0) return 'Done';
  const errorCount = steps.filter((step) => step.status === 'error' || step.result?.ok === false).length;
  if (errorCount > 0) {
    const successCount = steps.length - errorCount;
    if (successCount === 0) {
      return errorCount === 1 ? '1 step failed' : `${errorCount} steps failed`;
    }
    return `${successCount} step(s) completed, ${errorCount} failed`;
  }
  return steps.length === 1 ? '1 step completed' : `${steps.length} steps completed`;
};

const LIVE_PREVIEW_STEP_COUNT = 5;

/** Vertical activity timeline — collapsed to a small live preview while running, full detail on demand (V4 UX-3). */
export const AgentActivityFeed = ({
  steps = [],
  thinking,
  isActive = false,
  defaultExpanded,
  copyStepsText,
}: AgentActivityFeedProps) => {
  const isRunning = isActive || Boolean(thinking) || steps.some((step) => step.status === 'running');
  // User-controlled — running no longer forces the full list open.
  const [expanded, setExpanded] = useState(defaultExpanded ?? false);
  const [copyFeedbackVisible, setCopyFeedbackVisible] = useState(false);
  const copyFeedbackTimerRef = useRef<number | null>(null);
  const wasRunningRef = useRef(isRunning);
  const hasSteps = steps.length > 0;
  const hasExpandableDetails = Boolean(thinking) || hasSteps;
  const canCopySteps = Boolean(copyStepsText?.trim()) && !isRunning && hasSteps;
  const showExpanded = expanded;
  const showLivePreview = isRunning && !expanded && hasSteps;
  const previewSteps = showLivePreview ? steps.slice(-LIVE_PREVIEW_STEP_COUNT) : [];
  const hasFailedSteps = steps.some((step) => step.status === 'error' || step.result?.ok === false);

  useEffect(() => () => {
    if (copyFeedbackTimerRef.current !== null) {
      window.clearTimeout(copyFeedbackTimerRef.current);
    }
  }, []);

  // Collapse after success; keep open after failure so internal AppEndoo status stays visible.
  useEffect(() => {
    if (wasRunningRef.current && !isRunning) {
      setExpanded(hasFailedSteps);
    }
    wasRunningRef.current = isRunning;
  }, [hasFailedSteps, isRunning]);

  const handleCopySteps = useCallback(async () => {
    if (!copyStepsText?.trim()) return;
    try {
      await navigator.clipboard.writeText(copyStepsText);
      setCopyFeedbackVisible(true);
      if (copyFeedbackTimerRef.current !== null) {
        window.clearTimeout(copyFeedbackTimerRef.current);
      }
      copyFeedbackTimerRef.current = window.setTimeout(() => {
        setCopyFeedbackVisible(false);
        copyFeedbackTimerRef.current = null;
      }, 1500);
    } catch {
      // Clipboard unavailable.
    }
  }, [copyStepsText]);

  const toggleExpanded = useCallback(() => {
    if (hasExpandableDetails) {
      setExpanded((open) => !open);
    }
  }, [hasExpandableDetails]);

  if (!thinking && !hasSteps && !isActive) return null;

  return (
    <div className="mb-1.5 select-text" data-testid="agent-activity-feed">
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          className={cn(
            'inline-flex min-w-0 flex-1 items-center gap-1.5 text-left text-[11px] text-slate-500',
            hasExpandableDetails && 'cursor-pointer transition-colors hover:text-slate-700',
          )}
          aria-expanded={showExpanded}
          aria-label={isRunning ? 'Agent activity details' : 'Completed steps'}
          disabled={!hasExpandableDetails}
          onClick={toggleExpanded}
        >
          {isRunning ? (
            <Loader2 className="h-3 w-3 shrink-0 animate-spin text-amber-600" aria-hidden />
          ) : null}
          <span className="min-w-0 truncate text-slate-600">
            {isRunning
              ? (thinking || 'Working…')
              : summarizeSteps(steps)}
          </span>
        </button>
        {hasExpandableDetails ? (
          <button
            type="button"
            className={cn(
              'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-300 transition-colors',
              'hover:bg-slate-100/80 hover:text-slate-500',
              showExpanded && 'text-slate-400',
            )}
            aria-expanded={showExpanded}
            aria-label={showExpanded ? 'Hide activity details' : 'Show activity details'}
            title={showExpanded ? 'Hide details' : 'Details'}
            data-testid="agent-activity-details-toggle"
            onClick={toggleExpanded}
          >
            <ListTree className="h-3 w-3" strokeWidth={1.75} />
          </button>
        ) : null}
        {canCopySteps ? (
          <button
            type="button"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            aria-label={copyFeedbackVisible ? 'Copied activity' : 'Copy activity timeline'}
            title={copyFeedbackVisible ? 'Copied' : 'Copy steps'}
            onClick={() => { void handleCopySteps(); }}
          >
            <Copy className="h-3 w-3" />
          </button>
        ) : null}
      </div>
      {copyFeedbackVisible ? (
        <p className="mt-0.5 text-[9px] text-slate-400">Steps copied</p>
      ) : null}

      {showLivePreview ? (
        <ol className="mt-1 space-y-0.5 border-s border-slate-200 ps-2.5">
          {previewSteps.map((step) => (
            <li key={step.id} className="flex items-center gap-1.5 text-[9px] leading-relaxed text-slate-400">
              {step.status === 'running' ? (
                <Loader2 className="h-2.5 w-2.5 shrink-0 animate-spin text-cyan-600" />
              ) : step.status === 'error' || step.result?.ok === false ? (
                <X className="h-2.5 w-2.5 shrink-0 text-rose-600" />
              ) : (
                <Check className="h-2.5 w-2.5 shrink-0 text-emerald-600" />
              )}
              <span className="min-w-0 truncate">{step.activityTitle || step.name}</span>
            </li>
          ))}
        </ol>
      ) : null}

      {showExpanded && hasExpandableDetails ? (
        <ol className="mt-1.5 space-y-1 border-s border-slate-200 ps-2.5">
          {thinking && isRunning ? (
            <li className="text-[10px] leading-relaxed text-amber-700">{thinking}</li>
          ) : null}
          {steps.map((step) => {
            const title = step.activityTitle || step.name;
            return (
              <li key={step.id} className="flex items-start gap-1.5 text-[10px] leading-relaxed">
                {step.status === 'running' ? (
                  <Loader2 className="mt-0.5 h-3 w-3 shrink-0 animate-spin text-cyan-600" />
                ) : step.status === 'error' || step.result?.ok === false ? (
                  <X className="mt-0.5 h-3 w-3 shrink-0 text-rose-600" />
                ) : (
                  <Check className="mt-0.5 h-3 w-3 shrink-0 text-emerald-600" />
                )}
                <div className="min-w-0">
                  <span className="font-medium text-slate-700">{title}</span>
                  {step.intention ? (
                    <p className="mt-0.5 text-slate-500">{step.intention}</p>
                  ) : null}
                  {step.argsOneLiner ? (
                    <p className="mt-0.5 font-mono text-[9px] text-slate-400">{step.argsOneLiner}</p>
                  ) : null}
                  {step.result?.summary ? (
                    <p className="mt-0.5 text-slate-400">{step.result.summary}</p>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
};
