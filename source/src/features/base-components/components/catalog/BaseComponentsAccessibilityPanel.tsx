import React from 'react';
import type {
  BaseComponentEvidence,
  BaseComponentOptionMeta,
} from '../../catalog/baseComponentOptionTypes';
import {
  BaseComponentsCatalogPanel,
  BaseComponentsMetadataBadge,
} from './BaseComponentsCatalogPanel';

export const BaseComponentsAccessibilityPanel: React.FC<{
  options: readonly BaseComponentOptionMeta[];
  evidence: readonly BaseComponentEvidence[];
}> = ({ options, evidence }) => {
  const relevantOptions = options.filter(
    (option) => option.axis === 'accessibility' || option.accessibilityImpact,
  );
  const evidenceIds = new Set(relevantOptions.flatMap((option) => option.evidenceRefs));
  const sources = evidence.filter((entry) => evidenceIds.has(entry.id));

  return (
    <BaseComponentsCatalogPanel
      title="Accessibility"
      summary="Interaction and naming requirements are part of the component contract."
    >
      <div className="space-y-2">
        {relevantOptions.map((option) => (
          <div key={option.id} className="rounded-md border border-slate-100 p-2">
            <div className="flex flex-wrap items-center justify-between gap-1">
              <span className="font-semibold text-slate-800">{option.label}</span>
              <BaseComponentsMetadataBadge tone="cyan">{option.axis}</BaseComponentsMetadataBadge>
            </div>
            {option.accessibilityImpact ? (
              <p className="mt-1 leading-relaxed text-slate-500">
                {option.accessibilityImpact}
              </p>
            ) : null}
          </div>
        ))}
      </div>
      <div>
        <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          Evidence
        </h4>
        <div className="flex flex-wrap gap-1">
          {sources.map((source) => (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noreferrer"
              className="rounded-md border border-cyan-200 bg-cyan-50 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-800 hover:underline"
            >
              {source.label}
            </a>
          ))}
        </div>
      </div>
    </BaseComponentsCatalogPanel>
  );
};
