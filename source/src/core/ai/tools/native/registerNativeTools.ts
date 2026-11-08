import type { ToolRegistry } from '../ToolRegistry';
import { pruneToolObservationsTool } from './pruneToolObservations';
import {
  artifactListErrorsTool,
  artifactReadRangeTool,
  artifactSearchTool,
  artifactTailTool,
} from './toolOutputArtifactTools';
import { delegateResearchTool } from './delegateResearch';

/** Registers native tools not yet owned by a built-in capability pack (M2g migration). */
export const registerNativeTools = (registry: Pick<ToolRegistry, 'register'>): void => {
  registry.register(pruneToolObservationsTool);
  // V5 Phase P09 §15 — Large Output Defense query tools.
  registry.register(artifactReadRangeTool);
  registry.register(artifactTailTool);
  registry.register(artifactSearchTool);
  registry.register(artifactListErrorsTool);
  // p-98 §2.7 — subagent delegation.
  registry.register(delegateResearchTool);
};
