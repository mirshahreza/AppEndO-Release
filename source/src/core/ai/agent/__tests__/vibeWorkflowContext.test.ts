import { describe, expect, it } from 'vitest';
import {
  formatActiveVibeWorkflowBlock,
  resolveVibeWorkflowContext,
} from '../vibeWorkflowContext';

describe('resolveVibeWorkflowContext (VC-6.1)', () => {
  it('maps server-functions pageKey to WF-1 + vibe-server-function', () => {
    const ctx = resolveVibeWorkflowContext({
      path: '/server-functions',
      pageLabel: 'Server Functions',
      pageKey: 'server-functions',
    });
    expect(ctx.workflowId).toBe('WF-1');
    expect(ctx.standardsShard).toBe('vibe-server-function');
    expect(ctx.toolOrder.some((step) => step.includes('draft_server_function'))).toBe(true);
  });

  it('maps UI intent on server-functions page to WF-2 + vibe-crud', () => {
    const ctx = resolveVibeWorkflowContext({
      path: '/server-functions',
      pageLabel: 'Server Functions',
      pageKey: 'server-functions',
      functionId: 'math.sum-two-numbers',
    }, 'Build a user interface');
    expect(ctx.workflowId).toBe('WF-2');
    expect(ctx.standardsShard).toBe('vibe-crud');
    expect(ctx.toolOrder.some((step) => step.includes('draft_component_layout'))).toBe(true);
  });

  it('maps functionId without pageKey to WF-1', () => {
    const ctx = resolveVibeWorkflowContext({
      path: '/server-functions/edit/list-users',
      pageLabel: 'Server Functions',
      functionId: 'list-users',
    });
    expect(ctx.workflowId).toBe('WF-1');
    expect(ctx.standardsShard).toBe('vibe-server-function');
  });

  it('maps client-components without layoutId to WF-2 + vibe-crud', () => {
    const ctx = resolveVibeWorkflowContext({
      path: '/client-components',
      pageLabel: 'Client Components',
      pageKey: 'client-components',
    });
    expect(ctx.workflowId).toBe('WF-2');
    expect(ctx.standardsShard).toBe('vibe-crud');
    expect(ctx.toolOrder.some((step) => step.includes('draft_component_layout'))).toBe(true);
  });

  it('maps layoutId to WF-3 + vibe-designer-edit', () => {
    const ctx = resolveVibeWorkflowContext({
      path: '/client-components',
      pageLabel: 'Designer',
      pageKey: 'client-components',
      layoutId: 'layout-abc',
    });
    expect(ctx.workflowId).toBe('WF-3');
    expect(ctx.standardsShard).toBe('vibe-designer-edit');
    expect(ctx.toolOrder.some((step) => step.includes('designer_set_prop'))).toBe(true);
  });

  it('maps selectedNodeId to WF-3 even without layoutId', () => {
    const ctx = resolveVibeWorkflowContext({
      path: '/client-components',
      pageLabel: 'Designer',
      selectedNodeId: 'node-1',
    });
    expect(ctx.workflowId).toBe('WF-3');
    expect(ctx.standardsShard).toBe('vibe-designer-edit');
  });

  it('maps empty page context to WF-default', () => {
    const ctx = resolveVibeWorkflowContext({
      path: '/dashboard',
      pageLabel: 'Dashboard',
    });
    expect(ctx.workflowId).toBe('WF-default');
    expect(ctx.standardsShard).toBe('vibe-coding-workflows');
    expect(ctx.toolOrder[0]).toContain('vibe-operator-playbook');
    expect(ctx.limits).toBeUndefined();
  });

  it('maps ambiguous pageKey to WF-4 with limits', () => {
    const ctx = resolveVibeWorkflowContext({
      path: '/users',
      pageLabel: 'Users',
      pageKey: 'users',
    });
    expect(ctx.workflowId).toBe('WF-4');
    expect(ctx.standardsShard).toBe('vibe-coding-workflows');
    expect(ctx.limits).toContain('vibeMaxFilesPerProposal');
  });

  it('prefers WF-3 over WF-1 when layoutId and functionId coexist', () => {
    const ctx = resolveVibeWorkflowContext({
      path: '/client-components',
      pageLabel: 'Designer',
      pageKey: 'client-components',
      layoutId: 'layout-xyz',
      functionId: 'should-not-win',
    });
    expect(ctx.workflowId).toBe('WF-3');
  });
});

describe('formatActiveVibeWorkflowBlock', () => {
  it('includes workflow id and shard in active block', () => {
    const block = formatActiveVibeWorkflowBlock({
      path: '/client-components',
      pageLabel: 'Designer',
      layoutId: 'wf3-layout',
    });
    expect(block).toContain('## Active vibe workflow');
    expect(block).toContain('WF-3');
    expect(block).toContain('vibe-designer-edit');
  });
});
