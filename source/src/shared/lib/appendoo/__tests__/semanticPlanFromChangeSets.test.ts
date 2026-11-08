import { describe, expect, it } from 'vitest';
import type { ChangeSet } from '../../../api/contracts/ai/agentTypes';
import { buildSemanticPlanFromChangeSets } from '../semanticPlanFromChangeSets';

const multiFileChangeSets: ChangeSet[] = [
  {
    id: 'cs-fn-a',
    kind: 'function_source_patch',
    title: 'Server function: Validate A',
    functionId: 'validate-a',
    patch: {
      name: 'Validate A',
      folder: 'api',
      source: 'export async function handler() { return { ok: true }; }\n',
    },
  },
  {
    id: 'cs-file-c',
    kind: 'file_patch',
    title: 'File patch: src/shared/validate-c.ts',
    path: 'src/shared/validate-c.ts',
    beforeContent: 'export const validate = () => true;\n',
    content: 'export const validate = () => false;\n',
  },
];

describe('buildSemanticPlanFromChangeSets (V4-PATCH-5 P5.1)', () => {
  it('maps agent change sets to reverse audit ASP artifacts', () => {
    const plan = buildSemanticPlanFromChangeSets({
      changeSets: multiFileChangeSets,
      userPrompt: 'Unify validation',
    });

    expect(plan).not.toBeNull();
    expect(plan?.producer).toBe('reverse_audit');
    expect(plan?.authority).toBe('SCAFFOLD');
    expect(plan?.proposedArtifacts).toHaveLength(2);
    expect(plan?.proposedArtifacts.map((artifact) => artifact.kind)).toEqual([
      'server_function',
      'configuration',
    ]);
  });

  it('returns null when no mappable change sets exist', () => {
    expect(buildSemanticPlanFromChangeSets({
      changeSets: [{
        id: 'cs-git',
        kind: 'git_operation',
        title: 'Git op',
        operation: 'commit',
        message: 'test',
      }],
    })).toBeNull();
  });
});
