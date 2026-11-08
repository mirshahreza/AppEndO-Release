import { describe, expect, it } from 'vitest';
import { studioPath } from '../studioPaths';

describe('studioPaths', () => {
  it('builds mount-relative studio paths', () => {
    expect(studioPath()).toBe('/studio');
    expect(studioPath('users')).toBe('/studio/users');
    expect(studioPath('/jobs')).toBe('/studio/jobs');
  });
});
