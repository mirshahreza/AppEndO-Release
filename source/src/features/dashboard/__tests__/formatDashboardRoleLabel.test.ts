import { describe, expect, it } from 'vitest';
import { formatDashboardRoleLabel } from '../formatDashboardRoleLabel';

describe('formatDashboardRoleLabel', () => {
  it('title-cases standard role codes', () => {
    expect(formatDashboardRoleLabel('ADMIN')).toBe('Admin');
    expect(formatDashboardRoleLabel('DEVELOPER')).toBe('Developer');
  });

  it('falls back safely for empty values', () => {
    expect(formatDashboardRoleLabel('')).toBe('User');
    expect(formatDashboardRoleLabel(null)).toBe('User');
  });
});
