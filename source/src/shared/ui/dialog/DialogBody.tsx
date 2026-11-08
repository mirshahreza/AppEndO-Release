import React from 'react';
import { cn } from '../../../lib/utils';
import {
  CREATE_EDIT_MODAL_BODY_CLASS,
  CREATE_EDIT_MODAL_BODY_INNER_CLASS,
  DIALOG_BODY_OUTER_PLAIN_CLASS,
  DIALOG_BODY_OUTER_SCROLL_CLASS,
} from '../surfaceClasses';

export type DialogBodyProps = {
  children: React.ReactNode;
  /** When true, outer slot uses accent gradient; inner host stays pure white. */
  gradient?: boolean;
  /**
   * When true (default for gradient bodies), outer uses flex-1 + min-h-0 so tall shells scroll.
   * Short confirms pass `false` so body/footer are not collapsed by flex-1.
   */
  fill?: boolean;
  outerClassName?: string;
  innerClassName?: string;
};

export const DialogBody: React.FC<DialogBodyProps> = ({
  children,
  gradient = true,
  fill = gradient,
  outerClassName,
  innerClassName,
}) => (
  <div
    className={cn(
      gradient
        ? CREATE_EDIT_MODAL_BODY_CLASS
        : (fill ? DIALOG_BODY_OUTER_SCROLL_CLASS : DIALOG_BODY_OUTER_PLAIN_CLASS),
      outerClassName,
    )}
  >
    <div className={cn(CREATE_EDIT_MODAL_BODY_INNER_CLASS, innerClassName)}>{children}</div>
  </div>
);
