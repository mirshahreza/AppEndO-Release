import * as React from 'react';
import { AlertTriangle, Accessibility, CircleAlert, Info } from 'lucide-react';
import {
  filterDiagnosticsByCategory,
  type DesignerDiagnosticCategory,
} from '../../../domain/component-designer/a11yDiagnostics';
import type { DesignerDiagnostic } from '../../../domain/component-designer/types';
import { cn } from '../../../lib/utils';

export type DesignerDiagnosticsPanelProps = {
  diagnostics: readonly DesignerDiagnostic[];
  onSelectNode?: (nodeId: string) => void;
  className?: string;
};

const CATEGORY_META: Record<
  DesignerDiagnosticCategory,
  { label: string; empty: string; icon: React.ReactNode; tone: string; activeTone: string }
> = {
  errors: {
    label: 'Errors',
    empty: 'No errors.',
    icon: <CircleAlert className="h-3 w-3" />,
    tone: 'text-rose-700 border-rose-200',
    activeTone: 'bg-rose-50 border-rose-300 text-rose-800',
  },
  warnings: {
    label: 'Warnings',
    empty: 'No warnings.',
    icon: <AlertTriangle className="h-3 w-3" />,
    tone: 'text-amber-700 border-amber-200',
    activeTone: 'bg-amber-50 border-amber-300 text-amber-800',
  },
  accessibility: {
    label: 'Accessibility',
    empty: 'No accessibility issues.',
    icon: <Accessibility className="h-3 w-3" />,
    tone: 'text-sky-700 border-sky-200',
    activeTone: 'bg-sky-50 border-sky-300 text-sky-800',
  },
};

const toneForDiagnostic = (diagnostic: DesignerDiagnostic): string => {
  if (diagnostic.level === 'error') {
    return 'border-rose-200 bg-rose-50 text-rose-700';
  }
  if (diagnostic.code.startsWith('a11y-')) {
    return 'border-sky-200 bg-sky-50 text-sky-800';
  }
  return 'border-amber-200 bg-amber-50 text-amber-800';
};

export const DesignerDiagnosticsPanel: React.FC<DesignerDiagnosticsPanelProps> = ({
  diagnostics,
  onSelectNode,
  className,
}) => {
  const [category, setCategory] = React.useState<DesignerDiagnosticCategory>('errors');

  const counts = React.useMemo(() => ({
    errors: filterDiagnosticsByCategory(diagnostics, 'errors').length,
    warnings: filterDiagnosticsByCategory(diagnostics, 'warnings').length,
    accessibility: filterDiagnosticsByCategory(diagnostics, 'accessibility').length,
  }), [diagnostics]);

  const filtered = React.useMemo(
    () => filterDiagnosticsByCategory(diagnostics, category),
    [category, diagnostics],
  );

  const categories = Object.keys(CATEGORY_META) as DesignerDiagnosticCategory[];

  return (
    <div
      data-testid="designer-diagnostics-panel"
      className={cn('space-y-2', className)}
    >
      <div
        role="tablist"
        aria-label="Diagnostics filters"
        className="flex flex-wrap gap-1"
        data-testid="designer-diagnostics-filters"
      >
        {categories.map((key) => {
          const meta = CATEGORY_META[key];
          const isActive = category === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={isActive}
              data-testid={`designer-diagnostics-filter-${key}`}
              className={cn(
                'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors',
                isActive ? meta.activeTone : `bg-white hover:bg-slate-50 ${meta.tone}`,
              )}
              onClick={() => setCategory(key)}
            >
              {meta.icon}
              <span>{meta.label}</span>
              <span className="tabular-nums opacity-80">({counts[key]})</span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        data-testid={`designer-diagnostics-list-${category}`}
        className="max-h-48 space-y-1 overflow-y-auto"
      >
        {filtered.length === 0 ? (
          <p className="flex items-center gap-1 text-[11px] text-emerald-700">
            <Info className="h-3 w-3" />
            {CATEGORY_META[category].empty}
          </p>
        ) : (
          filtered.map((diagnostic) => (
            <div
              key={diagnostic.id}
              data-testid={`designer-diagnostic-${diagnostic.id}`}
              className={cn('rounded-md border px-2 py-1.5 text-[11px] leading-4', toneForDiagnostic(diagnostic))}
            >
              <div className="flex items-start justify-between gap-2">
                <button
                  type="button"
                  className={cn(
                    'min-w-0 flex-1 text-start',
                    diagnostic.nodeId && onSelectNode ? 'cursor-pointer hover:underline' : 'cursor-default',
                  )}
                  onClick={() => {
                    if (diagnostic.nodeId && onSelectNode) {
                      onSelectNode(diagnostic.nodeId);
                    }
                  }}
                >
                  <span className="font-semibold uppercase tracking-wide opacity-70">{diagnostic.code}</span>
                  <p className="mt-0.5 break-words">{diagnostic.message}</p>
                </button>
                <a
                  href={`/docs/standards/component-designer.md#${diagnostic.code}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-[10px] font-medium underline opacity-80 hover:opacity-100"
                >
                  Help
                </a>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
