import React from 'react';
import type { BaseComponentMeta } from '../../catalog/baseComponentOptionTypes';
import {
  BaseComponentsCatalogPanel,
  BaseComponentsMetadataBadge,
  BaseComponentsMetadataList,
} from './BaseComponentsCatalogPanel';

export const BaseComponentsDecisionPanel: React.FC<{
  component: BaseComponentMeta;
}> = ({ component }) => (
  <BaseComponentsCatalogPanel
    title="Decision"
    summary="Choose this component by task and interaction model, not by visual similarity."
    headerExtra={
      <div className="flex flex-wrap justify-end gap-1">
        <BaseComponentsMetadataBadge tone="cyan">{component.kind}</BaseComponentsMetadataBadge>
        <BaseComponentsMetadataBadge
          tone={component.maturity === 'experimental' ? 'amber' : 'emerald'}
        >
          {component.maturity}
        </BaseComponentsMetadataBadge>
      </div>
    }
  >
    <div>
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-700">
        Use when
      </h4>
      <BaseComponentsMetadataList items={component.useWhen} />
    </div>
    <div>
      <h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-amber-700">
        Avoid when
      </h4>
      <BaseComponentsMetadataList items={component.avoidWhen} />
    </div>
  </BaseComponentsCatalogPanel>
);
