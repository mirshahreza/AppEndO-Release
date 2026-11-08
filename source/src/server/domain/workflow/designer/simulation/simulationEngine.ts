import { WorkflowDomainError } from '../../errors';
import type { JsonValue, WorkflowModel, WorkflowNodeDefinition } from '../../awm/types';
import type { EvaluationContext } from '../../engine/expressionEvaluator';
import { evaluateExpression, evaluateMapping } from '../../engine/expressionEvaluator';
import {
  outgoingEdgesOf,
  successEdgeOf,
  errorEdgeOf,
  cancelRegionEdgeOf,
  evaluateDecisionNode,
  evaluateSwitchNode,
  evaluateEndNode,
  evaluateFailNode,
  evaluateParallelSplitNode,
  evaluateParallelJoinNode,
  evaluateWorkItemCreation,
  evaluateForEachItems,
  evaluateForEachJoinSatisfied,
  applyOutputAssignments,
  describeEdgeSelection,
  evaluateBooleanExpression,
  type ForEachItemResult,
} from '../../engine/nodeExecution';
import { resolveSplitJoin } from '../../engine/parallelResolution';
import {
  resolveExactProviderWithPackages as resolveExactProvider,
  resolveCapabilityProviderWithPackages as resolveCapabilityProvider,
} from '../../actions/actionResolutionWithPackages';
import type { ResolvedActionNodeBinding } from '../../publication/validationTypes';
import type { ActionExecutorContext } from '../../actions/types';
import { canExecuteLiveUnderSimulationPolicy } from './simulationFixtures';
import type { WorkflowSimulationFixtureSet, NodeSimulationFixture, SimulationEvidenceEntry, SimulationExecutionResult, SimulationExecutionOutcome } from './simulationTypes';

/**
 * Simulation execution interpreter — doc 11 section 1 item 11d, doc 09 section 5 (side-effect
 * fence), doc 08 section 8 (FULL/NODE/FROM_NODE). Deliberately a SEPARATE code path from
 * `engine/dispatchService.ts`/`continuationApply.ts`, not a "simulation flag" threaded through the
 * durable engine — the durable engine's every dispatch/completion function is a Postgres
 * transaction that mutates real `WorkflowInstance`/`WorkflowNodeInstance`/`WorkflowWait`/`WorkItem`
 * rows by construction; branching that same code on a boolean would make "is this call real" a
 * runtime condition deep inside atomic commit logic, which is exactly the kind of accidental
 * production side effect doc 09 section 5's fence exists to prevent. This module reuses only the
 * PURE, no-I/O evaluation layer those transactions are themselves built on
 * (`expressionEvaluator.ts`, `nodeExecution.ts`'s pure evaluators, `parallelResolution.ts`) and
 * substitutes an explicit fixture for every node kind whose real completion is externally decided
 * (ACTION/WAIT_EVENT/WORK_ITEM/SUBFLOW) — no durable row of any kind is read or written by this
 * module. `WorkflowSimulationRun`/its evidence are the only persistence this feature performs, and
 * that persistence happens one layer up, in `workflowSimulationService.ts`.
 */

export type SimulationStartContext = { workflowInput: JsonValue; variables: Record<string, JsonValue>; nodeOutputs: Record<string, JsonValue> };

const MAX_SIMULATION_STEPS = 500;

class SimulationCursor {
  sequence = 0;

  steps = 0;

  readonly evidence: SimulationEvidenceEntry[] = [];

  record(entry: Omit<SimulationEvidenceEntry, 'sequence' | 'simulation'>): void {
    this.sequence += 1;
    this.evidence.push({ ...entry, sequence: this.sequence, simulation: true });
  }

  step(nodeKey: string): void {
    this.steps += 1;
    if (this.steps > MAX_SIMULATION_STEPS) {
      throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Simulation exceeded ${MAX_SIMULATION_STEPS} steps without reaching a terminal node (at "${nodeKey}") — a validated model should be acyclic; this indicates a validator gap, not a legitimate long-running simulation.`, { nodeKey });
    }
  }
}

const findNode = (model: WorkflowModel, nodeKey: string): WorkflowNodeDefinition => {
  const node = model.nodes.find((n) => n.key === nodeKey);
  if (!node) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Simulation cannot find node "${nodeKey}" in the resolved model.`, { nodeKey });
  return node;
};

const findEdge = (model: WorkflowModel, edgeKey: string) => {
  const edge = model.edges.find((e) => e.key === edgeKey);
  if (!edge) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Simulation cannot find edge "${edgeKey}" in the resolved model.`, { edgeKey });
  return edge;
};

type NodeDataSnapshot = {
  received?: JsonValue;
  config?: JsonValue;
  produced?: JsonValue;
  status: 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  errorCode?: string;
  errorClass?: string;
  safeMessage?: string;
};

const recordNodeDataSnapshot = (cursor: SimulationCursor, node: WorkflowNodeDefinition, snapshot: NodeDataSnapshot): void => {
  cursor.record({
    type: 'NODE_DATA_RECORDED',
    nodeKey: node.key,
    detail: {
      kind: node.kind,
      received: snapshot.received ?? null,
      config: snapshot.config ?? null,
      produced: snapshot.produced ?? null,
      status: snapshot.status,
      errorCode: snapshot.errorCode ?? null,
      errorClass: snapshot.errorClass ?? null,
      safeMessage: snapshot.safeMessage ?? null,
    },
  });
};

const syntheticActionExecutorContext = (nodeKey: string, cursor: SimulationCursor): ActionExecutorContext => ({
  workflowInstanceId: 'SIMULATION',
  nodeInstanceId: `SIMULATION:${nodeKey}`,
  logicalInvocationId: `SIMULATION:${nodeKey}:${cursor.sequence}`,
  idempotencyKey: `SIMULATION:${nodeKey}:${cursor.sequence}`,
  effectiveIdentity: { type: 'SYSTEM', id: null },
  cancellationSignal: new AbortController().signal,
  resolveSecret: async () => {
    throw new WorkflowDomainError('WF_DEF_MISSING_CANONICAL_PLATFORM_CONTRACT', 'Simulation cannot resolve secrets — only PURE, zero-secret-field Actions may execute live under simulation policy (doc 09 section 5).', { nodeKey });
  },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  writeTraceMetadata: () => {},
});

async function resolveActionOutcome(
  node: Extract<WorkflowNodeDefinition, { kind: 'ACTION' }>,
  input: JsonValue,
  config: JsonValue,
  fixture: NodeSimulationFixture | undefined,
  cursor: SimulationCursor,
): Promise<{ status: 'SUCCEEDED'; output: JsonValue } | { status: 'FAILED'; errorCode: string; errorClass: string; safeMessage: string }> {
  if (fixture) {
    if (fixture.kind === 'ACTION_RESULT') {
      cursor.record({ type: 'ACTION_FIXTURE_APPLIED', nodeKey: node.key, detail: { output: fixture.output } });
      return { status: 'SUCCEEDED', output: fixture.output };
    }
    if (fixture.kind === 'ACTION_FAILURE') {
      cursor.record({ type: 'ACTION_FIXTURE_APPLIED', nodeKey: node.key, detail: { errorCode: fixture.errorCode, errorClass: fixture.errorClass, safeMessage: fixture.safeMessage } });
      return { status: 'FAILED', errorCode: fixture.errorCode, errorClass: fixture.errorClass, safeMessage: fixture.safeMessage };
    }
    throw new WorkflowDomainError('WF_SIM_MISSING_FIXTURE', `Node "${node.key}" (ACTION) has a fixture of the wrong kind — expected ACTION_RESULT or ACTION_FAILURE.`, { nodeKey: node.key });
  }

  const actionRef = node.actionRef.action;
  if (!canExecuteLiveUnderSimulationPolicy(actionRef.actionKey, actionRef.actionVersion)) {
    throw new WorkflowDomainError('WF_SIM_MISSING_FIXTURE', `Node "${node.key}" has no simulation fixture and is not an approved PURE/safe Action eligible for live execution under simulation policy (doc 09 section 5).`, { nodeKey: node.key, actionRef });
  }

  const provider =
    node.actionRef.type === 'EXACT_PROVIDER'
      ? resolveExactProvider(actionRef.actionKey, actionRef.actionVersion, node.actionRef.providerId, node.actionRef.providerVersion)
      : resolveCapabilityProvider(actionRef.actionKey, actionRef.actionVersion, node.actionRef.requiredCapabilities, () => true).winner;

  const result = await provider.executor.execute(syntheticActionExecutorContext(node.key, cursor), config, input);
  cursor.record({ type: 'ACTION_LIVE_PURE_EXECUTED', nodeKey: node.key, detail: { actionRef: actionRef as unknown as JsonValue, result: result as unknown as JsonValue } });
  return result;
}

/**
 * Walks the graph from `startNodeKey` with `startContext` until a terminal node (END/FAIL) or an
 * unresolvable node (missing fixture) is reached. Recurses into PARALLEL_SPLIT branches
 * deterministically in declared-edge order (real concurrent-arrival races have no meaning in a
 * single synchronous fixture-driven walk — see module doc comment) and merges each branch's
 * resulting variables/node outputs before continuing past the join.
 */
async function walk(model: WorkflowModel, actionBindings: readonly ResolvedActionNodeBinding[], fixtureSet: WorkflowSimulationFixtureSet, startNodeKey: string, startContext: SimulationStartContext, cursor: SimulationCursor, limitStopAtNode?: string): Promise<{ outcome: SimulationExecutionOutcome; finalContext: SimulationStartContext }> {
  let variables = { ...startContext.variables };
  let nodeOutputs = { ...startContext.nodeOutputs };
  let currentNodeKey = startNodeKey;
  let currentNodeInput: JsonValue = null;

  for (;;) {
    cursor.step(currentNodeKey);
    if (limitStopAtNode && currentNodeKey === limitStopAtNode) {
      return { outcome: { status: 'STOPPED_AT_NODE', nodeKey: currentNodeKey }, finalContext: { workflowInput: startContext.workflowInput, variables, nodeOutputs } };
    }
    const node = findNode(model, currentNodeKey);
    cursor.record({ type: 'NODE_ENTERED', nodeKey: node.key, detail: { kind: node.kind } });

    const baseContext: EvaluationContext = { workflowInput: startContext.workflowInput, variables, nodeOutputs, currentNodeInput };

    switch (node.kind) {
      case 'ACTION': {
        const config = evaluateMapping(node.config, baseContext);
        const input = evaluateMapping(node.input, baseContext);
        const fixture = fixtureSet.fixtures[node.key];
        const result = await resolveActionOutcome(node, input, config, fixture, cursor);
        if (result.status === 'FAILED') {
          // WFV2-1 — a simulated ACTION_FAILURE fixture follows the node's own ON_ERROR edge, same
          // as the real engine, when the author declared one; falls back to instance failure only
          // when there isn't one, matching `dispatchService.ts`'s dispatchActionNode exactly.
          const errorOutput: JsonValue = { errorCode: result.errorCode, errorClass: result.errorClass, safeMessage: result.safeMessage, isTimeout: false };
          const errorEdge = errorEdgeOf(model, node.key);
          if (errorEdge) {
            nodeOutputs = { ...nodeOutputs, [node.key]: errorOutput };
            variables = applyOutputAssignments(node.outputAssignments, { ...baseContext, nodeOutputs }, node.key, errorOutput);
            recordNodeDataSnapshot(cursor, node, {
              received: input,
              config,
              produced: errorOutput,
              status: 'FAILED',
              errorCode: result.errorCode,
              errorClass: result.errorClass,
              safeMessage: result.safeMessage,
            });
            cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { edgeKey: errorEdge.key, selectionMode: 'ON_ERROR', selectionReason: 'ACTION failure caught by ON_ERROR edge' } });
            currentNodeKey = errorEdge.toNodeKey;
            currentNodeInput = null;
            continue;
          }
          recordNodeDataSnapshot(cursor, node, {
            received: input,
            config,
            produced: errorOutput,
            status: 'FAILED',
            errorCode: result.errorCode,
            errorClass: result.errorClass,
            safeMessage: result.safeMessage,
          });
          return { outcome: { status: 'FAILED', errorCode: result.errorCode, safeMessage: result.safeMessage }, finalContext: { workflowInput: startContext.workflowInput, variables, nodeOutputs } };
        }
        nodeOutputs = { ...nodeOutputs, [node.key]: result.output };
        variables = applyOutputAssignments(node.outputAssignments, { ...baseContext, nodeOutputs }, node.key, result.output);
        recordNodeDataSnapshot(cursor, node, { received: input, config, produced: result.output, status: 'SUCCEEDED' });
        const edge = successEdgeOf(model, node.key);
        if (!edge) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `ACTION node "${node.key}" has no UNCONDITIONAL outgoing edge — publication should have rejected this shape.`, { nodeKey: node.key });
        cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { edgeKey: edge.key, ...describeEdgeSelection(edge) } });
        currentNodeKey = edge.toNodeKey;
        currentNodeInput = null;
        continue;
      }

      case 'FOR_EACH': {
        // WFV2-2 — simulation has no meaningful "fixture" shape for a runtime-dynamic-length item
        // array, so a FOR_EACH node's actionRef must be an approved PURE/safe Action to simulate at
        // all (same doc09 section 5 exemption ACTION's fixture-free live-execution path already
        // uses) — a non-pure per-item action is an honest, documented simulation gap, not faked.
        const actionRef = node.actionRef.action;
        if (!canExecuteLiveUnderSimulationPolicy(actionRef.actionKey, actionRef.actionVersion)) {
          throw new WorkflowDomainError('WF_SIM_MISSING_FIXTURE', `FOR_EACH node "${node.key}" is not an approved PURE/safe Action eligible for simulation (doc 09 section 5) — FOR_EACH has no per-item fixture shape in V1.`, { nodeKey: node.key, actionRef });
        }
        const items = evaluateForEachItems(node, baseContext, 1000);
        const provider =
          node.actionRef.type === 'EXACT_PROVIDER'
            ? resolveExactProvider(actionRef.actionKey, actionRef.actionVersion, node.actionRef.providerId, node.actionRef.providerVersion)
            : resolveCapabilityProvider(actionRef.actionKey, actionRef.actionVersion, node.actionRef.requiredCapabilities, () => true).winner;
        const config = evaluateMapping(node.config, baseContext);
        const results: ForEachItemResult[] = [];
        for (let i = 0; i < items.length; i += 1) {
          const itemContext: EvaluationContext = { ...baseContext, currentItem: items[i], currentItemIndex: i };
          const itemInput = evaluateMapping(node.input, itemContext);
          const result = await provider.executor.execute(syntheticActionExecutorContext(`${node.key}[${i}]`, cursor), config, itemInput);
          results.push(result.status === 'SUCCEEDED' ? { index: i, status: 'SUCCEEDED', output: result.output } : { index: i, status: 'FAILED', errorCode: result.errorCode, errorClass: result.errorClass, safeMessage: result.safeMessage });
        }
        cursor.record({ type: 'FOR_EACH_EXECUTED', nodeKey: node.key, detail: { totalItems: items.length, succeededCount: results.filter((r) => r.status === 'SUCCEEDED').length } });

        const satisfied = evaluateForEachJoinSatisfied(node, results);
        const outgoing = outgoingEdgesOf(model, node.key);
        if (!satisfied) {
          const errEdge = outgoing.find((e) => e.selector.type === 'ON_ERROR');
          if (errEdge) {
            nodeOutputs = { ...nodeOutputs, [node.key]: results as unknown as JsonValue };
            variables = applyOutputAssignments(node.outputAssignments, { ...baseContext, nodeOutputs }, node.key, results as unknown as JsonValue);
            recordNodeDataSnapshot(cursor, node, {
              received: items as unknown as JsonValue,
              config,
              produced: results as unknown as JsonValue,
              status: 'FAILED',
              errorCode: 'WF_EXEC_UNHANDLED_NODE_FAILURE',
              safeMessage: `FOR_EACH join policy (${node.joinMode}) was not satisfied.`,
            });
            cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { edgeKey: errEdge.key, selectionMode: 'ON_ERROR', selectionReason: 'FOR_EACH join policy not satisfied' } });
            currentNodeKey = errEdge.toNodeKey;
            currentNodeInput = null;
            continue;
          }
          recordNodeDataSnapshot(cursor, node, {
            received: items as unknown as JsonValue,
            config,
            produced: results as unknown as JsonValue,
            status: 'FAILED',
            errorCode: 'WF_EXEC_UNHANDLED_NODE_FAILURE',
            safeMessage: `FOR_EACH join policy (${node.joinMode}) was not satisfied.`,
          });
          return { outcome: { status: 'FAILED', errorCode: 'WF_EXEC_UNHANDLED_NODE_FAILURE', safeMessage: `FOR_EACH node "${node.key}" join policy (${node.joinMode}) was not satisfied.` }, finalContext: { workflowInput: startContext.workflowInput, variables, nodeOutputs } };
        }
        nodeOutputs = { ...nodeOutputs, [node.key]: results as unknown as JsonValue };
        variables = applyOutputAssignments(node.outputAssignments, { ...baseContext, nodeOutputs }, node.key, results as unknown as JsonValue);
        recordNodeDataSnapshot(cursor, node, {
          received: items as unknown as JsonValue,
          config,
          produced: results as unknown as JsonValue,
          status: 'SUCCEEDED',
        });
        const edge = successEdgeOf(model, node.key);
        if (!edge) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `FOR_EACH node "${node.key}" has no UNCONDITIONAL outgoing edge — publication should have rejected this shape.`, { nodeKey: node.key });
        cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { edgeKey: edge.key, ...describeEdgeSelection(edge) } });
        currentNodeKey = edge.toNodeKey;
        currentNodeInput = null;
        continue;
      }

      case 'LOOP': {
        const actionRef = node.actionRef.action;
        if (!canExecuteLiveUnderSimulationPolicy(actionRef.actionKey, actionRef.actionVersion)) {
          throw new WorkflowDomainError('WF_SIM_MISSING_FIXTURE', `LOOP node "${node.key}" is not an approved PURE/safe Action eligible for simulation — LOOP has no fixture shape in V1.`, { nodeKey: node.key, actionRef });
        }
        const provider =
          node.actionRef.type === 'EXACT_PROVIDER'
            ? resolveExactProvider(actionRef.actionKey, actionRef.actionVersion, node.actionRef.providerId, node.actionRef.providerVersion)
            : resolveCapabilityProvider(actionRef.actionKey, actionRef.actionVersion, node.actionRef.requiredCapabilities, () => true).winner;
        const config = evaluateMapping(node.config, baseContext);
        const maxIterations = Math.min(node.maxIterations ?? 25, 100);
        const results: ForEachItemResult[] = [];
        let previousOutput: JsonValue = null;
        let loopCaughtEdgeKey: string | null = null;
        let loopFail: { errorCode: string; safeMessage: string } | null = null;
        for (let i = 0; i < maxIterations; i += 1) {
          const itemContext: EvaluationContext = { ...baseContext, currentItem: previousOutput, currentItemIndex: i };
          if (!evaluateBooleanExpression(node.condition, itemContext)) break;
          const itemInput = evaluateMapping(node.input, itemContext);
          const result = await provider.executor.execute(syntheticActionExecutorContext(`${node.key}[${i}]`, cursor), config, itemInput);
          if (result.status !== 'SUCCEEDED') {
            results.push({ index: i, status: 'FAILED', errorCode: result.errorCode, errorClass: result.errorClass, safeMessage: result.safeMessage });
            const errEdge = outgoingEdgesOf(model, node.key).find((e) => e.selector.type === 'ON_ERROR');
            if (errEdge) loopCaughtEdgeKey = errEdge.key;
            else loopFail = { errorCode: 'WF_EXEC_UNHANDLED_NODE_FAILURE', safeMessage: `LOOP node "${node.key}" iteration ${i} failed.` };
            break;
          }
          previousOutput = result.output;
          results.push({ index: i, status: 'SUCCEEDED', output: result.output });
        }
        const produced = results as unknown as JsonValue;
        if (!loopCaughtEdgeKey && !loopFail) {
          const wouldContinue = evaluateBooleanExpression(node.condition, { ...baseContext, currentItem: previousOutput, currentItemIndex: results.length });
          if (results.length >= maxIterations && wouldContinue) {
            const errEdge = outgoingEdgesOf(model, node.key).find((e) => e.selector.type === 'ON_ERROR');
            if (errEdge) loopCaughtEdgeKey = errEdge.key;
            else loopFail = { errorCode: 'WF_EXEC_LOOP_LIMIT_EXCEEDED', safeMessage: `LOOP node "${node.key}" reached the iteration cap of ${maxIterations}.` };
          }
        }
        if (loopFail) {
          recordNodeDataSnapshot(cursor, node, { received: currentNodeInput, config, produced, status: 'FAILED', errorCode: loopFail.errorCode, safeMessage: loopFail.safeMessage });
          return { outcome: { status: 'FAILED', errorCode: loopFail.errorCode, safeMessage: loopFail.safeMessage }, finalContext: { workflowInput: startContext.workflowInput, variables, nodeOutputs } };
        }
        if (loopCaughtEdgeKey) {
          const errEdge = findEdge(model, loopCaughtEdgeKey);
          nodeOutputs = { ...nodeOutputs, [node.key]: produced };
          variables = applyOutputAssignments(node.outputAssignments, { ...baseContext, nodeOutputs }, node.key, produced);
          recordNodeDataSnapshot(cursor, node, { received: currentNodeInput, config, produced, status: 'FAILED', errorCode: 'WF_EXEC_UNHANDLED_NODE_FAILURE', safeMessage: 'LOOP did not complete successfully.' });
          cursor.record({ type: 'LOOP_EXECUTED', nodeKey: node.key, detail: { iterations: results.length, status: 'FAILED' } });
          cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { edgeKey: errEdge.key, selectionMode: 'ON_ERROR', selectionReason: 'LOOP iteration failed or cap reached' } });
          currentNodeKey = errEdge.toNodeKey;
          currentNodeInput = null;
          continue;
        }
        nodeOutputs = { ...nodeOutputs, [node.key]: produced };
        variables = applyOutputAssignments(node.outputAssignments, { ...baseContext, nodeOutputs }, node.key, produced);
        recordNodeDataSnapshot(cursor, node, { received: currentNodeInput, config, produced, status: 'SUCCEEDED' });
        cursor.record({ type: 'LOOP_EXECUTED', nodeKey: node.key, detail: { iterations: results.length } });
        const edge = successEdgeOf(model, node.key);
        if (!edge) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `LOOP node "${node.key}" has no UNCONDITIONAL outgoing edge — publication should have rejected this shape.`, { nodeKey: node.key });
        cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { edgeKey: edge.key, ...describeEdgeSelection(edge) } });
        currentNodeKey = edge.toNodeKey;
        currentNodeInput = null;
        continue;
      }

      case 'DECISION': {
        const decision = evaluateDecisionNode(node, outgoingEdgesOf(model, node.key), baseContext);
        if (decision.kind === 'START_PARALLEL') {
          const joinNodeKey = resolveSplitJoin(model, node.key);
          recordNodeDataSnapshot(cursor, node, {
            received: currentNodeInput,
            produced: { branchCount: decision.branches.length, joinNodeKey, selectionMode: 'MULTI_MATCH' },
            status: 'SUCCEEDED',
          });
          cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { branchCount: decision.branches.length, joinNodeKey, selectionMode: 'MULTI_MATCH' } });

          let mergedVariables = variables;
          let mergedNodeOutputs = nodeOutputs;
          for (const branch of decision.branches) {
            const edge = findEdge(model, branch.edgeKey);
            const branchResult = await walk(model, actionBindings, fixtureSet, edge.toNodeKey, { workflowInput: startContext.workflowInput, variables: mergedVariables, nodeOutputs: mergedNodeOutputs }, cursor, joinNodeKey);
            if (branchResult.outcome.status !== 'STOPPED_AT_NODE') {
              return branchResult;
            }
            mergedVariables = branchResult.finalContext.variables;
            mergedNodeOutputs = branchResult.finalContext.nodeOutputs;
          }
          variables = mergedVariables;
          nodeOutputs = mergedNodeOutputs;
          currentNodeKey = joinNodeKey;
          currentNodeInput = null;
          continue;
        }
        if (decision.kind !== 'SELECT_EDGE') throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'DECISION evaluation returned an unexpected continuation kind.', { nodeKey: node.key });
        const edge = findEdge(model, decision.edgeKey);
        recordNodeDataSnapshot(cursor, node, {
          received: currentNodeInput,
          produced: { selectedEdgeKey: edge.key, selectionMode: node.mode ?? 'EXACT_ONE' },
          status: 'SUCCEEDED',
        });
        cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { edgeKey: edge.key, ...describeEdgeSelection(edge, node.mode ?? 'EXACT_ONE') } });
        currentNodeKey = edge.toNodeKey;
        currentNodeInput = null;
        continue;
      }

      case 'SWITCH': {
        const decision = evaluateSwitchNode(node, outgoingEdgesOf(model, node.key), baseContext);
        if (decision.kind !== 'SELECT_EDGE') throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'SWITCH evaluation returned an unexpected continuation kind.', { nodeKey: node.key });
        const edge = findEdge(model, decision.edgeKey);
        recordNodeDataSnapshot(cursor, node, {
          received: currentNodeInput,
          produced: { selectedEdgeKey: edge.key },
          status: 'SUCCEEDED',
        });
        cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { edgeKey: edge.key, ...describeEdgeSelection(edge) } });
        currentNodeKey = edge.toNodeKey;
        currentNodeInput = null;
        continue;
      }

      case 'DELAY': {
        // Simulation does not model real elapsed time (doc 09 section 5 has no bearing on a pure
        // timer) — the wait is treated as immediately fired; only the exact node itself needs no
        // fixture since DELAY carries no outputAssignments of its own (doc 05 section 23).
        // `nodeOutput: null` mirrors `dueTimerScannerService.ts`'s real TIMER-SATISFY nodeOutput.
        nodeOutputs = { ...nodeOutputs, [node.key]: null };
        const edge = outgoingEdgesOf(model, node.key)[0];
        if (!edge) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `DELAY node "${node.key}" has no outgoing edge.`, { nodeKey: node.key });
        recordNodeDataSnapshot(cursor, node, { received: currentNodeInput, produced: null, status: 'SUCCEEDED' });
        cursor.record({ type: 'WAIT_RESOLVED_BY_FIXTURE', nodeKey: node.key, detail: { waitType: 'TIMER', resolution: 'assumed-fired' } });
        cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { edgeKey: edge.key, ...describeEdgeSelection(edge) } });
        currentNodeKey = edge.toNodeKey;
        currentNodeInput = null;
        continue;
      }

      case 'WAIT_EVENT': {
        const fixture = fixtureSet.fixtures[node.key];
        if (!fixture || fixture.kind !== 'WAIT_EVENT_RESOLUTION') {
          throw new WorkflowDomainError('WF_SIM_MISSING_FIXTURE', `WAIT_EVENT node "${node.key}" requires a WAIT_EVENT_RESOLUTION fixture.`, { nodeKey: node.key });
        }
        if (fixture.outcome === 'EVENT') {
          // Matches `eventCorrelationService.ts`'s real event-win path: nodeOutput is the raw event
          // payload (not null), and outputAssignments evaluate with CURRENT_EVENT bound to it.
          const eventContext: EvaluationContext = { ...baseContext, currentEvent: fixture.eventPayload };
          nodeOutputs = { ...nodeOutputs, [node.key]: fixture.eventPayload };
          variables = applyOutputAssignments(node.outputAssignments, eventContext, node.key, fixture.eventPayload);
          const edge = outgoingEdgesOf(model, node.key).find((e) => e.selector.type === 'UNCONDITIONAL');
          if (!edge) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `WAIT_EVENT node "${node.key}" has no event-win outgoing edge.`, { nodeKey: node.key });
          recordNodeDataSnapshot(cursor, node, { received: currentNodeInput, produced: fixture.eventPayload, status: 'SUCCEEDED' });
          cursor.record({ type: 'WAIT_RESOLVED_BY_FIXTURE', nodeKey: node.key, detail: { waitType: 'EVENT', resolution: 'EVENT', eventPayload: fixture.eventPayload } });
          cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { edgeKey: edge.key, ...describeEdgeSelection(edge) } });
          currentNodeKey = edge.toNodeKey;
          currentNodeInput = null;
          continue;
        }
        if (!node.timeout) throw new WorkflowDomainError('WF_SIM_MISSING_FIXTURE', `WAIT_EVENT node "${node.key}" has no configured timeout — a TIMEOUT fixture outcome is illegal.`, { nodeKey: node.key });
        // Matches `dueTimerScannerService.ts`'s real EXPIRE nodeOutput shape.
        nodeOutputs = { ...nodeOutputs, [node.key]: { timeoutOutcomeKey: node.timeout.outcomeKey } };
        const edge = outgoingEdgesOf(model, node.key).find((e) => e.selector.type === 'WAIT_TIMEOUT' && e.selector.outcomeKey === node.timeout!.outcomeKey);
        if (!edge) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `WAIT_EVENT node "${node.key}" has no matching WAIT_TIMEOUT outgoing edge.`, { nodeKey: node.key });
        recordNodeDataSnapshot(cursor, node, {
          received: currentNodeInput,
          produced: { timeoutOutcomeKey: node.timeout.outcomeKey },
          status: 'SUCCEEDED',
        });
        cursor.record({ type: 'WAIT_RESOLVED_BY_FIXTURE', nodeKey: node.key, detail: { waitType: 'EVENT', resolution: 'TIMEOUT' } });
        cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { edgeKey: edge.key, ...describeEdgeSelection(edge) } });
        currentNodeKey = edge.toNodeKey;
        currentNodeInput = null;
        continue;
      }

      case 'WORK_ITEM': {
        let presetAssignment;
        if (node.assignment.strategy === 'ROUND_ROBIN') {
          const firstUserId = Number(node.assignment.userIds[0] ?? '1');
          presetAssignment = {
            resolved: { type: 'USER' as const, userId: Number.isInteger(firstUserId) && firstUserId > 0 ? firstUserId : 1 },
            evidence: { strategy: 'ROUND_ROBIN', resolvedType: 'USER', resolutionReason: 'simulation deterministic fallback' },
          };
        } else if (node.assignment.strategy === 'SHORTEST_QUEUE') {
          presetAssignment = {
            resolved: { type: 'ROLE' as const, roleId: node.assignment.roleId },
            evidence: { strategy: 'SHORTEST_QUEUE', resolvedType: 'ROLE', resolvedRoleId: node.assignment.roleId, resolutionReason: 'simulation deterministic fallback' },
          };
        }
        const created = evaluateWorkItemCreation(node, baseContext, model.policies.limits, presetAssignment);
        const fixture = fixtureSet.fixtures[node.key];
        if (!fixture || fixture.kind !== 'WORK_ITEM_RESOLUTION') {
          throw new WorkflowDomainError('WF_SIM_MISSING_FIXTURE', `WORK_ITEM node "${node.key}" requires a WORK_ITEM_RESOLUTION fixture.`, { nodeKey: node.key });
        }
        if (!node.allowedOutcomes.includes(fixture.outcomeKey)) {
          throw new WorkflowDomainError('WF_EXEC_WORK_ITEM_OUTCOME_INVALID', `Fixture outcomeKey "${fixture.outcomeKey}" is not among WORK_ITEM node "${node.key}"'s allowedOutcomes.`, { nodeKey: node.key, outcomeKey: fixture.outcomeKey });
        }
        const workItemContext: EvaluationContext = { ...baseContext, currentWorkItem: { outcome: fixture.outcomeKey, output: fixture.output } };
        // Matches `workItemService.ts::resolveWorkItemCompletionPlan`'s real `canonicalOutput = { outcome, output }` — the WORK_ITEM node's own persisted/NODE_OUTPUT-visible output.
        const canonicalOutput: JsonValue = { outcome: fixture.outcomeKey, output: fixture.output };
        nodeOutputs = { ...nodeOutputs, [node.key]: canonicalOutput };
        variables = applyOutputAssignments(node.outputAssignments, workItemContext, node.key, canonicalOutput);
        const edge = outgoingEdgesOf(model, node.key).find((e) => e.selector.type === 'WORK_ITEM_OUTCOME' && e.selector.outcomeKey === fixture.outcomeKey);
        if (!edge) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `WORK_ITEM node "${node.key}" has no outgoing edge for outcome "${fixture.outcomeKey}".`, { nodeKey: node.key });
        recordNodeDataSnapshot(cursor, node, {
          received: created as unknown as JsonValue,
          produced: canonicalOutput,
          status: 'SUCCEEDED',
        });
        cursor.record({ type: 'WAIT_RESOLVED_BY_FIXTURE', nodeKey: node.key, detail: { waitType: 'HUMAN', resolution: fixture.outcomeKey, titleText: created.titleText } });
        cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { edgeKey: edge.key, ...describeEdgeSelection(edge) } });
        currentNodeKey = edge.toNodeKey;
        currentNodeInput = null;
        continue;
      }

      case 'SUBFLOW': {
        const fixture = fixtureSet.fixtures[node.key];
        if (!fixture || fixture.kind !== 'SUBFLOW_RESOLUTION') {
          throw new WorkflowDomainError('WF_SIM_MISSING_FIXTURE', `SUBFLOW node "${node.key}" requires a SUBFLOW_RESOLUTION fixture.`, { nodeKey: node.key });
        }
        if (fixture.status === 'FAILED') {
          recordNodeDataSnapshot(cursor, node, {
            received: currentNodeInput,
            produced: { errorCode: fixture.errorCode },
            status: 'FAILED',
            errorCode: fixture.errorCode,
            safeMessage: `Child workflow failed (simulated) — ${fixture.errorCode}.`,
          });
          return { outcome: { status: 'FAILED', errorCode: 'WF_EXEC_SUBFLOW_FAILED', safeMessage: `Child workflow failed (simulated) — ${fixture.errorCode}.` }, finalContext: { workflowInput: startContext.workflowInput, variables, nodeOutputs } };
        }
        if (fixture.status === 'CANCELLED_BY_REGION_EVENT') {
          // p-99/WFT-9 — mirrors `applySubflowCancelRegionContinuation`: no output assignments run
          // (the child never reached a real output), node status is CANCELLED not SUCCEEDED, and
          // routing follows CANCEL_REGION rather than the node's normal UNCONDITIONAL edge.
          if (!node.cancelEvent) {
            throw new WorkflowDomainError('WF_SIM_MISSING_FIXTURE', `SUBFLOW node "${node.key}" has a CANCELLED_BY_REGION_EVENT fixture but declares no cancelEvent.`, { nodeKey: node.key });
          }
          const edge = cancelRegionEdgeOf(model, node.key);
          if (!edge) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `SUBFLOW node "${node.key}" has no CANCEL_REGION outgoing edge.`, { nodeKey: node.key });
          nodeOutputs = { ...nodeOutputs, [node.key]: fixture.eventPayload };
          recordNodeDataSnapshot(cursor, node, { received: currentNodeInput, produced: fixture.eventPayload, status: 'CANCELLED' });
          cursor.record({ type: 'WAIT_RESOLVED_BY_FIXTURE', nodeKey: node.key, detail: { waitType: 'SUBFLOW', resolution: fixture.status } });
          cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { edgeKey: edge.key, ...describeEdgeSelection(edge) } });
          currentNodeKey = edge.toNodeKey;
          currentNodeInput = null;
          continue;
        }
        nodeOutputs = { ...nodeOutputs, [node.key]: fixture.output };
        variables = applyOutputAssignments(node.outputAssignments, { ...baseContext, nodeOutputs }, node.key, fixture.output);
        const edge = successEdgeOf(model, node.key);
        if (!edge) throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `SUBFLOW node "${node.key}" has no UNCONDITIONAL outgoing edge.`, { nodeKey: node.key });
        recordNodeDataSnapshot(cursor, node, { received: currentNodeInput, produced: fixture.output, status: 'SUCCEEDED' });
        cursor.record({ type: 'WAIT_RESOLVED_BY_FIXTURE', nodeKey: node.key, detail: { waitType: 'SUBFLOW', resolution: fixture.status } });
        cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { edgeKey: edge.key, ...describeEdgeSelection(edge) } });
        currentNodeKey = edge.toNodeKey;
        currentNodeInput = null;
        continue;
      }

      case 'PARALLEL_SPLIT': {
        const decision = evaluateParallelSplitNode(node, outgoingEdgesOf(model, node.key));
        if (decision.kind !== 'START_PARALLEL') throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'PARALLEL_SPLIT evaluation returned an unexpected continuation kind.', { nodeKey: node.key });
        const joinNodeKey = resolveSplitJoin(model, node.key);
        recordNodeDataSnapshot(cursor, node, {
          received: currentNodeInput,
          produced: { branchCount: decision.branches.length, joinNodeKey },
          status: 'SUCCEEDED',
        });
        cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { branchCount: decision.branches.length, joinNodeKey } });

        let mergedVariables = variables;
        let mergedNodeOutputs = nodeOutputs;
        for (const branch of decision.branches) {
          const edge = findEdge(model, branch.edgeKey);
          const branchResult = await walk(model, actionBindings, fixtureSet, edge.toNodeKey, { workflowInput: startContext.workflowInput, variables: mergedVariables, nodeOutputs: mergedNodeOutputs }, cursor, joinNodeKey);
          if (branchResult.outcome.status !== 'STOPPED_AT_NODE') {
            // A branch reaching END/FAIL/a missing fixture before its join is a validated-model
            // invariant violation (doc 05 section 22/32 requires every required branch to reach
            // its join) — surfaced as-is rather than silently swallowed.
            return branchResult;
          }
          mergedVariables = branchResult.finalContext.variables;
          mergedNodeOutputs = branchResult.finalContext.nodeOutputs;
        }
        variables = mergedVariables;
        nodeOutputs = mergedNodeOutputs;
        currentNodeKey = joinNodeKey;
        currentNodeInput = null;
        continue;
      }

      case 'PARALLEL_JOIN': {
        const decision = evaluateParallelJoinNode(node, outgoingEdgesOf(model, node.key));
        if (decision.kind !== 'SELECT_EDGE') throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'PARALLEL_JOIN evaluation returned an unexpected continuation kind.', { nodeKey: node.key });
        const edge = findEdge(model, decision.edgeKey);
        recordNodeDataSnapshot(cursor, node, {
          received: currentNodeInput,
          produced: { selectedEdgeKey: edge.key },
          status: 'SUCCEEDED',
        });
        cursor.record({ type: 'EDGE_SELECTED', nodeKey: node.key, detail: { edgeKey: edge.key, ...describeEdgeSelection(edge) } });
        currentNodeKey = edge.toNodeKey;
        currentNodeInput = null;
        continue;
      }

      case 'END': {
        const decision = evaluateEndNode(node, baseContext);
        if (decision.kind !== 'COMPLETE_INSTANCE') throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'END evaluation returned an unexpected continuation kind.', { nodeKey: node.key });
        recordNodeDataSnapshot(cursor, node, { received: currentNodeInput, produced: decision.output, status: 'SUCCEEDED' });
        cursor.record({ type: 'INSTANCE_SUCCEEDED', nodeKey: node.key, detail: { output: decision.output } });
        return { outcome: { status: 'SUCCEEDED', output: decision.output }, finalContext: { workflowInput: startContext.workflowInput, variables, nodeOutputs } };
      }

      case 'FAIL': {
        const decision = evaluateFailNode(node, baseContext);
        if (decision.kind !== 'FAIL_INSTANCE') throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', 'FAIL evaluation returned an unexpected continuation kind.', { nodeKey: node.key });
        recordNodeDataSnapshot(cursor, node, {
          received: currentNodeInput,
          produced: { errorCode: decision.errorCode, safeMessage: decision.safeMessage },
          status: 'FAILED',
          errorCode: decision.errorCode,
          safeMessage: decision.safeMessage,
        });
        cursor.record({ type: 'INSTANCE_FAILED', nodeKey: node.key, detail: { errorCode: decision.errorCode, safeMessage: decision.safeMessage } });
        return { outcome: { status: 'FAILED', errorCode: decision.errorCode, safeMessage: decision.safeMessage }, finalContext: { workflowInput: startContext.workflowInput, variables, nodeOutputs } };
      }

      /* istanbul ignore next -- exhaustiveness guard */
      default: {
        const exhaustive: never = node;
        throw new WorkflowDomainError('WF_EXEC_ENGINE_INVARIANT', `Unknown node kind reached by simulation: ${JSON.stringify(exhaustive)}`);
      }
    }
  }
}

export async function runSimulationFull(model: WorkflowModel, actionBindings: readonly ResolvedActionNodeBinding[], fixtureSet: WorkflowSimulationFixtureSet, workflowInput: JsonValue): Promise<SimulationExecutionResult> {
  const cursor = new SimulationCursor();
  cursor.record({ type: 'WORKFLOW_INPUT_RECORDED', nodeKey: null, detail: { workflowInput } });
  const initialVariables: Record<string, JsonValue> = {};
  const initialContext: EvaluationContext = { workflowInput, variables: {}, nodeOutputs: {}, currentNodeInput: null };
  for (const variable of model.variables) {
    if (variable.initialValue) {
      initialVariables[variable.key] = evaluateExpression(variable.initialValue, { ...initialContext, variables: initialVariables });
    }
  }
  const { outcome } = await walk(model, actionBindings, fixtureSet, model.start.targetNodeKey, { workflowInput, variables: initialVariables, nodeOutputs: {} }, cursor);
  return { outcome, evidence: cursor.evidence, missingFixturePaths: [] };
}

export async function runSimulationFromNode(model: WorkflowModel, actionBindings: readonly ResolvedActionNodeBinding[], fixtureSet: WorkflowSimulationFixtureSet, nodeKey: string, start: SimulationStartContext): Promise<SimulationExecutionResult> {
  const cursor = new SimulationCursor();
  const { outcome } = await walk(model, actionBindings, fixtureSet, nodeKey, start, cursor);
  return { outcome, evidence: cursor.evidence, missingFixturePaths: [] };
}

/** `Run This Node` — executes exactly one node and reports the edge it would select (or its terminal result), without continuing past it. */
export async function runSimulationSingleNode(model: WorkflowModel, actionBindings: readonly ResolvedActionNodeBinding[], fixtureSet: WorkflowSimulationFixtureSet, nodeKey: string, start: SimulationStartContext): Promise<SimulationExecutionResult> {
  const cursor = new SimulationCursor();
  const node = findNode(model, nodeKey);
  const outgoing = outgoingEdgesOf(model, nodeKey);
  const stopAt = outgoing[0]?.toNodeKey ?? (node.kind === 'PARALLEL_SPLIT' || (node.kind === 'DECISION' && node.mode === 'MULTI_MATCH') ? resolveSplitJoin(model, nodeKey) : undefined);
  const { outcome } = await walk(model, actionBindings, fixtureSet, nodeKey, start, cursor, node.kind === 'END' || node.kind === 'FAIL' ? undefined : stopAt);
  return { outcome, evidence: cursor.evidence, missingFixturePaths: [] };
}
