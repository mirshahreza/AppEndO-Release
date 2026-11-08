import { describe, expect, it } from 'vitest';

import { resolvePreferredHmrPort, VITE_DEFAULT_HMR_PORT } from '../devHmr';

describe('devHmr', () => {
  it('uses configured HMR port when set', () => {
    expect(resolvePreferredHmrPort(3002, 4000)).toBe(4000);
  });

  it('falls back to server port + 100 when HMR port is unset', () => {
    expect(resolvePreferredHmrPort(3002, 0)).toBe(3102);
  });

  it('documents Vite default HMR port for restart tooling', () => {
    expect(VITE_DEFAULT_HMR_PORT).toBe(24678);
  });
});
