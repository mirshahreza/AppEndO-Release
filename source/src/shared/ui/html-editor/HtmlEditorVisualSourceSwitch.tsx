import React from 'react';
import { Code2 } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AppButton } from '../AppButton';

type HtmlEditorSourceToggleProps = {
  sourceActive: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
};

/** Single source-mode toggle (off = visual, on = HTML source). */
export const HtmlEditorSourceToggle: React.FC<HtmlEditorSourceToggleProps> = ({
  sourceActive,
  onToggle,
  disabled = false,
  className,
}) => (
  <AppButton
    type="button"
    intent={sourceActive ? 'toggle-on' : 'toggle-off'}
    size="icon-sm"
    className={cn('h-7 w-7 min-h-7 min-w-7 p-0', className)}
    aria-label={sourceActive ? 'Source mode on' : 'Source mode off'}
    aria-pressed={sourceActive}
    title={sourceActive ? 'Switch to visual editor' : 'Switch to HTML source'}
    disabled={disabled}
    onClick={(event) => {
      event.preventDefault();
      event.stopPropagation();
      onToggle();
    }}
  >
    <Code2 className="h-3.5 w-3.5" />
  </AppButton>
);
