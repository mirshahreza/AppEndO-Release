import React from 'react';
import { ShieldCheck, Table2, Users } from 'lucide-react';
import { cn } from '../../lib/utils';
import { pageGuideLocalProps } from '../../shared/ui/shell/pageGuide/pageGuideChrome';
import type { SqlConsoleSampleQuery } from './sqlConsoleSampleQueries';

const SAMPLE_ICONS: Record<string, { Icon: typeof Table2; className: string }> = {
  'list-tables': { Icon: Table2, className: 'text-cyan-600' },
  'platform-users': { Icon: Users, className: 'text-indigo-600' },
  'users-and-roles': { Icon: ShieldCheck, className: 'text-emerald-600' },
};

export type SqlConsoleSampleListProps = {
  samples: SqlConsoleSampleQuery[];
  onPick: (sql: string) => void;
};

export const SqlConsoleSampleList: React.FC<SqlConsoleSampleListProps> = ({
  samples,
  onPick,
}) => {
  if (samples.length === 0) {
    return null;
  }

  return (
    <div
      className="flex h-full flex-col justify-center gap-3 p-6"
      {...pageGuideLocalProps(
        'Sample queries',
        'Load a ready-to-run SELECT into this tab. List tables works on any SQL engine. The other two read control-plane identity tables.',
        30,
      )}
    >
      <p className="text-xs font-medium text-slate-500">Sample queries</p>
      <ul className="flex max-w-xl flex-col gap-2">
        {samples.map((sample) => {
          const icon = SAMPLE_ICONS[sample.id] ?? { Icon: Table2, className: 'text-slate-500' };
          return (
            <li key={sample.id}>
              <button
                type="button"
                onClick={() => onPick(sample.sql)}
                aria-label={`Load sample: ${sample.title}`}
                className="flex w-full items-start gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-left transition-colors hover:bg-slate-50"
              >
                <icon.Icon aria-hidden className={cn('mt-0.5 h-4 w-4 shrink-0', icon.className)} />
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-slate-800">{sample.title}</span>
                  <span className="block text-xs text-slate-500">{sample.hint}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};
