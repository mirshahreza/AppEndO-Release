import React from 'react';
import { cn } from '../../../lib/utils';
import { useSurfaceChrome } from '../SurfaceChromeContext';
import { DIALOG_ACTION_FOOTER_LAYOUT_CLASS, DIALOG_AUXILIARY_FOOTER_LAYOUT_CLASS } from '../surfaceClasses';

export type DialogFooterVariant = 'auxiliary' | 'action';

export type DialogFooterProps = {
  variant?: DialogFooterVariant;
  /** When true, omits top spacing so this footer sits flush against the footer above. */
  stacked?: boolean;
  children: React.ReactNode;
  className?: string;
};

export const DialogFooter: React.FC<DialogFooterProps> = ({
  variant = 'action',
  stacked = false,
  children,
  className,
}) => {
  const chrome = useSurfaceChrome();
  const footerClassName = (() => {
    if (variant === 'auxiliary') {
      return cn(
        DIALOG_AUXILIARY_FOOTER_LAYOUT_CLASS,
        chrome.footer,
        !stacked && 'mt-2',
      );
    }
    return cn(
      DIALOG_ACTION_FOOTER_LAYOUT_CLASS,
      chrome.footer,
      !stacked && 'mt-2',
    );
  })();

  return (
    <div
      className={cn(footerClassName, className)}
      style={chrome.footerStyle}
    >
      {children}
    </div>
  );
};
