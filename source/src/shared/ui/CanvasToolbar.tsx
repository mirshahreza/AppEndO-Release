import React from 'react';
import { cn } from '../../lib/utils';
import { PAGE_GUIDE_EN } from '../../core/culture/translations/pageGuideEn';
import { pageGuideLocalProps } from './shell/pageGuide/pageGuideChrome';
import {
  CANVAS_TOOLBAR_ANCHOR_BASE_CLASS,
  CANVAS_TOOLBAR_ANCHOR_POSITION_CLASS,
  CANVAS_TOOLBAR_GROUP_ALIGN_BUTTONS_CLASS,
  CANVAS_TOOLBAR_GROUP_CLASS,
  CANVAS_TOOLBAR_GROUP_FULL_WIDTH_BUTTONS_CLASS,
  CANVAS_TOOLBAR_GROUP_ROW_CLASS,
  CANVAS_TOOLBAR_GROUP_STACK_CLASS,
  type CanvasToolbarPosition,
} from './surfaceClasses';

export type CanvasToolbarLayout = 'stack' | 'row';

export type CanvasToolbarGroupProps = {
  layout?: CanvasToolbarLayout;
  fullWidthButtons?: boolean;
  className?: string;
  children: React.ReactNode;
};

const toolbarGroupClassName = (
  layout: CanvasToolbarLayout,
  fullWidthButtons: boolean,
  className?: string,
) => cn(
  CANVAS_TOOLBAR_GROUP_CLASS,
  layout === 'stack' ? CANVAS_TOOLBAR_GROUP_STACK_CLASS : CANVAS_TOOLBAR_GROUP_ROW_CLASS,
  fullWidthButtons
    ? CANVAS_TOOLBAR_GROUP_FULL_WIDTH_BUTTONS_CLASS
    : CANVAS_TOOLBAR_GROUP_ALIGN_BUTTONS_CLASS,
  className,
);

/**
 * Bordered button cluster inside a {@link CanvasToolbar} anchor. Stack multiple groups in one
 * corner to separate unrelated actions (e.g. authoring vs secrets).
 */
export const CanvasToolbarGroup: React.FC<CanvasToolbarGroupProps> = ({
  layout = 'stack',
  fullWidthButtons = false,
  className,
  children,
}) => (
  <div
    className={toolbarGroupClassName(layout, fullWidthButtons, className)}
    data-layout={layout}
    data-full-width-buttons={fullWidthButtons}
  >
    {children}
  </div>
);

export type CanvasToolbarProps = {
  position: CanvasToolbarPosition;
  layout?: CanvasToolbarLayout;
  fullWidthButtons?: boolean;
  className?: string;
  groupClassName?: string;
  children: React.ReactNode;
};

function isToolbarGroup(child: React.ReactNode): child is React.ReactElement<CanvasToolbarGroupProps> {
  return React.isValidElement(child) && child.type === CanvasToolbarGroup;
}

/**
 * Floating toolbar group for canvas/workspace surfaces (workflow editor, designers, previews).
 * Pair multiple instances at different corners inside a `relative` host.
 */
export const CanvasToolbar: React.FC<CanvasToolbarProps> & {
  Group: typeof CanvasToolbarGroup;
} = ({
  position,
  layout = 'stack',
  fullWidthButtons = false,
  className,
  groupClassName,
  children,
}) => {
  const childArray = React.Children.toArray(children);
  const usesGroups = childArray.length > 0 && childArray.every(isToolbarGroup);

  return (
    <div
      className={cn(
        CANVAS_TOOLBAR_ANCHOR_BASE_CLASS,
        CANVAS_TOOLBAR_ANCHOR_POSITION_CLASS[position],
        className,
      )}
      data-position={position}
      {...pageGuideLocalProps(
        PAGE_GUIDE_EN['pageGuide.chrome.canvasToolbar.title'],
        PAGE_GUIDE_EN['pageGuide.chrome.canvasToolbar.hint'],
        28,
      )}
    >
      {usesGroups ? (
        children
      ) : (
        <div
          className={toolbarGroupClassName(layout, fullWidthButtons, groupClassName)}
          data-layout={layout}
          data-full-width-buttons={fullWidthButtons}
        >
          {children}
        </div>
      )}
    </div>
  );
};

CanvasToolbar.Group = CanvasToolbarGroup;
