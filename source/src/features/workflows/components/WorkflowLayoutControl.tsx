import React from 'react';
import {
  CanvasGraphLayoutControl,
  type CanvasGraphLayoutControlProps,
} from '../../../shared/ui/CanvasGraphLayoutControl';
import type { WorkflowGraphLayoutMode } from '../lib/computeWorkflowGraphLayout';

type WorkflowLayoutControlProps = Omit<CanvasGraphLayoutControlProps, 'onApplyLayout' | 'activeMode'> & {
  activeMode?: WorkflowGraphLayoutMode | null;
  onApplyLayout: (mode: WorkflowGraphLayoutMode) => void;
};

/** @deprecated Prefer `CanvasGraphLayoutControl` from shared/ui — thin workflow alias. */
export const WorkflowLayoutControl: React.FC<WorkflowLayoutControlProps> = (props) => (
  <CanvasGraphLayoutControl {...props} />
);
