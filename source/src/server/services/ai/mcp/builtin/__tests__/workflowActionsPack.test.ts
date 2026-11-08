import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createPhase1ToolRegistry } from '../../../../../../core/ai/tools/ToolRegistry';
import { getAiCapabilityPack } from '../../../../../../shared/api/contracts/ai/capabilityPacks';
import { registerCoreActionPack } from '../../../../../domain/workflow/actions/corePack';
import { __resetActionRegistryForTests } from '../../../../../domain/workflow/actions/registry';
import { registerBuiltinCapabilityPacks } from '../index';
import {
  executeInvokeWorkflowAction,
  executeListWorkflowActions,
  INVOKE_WORKFLOW_ACTION_TOOL_NAME,
  LIST_WORKFLOW_ACTIONS_TOOL_NAME,
} from '../workflowActionsTools';

describe('appendo-workflow pack', () => {
  beforeEach(() => {
    __resetActionRegistryForTests();
    registerCoreActionPack();
  });

  afterEach(() => {
    __resetActionRegistryForTests();
  });

  it('registers workflow-action tools when appendo-workflow is enabled', () => {
    const registry = createPhase1ToolRegistry('agent', ['workflow']);
    registerBuiltinCapabilityPacks(registry, ['appendo-workflow']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    getAiCapabilityPack('appendo-workflow').toolNames.forEach((name) => {
      expect(names).toContain(name);
    });
  });

  it('blocks workflow-action tools in plan mode', () => {
    const registry = createPhase1ToolRegistry('plan', ['workflow']);
    registerBuiltinCapabilityPacks(registry, ['appendo-workflow']);

    const names = registry.listDefinitions().map((tool) => tool.name);
    expect(names).not.toContain(LIST_WORKFLOW_ACTIONS_TOOL_NAME);
    expect(names).not.toContain(INVOKE_WORKFLOW_ACTION_TOOL_NAME);
  });

  it('list_workflow_actions lists real invocable corePack actions and excludes write-effect ones', () => {
    const result = executeListWorkflowActions({});
    expect(result.ok).toBe(true);
    const keys = result.data.items.map((item) => item.key);
    expect(keys).toContain('crypto.hash');
    expect(keys).toContain('text.template');
    // communication.email-send is WRITE_EXTERNAL — must not be offered for direct invocation.
    expect(keys).not.toContain('communication.email-send');
  });

  it('list_workflow_actions filters by category prefix', () => {
    const result = executeListWorkflowActions({ category: 'crypto' });
    expect(result.ok).toBe(true);
    expect(result.data.items.length).toBeGreaterThan(0);
    result.data.items.forEach((item) => expect(item.key.startsWith('crypto.')).toBe(true));
  });

  it('invoke_workflow_action actually runs a real PURE action end-to-end', async () => {
    const result = await executeInvokeWorkflowAction({
      actionKey: 'crypto.hash',
      actionVersion: '1',
      config: {},
      input: { algorithm: 'sha256', data: 'hello' },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.output).toBeTruthy();
  });

  it('rejects invocation of a WRITE_EXTERNAL action', async () => {
    const result = await executeInvokeWorkflowAction({
      actionKey: 'communication.email-send',
      actionVersion: '1',
      config: {},
      input: {},
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('action_not_invocable');
  });

  it('reports action_not_found for an unknown action key', async () => {
    const result = await executeInvokeWorkflowAction({ actionKey: 'nobody.home', actionVersion: '1' });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('action_not_found');
  });

  it('requires actionKey and actionVersion', async () => {
    const result = await executeInvokeWorkflowAction({});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe('missing_action_ref');
  });
});
