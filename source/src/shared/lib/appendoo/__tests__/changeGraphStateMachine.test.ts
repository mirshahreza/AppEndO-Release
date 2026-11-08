import { describe, expect, it } from 'vitest';
import {
  assertValidChangeNodeTransition,
  getAllowedChangeNodeTransitions,
  isValidChangeNodeTransition,
} from '../changeGraphStateMachine';

describe('changeGraphStateMachine', () => {
  it('allows READY → BUILDING and rejects PLANNED → VERIFIED', () => {
    expect(isValidChangeNodeTransition('READY', 'BUILDING')).toBe(true);
    expect(assertValidChangeNodeTransition('READY', 'BUILDING').ok).toBe(true);
    expect(isValidChangeNodeTransition('PLANNED', 'VERIFIED')).toBe(false);
    expect(assertValidChangeNodeTransition('PLANNED', 'VERIFIED').ok).toBe(false);
  });

  it('lists allowed transitions from FAILED', () => {
    expect(getAllowedChangeNodeTransitions('FAILED')).toEqual(['READY', 'PLANNED']);
  });
});
