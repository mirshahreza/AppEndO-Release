import type { ChangeNodeState } from '../../api/contracts/appendoo/changeGraph.types';

export const CHANGE_GRAPH_STATE_MACHINE_VERSION = '1.0.0';

const VALID_TRANSITIONS: Record<ChangeNodeState, ChangeNodeState[]> = {
  PLANNED: ['READY', 'FAILED'],
  READY: ['BUILDING', 'PLANNED', 'FAILED'],
  BUILDING: ['BUILT', 'FAILED'],
  BUILT: ['VERIFYING', 'FAILED'],
  VERIFYING: ['VERIFIED', 'FAILED'],
  VERIFIED: [],
  FAILED: ['READY', 'PLANNED'],
};

export const isValidChangeNodeTransition = (
  from: ChangeNodeState,
  to: ChangeNodeState,
): boolean => VALID_TRANSITIONS[from].includes(to);

export const assertValidChangeNodeTransition = (
  from: ChangeNodeState,
  to: ChangeNodeState,
): { ok: true } | { ok: false; reason: string } => {
  if (from === to) {
    return { ok: true };
  }
  if (!isValidChangeNodeTransition(from, to)) {
    return {
      ok: false,
      reason: `Invalid ChangeNode transition ${from} → ${to}.`,
    };
  }
  return { ok: true };
};

export const getAllowedChangeNodeTransitions = (from: ChangeNodeState): ChangeNodeState[] => (
  [...VALID_TRANSITIONS[from]]
);
