import React from 'react';
import type { GridCompactCardsPerRow } from '../../../shared/lib/gridCompactViewport';
import type { GridCardBelowTier, GridPresentationMode } from '../../../shared/lib/appTableGridPresentation';
import type {
  GridPresentationFieldsConfig,
  GridPresentationInheritLayout,
  GridPresentationTriState,
  GridRowActionsFieldsConfig,
} from '../../../shared/lib/gridPresentationConfigBridge';
import {
  GridHeightField,
  GridPresentationFields,
  GridRowActionsFields,
} from '../../../shared/ui/GridPresentationFields';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  BASE_COMPONENTS_CONFIG_SECTION_TONE,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
} from '../baseComponentsConfiguratorLayout';
import { markBaseComponentsConfigSectionSource } from './baseComponentsConfigSectionSource';

export type CompactInheritLayout = GridPresentationInheritLayout;
export type CompactTriState = GridPresentationTriState;
/** TreeGrid stacked-row label chrome only — not used by AppTableGrid cards. */
export type CompactInheritLabels = 'inherit' | 'inline' | 'stacked' | 'hidden';
/** TreeGrid stacked-row action chrome only — AppTableGrid cards always use footer actions. */
export type CompactActionsPlacement = 'inherit' | 'footer' | 'header' | 'none';

/** Shared Presentation + Compact viewport fields for Grid and TreeGrid. */
export type BaseComponentsGridPresentationConfig = GridPresentationFieldsConfig;

export type BaseComponentsGridRowActionsConfig = GridRowActionsFieldsConfig;

type BaseComponentsGridPresentationFieldsProps = {
  variant?: 'grid' | 'tree';
  config: BaseComponentsGridPresentationConfig;
  onChange: (patch: Partial<BaseComponentsGridPresentationConfig>) => void;
  showPresentation?: boolean;
  showCompact?: boolean;
};

const GRID_PRESENTATION_CHROME = {
  fieldClassName: BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  selectClassName: BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  fieldsStackClassName: BASE_COMPONENTS_CONFIG_FIELDS_STACK_CLASS,
  sectionTone: BASE_COMPONENTS_CONFIG_SECTION_TONE,
  useSections: true,
} as const;

export const BaseComponentsGridPresentationFields: React.FC<BaseComponentsGridPresentationFieldsProps> = ({
  variant = 'grid',
  config,
  onChange,
  showPresentation = true,
  showCompact = true,
}) => (
  <GridPresentationFields
    variant={variant}
    config={config}
    onChange={onChange}
    showPresentation={showPresentation}
    showCompact={showCompact}
    chrome={GRID_PRESENTATION_CHROME}
  />
);
markBaseComponentsConfigSectionSource(BaseComponentsGridPresentationFields);
markBaseComponentsConfigSectionSource(GridPresentationFields);

export const BaseComponentsGridRowActionsFields: React.FC<{
  config: BaseComponentsGridRowActionsConfig;
  onChange: (patch: Partial<BaseComponentsGridRowActionsConfig>) => void;
}> = ({ config, onChange }) => (
  <GridRowActionsFields
    config={config}
    onChange={onChange}
    chrome={GRID_PRESENTATION_CHROME}
  />
);

export const BaseComponentsGridHeightField = ({
  fillHeight,
  onChange,
  ariaLabel,
}: {
  fillHeight: boolean;
  onChange: (fillHeight: boolean) => void;
  ariaLabel?: string;
}) => (
  <GridHeightField
    fillHeight={fillHeight}
    onChange={onChange}
    ariaLabel={ariaLabel}
    fieldClassName={BASE_COMPONENTS_CONFIG_FIELD_CLASS}
    selectClassName={BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS}
  />
);

export type {
  GridPresentationFieldsConfig,
  GridPresentationMode,
  GridCardBelowTier,
  GridCompactCardsPerRow,
};
