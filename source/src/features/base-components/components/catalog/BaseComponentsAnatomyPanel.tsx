import React from 'react';
import type { BaseComponentMeta } from '../../catalog/baseComponentOptionTypes';
import {
  BaseComponentsCatalogPanel,
  BaseComponentsMetadataBadge,
} from './BaseComponentsCatalogPanel';

const AnatomyGroup: React.FC<{
  label: string;
  items: readonly string[];
  tone: 'cyan' | 'slate';
}> = ({ label, items, tone }) => (
  <div>
    <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
      {label}
    </h4>
    <div className="flex flex-wrap gap-1">
      {items.map((item) => (
        <BaseComponentsMetadataBadge key={item} tone={tone}>
          {item}
        </BaseComponentsMetadataBadge>
      ))}
    </div>
  </div>
);

export const BaseComponentsAnatomyPanel: React.FC<{
  component: BaseComponentMeta;
}> = ({ component }) => (
  <BaseComponentsCatalogPanel title="Anatomy">
    <AnatomyGroup label="Required" items={component.anatomy.required} tone="cyan" />
    <AnatomyGroup label="Optional" items={component.anatomy.optional} tone="slate" />
  </BaseComponentsCatalogPanel>
);
