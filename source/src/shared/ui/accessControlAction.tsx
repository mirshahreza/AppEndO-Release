import React from 'react';
import { KeyRound } from 'lucide-react';

/** Canonical Lucide icon for opening `AccessControlModal` — do not substitute Shield/Lock/etc. */
export const AccessControlActionIconComponent = KeyRound;

export type AccessControlActionIconProps = {
  className?: string;
};

export const AccessControlActionIcon: React.FC<AccessControlActionIconProps> = ({
  className = 'h-3.5 w-3.5',
}) => <KeyRound className={className} aria-hidden="true" />;

export const ACCESS_CONTROL_ACTION_ARIA_LABEL = 'Configure access control';
