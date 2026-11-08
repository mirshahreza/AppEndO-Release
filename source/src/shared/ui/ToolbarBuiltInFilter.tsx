import React from 'react';
import { BUILTIN_FILTER_OPTIONS } from '../lib/builtInFilter';
import { ToolbarFilterSelect } from './ToolbarFilterSelect';

export type ToolbarBuiltInFilterProps = {
  value: string;
  onChange: (value: string) => void;
};

/** Shared BuiltIn origin filter — All / BuiltIn / Not BuiltIn. Do not mix into Kind. */
export const ToolbarBuiltInFilter: React.FC<ToolbarBuiltInFilterProps> = ({
  value,
  onChange,
}) => (
  <ToolbarFilterSelect
    value={value}
    onChange={onChange}
    ariaLabel="BuiltIn"
    allLabel="All"
    hint="Filter by whether the item is built-in. Independent of type."
    options={[...BUILTIN_FILTER_OPTIONS]}
  />
);
