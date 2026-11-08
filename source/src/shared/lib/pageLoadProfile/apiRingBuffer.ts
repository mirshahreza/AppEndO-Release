import type { PageLoadProfileApiCall } from './types';

const MAX_RING = 100;
const ring: PageLoadProfileApiCall[] = [];

export const pushPageLoadProfileApiRing = (call: PageLoadProfileApiCall): void => {
  ring.push(call);
  if (ring.length > MAX_RING) {
    ring.splice(0, ring.length - MAX_RING);
  }
};

export const drainPageLoadProfileApiRingSince = (sinceMs: number): PageLoadProfileApiCall[] => {
  const cutoff = sinceMs - 250;
  return ring.filter((call) => call.finishedAtMs >= cutoff);
};

export const resetPageLoadProfileApiRingForTests = (): void => {
  ring.length = 0;
};
