import * as React from 'react';
import { Loader2 } from 'lucide-react';

export type LoadingSpinnerProps = {
  className?: string;
  label?: string;
};

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  className = 'h-4 w-4 animate-spin text-slate-500',
  label = 'Loading',
}) => (
  <Loader2 className={className} aria-label={label} role="status" />
);
