import { describe, expect, it } from 'vitest';
import type { ChangeSet } from '../../../../shared/api/contracts/ai/agentTypes';
import { validateProposal } from '../proposalValidator';

const fileChangeSet = (overrides: Partial<Extract<ChangeSet, { kind: 'file_patch' }>> = {}): ChangeSet => ({
  id: 'cs-1',
  kind: 'file_patch',
  title: 'Update file',
  path: 'src/shared/ui/AppButton.tsx',
  content: 'export const AppButton = () => null;\n',
  ...overrides,
});

describe('validateProposal', () => {
  it('passes a small allowlisted file patch', () => {
    const result = validateProposal([fileChangeSet()], {
      agentSettings: {
        defaultMode: 'agent',
        maxIterations: 10,
        maxIterationsVibe: 25,
        maxToolCallsPerTurn: 5,
        allowedNativeToolGroups: ['standards', 'search', 'read', 'draft'],
        writeRequiresConfirm: true,
        vibeMaxFilesPerProposal: 8,
        vibeMaxLinesPerProposal: 400,
      },
    });
    expect(result.ok).toBe(true);
    expect(result.violations.filter((v) => v.severity === 'error')).toHaveLength(0);
  });

  it('blocks paths outside allowlist', () => {
    const result = validateProposal([
      fileChangeSet({ path: '.env', content: 'SECRET=1\n' }),
    ]);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.message.includes('allowlist'))).toBe(true);
  });

  it('blocks secret patterns in content', () => {
    const result = validateProposal([
      fileChangeSet({ content: 'const apiKey = "sk-1234567890abcdef"\n' }),
    ]);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.message.includes('secret'))).toBe(true);
  });

  it('enforces max files cap', () => {
    const changeSets = Array.from({ length: 10 }, (_, index) => fileChangeSet({
      id: `cs-${index}`,
      path: `src/shared/ui/File${index}.tsx`,
    }));
    const result = validateProposal(changeSets, {
      agentSettings: {
        defaultMode: 'agent',
        maxIterations: 10,
        maxIterationsVibe: 25,
        maxToolCallsPerTurn: 5,
        allowedNativeToolGroups: ['draft'],
        writeRequiresConfirm: true,
        vibeMaxFilesPerProposal: 8,
        vibeMaxLinesPerProposal: 400,
      },
    });
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.id === 'surface-max-files')).toBe(true);
  });

  it('flags native checkbox usage via standards validator', () => {
    const result = validateProposal([
      fileChangeSet({
        content: '<input type="checkbox" checked />',
      }),
    ]);
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.ruleId === 'ui.checkbox.use-uicheckbox')).toBe(true);
  });

  it('blocks non-markdown paths in plan mode', () => {
    const result = validateProposal([
      fileChangeSet({ path: 'src/shared/ui/AppButton.tsx' }),
    ], { mode: 'plan' });
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.id.startsWith('plan-path-'))).toBe(true);
  });

  it('allows plans markdown in plan mode', () => {
    const result = validateProposal([
      fileChangeSet({
        path: 'plans/core/todo/p-00-todo-index.md',
        content: '# Design\n\nGoals:\n',
      }),
    ], { mode: 'plan' });
    expect(result.ok).toBe(true);
    expect(result.violations.filter((v) => v.severity === 'error' && v.id.startsWith('plan-'))).toHaveLength(0);
  });

  it('blocks component layout patches in plan mode', () => {
    const result = validateProposal([
      {
        id: 'cs-layout',
        kind: 'component_layout_patch',
        title: 'Layout',
        layoutId: 'demo-layout',
        patch: {},
      },
    ], { mode: 'plan' });
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.id.startsWith('plan-scope-'))).toBe(true);
  });

  it('allows creating a new function while another function is open in the editor', () => {
    const result = validateProposal([
      {
        id: 'cs-multiply',
        kind: 'function_source_patch',
        title: 'Server function: multiply-two-numbers',
        functionId: 'math.multiply-two-numbers',
        patch: {
          name: 'multiply-two-numbers',
          folder: 'math',
          operation: 'create',
          source: 'async function handler() { return res.json({ product: 1 }); }',
        },
      },
    ], {
      pageContext: {
        path: '/server-functions/math/sum-two-numbers',
        pageLabel: 'Server Functions',
        pageKey: 'server-functions',
        functionId: 'math.sum-two-numbers',
      },
    });
    expect(result.violations.some((v) => v.ruleId === 'ai.vibe.server-function-identity')).toBe(false);
    expect(result.ok).toBe(true);
  });

  it('blocks drafts that claim to update the open function but target another id', () => {
    const result = validateProposal([
      {
        id: 'cs-wrong-target',
        kind: 'function_source_patch',
        title: 'Server function: multiply-two-numbers',
        functionId: 'math.multiply-two-numbers',
        patch: {
          name: 'multiply-two-numbers',
          folder: 'math',
          operation: 'update',
          baseFunctionId: 'math.sum-two-numbers',
          source: 'async function handler() { return res.json({ product: 1 }); }',
        },
      },
    ], {
      pageContext: {
        path: '/server-functions/math/sum-two-numbers',
        pageLabel: 'Server Functions',
        pageKey: 'server-functions',
        functionId: 'math.sum-two-numbers',
      },
    });
    expect(result.ok).toBe(false);
    expect(result.violations.some((v) => v.ruleId === 'ai.vibe.server-function-identity')).toBe(true);
  });
});
