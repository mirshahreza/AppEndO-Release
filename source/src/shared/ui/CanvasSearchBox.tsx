import React from 'react';
import { cn } from '../../lib/utils';
import { AppSearchBox, type AppSearchBoxProps } from './AppSearchBox';
import {
  CANVAS_SEARCH_BOX_CLASS,
  CANVAS_TOOLBAR_ANCHOR_BASE_CLASS,
  CANVAS_TOOLBAR_ANCHOR_POSITION_CLASS,
} from './surfaceClasses';

/**
 * Canvas overlay search — always top-left, always AppSearchBox.
 * Zoom stays bottom-left; layout stays bottom-right; other buttons stay top-right.
 */
export const CanvasSearchBox: React.FC<AppSearchBoxProps> = ({
  className,
  ...props
}) => (
  <div
    className={cn(
      CANVAS_TOOLBAR_ANCHOR_BASE_CLASS,
      CANVAS_TOOLBAR_ANCHOR_POSITION_CLASS['top-left'],
    )}
    data-position="top-left"
    onPointerDown={(event) => event.stopPropagation()}
  >
    <AppSearchBox {...props} className={cn(CANVAS_SEARCH_BOX_CLASS, className)} />
  </div>
);
