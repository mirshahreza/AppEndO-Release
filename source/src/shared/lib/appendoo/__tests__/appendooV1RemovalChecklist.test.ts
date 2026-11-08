import { describe, expect, it } from 'vitest';
import { evaluateAppendooV1RemovalChecklist, probeAppendooV1Removal } from '../appendooV1RemovalChecklist';

describe('appendooV1RemovalChecklist', () => {
  it('passes v1 removal readiness checklist under cutover', () => {
    const checklist = evaluateAppendooV1RemovalChecklist();
    expect(checklist.ok).toBe(true);
    expect(checklist.items.length).toBeGreaterThanOrEqual(6);
    expect(checklist.failures).toHaveLength(0);
  });

  it('probes v1 removal gate', () => {
    expect(probeAppendooV1Removal().ok).toBe(true);
  });
});
