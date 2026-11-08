import { describe, expect, it } from 'vitest';
import { DEFAULT_AUTONOMY_TIER, isAutoApplyAllowedForTier, resolveAutonomyTierForRoles } from '../autonomyTier';

describe('V5 P11 § V5-17 — autonomyTier', () => {
  it('defaults every unconfigured role to AUTOPILOT (zero regression for today\'s existing auto-apply behavior)', () => {
    expect(resolveAutonomyTierForRoles(['DEVELOPER'])).toBe('AUTOPILOT');
    expect(resolveAutonomyTierForRoles([])).toBe(DEFAULT_AUTONOMY_TIER);
  });

  it('only AUTOPILOT allows unattended apply — ADVISOR_ONLY and CO_PILOT both require human confirmation', () => {
    expect(isAutoApplyAllowedForTier('AUTOPILOT')).toBe(true);
    expect(isAutoApplyAllowedForTier('CO_PILOT')).toBe(false);
    expect(isAutoApplyAllowedForTier('ADVISOR_ONLY')).toBe(false);
  });
});
