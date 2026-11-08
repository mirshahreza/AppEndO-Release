import { describe, it, expect, afterEach } from 'vitest';
import {
  registerDynamicOptionsResolver,
  resolveDynamicOptions,
  isDynamicOptionsSourceRegistered,
  __resetDynamicOptionsRegistryForTests,
} from '../dynamicOptionsRegistry';

afterEach(() => {
  __resetDynamicOptionsRegistryForTests();
});

describe('dynamicOptionsRegistry', () => {
  it('returns undefined for an unregistered source', async () => {
    expect(isDynamicOptionsSourceRegistered('nobody.home')).toBe(false);
    expect(await resolveDynamicOptions('nobody.home')).toBeUndefined();
  });

  it('resolves options from a registered resolver', async () => {
    registerDynamicOptionsResolver('test.colors', async () => [
      { value: 'red', label: 'Red' },
      { value: 'blue', label: 'Blue' },
    ]);
    expect(isDynamicOptionsSourceRegistered('test.colors')).toBe(true);
    expect(await resolveDynamicOptions('test.colors')).toEqual([
      { value: 'red', label: 'Red' },
      { value: 'blue', label: 'Blue' },
    ]);
  });

  it('re-registering the same source replaces the previous resolver', async () => {
    registerDynamicOptionsResolver('test.dupe', async () => [{ value: 'a', label: 'A' }]);
    registerDynamicOptionsResolver('test.dupe', async () => [{ value: 'b', label: 'B' }]);
    expect(await resolveDynamicOptions('test.dupe')).toEqual([{ value: 'b', label: 'B' }]);
  });
});
