import React from 'react';
import { FieldHintTooltip } from '../../../shared/ui/FieldHintTooltip';

type SettingsNavScopeHintProps = {
  hint: string;
  label: string;
  contentClassName?: string;
};

/** Settings alias for the shared HeroUI field hint tooltip. */
export const SettingsNavScopeHint: React.FC<SettingsNavScopeHintProps> = ({
  hint,
  label,
  contentClassName,
}) => (
  <FieldHintTooltip hint={hint} label={label} contentClassName={contentClassName} />
);
