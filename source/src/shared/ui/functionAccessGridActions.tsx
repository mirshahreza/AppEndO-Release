import React from 'react';
import { KeyRound } from 'lucide-react';
import { GRID_ACTION_ACCESS_CLASS } from './surfaceClasses';

/** Canonical Lucide icon for unified server function access from Users/Roles grids. */
export const FunctionAccessActionIconComponent = KeyRound;

export type FunctionAccessActionIconProps = {
  className?: string;
};

export const FunctionAccessActionIcon: React.FC<FunctionAccessActionIconProps> = ({
  className = 'h-3.5 w-3.5',
}) => <KeyRound className={className} aria-hidden="true" />;

export const FUNCTION_ACCESS_ACTION_ARIA_LABEL = 'Configure server function access';

export const GRID_ACTION_FUNCTION_ACCESS_BUTTON_CLASS = GRID_ACTION_ACCESS_CLASS;
