import { describe, expect, it, beforeEach } from 'vitest';
import {
  claimAppEndooHost,
  releaseAppEndooHost,
  resetAppEndooHostRegistryForTests,
} from '../appendooHostRegistry';

describe('appendooHostRegistry', () => {
  beforeEach(() => {
    resetAppEndooHostRegistryForTests();
  });

  it('grants first claimant ownership', () => {
    expect(claimAppEndooHost('host-a', 0)).toBe(true);
    expect(claimAppEndooHost('host-b', 0)).toBe(false);
  });

  it('allows higher-priority host to preempt', () => {
    expect(claimAppEndooHost('shell-host', 0)).toBe(true);
    expect(claimAppEndooHost('global-host', 100)).toBe(true);
    expect(claimAppEndooHost('shell-host', 0)).toBe(false);
  });

  it('releases ownership for next claimant', () => {
    expect(claimAppEndooHost('host-a', 0)).toBe(true);
    releaseAppEndooHost('host-a');
    expect(claimAppEndooHost('host-b', 0)).toBe(true);
  });
});
