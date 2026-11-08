import { describe, expect, it } from 'vitest';
import { formatDashboardCompactCount } from '../formatDashboardCompactCount';

describe('formatDashboardCompactCount', () => {
  it('keeps values below 1000 unabbreviated without full label', () => {
    expect(formatDashboardCompactCount(0)).toEqual({ display: '0', full: null });
    expect(formatDashboardCompactCount(999)).toEqual({ display: '999', full: null });
  });

  it('abbreviates thousands and above and exposes the full value', () => {
    expect(formatDashboardCompactCount(1500)).toEqual({ display: '1.5K', full: '1,500' });
    expect(formatDashboardCompactCount(12000)).toEqual({ display: '12K', full: '12,000' });
    expect(formatDashboardCompactCount(2_500_000)).toEqual({ display: '2.5M', full: '2,500,000' });
  });
});
