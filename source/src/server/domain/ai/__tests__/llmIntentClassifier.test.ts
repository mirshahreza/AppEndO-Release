import { describe, expect, it } from 'vitest';
import {
  applyLlmIntentToExecutionProfile,
  mergeGovernedStructuredIntent,
  parseLlmIntentClass,
} from '../llmIntentClassifier';

describe('llmIntentClassifier', () => {
  it('parses single-token classifier output', () => {
    expect(parseLlmIntentClass('engineering_change')).toBe('engineering_change');
    expect(parseLlmIntentClass(' governed_engineering\n')).toBe('governed_engineering');
    expect(parseLlmIntentClass('unknown')).toBeNull();
  });

  it('maps LLM class to execution profile for agent mode', () => {
    expect(applyLlmIntentToExecutionProfile('agent_lookup', 'engineering_change', 'agent'))
      .toBe('agent_implement');
    expect(applyLlmIntentToExecutionProfile('agent_lookup', 'governed_engineering', 'agent'))
      .toBe('agent_implement_governed');
    expect(applyLlmIntentToExecutionProfile('agent_implement', 'engineering_query', 'agent'))
      .toBe('agent_lookup');
    expect(applyLlmIntentToExecutionProfile('agent_lookup', null, 'agent'))
      .toBe('agent_lookup');
  });

  it('merges governed structured intent over light classifier', () => {
    expect(mergeGovernedStructuredIntent('engineering_change', { governed: true }))
      .toBe('governed_engineering');
    expect(mergeGovernedStructuredIntent('engineering_change', { governed: false }))
      .toBe('engineering_change');
  });
});
