import React from 'react';
import type {
  BaseComponentExportMeta,
  BaseComponentMeta,
  BaseComponentOptionMeta,
} from '../../catalog/baseComponentOptionTypes';
import {
  BaseComponentsCatalogPanel,
  BaseComponentsMetadataBadge,
} from './BaseComponentsCatalogPanel';

export const BaseComponentsApiMappingPanel: React.FC<{
  component: BaseComponentMeta;
  options: readonly BaseComponentOptionMeta[];
  exports: readonly BaseComponentExportMeta[];
}> = ({ component, options, exports }) => {
  const mappedOptions = options.filter(
    (option) =>
      option.disposition === 'public-prop' ||
      option.disposition === 'composition-prop',
  );
  const componentExports = exports.filter(
    (entry) => entry.componentId === component.id,
  );

  return (
    <BaseComponentsCatalogPanel
      title="API mapping"
      summary="Only public and composition mappings enter reusable runtime configuration."
    >
      <div className="flex flex-wrap gap-1">
        {componentExports.map((entry) => (
          <BaseComponentsMetadataBadge key={entry.exportId} tone="emerald">
            {entry.exportId} · {entry.classification}
          </BaseComponentsMetadataBadge>
        ))}
      </div>
      <div className="divide-y divide-slate-100">
        {mappedOptions.map((option) => (
          <div key={option.id} className="flex items-center justify-between gap-2 py-1.5">
            <span className="text-slate-700">{option.label}</span>
            <code className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-700">
              {option.propPath ?? option.id}
            </code>
          </div>
        ))}
      </div>
    </BaseComponentsCatalogPanel>
  );
};
