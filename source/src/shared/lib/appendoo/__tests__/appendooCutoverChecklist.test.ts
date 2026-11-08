import { describe, expect, it } from 'vitest';
import { evaluateAppendooCutoverChecklist } from '../appendooCutoverChecklist';

describe('appendooCutoverChecklist', () => {
  it('passes automated cutover readiness checklist', () => {
    const checklist = evaluateAppendooCutoverChecklist({ pipelineGatePassed: true });
    expect(checklist.ok).toBe(true);
    expect(checklist.items.length).toBeGreaterThanOrEqual(9);
    expect(checklist.failures).toHaveLength(0);
  });

  it('fails when pipeline gate is not passed', () => {
    const checklist = evaluateAppendooCutoverChecklist({ pipelineGatePassed: false });
    expect(checklist.ok).toBe(false);
    expect(checklist.failures.some((failure) => failure.startsWith('CUT-08'))).toBe(true);
  });
});
