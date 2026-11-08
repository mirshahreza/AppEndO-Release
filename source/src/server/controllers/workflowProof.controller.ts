import type { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { buildDeterministicProofForInstance } from '../domain/workflow/proofProjection';
import { handleWorkflowError } from './workflowTransportSupport';

/**
 * `WorkflowProofQueryService` (doc 02 section 13) — "Get ordered typed Proof projection from
 * WorkflowTrace registry." Admin-only: Proof is audit/operator evidence, not an end-user Work Item
 * field, and doc 09 section 4's authorized-scope model (which would let a non-admin see Proof for
 * only their own instances) is not implemented, same carried-forward gap as every prior slice.
 */
export class WorkflowProofController {
  getProof = asyncHandler(async (req: Request, res: Response) => {
    const entries = await buildDeterministicProofForInstance(Number(req.params.instanceId));
    res.json({ success: true, entries });
  }, 'Failed to load Workflow Proof.', { onError: handleWorkflowError });
}
