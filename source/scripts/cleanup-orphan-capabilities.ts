/**
 * One-time / out-of-band sweep of leftover Edge models, Data APIs, and designer
 * artifacts after incomplete deletes. Safe to re-run.
 */
import { deleteDesignerDraft } from '../src/server/services/component-designer/draftCoordinator.service';
import { reconcileDeletedDesignerArtifacts } from '../src/server/services/component-designer/designerDeleteCleanup';
import {
  pruneEdgeModelsWithoutApis,
  reconcileDeletedEdgeCapabilities,
} from '../src/server/services/data-api/edgeCapabilityDeleteCleanup';
import { listDesignerDrafts } from '../src/server/domain/component-designer/drafts';
import { listEdgeModels } from '../src/server/services/data-api/edgeModelStore';
import { listEdgeApiDefinitions } from '../src/server/services/data-api/edgeApiStore';

const LEFTOVER_DRAFT_IDS = [
  'math-sum-two-numbers-calculator',
];

const beforeModels = listEdgeModels().length;
const beforeApis = listEdgeApiDefinitions().length;
const beforeDrafts = listDesignerDrafts().length;

for (const draftId of LEFTOVER_DRAFT_IDS) {
  const removed = deleteDesignerDraft(draftId);
  console.log(`designer draft ${draftId}: ${removed ? 'deleted' : 'not found'}`);
}

reconcileDeletedEdgeCapabilities();
const droppedModels = pruneEdgeModelsWithoutApis();
console.log(`unreferenced edge models removed: ${droppedModels}`);
reconcileDeletedDesignerArtifacts();

const afterModels = listEdgeModels().length;
const afterApis = listEdgeApiDefinitions().length;
const afterDrafts = listDesignerDrafts().length;

console.log(`edge models: ${beforeModels} -> ${afterModels}`);
console.log(`edge apis: ${beforeApis} -> ${afterApis}`);
console.log(`designer drafts: ${beforeDrafts} -> ${afterDrafts}`);
