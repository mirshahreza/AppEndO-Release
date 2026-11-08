import React from 'react';
import { Panel, useReactFlow, useStore, useViewport, type FitViewOptions, type PanelPosition } from '@xyflow/react';
import { CanvasViewportControls } from './CanvasViewportControls';
import {
  CANVAS_FLOW_CONTROLS_PANEL_CLASS,
  CANVAS_FLOW_FIT_VIEW_PADDING,
  CANVAS_FLOW_ZOOM_DURATION_MS,
} from './canvasFlowChrome';

export type CanvasFlowViewportControlsProps = {
  disabled?: boolean;
  fitViewOptions?: FitViewOptions;
  /** Skip the xyflow Panel wrapper when hosting inside another overlay. */
  embedded?: boolean;
  position?: PanelPosition;
};

/**
 * Workflow-editor viewport controls for every `@xyflow/react` canvas.
 * Must render as a child of `ReactFlow` (or inside `ReactFlowProvider`).
 * Lives at bottom-left. Search stays top-left; layout stays bottom-right.
 */
export const CanvasFlowViewportControls: React.FC<CanvasFlowViewportControlsProps> = ({
  disabled = false,
  fitViewOptions,
  embedded = false,
  position = 'bottom-left',
}) => {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const { zoom } = useViewport();
  const minZoom = useStore((state) => state.minZoom);
  const maxZoom = useStore((state) => state.maxZoom);

  const controls = (
    <CanvasViewportControls
      disabled={disabled}
      canZoomIn={zoom < maxZoom}
      canZoomOut={zoom > minZoom}
      onZoomIn={() => {
        void zoomIn({ duration: CANVAS_FLOW_ZOOM_DURATION_MS });
      }}
      onZoomOut={() => {
        void zoomOut({ duration: CANVAS_FLOW_ZOOM_DURATION_MS });
      }}
      onFitView={() => {
        void fitView({
          padding: CANVAS_FLOW_FIT_VIEW_PADDING,
          duration: CANVAS_FLOW_ZOOM_DURATION_MS,
          ...fitViewOptions,
        });
      }}
    />
  );

  if (embedded) {
    return controls;
  }

  return (
    <Panel position={position} className={CANVAS_FLOW_CONTROLS_PANEL_CLASS}>
      {controls}
    </Panel>
  );
};
