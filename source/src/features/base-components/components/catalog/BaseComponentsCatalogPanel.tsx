import React from 'react';
import { AppSurfaceBox } from '../../../../shared/ui/AppSurfaceBox';

export type BaseComponentsCatalogPanelProps = {
  title: string;
  summary?: string;
  children: React.ReactNode;
  headerExtra?: React.ReactNode;
};

export const BaseComponentsCatalogPanel: React.FC<BaseComponentsCatalogPanelProps> = ({
  title,
  summary,
  children,
  headerExtra,
}) => (
  <AppSurfaceBox
    title={title}
    headerExtra={headerExtra}
    className="bg-white"
    bodyClassName="space-y-2 text-xs text-slate-700"
  >
    {summary ? <p className="leading-relaxed text-slate-500">{summary}</p> : null}
    {children}
  </AppSurfaceBox>
);

export const BaseComponentsMetadataList: React.FC<{
  items: readonly string[];
  emptyLabel?: string;
}> = ({ items, emptyLabel = 'None documented.' }) =>
  items.length > 0 ? (
    <ul className="space-y-1.5">
      {items.map((item) => (
        <li key={item} className="flex gap-2 leading-relaxed">
          <span className="mt-[0.42rem] h-1.5 w-1.5 shrink-0 rounded-full bg-cyan-600" aria-hidden />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  ) : (
    <p className="text-slate-500">{emptyLabel}</p>
  );

export const BaseComponentsMetadataBadge: React.FC<{
  children: React.ReactNode;
  tone?: 'slate' | 'cyan' | 'amber' | 'emerald';
}> = ({ children, tone = 'slate' }) => {
  const toneClass = {
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
    cyan: 'border-cyan-200 bg-cyan-50 text-cyan-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-800',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  }[tone];
  return (
    <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-semibold ${toneClass}`}>
      {children}
    </span>
  );
};
