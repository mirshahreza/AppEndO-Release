import type { EntityFunctionAccessDecision } from '../../api/contracts/server-functions/entityAccess';

export function buildManifestScopedAccessDecisions(input: {
  manifestFunctionIds: string[];
  allowedByFunctionId: Record<string, boolean>;
  currentDecisions: Record<string, EntityFunctionAccessDecision>;
}): Record<string, EntityFunctionAccessDecision> {
  const manifestSet = new Set(input.manifestFunctionIds);
  const decisions: Record<string, EntityFunctionAccessDecision> = {};

  for (const [functionId, decision] of Object.entries(input.currentDecisions)) {
    if (!manifestSet.has(functionId) && decision !== 'none') {
      decisions[functionId] = decision;
    }
  }

  for (const functionId of input.manifestFunctionIds) {
    decisions[functionId] = input.allowedByFunctionId[functionId] ? 'allow' : 'none';
  }

  return decisions;
}
