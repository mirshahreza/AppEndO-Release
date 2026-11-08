import React from 'react';
import type {
  BaseComponentOptionMeta,
  BaseComponentOptionResolution,
} from '../../catalog/baseComponentOptionTypes';
import {
  BaseComponentsCatalogPanel,
  BaseComponentsMetadataBadge,
} from './BaseComponentsCatalogPanel';

export type BaseComponentsOptionsPanelProps = {
  options: readonly BaseComponentOptionMeta[];
  resolution?: BaseComponentOptionResolution;
  title?: string;
  summary?: string;
};

export const BaseComponentsOptionsPanel: React.FC<BaseComponentsOptionsPanelProps> = ({
  options,
  resolution,
  title = 'Options',
  summary,
}) => (
  <BaseComponentsCatalogPanel title={title} summary={summary}>
    {options.length > 0 ? (
      <div className="divide-y divide-slate-100">
        {options.map((option) => {
          const state = resolution?.optionState[option.id];
          return (
            <div
              key={option.id}
              className="flex flex-wrap items-start justify-between gap-2 py-2 first:pt-0 last:pb-0"
              data-option-id={option.id}
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{option.label}</p>
                <p className="font-mono text-[10px] text-slate-500">{option.id}</p>
                {option.accessibilityImpact ? (
                  <p className="mt-1 max-w-xl leading-relaxed text-slate-500">
                    {option.accessibilityImpact}
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap justify-end gap-1">
                <BaseComponentsMetadataBadge tone="cyan">{option.axis}</BaseComponentsMetadataBadge>
                <BaseComponentsMetadataBadge>{option.disposition}</BaseComponentsMetadataBadge>
                {state && !state.enabled ? (
                  <BaseComponentsMetadataBadge tone="amber">disabled</BaseComponentsMetadataBadge>
                ) : null}
                {state && !state.visible ? (
                  <BaseComponentsMetadataBadge tone="amber">hidden</BaseComponentsMetadataBadge>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    ) : (
      <p className="text-slate-500">No options in this category.</p>
    )}
  </BaseComponentsCatalogPanel>
);
