import React from 'react';
import { ConfigBoolField, type ConfigBoolFieldProps } from '../../../shared/ui/ConfigBoolField';
import {
  BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
} from '../baseComponentsConfiguratorLayout';

export type BaseComponentsConfigBoolFieldProps = Omit<
  ConfigBoolFieldProps,
  'fieldClassName' | 'selectClassName' | 'control'
> & {
  fieldClassName?: string;
  selectClassName?: string;
};

/** Yes/no select for Base Components property panels. */
export const BaseComponentsConfigBoolField: React.FC<BaseComponentsConfigBoolFieldProps> = ({
  fieldClassName = BASE_COMPONENTS_CONFIG_FIELD_CLASS,
  selectClassName = BASE_COMPONENTS_CONFIG_SPLIT_SELECT_CLASS,
  ...props
}) => (
  <ConfigBoolField
    fieldClassName={fieldClassName}
    selectClassName={selectClassName}
    control="select"
    {...props}
  />
);
