import * as React from 'react';
import { Check } from 'lucide-react';
import { cn } from '../../../lib/utils';
import { AppButton } from '../AppButton';
import { type ShellElementProps } from './shellFoundation';

export type ShellAccentOption = {
  value: string;
  label: string;
  swatchClassName: string;
};
export type ShellAccentControlProps = Omit<ShellElementProps<HTMLDivElement>, 'children'> & {
  value: string;
  onValueChange: (value: string) => void;
  options: readonly ShellAccentOption[];
  label?: string;
  disabled?: boolean;
};

export const ShellAccentControl = React.forwardRef<HTMLDivElement, ShellAccentControlProps>(function ShellAccentControl({
  value,
  onValueChange,
  options,
  label = 'Accent color',
  disabled = false,
  className,
  ...props
}, ref) {
  return (
    <div
      ref={ref}
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      data-shell-accent-control=""
      className={cn('flex flex-wrap items-center gap-1', className)}
      {...props}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <AppButton
            key={option.value}
            role="radio"
            aria-checked={selected}
            aria-label={option.label}
            disabled={disabled}
            onClick={() => onValueChange(option.value)}
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-full border-2 border-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus',
              option.swatchClassName,
              selected && 'border-foreground',
            )}
          >
            {selected ? <Check aria-hidden className="h-3.5 w-3.5 drop-shadow-sm" /> : null}
          </AppButton>
        );
      })}
    </div>
  );
});
