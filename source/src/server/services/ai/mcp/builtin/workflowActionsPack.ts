import type { BuiltinCapabilityPackRegistrar } from './types';
import { createWorkflowActionsTools } from './workflowActionsTools';

/** appendo-workflow — list_workflow_actions · invoke_workflow_action (p-99/WFT-4). */
export const registerWorkflowActionsPackTools: BuiltinCapabilityPackRegistrar = (registry) => {
  createWorkflowActionsTools().forEach((tool) => registry.register(tool));
};
