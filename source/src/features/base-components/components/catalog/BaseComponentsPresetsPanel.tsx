import React from 'react';
import type { BaseComponentOptionMeta } from '../../catalog/baseComponentOptionTypes';
import { BaseComponentsOptionsPanel } from './BaseComponentsOptionsPanel';

export const BaseComponentsPresetsPanel: React.FC<{
  options: readonly BaseComponentOptionMeta[];
}> = ({ options }) => (
  <BaseComponentsOptionsPanel
    title="Presets"
    summary="Named bundles capture coherent use cases without expanding the runtime prop surface."
    options={options.filter((option) => option.axis === 'preset')}
  />
);
