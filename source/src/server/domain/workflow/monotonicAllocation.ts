import { prisma, toId } from './prismaHelpers';
import type { PrismaTransactionClient } from './prismaHelpers';
import { WorkflowDomainError } from './errors';

/**
 * Monotonic allocation — doc 03 section 13 forbids computing the next value from the maximum
 * existing row plus one. Every counter is
 * allocated via the same compare-and-swap idiom as
 * `src/server/domain/jobs/jobRepository.ts::claimNextPendingJob`: read the current counter,
 * then `updateMany({ where: { id, counterColumn: readValue } })` — exactly one caller wins the
 * race, everyone else retries against the new value (bounded).
 */

const MAX_ALLOCATION_ATTEMPTS = 20;

const allocationInvariantError = (subject: string): WorkflowDomainError =>
  new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Monotonic allocation for ${subject} did not converge after ${MAX_ALLOCATION_ATTEMPTS} attempts.`);

export async function allocateNextRevisionNumber(workflowDefinitionId: number): Promise<number> {
  const id = toId(workflowDefinitionId);
  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const current = await prisma().workflowDefinition.findUniqueOrThrow({
      where: { id },
      select: { nextRevisionNumber: true },
    });
    const allocated = current.nextRevisionNumber;
    const result = await prisma().workflowDefinition.updateMany({
      where: { id, nextRevisionNumber: allocated },
      data: { nextRevisionNumber: { increment: 1 } },
    });
    if (result.count === 1) {
      return allocated;
    }
  }
  throw allocationInvariantError('WorkflowDefinition.nextRevisionNumber');
}

export async function allocateNextAttemptNumber(nodeInstanceId: number): Promise<number> {
  const id = toId(nodeInstanceId);
  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const current = await prisma().workflowNodeInstance.findUniqueOrThrow({
      where: { id },
      select: { nextAttemptNumber: true },
    });
    const allocated = current.nextAttemptNumber;
    const result = await prisma().workflowNodeInstance.updateMany({
      where: { id, nextAttemptNumber: allocated },
      data: { nextAttemptNumber: { increment: 1 } },
    });
    if (result.count === 1) {
      return allocated;
    }
  }
  throw allocationInvariantError('WorkflowNodeInstance.nextAttemptNumber');
}

export async function allocateNextTraceSequenceNumber(workflowInstanceId: number): Promise<number> {
  const id = toId(workflowInstanceId);
  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const current = await prisma().workflowInstance.findUniqueOrThrow({
      where: { id },
      select: { nextTraceSequenceNumber: true },
    });
    const allocated = current.nextTraceSequenceNumber;
    const result = await prisma().workflowInstance.updateMany({
      where: { id, nextTraceSequenceNumber: allocated },
      data: { nextTraceSequenceNumber: { increment: 1 } },
    });
    if (result.count === 1) {
      return allocated;
    }
  }
  throw allocationInvariantError('WorkflowInstance.nextTraceSequenceNumber');
}

/**
 * Slice 10 tx-aware variant — Doc 06 section 4 requires trace core evidence to be "committed
 * atomically" with the node/instance/attempt mutation it documents, so emission cannot go through
 * the implicit-client `allocateNextTraceSequenceNumber` above (which opens its own non-transactional
 * `prisma()` calls). Runs the identical CAS idiom against the caller-supplied transaction client
 * instead — no separate retry loop is needed here because the owning transaction already holds
 * whatever row locks its other statements acquired on the same `WorkflowInstance` row (every emitting
 * transaction reads/writes `WorkflowInstance` or a child row keyed off it before emitting), so a
 * concurrent CAS collision on `nextTraceSequenceNumber` inside the same transaction cannot happen;
 * `MAX_ALLOCATION_ATTEMPTS` retries remain as a defensive bound, matching the non-tx sibling.
 */
export async function allocateNextTraceSequenceNumberInTx(tx: PrismaTransactionClient, workflowInstanceId: number): Promise<number> {
  const id = toId(workflowInstanceId);
  for (let attempt = 0; attempt < MAX_ALLOCATION_ATTEMPTS; attempt += 1) {
    const current = await tx.workflowInstance.findUniqueOrThrow({
      where: { id },
      select: { nextTraceSequenceNumber: true },
    });
    const allocated = current.nextTraceSequenceNumber;
    const result = await tx.workflowInstance.updateMany({
      where: { id, nextTraceSequenceNumber: allocated },
      data: { nextTraceSequenceNumber: { increment: 1 } },
    });
    if (result.count === 1) {
      return allocated;
    }
  }
  throw allocationInvariantError('WorkflowInstance.nextTraceSequenceNumber (tx)');
}
