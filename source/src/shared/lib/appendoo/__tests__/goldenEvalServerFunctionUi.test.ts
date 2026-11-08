import { describe, expect, it } from 'vitest';
import {
  evaluateGeSfUi001Scenario,
  GE_SF_UI_001_SCENARIO_ID,
} from '../goldenEvalServerFunctionUi';

describe('goldenEvalServerFunctionUi', () => {
  it('passes GE-SF-UI-001 semantic vertical slice assertions', () => {
    const result = evaluateGeSfUi001Scenario();
    expect(GE_SF_UI_001_SCENARIO_ID).toBe('GE-SF-UI-001');
    expect(result.passed, result.failures.join('\n')).toBe(true);
    expect(result.evidence.planSnapshot).toBeTruthy();
    expect(result.evidence.failureCodes).toHaveLength(0);
  });
});
