import { describe, expect, it } from 'vitest';
import {
  isPlatformTransferSectionKey,
  defaultPlatformTransferSelection,
} from '../platformTransfer';

describe('platformTransfer contract', () => {
  it('recognizes known section keys', () => {
    expect(isPlatformTransferSectionKey('ai')).toBe(true);
    expect(isPlatformTransferSectionKey('auth')).toBe(true);
    expect(isPlatformTransferSectionKey('profile-fields')).toBe(true);
    expect(isPlatformTransferSectionKey('node-runtime')).toBe(false);
  });

  it('defaults exclude sensitive JWT secrets', () => {
    expect(defaultPlatformTransferSelection()).not.toContain('security');
    expect(defaultPlatformTransferSelection()).toContain('ai');
  });
});
