import React, { useEffect, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  AlertCircle,
  Braces,
  Check,
  Clock,
  Copy,
  Database,
  ExternalLink,
  Gauge,
  Globe,
  Hash,
  Info,
  KeyRound,
  Layers,
  LayoutList,
  Loader2,
  MapPin,
  Monitor,
  Network,
  Route,
  Rows3,
  Server,
  Sparkles,
  Timer,
  Zap,
} from 'lucide-react';
import {
  buildPageLoadProfilePhaseRows,
  formatProfileDurationMs,
} from '../../../shared/lib/pageLoadProfile/buildPhaseRows';
import { buildSimplePageLoadProfileSummary } from '../../../shared/lib/pageLoadProfile/buildSimpleSummary';
import { serializePageLoadProfileExport } from '../../../shared/lib/pageLoadProfile/buildExportPayload';
import { openPageLoadProfileExportWindow } from '../../../shared/lib/pageLoadProfile/openExportJsonWindow';
import { computePageLoadProfileTotals } from '../../../shared/lib/pageLoadProfile/computeTotals';
import { PAGE_LOAD_PROFILE_COPY as COPY } from '../../../shared/lib/pageLoadProfile/pageLoadProfileCopy';
import { isHttpApiRequestPath } from '../../../shared/lib/pageLoadProfile/httpApiPath';
import { refreshPageLoadProfileSession } from '../../../shared/lib/pageLoadProfile/store';
import { usePageLoadProfileSnapshot } from '../../../shared/lib/pageLoadProfile/usePageLoadProfileSnapshot';
import { AppButton, CreateEditModalShell, UiSegmentedControl } from '../../../shared/ui';
import { cn } from '../../../lib/utils';

export type PageLoadProfileDialogProps = {
  open: boolean;
  onClose: () => void;
};

type ProfileViewMode = 'simple' | 'advanced';

type IconTone = 'primary' | 'cyan' | 'violet' | 'indigo' | 'amber' | 'emerald' | 'slate';

const ICON_BADGE: Record<IconTone, string> = {
  primary: 'bg-primary-subtle/60 text-primary-700 ring-primary-200/80',
  cyan: 'bg-cyan-50 text-cyan-700 ring-cyan-200/80',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200/80',
  indigo: 'bg-indigo-50 text-indigo-700 ring-indigo-200/80',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200/80',
  emerald: 'bg-emerald-50 text-emerald-700 ring-emerald-200/80',
  slate: 'bg-slate-100 text-slate-600 ring-slate-200/80',
};

const SectionHeading: React.FC<{
  icon: LucideIcon;
  tone?: IconTone;
  children: React.ReactNode;
  className?: string;
}> = ({ icon: Icon, tone = 'slate', children, className }) => (
  <h3
    className={cn(
      'mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-600',
      className,
    )}
  >
    <span
      className={cn(
        'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset',
        ICON_BADGE[tone],
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </span>
    <span>{children}</span>
  </h3>
);

const SummaryCard: React.FC<{
  icon: LucideIcon;
  tone?: IconTone;
  label: string;
  value: string;
  emphasis?: boolean;
}> = ({ icon: Icon, tone = 'slate', label, value, emphasis }) => (
  <div
    className={cn(
      'flex min-w-0 flex-col gap-2 rounded-lg border px-3 py-2.5 shadow-sm',
      emphasis ? 'border-primary-200 bg-primary-subtle/25' : 'border-slate-200 bg-white',
    )}
  >
    <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
      <span
        className={cn(
          'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset',
          ICON_BADGE[emphasis ? 'primary' : tone],
        )}
      >
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </span>
      <span className="min-w-0 truncate">{label}</span>
    </div>
    <div className={cn('ps-9 text-lg font-bold tabular-nums', emphasis ? 'text-primary-700' : 'text-slate-900')}>
      {value}
    </div>
  </div>
);

const BUCKET_VISUAL: Record<string, { icon: LucideIcon; tone: IconTone; bar: string }> = {
  'client-before': { icon: Route, tone: 'violet', bar: 'bg-violet-500' },
  'api-window': { icon: Globe, tone: 'cyan', bar: 'bg-cyan-500' },
  'client-after': { icon: Sparkles, tone: 'indigo', bar: 'bg-indigo-500' },
};

const PHASE_BAR: Record<string, string> = {
  total: 'bg-primary-500',
  'server-db': 'bg-cyan-500',
  'server-handler': 'bg-teal-500',
  'api-network': 'bg-sky-500',
  'react-shell': 'bg-violet-500',
  'js-chunks': 'bg-indigo-400',
};

const PageLoadProfileSimpleView: React.FC<{
  snapshot: NonNullable<ReturnType<typeof usePageLoadProfileSnapshot>>;
}> = ({ snapshot }) => {
  const summary = useMemo(() => buildSimplePageLoadProfileSummary(snapshot), [snapshot]);
  const totals = useMemo(() => computePageLoadProfileTotals(snapshot), [snapshot]);
  const maxBucketMs = Math.max(1, ...summary.buckets.map((bucket) => bucket.durationMs));

  const headlineIcon = summary.isComplete ? Gauge : Loader2;
  const HeadlineIcon = headlineIcon;

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-primary-200/80 bg-gradient-to-br from-primary-subtle/35 via-white to-violet-50/40 px-4 py-3 shadow-sm">
        <p className="flex items-start gap-2 text-sm font-medium text-slate-800">
          <span className={cn('mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset', ICON_BADGE.primary)}>
            <HeadlineIcon className={cn('h-4 w-4', !summary.isComplete && 'animate-spin')} aria-hidden />
          </span>
          <span>{summary.headline}</span>
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2 ps-9">
          <Timer className="h-4 w-4 text-primary-600" aria-hidden />
          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {COPY.simpleTotalLabel}
          </span>
          <span className="text-2xl font-bold tabular-nums text-primary-700">
            {formatProfileDurationMs(summary.wallClockMs)}
          </span>
        </div>
      </div>

      <section>
        <SectionHeading icon={Activity} tone="primary">
          {COPY.simpleWhereTimeWent}
        </SectionHeading>
        <ul className="space-y-3">
          {summary.buckets.map((bucket) => {
            const width = Math.max(4, Math.round((bucket.durationMs / maxBucketMs) * 100));
            const visual = BUCKET_VISUAL[bucket.id] ?? { icon: Zap, tone: 'slate' as const, bar: 'bg-primary-500' };
            const BucketIcon = visual.icon;
            return (
              <li key={bucket.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm font-medium text-slate-800">
                    <span className={cn('inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md ring-1 ring-inset', ICON_BADGE[visual.tone])}>
                      <BucketIcon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="truncate">{bucket.label}</span>
                  </span>
                  <span className="shrink-0 tabular-nums text-sm font-bold text-slate-900">
                    {formatProfileDurationMs(bucket.durationMs)}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={cn('h-full rounded-full', visual.bar)} style={{ width: `${width}%` }} />
                </div>
                {bucket.note ? (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-slate-500">
                    <Info className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                    {bucket.note}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>

      <div className="grid gap-2 sm:grid-cols-2">
        <SummaryCard
          icon={Server}
          tone="cyan"
          label={COPY.simpleServerHandlerTotals}
          value={formatProfileDurationMs(totals.serverHandlerSumMs)}
        />
        <SummaryCard
          icon={Database}
          tone="cyan"
          label={COPY.simpleServerDbTotals}
          value={formatProfileDurationMs(totals.serverDbSumMs)}
        />
      </div>

      <section className="space-y-4 rounded-lg border border-slate-200 bg-white px-3 py-3 text-sm shadow-sm">
        <div>
          <SectionHeading icon={Network} tone="violet" className="mb-1">
            {COPY.simpleSlowestApi}
          </SectionHeading>
          {summary.slowestApi ? (
            <div className="flex flex-wrap items-center gap-2 ps-8 font-mono text-xs text-slate-800">
              <Zap className="h-3.5 w-3.5 text-amber-600" aria-hidden />
              <span>{summary.slowestApi.path.replace(/^\/api/, '')}</span>
              <span className="tabular-nums font-bold text-primary-700">
                {formatProfileDurationMs(summary.slowestApi.durationMs)}
              </span>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 ps-8 text-xs text-slate-500">
              <AlertCircle className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              {COPY.simpleNoSlowestApi}
            </p>
          )}
        </div>
        <div>
          <SectionHeading icon={Database} tone="cyan" className="mb-1">
            {COPY.simpleSlowestQuery}
          </SectionHeading>
          {summary.slowestQuery ? (
            <div className="space-y-1 ps-8 text-xs text-slate-800">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono tabular-nums font-bold text-cyan-800">
                  {formatProfileDurationMs(summary.slowestQuery.ms)}
                </span>
                <span className="font-mono text-slate-600">{summary.slowestQuery.apiPath.replace(/^\/api/, '')}</span>
              </div>
              <p className="line-clamp-2 font-mono text-[11px] text-slate-600" title={summary.slowestQuery.sql}>
                {summary.slowestQuery.sql}
              </p>
            </div>
          ) : (
            <p className="flex items-center gap-1.5 ps-8 text-xs text-slate-500">
              <AlertCircle className="h-3.5 w-3.5 text-slate-400" aria-hidden />
              {COPY.simpleNoSlowestQuery}
            </p>
          )}
        </div>
      </section>
    </div>
  );
};

/** Fixed modal band — stays above scrollable Simple / Advanced body. */
const PageLoadProfileJsonToolbar: React.FC<{
  copyState: 'idle' | 'copied' | 'failed';
  windowState: 'idle' | 'failed';
  onCopyJson: () => void;
  onOpenJsonWindow: () => void;
}> = ({ copyState, windowState, onCopyJson, onOpenJsonWindow }) => (
  <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 py-0.5" lang="en" dir="ltr">
    <p className="flex min-w-0 flex-1 items-center gap-2 text-xs text-slate-600">
      <span className={cn('inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset', ICON_BADGE.emerald)}>
        <Braces className="h-4 w-4" aria-hidden />
      </span>
      <span>{COPY.jsonHint}</span>
    </p>
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <AppButton intent="secondary" size="sm" onClick={onCopyJson}>
        <span className="inline-flex items-center gap-1.5">
          {copyState === 'copied' ? (
            <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
          ) : (
            <Copy className="h-3.5 w-3.5 text-violet-600" aria-hidden />
          )}
          {copyState === 'copied' ? COPY.copiedJson : COPY.copyJson}
        </span>
      </AppButton>
      <AppButton intent="secondary" size="sm" onClick={onOpenJsonWindow}>
        <span className="inline-flex items-center gap-1.5">
          <ExternalLink className="h-3.5 w-3.5 text-cyan-600" aria-hidden />
          {COPY.viewJsonWindow}
        </span>
      </AppButton>
    </div>
    {copyState === 'failed' || windowState === 'failed' ? (
      <p className="flex w-full items-center gap-1.5 text-xs text-amber-800">
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {copyState === 'failed' ? COPY.copyJsonFailed : COPY.viewJsonWindowFailed}
      </p>
    ) : null}
  </div>
);

const PageLoadProfileAdvancedView: React.FC<{
  snapshot: NonNullable<ReturnType<typeof usePageLoadProfileSnapshot>>;
}> = ({ snapshot }) => {
  const phaseRows = useMemo(
    () => buildPageLoadProfilePhaseRows(snapshot),
    [snapshot],
  );
  const orderedApiCalls = useMemo(
    () => (snapshot
      ? [...snapshot.apiCalls]
        .filter((call) => isHttpApiRequestPath(call.path))
        .sort((a, b) => a.startedAtMs - b.startedAtMs)
      : []),
    [snapshot],
  );
  const totals = useMemo(
    () => computePageLoadProfileTotals(snapshot),
    [snapshot],
  );
  const maxPhaseMs = useMemo(
    () => Math.max(1, ...phaseRows.map((row) => row.durationMs ?? 0)),
    [phaseRows],
  );
  const inProgress = Boolean(totals && !totals.isComplete);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-slate-200 bg-slate-50/90 px-3 py-2.5 text-xs text-slate-600 shadow-sm">
        <div className="flex items-center gap-2 font-semibold text-slate-800">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-primary-600" aria-hidden />
          {snapshot.pathname}
        </div>
        {snapshot.pageKey ? (
          <div className="mt-1 flex items-center gap-2 text-slate-600">
            <KeyRound className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
            {`${COPY.pageKey}: ${snapshot.pageKey}`}
          </div>
        ) : null}
        {inProgress ? (
          <div className="mt-2 flex items-center gap-2 font-medium text-amber-800">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {COPY.inProgress}
          </div>
        ) : null}
      </div>

      <section>
        <SectionHeading icon={Layers} tone="primary">
          {COPY.totalsHeading}
        </SectionHeading>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard
            emphasis
            icon={Clock}
            label={COPY.totalWallClock}
            value={formatProfileDurationMs(totals.wallClockMs)}
          />
          <SummaryCard
            icon={Server}
            tone="cyan"
            label={COPY.totalServer}
            value={formatProfileDurationMs(totals.serverHandlerSumMs)}
          />
          <SummaryCard
            icon={Monitor}
            tone="violet"
            label={COPY.totalClient}
            value={formatProfileDurationMs(totals.clientUiWallMs)}
          />
          <SummaryCard
            icon={Gauge}
            tone="indigo"
            label={COPY.totalServerPlusClient}
            value={formatProfileDurationMs(totals.serverPlusClientMs)}
          />
        </div>
        <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden />
          <span>{COPY.totalsFootnote}</span>
        </p>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section>
          <SectionHeading icon={Timer} tone="violet">
            {COPY.phasesHeading}
          </SectionHeading>
          <ul className="space-y-2">
            {phaseRows.map((row) => {
              const width = row.durationMs != null
                ? Math.max(4, Math.round((row.durationMs / maxPhaseMs) * 100))
                : 0;
              return (
                <li key={row.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="min-w-0 text-xs font-medium text-slate-800">{row.label}</span>
                    <span className={cn(
                      'shrink-0 tabular-nums text-xs font-semibold',
                      row.id === 'total' ? 'text-primary-700' : 'text-slate-700',
                    )}
                    >
                      {formatProfileDurationMs(row.durationMs)}
                    </span>
                  </div>
                  {row.durationMs != null && row.durationMs > 0 ? (
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={cn(
                          'h-full rounded-full',
                          PHASE_BAR[row.id] ?? 'bg-slate-400',
                        )}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                  ) : null}
                  {row.detail ? (
                    <div className="mt-1 text-[11px] text-slate-500">{row.detail}</div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </section>

        <section>
          <SectionHeading icon={Globe} tone="cyan">
            {COPY.apiHeading}
          </SectionHeading>
          <p className="mb-2 flex items-start gap-1.5 text-[11px] text-slate-500">
            <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            {COPY.apiSectionsHint}
          </p>
          {orderedApiCalls.length === 0 ? (
            <p className="flex items-center gap-1.5 text-slate-500">
              <AlertCircle className="h-3.5 w-3.5" aria-hidden />
              {COPY.noApiCalls}
            </p>
          ) : (
            <div className="max-h-64 overflow-auto rounded-lg border border-slate-200 shadow-sm">
              <table className="min-w-full divide-y divide-slate-200 text-[11px]">
                <thead className="sticky top-0 bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-2 py-1.5 text-start font-semibold">
                      <span className="inline-flex items-center gap-1"><Route className="h-3 w-3 text-violet-600" aria-hidden />{COPY.colPath}</span>
                    </th>
                    <th className="px-2 py-1.5 text-end font-semibold">
                      <span className="inline-flex items-center justify-end gap-1"><Network className="h-3 w-3 text-sky-600" aria-hidden />{COPY.colNetwork}</span>
                    </th>
                    <th className="px-2 py-1.5 text-end font-semibold">
                      <span className="inline-flex items-center justify-end gap-1"><Server className="h-3 w-3 text-cyan-600" aria-hidden />{COPY.colServer}</span>
                    </th>
                    <th className="px-2 py-1.5 text-end font-semibold">
                      <span className="inline-flex items-center justify-end gap-1"><Database className="h-3 w-3 text-cyan-700" aria-hidden />{COPY.colDb}</span>
                    </th>
                    <th className="px-2 py-1.5 text-end font-semibold">
                      <span className="inline-flex items-center justify-end gap-1"><Zap className="h-3 w-3 text-violet-600" aria-hidden />{COPY.colApplication}</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {orderedApiCalls.map((call) => (
                    <tr key={`${call.path}-${call.requestId ?? call.finishedAtMs}`}>
                      <td className="max-w-[180px] truncate px-2 py-1.5 font-mono" title={call.path}>
                        {call.path.replace(/^\/api/, '')}
                      </td>
                      <td className="px-2 py-1.5 text-end tabular-nums">{formatProfileDurationMs(call.durationMs)}</td>
                      <td className="px-2 py-1.5 text-end tabular-nums">
                        {formatProfileDurationMs(call.server?.totalMs ?? null)}
                      </td>
                      <td className="px-2 py-1.5 text-end tabular-nums text-cyan-800">
                        {formatProfileDurationMs(call.server?.sections.database.totalMs ?? call.server?.dbMs ?? null)}
                      </td>
                      <td className="px-2 py-1.5 text-end tabular-nums text-violet-800">
                        {formatProfileDurationMs(call.server?.sections.application.totalMs ?? call.server?.applicationMs ?? null)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <section>
        <SectionHeading icon={Database} tone="cyan">
          {COPY.perApiDatabaseHeading}
        </SectionHeading>
        {orderedApiCalls.every((call) => !call.server?.queries?.length) ? (
          <p className="flex items-center gap-1.5 text-slate-500">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            {COPY.noQueries}
          </p>
        ) : (
          <div className="max-h-56 space-y-3 overflow-auto">
            {orderedApiCalls.map((call) => {
              const queries = call.server?.sections.database.queries ?? call.server?.queries ?? [];
              if (queries.length === 0) {
                return null;
              }
              return (
                <div
                  key={`queries-${call.path}-${call.finishedAtMs}`}
                  className="rounded-lg border border-slate-200 bg-white"
                >
                  <div className="flex items-center gap-2 border-b border-slate-100 bg-cyan-50/50 px-2 py-1.5 font-mono text-[11px] text-slate-700">
                    <Globe className="h-3 w-3 shrink-0 text-cyan-700" aria-hidden />
                    {call.path.replace(/^\/api/, '')}
                    <span className="ms-auto tabular-nums font-semibold text-cyan-800">
                      {formatProfileDurationMs(call.server?.sections.database.totalMs ?? null)}
                    </span>
                  </div>
                  <table className="min-w-full divide-y divide-slate-100 text-[11px]">
                    <thead className="text-slate-600">
                      <tr>
                        <th className="px-2 py-1 text-end font-semibold">
                          <span className="inline-flex items-center justify-end gap-1"><Timer className="h-3 w-3" aria-hidden />{COPY.colQueryMs}</span>
                        </th>
                        <th className="px-2 py-1 text-end font-semibold">
                          <span className="inline-flex items-center justify-end gap-1"><Rows3 className="h-3 w-3" aria-hidden />{COPY.colRows}</span>
                        </th>
                        <th className="px-2 py-1 text-start font-semibold">
                          <span className="inline-flex items-center gap-1"><Hash className="h-3 w-3" aria-hidden />{COPY.colSource}</span>
                        </th>
                        <th className="px-2 py-1 text-start font-semibold">
                          <span className="inline-flex items-center gap-1"><Braces className="h-3 w-3" aria-hidden />{COPY.colSql}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {queries.map((query, index) => (
                        <tr key={`${query.source}-${query.ms}-${index}`}>
                          <td className="px-2 py-1 text-end tabular-nums font-medium">{formatProfileDurationMs(query.ms)}</td>
                          <td className="px-2 py-1 text-end tabular-nums text-slate-600">{query.rowCount ?? '—'}</td>
                          <td className="whitespace-nowrap px-2 py-1 font-mono text-slate-600">{query.source}</td>
                          <td className="max-w-lg px-2 py-1 font-mono text-slate-800" title={query.sql}>
                            {query.sql}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export const PageLoadProfileDialog: React.FC<PageLoadProfileDialogProps> = ({
  open,
  onClose,
}) => {
  const snapshot = usePageLoadProfileSnapshot();
  const [viewMode, setViewMode] = useState<ProfileViewMode>('simple');
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const [windowState, setWindowState] = useState<'idle' | 'failed'>('idle');

  useEffect(() => {
    if (!open) {
      return;
    }
    refreshPageLoadProfileSession();
    setCopyState('idle');
    setWindowState('idle');
  }, [open, snapshot?.pathname, snapshot?.apiCalls.length]);

  const exportJson = useMemo(
    () => (snapshot ? serializePageLoadProfileExport(snapshot) : ''),
    [snapshot],
  );

  const handleCopyJson = async (): Promise<void> => {
    if (!exportJson) {
      return;
    }
    try {
      await navigator.clipboard.writeText(exportJson);
      setCopyState('copied');
      setWindowState('idle');
    } catch {
      setCopyState('failed');
    }
  };

  const handleOpenJsonWindow = (): void => {
    if (!exportJson) {
      return;
    }
    const opened = openPageLoadProfileExportWindow(exportJson);
    setWindowState(opened ? 'idle' : 'failed');
    if (opened) {
      setCopyState('idle');
    }
  };

  if (!open) {
    return null;
  }

  const hasData = Boolean(snapshot && (snapshot.apiCalls.length > 0 || snapshot.revealedAtMs != null));

  return (
    <CreateEditModalShell
      onClose={onClose}
      title={(
        <span className="inline-flex items-center gap-2">
          <span className={cn('inline-flex h-8 w-8 items-center justify-center rounded-lg ring-1 ring-inset', ICON_BADGE.violet)}>
            <Gauge className="h-4 w-4" aria-hidden />
          </span>
          <span>{COPY.title}</span>
        </span>
      )}
      size="maximized"
      shellDirection="ltr"
      headerDirection="ltr"
      shellClassName="text-start"
      headerClassName="justify-between"
      metaBand={
        hasData ? (
          <PageLoadProfileJsonToolbar
            copyState={copyState}
            windowState={windowState}
            onCopyJson={() => {
              void handleCopyJson();
            }}
            onOpenJsonWindow={handleOpenJsonWindow}
          />
        ) : undefined
      }
      metaBandClassName="px-4 py-2 text-start"
      bodyClassName="min-h-0 flex-1 overflow-y-auto text-start"
    >
      <div className="space-y-4 text-sm text-slate-700" lang="en" dir="ltr">
        <p className="flex items-start gap-2 rounded-lg border border-slate-200/80 bg-slate-50/60 px-3 py-2 text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary-600" aria-hidden />
          <span>{COPY.hint}</span>
        </p>
        {hasData && snapshot ? (
          <>
            <UiSegmentedControl
              ariaLabel="Profile detail level"
              items={[
                { id: 'simple', label: COPY.viewSimple, icon: LayoutList },
                { id: 'advanced', label: COPY.viewAdvanced, icon: Layers },
              ]}
              selectedKey={viewMode}
              onSelectionChange={(id) => setViewMode(id as ProfileViewMode)}
              visualMode="icon-label"
              width="equal"
            />
            {viewMode === 'simple' ? (
              <PageLoadProfileSimpleView snapshot={snapshot} />
            ) : (
              <PageLoadProfileAdvancedView snapshot={snapshot} />
            )}
          </>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-dashed border-violet-200 bg-violet-50/30 px-4 py-8 text-slate-600">
            <span className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ring-1 ring-inset', ICON_BADGE.violet)}>
              <Gauge className="h-5 w-5" aria-hidden />
            </span>
            <span className="text-sm">{COPY.empty}</span>
          </div>
        )}
      </div>
    </CreateEditModalShell>
  );
};
