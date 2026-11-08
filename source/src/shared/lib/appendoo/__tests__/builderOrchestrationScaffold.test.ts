import { describe, expect, it } from 'vitest';
import {
  BUILDER_PHASE_ORDER,
  getNextBuilderPhase,
  isAllowedBuilderPhase,
  summarizeBuilderOrchestration,
} from '../builderOrchestrationScaffold';

describe('builderOrchestrationScaffold', () => {
  it('defines ordered builder phases and next phase resolution', () => {
    expect(BUILDER_PHASE_ORDER[0]).toBe('validate');
    expect(getNextBuilderPhase('validate')).toBe('preview');
    expect(isAllowedBuilderPhase('execute')).toBe(true);
    expect(summarizeBuilderOrchestration().registeredBuilderCount).toBeGreaterThan(0);
  });
});
