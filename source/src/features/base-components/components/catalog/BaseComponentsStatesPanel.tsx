import React from 'react';
import type {
  BaseComponentMeta,
  BaseComponentOptionMeta,
} from '../../catalog/baseComponentOptionTypes';
import {
  BaseComponentsCatalogPanel,
  BaseComponentsMetadataList,
} from './BaseComponentsCatalogPanel';
import { BaseComponentsOptionsPanel } from './BaseComponentsOptionsPanel';

export const BaseComponentsStatesPanel: React.FC<{
  component: BaseComponentMeta;
  options: readonly BaseComponentOptionMeta[];
}> = ({ component, options }) => (
  <div className="space-y-2">
    <BaseComponentsOptionsPanel
      title="States"
      options={options.filter((option) => option.axis === 'state')}
    />
    <BaseComponentsCatalogPanel title="Required scenarios">
      <BaseComponentsMetadataList items={component.requiredScenarios} />
    </BaseComponentsCatalogPanel>
  </div>
);
