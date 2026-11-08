import React from 'react';
import { ConfigBoolField, type ConfigBoolFieldProps } from './ConfigBoolField';

export type CrudSetConfigCheckboxProps = Omit<ConfigBoolFieldProps, 'control'> & {
  control?: ConfigBoolFieldProps['control'];
};

/** Boolean field for CRUD Set configurators (yes/no select) and RecordForm bodies (checkbox). */
export const CrudSetConfigCheckbox: React.FC<CrudSetConfigCheckboxProps> = (props) => (
  <ConfigBoolField {...props} />
);
