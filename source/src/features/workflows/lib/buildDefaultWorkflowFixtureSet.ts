import type { JsonValue, WorkflowModel, WorkflowNode } from '../types';

type ActionCatalogEntry = {
  key: string;
  version: string;
  availability: string;
  sideEffectClass: string;
  secretReferenceFields?: string[];
};

type WorkflowFixtureSet = {
  fixtures: Record<string, JsonValue>;
};

function resolveActionKey(node: WorkflowNode): { actionKey: string; actionVersion: string } | null {
  const actionRef = node.actionRef as { action?: { actionKey?: string; actionVersion?: string } } | undefined;
  if (!actionRef?.action?.actionKey) return null;
  return {
    actionKey: actionRef.action.actionKey,
    actionVersion: actionRef.action.actionVersion ?? '1',
  };
}

function isPureSafeAction(
  actionCatalog: readonly ActionCatalogEntry[],
  actionKey: string,
  actionVersion: string,
): boolean {
  const entry = actionCatalog.find((item) => item.key === actionKey && item.version === actionVersion);
  return Boolean(
    entry
    && entry.availability === 'AVAILABLE'
    && entry.sideEffectClass === 'PURE'
    && !(entry.secretReferenceFields?.length),
  );
}

/** Builds default execute fixtures so draft runs can resolve WAIT/WORK_ITEM/SUBFLOW/non-PURE ACTION nodes. */
export function buildDefaultWorkflowFixtureSet(
  model: WorkflowModel,
  actionCatalog: readonly ActionCatalogEntry[],
): WorkflowFixtureSet {
  const fixtures: Record<string, JsonValue> = {};

  for (const node of model.nodes) {
    switch (node.kind) {
      case 'WORK_ITEM': {
        const allowedOutcomes = (node.allowedOutcomes as string[] | undefined) ?? [];
        if (allowedOutcomes.length === 0) break;
        fixtures[node.key] = {
          kind: 'WORK_ITEM_RESOLUTION',
          outcomeKey: allowedOutcomes[0],
          output: {},
        };
        break;
      }
      case 'WAIT_EVENT':
        fixtures[node.key] = {
          kind: 'WAIT_EVENT_RESOLUTION',
          outcome: 'EVENT',
          eventPayload: {},
        };
        break;
      case 'SUBFLOW':
        fixtures[node.key] = {
          kind: 'SUBFLOW_RESOLUTION',
          status: 'SUCCEEDED',
          output: {},
        };
        break;
      case 'ACTION': {
        const action = resolveActionKey(node);
        if (action && isPureSafeAction(actionCatalog, action.actionKey, action.actionVersion)) break;
        fixtures[node.key] = { kind: 'ACTION_RESULT', output: {} };
        break;
      }
      default:
        break;
    }
  }

  return { fixtures };
}

export function buildDefaultWorkflowFixtureSetJson(
  model: WorkflowModel,
  actionCatalog: readonly ActionCatalogEntry[],
): string {
  return JSON.stringify(buildDefaultWorkflowFixtureSet(model, actionCatalog), null, 2);
}

export function countWorkflowFixtureNodes(
  model: WorkflowModel,
  actionCatalog: readonly ActionCatalogEntry[],
): number {
  return Object.keys(buildDefaultWorkflowFixtureSet(model, actionCatalog).fixtures).length;
}
