import { describe, expect, it } from 'vitest';
import { resolvePackageBadgeLabel } from '../packageBadgeLabel';

describe('resolvePackageBadgeLabel', () => {
  it('prefers package display name over package id', () => {
    expect(resolvePackageBadgeLabel({
      packageId: 'pkg-crm',
      packageDisplayName: 'CRM Pack',
    })).toBe('CRM Pack');
  });

  it('falls back to package id when display name is missing', () => {
    expect(resolvePackageBadgeLabel({
      packageId: 'pkg-crm',
    })).toBe('pkg-crm');
  });

  it('falls back to Package when no identity is available', () => {
    expect(resolvePackageBadgeLabel({})).toBe('Package');
  });
});
