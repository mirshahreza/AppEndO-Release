import React from 'react';
import { FormSection } from '../../../shared/ui';

export type PackageBuilderDerivedDependencyCard = {
  key: string;
  kind: string;
  name: string;
};

type PackageBuilderDerivedDependenciesPanelProps = {
  title?: string;
  items: PackageBuilderDerivedDependencyCard[];
  emptyMessage: string;
};

const KIND_CLASS: Record<string, string> = {
  Layout: 'text-violet-700',
  Navigation: 'text-emerald-700',
  Component: 'text-violet-700',
  'Server Function': 'text-cyan-700',
  'Edge Model': 'text-teal-700',
  'Edge API': 'text-teal-700',
  File: 'text-slate-600',
};

export const PackageBuilderDerivedDependenciesPanel: React.FC<PackageBuilderDerivedDependenciesPanelProps> = ({
  title = 'From Portal',
  items,
  emptyMessage,
}) => (
  <FormSection title={title} ink="complement" className="shrink-0">
    {items.length === 0 ? (
      <p className="text-sm text-slate-500 ps-[4px]">{emptyMessage}</p>
    ) : (
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <div
            key={item.key}
            className="rounded-md border border-slate-200 bg-slate-50/70 px-3 py-2.5"
            title={item.name}
          >
            <p className={`ps-[4px] text-[10px] font-bold uppercase tracking-wider ${KIND_CLASS[item.kind] ?? 'text-slate-600'}`}>
              {item.kind}
            </p>
            <p className="mt-[2px] truncate ps-[4px] text-sm font-medium text-slate-800">
              {item.name}
            </p>
          </div>
        ))}
      </div>
    )}
  </FormSection>
);
