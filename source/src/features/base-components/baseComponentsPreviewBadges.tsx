import React from 'react';
import { cn } from '../../lib/utils';
import { BASE_COMPONENTS_BADGE_SOFT_CLASS } from './baseComponentsVisualTokens';

/** Soft semantic pills — small-area only (aligned with modeler badge restraint). */
const CATEGORY_BADGE_CLASS: Record<string, string> = {
  Core: 'border-slate-200 bg-slate-50 text-slate-700',
  Integration: 'border-cyan-200 bg-cyan-50 text-cyan-700',
  Reporting: 'border-violet-200 bg-violet-50 text-violet-700',
};

export const BaseComponentsCategoryBadge: React.FC<{ category: string }> = ({ category }) => (
  <span
    className={cn(
      BASE_COMPONENTS_BADGE_SOFT_CLASS,
      CATEGORY_BADGE_CLASS[category] ?? 'border-slate-200 bg-slate-50 text-slate-600',
    )}
  >
    {category}
  </span>
);

const ROOT_BADGE_CLASS = [
  'border-cyan-200 bg-cyan-50 text-cyan-800',
  'border-amber-200 bg-amber-50 text-amber-800',
  'border-emerald-200 bg-emerald-50 text-emerald-800',
  'border-violet-200 bg-violet-50 text-violet-800',
] as const;

export const BaseComponentsTreeKindBadge: React.FC<{ kind: 'group' | 'item' }> = ({ kind }) => (
  <span
    className={cn(
      BASE_COMPONENTS_BADGE_SOFT_CLASS,
      kind === 'group'
        ? 'border-slate-300 bg-slate-100 text-slate-700'
        : 'border-slate-200 bg-slate-50 text-slate-600',
    )}
  >
    {kind}
  </span>
);

export const BaseComponentsTreeRootAccent: React.FC<{ rootIndex: number; label: string }> = ({
  rootIndex,
  label,
}) => (
  <span className="inline-flex items-center gap-1.5">
    <span
      className={cn(
        'inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full border px-1 text-[10px] font-bold',
        ROOT_BADGE_CLASS[rootIndex % ROOT_BADGE_CLASS.length],
      )}
      aria-hidden
    >
      {rootIndex + 1}
    </span>
    <span>{label}</span>
  </span>
);
