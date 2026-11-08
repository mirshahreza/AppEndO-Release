import { describe, expect, it } from 'vitest';
import { formatPackageCreatedBy } from '../formatPackageCreatedBy';

describe('formatPackageCreatedBy', () => {
  it('prefers full name with email', () => {
    expect(formatPackageCreatedBy(
      { email: 'session@example.com' },
      { id: 1, email: 'profile@example.com', username: 'jdoe', firstname: 'Jane', lastname: 'Doe' },
    )).toBe('Jane Doe <profile@example.com>');
  });

  it('falls back to username with email when name is missing', () => {
    expect(formatPackageCreatedBy(
      { email: 'session@example.com' },
      { id: 1, email: 'jdoe@example.com', username: 'jdoe', firstname: null, lastname: null },
    )).toBe('jdoe <jdoe@example.com>');
  });

  it('uses session email when profile is unavailable', () => {
    expect(formatPackageCreatedBy({ email: 'session@example.com' }, null)).toBe('session@example.com');
  });
});
