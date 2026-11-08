import React from 'react';
import { cn } from '../../../lib/utils';
import { DIALOG_BAND_CLASS, type DialogBandTone } from '../surfaceClasses';

export type DialogBandProps = {
  tone?: DialogBandTone;
  children: React.ReactNode;
  className?: string;
};

export const DialogBand: React.FC<DialogBandProps> = ({
  tone = 'muted',
  children,
  className,
}) => (
  <div className={cn(DIALOG_BAND_CLASS[tone], className)}>
    {children}
  </div>
);
