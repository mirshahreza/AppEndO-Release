import React from 'react';
import { WorkflowsWorkspace } from './components/WorkflowsWorkspace';

/**
 * Workflows entry point — native authoring surface for workflow definitions (draft / validate /
 * publish / execute). Registered at `core:Workflows` / route `workflows` (Development nav group).
 */
export const WorkflowsPage: React.FC = () => <WorkflowsWorkspace />;
