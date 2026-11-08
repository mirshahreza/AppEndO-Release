import React from 'react';
import type { BaseComponentOptionMeta } from '../../catalog/baseComponentOptionTypes';
import { BaseComponentsOptionsPanel } from './BaseComponentsOptionsPanel';

export const BaseComponentsResponsivePanel: React.FC<{
  options: readonly BaseComponentOptionMeta[];
}> = ({ options }) => (
  <BaseComponentsOptionsPanel
    title="Responsive"
    summary="Responsive transformations identify whether the component or its composition owns adaptation."
    options={options.filter(
      (option) => option.axis === 'responsive' || option.responsiveOwner !== 'none',
    )}
  />
);
