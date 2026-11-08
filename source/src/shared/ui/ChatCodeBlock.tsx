import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Copy } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AppButton } from './AppButton';
import {
  CHAT_CODE_BLOCK_COLLAPSE_AFTER_LINES,
  resolveChatCodeDisplay,
} from './chatCodeBlockDisplay';
import { HighlightedCommandCode } from './HighlightedCommandCode';

export type ChatCodeBlockTone = 'default' | 'pending' | 'ran' | 'failed';

export type ChatCodeBlockProps = {
  code: string;
  language?: string;
  actions?: React.ReactNode;
  tone?: ChatCodeBlockTone;
  /** Current editor/source baseline — when set, a full replacement renders as a changed-line diff. */
  diffAgainst?: string;
  /** `always` diffs command-card replacements; `auto` diffs full-handler dumps in chat markdown. */
  diffMode?: 'auto' | 'always';
};

const TONE_CLASS: Record<ChatCodeBlockTone, string> = {
  default: 'border-slate-200',
  pending: 'border-amber-200',
  ran: 'border-emerald-200',
  failed: 'border-rose-200',
};

const HEADER_TONE_CLASS: Record<ChatCodeBlockTone, string> = {
  default: 'border-slate-200 bg-slate-100/80',
  pending: 'border-amber-200 bg-amber-50',
  ran: 'border-emerald-200 bg-emerald-50',
  failed: 'border-rose-200 bg-rose-50',
};

const LINE_CLASS = {
  add: 'bg-emerald-50 text-emerald-800',
  remove: 'bg-rose-50 text-rose-800',
  plain: 'text-slate-800',
} as const;

export const ChatCodeBlock: React.FC<ChatCodeBlockProps> = ({
  code,
  language = '',
  actions,
  tone = 'default',
  diffAgainst,
  diffMode = 'auto',
}) => {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const copyTimerRef = useRef<number | null>(null);
  const display = useMemo(
    () => resolveChatCodeDisplay(code, { diffAgainst, diffMode }),
    [code, diffAgainst, diffMode],
  );
  const hiddenCount = Math.max(0, display.lines.length - CHAT_CODE_BLOCK_COLLAPSE_AFTER_LINES);
  const collapsible = hiddenCount > 0;
  const visibleLines = collapsible && !expanded
    ? display.lines.slice(0, CHAT_CODE_BLOCK_COLLAPSE_AFTER_LINES)
    : display.lines;

  useEffect(() => () => {
    if (copyTimerRef.current !== null) {
      window.clearTimeout(copyTimerRef.current);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    if (!code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      if (copyTimerRef.current !== null) {
        window.clearTimeout(copyTimerRef.current);
      }
      copyTimerRef.current = window.setTimeout(() => {
        setCopied(false);
        copyTimerRef.current = null;
      }, 1500);
    } catch {
      // Clipboard access may be blocked; fail silently.
    }
  }, [code]);

  const languageLabel = display.mode === 'diff' ? 'Diff' : (language || 'Code');
  const visiblePlain = visibleLines.map((line) => line.text).join('\n');

  return (
    <div
      dir="ltr"
      className={cn(
        'min-w-0 max-w-full overflow-hidden rounded-xl border bg-slate-50 text-left shadow-none transition-shadow hover:shadow-sm',
        TONE_CLASS[tone],
      )}
    >
      <div className={cn('flex items-center justify-between gap-2 border-b px-2 py-1', HEADER_TONE_CLASS[tone])}>
        <span className="min-w-0 truncate px-1 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-500">
          {languageLabel}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {actions}
          <button
            type="button"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-white hover:text-slate-700"
            aria-label={copied ? 'Code copied' : 'Copy code block'}
            title={copied ? 'Copied' : 'Copy code'}
            onClick={() => { void handleCopy(); }}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        </div>
      </div>
      {display.mode === 'diff' && display.lines.length === 0 ? (
        <p className="px-3 py-2 text-[11px] text-slate-500">No remaining changes</p>
      ) : display.mode === 'diff' ? (
        <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed font-mono">
          {visibleLines.map((line, index) => (
            <div key={`${line.kind}-${index}`} className={cn('whitespace-pre', LINE_CLASS[line.kind])}>
              <span className="select-none pe-2 text-slate-400">{line.kind === 'add' ? '+' : '-'}</span>
              {line.text}
            </div>
          ))}
        </pre>
      ) : (
        <pre className="overflow-x-auto p-3 text-[11px] leading-relaxed font-mono text-slate-800">
          <HighlightedCommandCode code={visiblePlain} language={language} />
        </pre>
      )}
      {collapsible ? (
        <div className="border-t border-slate-200 bg-white px-2 py-1">
          <AppButton
            intent="utility"
            size="sm"
            className="h-6 min-h-0 px-2 text-[10px]"
            aria-expanded={expanded}
            aria-label={expanded ? 'Collapse code' : `Show ${hiddenCount} more lines`}
            title={expanded ? 'Collapse' : `Show ${hiddenCount} more lines`}
            onClick={() => setExpanded((open) => !open)}
          >
            <ChevronDown className={cn('h-3 w-3', expanded && 'rotate-180')} />
            {expanded ? 'Collapse' : `Show ${hiddenCount} more lines`}
          </AppButton>
        </div>
      ) : null}
    </div>
  );
};
