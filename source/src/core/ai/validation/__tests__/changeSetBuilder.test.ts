import { describe, expect, it, beforeEach } from 'vitest';
import { buildChangeSetsFromDrafts } from '../changeSetBuilder';
import { clearAgentDrafts, putAgentDraft } from '../../tools/native/agentDraftStore';
import { executeDraftServerFunction } from '../../tools/native/draftServerFunction';
import { validateProposal } from '../proposalValidator';
import { DEFAULT_AI_AGENT_SETTINGS } from '../../../../shared/api/contracts/ai/constants';
import { createInitialDesignerState } from '../../../../domain/component-designer/state';

describe('buildChangeSetsFromDrafts', () => {
  beforeEach(() => {
    clearAgentDrafts();
  });

  it('maps component layout drafts to change sets', () => {
    const document = createInitialDesignerState().document;
    document.name = 'Users form';

    const draft = putAgentDraft({
      kind: 'component_layout',
      id: 'draft-1',
      layoutId: 'users-form',
      name: 'Users form',
      folder: 'admin',
      description: 'CRUD create/edit form',
      document,
      bindingDefinitions: {},
      baseLayoutId: 'users-template',
    });

    const changeSets = buildChangeSetsFromDrafts([draft.id]);
    expect(changeSets).toHaveLength(1);
    expect(changeSets[0]).toMatchObject({
      kind: 'component_layout_patch',
      layoutId: 'users-form',
      title: 'Component layout: Users form',
    });
  });

  it('maps server function drafts to function_source_patch change sets', () => {
    const draft = putAgentDraft({
      kind: 'server_function',
      id: 'draft-sf-1',
      functionId: 'list-users',
      name: 'List Users',
      folder: 'admin',
      source: 'export async function handler() { return { ok: true }; }',
      baseFunctionId: 'users-list',
    });

    const changeSets = buildChangeSetsFromDrafts([draft.id]);
    expect(changeSets).toHaveLength(1);
    expect(changeSets[0]).toMatchObject({
      kind: 'function_source_patch',
      functionId: 'admin.list-users',
      title: 'Server function: List Users',
      patch: {
        name: 'List Users',
        folder: 'admin',
        baseFunctionId: 'users-list',
      },
    });
    const patch = changeSets[0]?.kind === 'function_source_patch' ? changeSets[0].patch : {};
    expect(JSON.stringify(patch)).toContain('async function handler()');
    expect(JSON.stringify(patch)).not.toContain('export ');
  });

  it('dedupes multiple server function drafts for the same functionId', async () => {
    await executeDraftServerFunction({
      name: 'sum-two-numbers',
      folder: 'math',
      functionId: 'math.sum-two-numbers',
      source: 'async function handler() { return res.json({ result: 1 }); }',
    });
    await executeDraftServerFunction({
      name: 'sum-two-numbers',
      folder: 'math',
      functionId: 'math.sum-two-numbers',
      source: 'async function handler() { return res.json({ result: 2 }); }',
    });

    const changeSets = buildChangeSetsFromDrafts();
    expect(changeSets).toHaveLength(1);
    expect(changeSets[0]).toMatchObject({
      kind: 'function_source_patch',
      functionId: 'math.sum-two-numbers',
    });
  });

  it('validates normalized export-default drafts without sandbox-source errors', async () => {
    await executeDraftServerFunction({
      name: 'sum-two-numbers',
      folder: 'math',
      functionId: 'math.sum-two-numbers',
      source: `export default async function sumTwoNumbers(context) {
  return { result: 1 };
}`,
    });

    const validation = validateProposal(buildChangeSetsFromDrafts(), {
      agentSettings: DEFAULT_AI_AGENT_SETTINGS,
    });
    expect(validation.violations.some((violation) => violation.ruleId === 'server-functions.sandbox-source')).toBe(false);
  });

  it('collapses legacy duplicate drafts and normalizes the surviving server function source', () => {
    const exportDefaultSource = `type ServerFunctionContext = {
  body?: Record<string, unknown>;
};

export default async function sumTwoNumbers(context: ServerFunctionContext) {
  const body = context.body ?? {};
  return { result: (Number(body.a) + Number(body.b)) * 2 };
}`;

    const handlerSource = `async function handler() {
  const body = req.body || {};
  const result = (Number(body.a) + Number(body.b)) * 2;
  return res.status(200).json({ result });
}

handler();`;

    putAgentDraft({
      kind: 'server_function',
      id: 'draft-1',
      functionId: 'math.sum-two-numbers',
      name: 'sum-two-numbers',
      folder: 'math',
      source: exportDefaultSource,
    });
    putAgentDraft({
      kind: 'server_function',
      id: 'draft-2',
      functionId: 'math.sum-two-numbers',
      name: 'sum-two-numbers',
      folder: 'math',
      source: 'declare const req: { body?: Record<string, unknown> }; async function handler() {}',
    });
    putAgentDraft({
      kind: 'server_function',
      id: 'draft-3',
      functionId: 'math.sum-two-numbers',
      name: 'sum-two-numbers',
      folder: 'math',
      source: handlerSource,
    });

    const changeSets = buildChangeSetsFromDrafts();
    expect(changeSets).toHaveLength(1);

    const validation = validateProposal(changeSets, {
      agentSettings: DEFAULT_AI_AGENT_SETTINGS,
    });
    expect(validation.ok).toBe(true);
    expect(validation.violations.some((violation) => violation.ruleId === 'server-functions.sandbox-source')).toBe(false);

    const patch = changeSets[0]?.kind === 'function_source_patch' ? changeSets[0].patch : {};
    expect(JSON.stringify(patch)).toContain('req.body');
    expect(JSON.stringify(patch)).not.toContain('export default');
  });
});
