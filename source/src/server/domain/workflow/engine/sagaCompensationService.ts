import { logger } from '../../../../core/logging/Logger';
import { prisma } from '../prismaHelpers';
import { getWorkflowInstanceById } from '../workflowInstanceRepository';
import { getWorkflowRevisionById } from '../workflowRevisionRepository';
import { listTraceByInstance } from '../workflowTraceRepository';
import { resolveActionProviderForNode } from './attemptService';
import { resolveWorkflowSecretFromEnv, applySecretReferenceFields } from './secretResolution';
import { evaluateMapping } from './expressionEvaluator';
import { buildEvaluationContext, loadNodeOutputsForInstance, parseJsonOrNull, parseVariables } from './evaluationContext';
import { emitTraceAutoRevision } from './traceEmission';
import type { WorkflowModel, ActionNodeDefinition, JsonValue } from '../awm/types';

/**
 * WFV2-14 — Saga/compensation (F-6: "a successfully-completed parallel branch's real side effect is
 * never undone when a sibling branch fails the whole instance"). Once an instance is FAILED, walks
 * every SUCCEEDED ACTION node that declared a `compensation` block, in LIFO order (reverse
 * completion order, reconstructed from the already-durable `ACTION_ATTEMPT_SUCCEEDED` trace
 * sequence — doc03 section 13's monotonic allocator already gives an exact, gap-free completion
 * order for free, no new bookkeeping needed), and invokes each compensation Action once.
 *
 * Deliberately synchronous/best-effort, triggered as a follow-up step right after the instance-fail
 * transaction commits (`applyFailInstanceContinuation`/`applyAttemptUnhandledFailureContinuation`),
 * not a durable background scanner: a crash between the instance failing and this pass running means
 * that specific failure's compensation never runs automatically — a documented V1 scope boundary, the
 * same kind of honest trade-off `ForEachNodeDefinition`'s in-process execution already makes. A
 * future revision could add a durable "compensation pending" marker + scanner if this proves
 * insufficient in practice. The function itself IS safe to call again by hand in the meantime — it
 * skips any node that already has a `COMPENSATION_STARTED` trace, so a manual re-run (or a future
 * scanner) never double-invokes the same compensation and duplicates the very side effect this
 * feature exists to undo.
 *
 * Scope boundary: only ACTION nodes' `compensation` is honored (not FOR_EACH's per-item actions, and
 * not a SUBFLOW-cascaded failure originating from `subflowContinuationApply.ts`'s own instance-fail
 * transaction, which does not call this) — both are real, carried-forward gaps for a later session.
 */
export async function runSagaCompensationForFailedInstance(workflowInstanceId: number): Promise<{ compensated: number; failed: number }> {
  const instance = await getWorkflowInstanceById(workflowInstanceId);
  if (!instance || instance.status !== 'FAILED') return { compensated: 0, failed: 0 };

  const revision = await getWorkflowRevisionById(instance.workflowRevisionId);
  if (!revision) return { compensated: 0, failed: 0 };
  const model = JSON.parse(revision.definitionJson) as WorkflowModel;

  const traces = await listTraceByInstance(workflowInstanceId);

  // Idempotency guard: a COMPENSATION_STARTED row already exists for a node the moment this pass
  // begins invoking its compensation (emitted before the executor call, see below) — never invoke
  // the same node's compensation twice, whether this function is re-entered after a crash or, as
  // here, simply called again (compensation running twice would itself duplicate a side effect,
  // exactly what this whole feature exists to prevent).
  const alreadyCompensated = new Set<string>();
  for (const trace of traces) {
    if (trace.traceType !== 'COMPENSATION_STARTED') continue;
    const evidence = JSON.parse(trace.coreEvidenceJson) as { compensatedNodeKey?: string };
    if (evidence.compensatedNodeKey) alreadyCompensated.add(evidence.compensatedNodeKey);
  }

  const succeededActionNodeKeysLifo: string[] = [];
  const seen = new Set<string>();
  for (let i = traces.length - 1; i >= 0; i -= 1) {
    const trace = traces[i];
    if (trace.traceType !== 'ACTION_ATTEMPT_SUCCEEDED') continue;
    const evidence = JSON.parse(trace.coreEvidenceJson) as { nodeKey?: string };
    const nodeKey = evidence.nodeKey;
    if (!nodeKey || seen.has(nodeKey) || alreadyCompensated.has(nodeKey)) continue;
    seen.add(nodeKey);
    succeededActionNodeKeysLifo.push(nodeKey);
  }

  const compensableNodes = succeededActionNodeKeysLifo
    .map((key) => model.nodes.find((n) => n.key === key))
    .filter((n): n is ActionNodeDefinition => !!n && n.kind === 'ACTION' && !!n.compensation);

  if (compensableNodes.length === 0) return { compensated: 0, failed: 0 };

  const workflowInput = parseJsonOrNull(instance.inputJson);
  const variables = parseVariables(instance.contextJson);
  const nodeOutputs = await loadNodeOutputsForInstance(workflowInstanceId);
  const evaluationContext = buildEvaluationContext({ workflowInput, variables, nodeOutputs, currentNodeInput: null });

  let compensated = 0;
  let failed = 0;
  for (const node of compensableNodes) {
    const compensation = node.compensation!;
    const provider = resolveActionProviderForNode(compensation.actionRef);
    await prisma().$transaction(async (tx) => {
      await emitTraceAutoRevision(tx, {
        workflowInstanceId,
        traceType: 'COMPENSATION_STARTED',
        actorType: 'SYSTEM',
        corePayload: { compensatedNodeKey: node.key, actionKey: provider.actionKey, actionVersion: provider.actionVersion },
      });
    });

    try {
      const config = evaluateMapping(compensation.config, evaluationContext);
      const input = evaluateMapping(compensation.input, evaluationContext);
      let resolvedConfig: JsonValue = config;
      let resolvedInput: JsonValue = input;
      if (provider.secretReferenceFields.length > 0) {
        const substituted = await applySecretReferenceFields({ config, actionInput: input, secretReferenceFields: provider.secretReferenceFields, resolveSecret: resolveWorkflowSecretFromEnv });
        resolvedConfig = substituted.config;
        resolvedInput = substituted.actionInput;
      }
      const result = await provider.executor.execute(
        {
          workflowInstanceId: String(workflowInstanceId),
          nodeInstanceId: `compensation:${node.key}`,
          logicalInvocationId: `compensation:${workflowInstanceId}:${node.key}`,
          idempotencyKey: `compensation:${workflowInstanceId}:${node.key}`,
          effectiveIdentity: { type: 'SYSTEM', id: null },
          cancellationSignal: new AbortController().signal,
          resolveSecret: resolveWorkflowSecretFromEnv,
          logger: { info: () => {}, warn: () => {}, error: () => {} },
          writeTraceMetadata: () => {},
        },
        resolvedConfig,
        resolvedInput,
      );

      if (result.status === 'SUCCEEDED') {
        compensated += 1;
        await prisma().$transaction(async (tx) => {
          await emitTraceAutoRevision(tx, {
            workflowInstanceId,
            traceType: 'COMPENSATION_SUCCEEDED',
            actorType: 'SYSTEM',
            corePayload: { compensatedNodeKey: node.key, actionKey: provider.actionKey, actionVersion: provider.actionVersion },
          });
        });
      } else {
        failed += 1;
        logger.error('SagaCompensation', `Compensation for node "${node.key}" (instance ${workflowInstanceId}) failed: ${result.safeMessage}`, { workflowInstanceId, nodeKey: node.key });
        await prisma().$transaction(async (tx) => {
          await emitTraceAutoRevision(tx, {
            workflowInstanceId,
            traceType: 'COMPENSATION_FAILED',
            actorType: 'SYSTEM',
            corePayload: { compensatedNodeKey: node.key, actionKey: provider.actionKey, actionVersion: provider.actionVersion, errorCode: result.errorCode, safeMessage: result.safeMessage },
          });
        });
      }
    } catch (error) {
      failed += 1;
      const safeMessage = error instanceof Error ? error.message : 'Compensation executor raised an unexpected exception.';
      logger.error('SagaCompensation', `Compensation for node "${node.key}" (instance ${workflowInstanceId}) threw: ${safeMessage}`, { workflowInstanceId, nodeKey: node.key });
      await prisma().$transaction(async (tx) => {
        await emitTraceAutoRevision(tx, {
          workflowInstanceId,
          traceType: 'COMPENSATION_FAILED',
          actorType: 'SYSTEM',
          corePayload: { compensatedNodeKey: node.key, actionKey: provider.actionKey, actionVersion: provider.actionVersion, errorCode: 'WF_EXEC_ACTION_OUTPUT_INVALID', safeMessage },
        });
      });
    }
  }

  await prisma().$transaction(async (tx) => {
    await emitTraceAutoRevision(tx, {
      workflowInstanceId,
      traceType: 'SAGA_COMPENSATION_COMPLETED',
      actorType: 'SYSTEM',
      corePayload: { compensatedCount: compensated, failedCount: failed },
    });
  });

  return { compensated, failed };
}
