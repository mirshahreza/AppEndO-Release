import { prisma, toId } from '../prismaHelpers';
import type { JsonValue } from '../awm/types';
import type { EvaluationContext } from './expressionEvaluator';

/** Reads every SUCCEEDED node's persisted output for one instance, keyed by semantic node key — the `NODE_OUTPUT(nodeKey)` resolution source (doc 05 section 26). Publication already proves structural dominance for every reference used, so this is a plain lookup, not a re-check of reachability. */
export async function loadNodeOutputsForInstance(workflowInstanceId: number): Promise<Record<string, JsonValue>> {
  const rows = await prisma().workflowNodeInstance.findMany({
    where: { workflowInstanceId: toId(workflowInstanceId), status: 'SUCCEEDED' },
    select: { semanticNodeKey: true, outputJson: true },
  });
  const result: Record<string, JsonValue> = {};
  for (const row of rows) {
    result[row.semanticNodeKey] = row.outputJson != null ? (JSON.parse(row.outputJson) as JsonValue) : null;
  }
  return result;
}

export const parseJsonOrNull = (raw: string | null): JsonValue => (raw != null ? (JSON.parse(raw) as JsonValue) : null);

export const parseVariables = (contextJson: string | null): Record<string, JsonValue> =>
  contextJson != null ? (JSON.parse(contextJson) as Record<string, JsonValue>) : {};

/** Assembles the evaluation context for a node about to run: workflow input, current persisted variables, every succeeded node's output and this node's own materialized input. */
export function buildEvaluationContext(input: {
  workflowInput: JsonValue;
  variables: Record<string, JsonValue>;
  nodeOutputs: Record<string, JsonValue>;
  currentNodeInput: JsonValue;
}): EvaluationContext {
  return {
    workflowInput: input.workflowInput,
    variables: input.variables,
    nodeOutputs: input.nodeOutputs,
    currentNodeInput: input.currentNodeInput,
  };
}
