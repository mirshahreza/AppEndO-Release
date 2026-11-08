export type OverlayOpenCandidate = {
  token: string;
  isOpen: boolean;
  /** Higher wins when multiple overlays are open (e.g. z-order). */
  priority?: number;
};

export function resolvePriorityOverlayToken(
  candidates: OverlayOpenCandidate[],
): string | null {
  const open = candidates.filter((candidate) => candidate.isOpen);
  if (open.length === 0) {
    return null;
  }
  open.sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0));
  return open[0]?.token ?? null;
}
