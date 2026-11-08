import React from 'react';
import type { BaseComponentMeta } from '../../catalog/baseComponentOptionTypes';
import {
  BaseComponentsCatalogPanel,
  BaseComponentsMetadataList,
} from './BaseComponentsCatalogPanel';

export const BaseComponentsAntiOptionsPanel: React.FC<{
  component: BaseComponentMeta;
}> = ({ component }) => (
  <BaseComponentsCatalogPanel
    title="Anti-options"
    summary="These combinations are intentionally excluded from the supported contract."
  >
    <BaseComponentsMetadataList items={component.antiOptions} />
  </BaseComponentsCatalogPanel>
);
