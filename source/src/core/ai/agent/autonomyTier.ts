/**
 * V5 Phase P11 § V5-17 "Autonomy Tiers per role/user" — a role-configurable dial for HOW MUCH
 * the agent may apply without explicit human confirmation. Deliberately independent of
 * `GovernanceDepth` (P03/T7, "how much of the internal pipeline runs") — see the phase doc's own
 * "difference from T7" note: T7 is pipeline depth, this is apply/approval authority.
 *
 * `AUTOPILOT` is the default for every role unless a role is EXPLICITLY configured otherwise —
 * this preserves today's existing auto-apply behavior for `agent_implement` mode with zero
 * regression for any caller that doesn't opt into the new dial.
 */
export type AutonomyTier = 'ADVISOR_ONLY' | 'CO_PILOT' | 'AUTOPILOT';

export const DEFAULT_AUTONOMY_TIER: AutonomyTier = 'AUTOPILOT';

/**
 * Real, explicit, per-role override table — not a fabricated org-chart inference. Empty by
 * default (matches current unconstrained behavior); a platform operator who wants to restrict a
 * junior/enterprise-compliance role adds an entry here (or, in a future phase, to a persisted
 * settings table — left as a static table this phase, same bounded-scope pattern used elsewhere
 * in this pack for a first real slice of a larger capability).
 */
const ROLE_AUTONOMY_TIER_OVERRIDES: Record<string, AutonomyTier> = {};

/** Most-restrictive-wins when a user has multiple roles with different configured tiers. */
const TIER_RESTRICTIVENESS_RANK: Record<AutonomyTier, number> = {
  ADVISOR_ONLY: 0,
  CO_PILOT: 1,
  AUTOPILOT: 2,
};

export const resolveAutonomyTierForRoles = (roleNames: readonly string[]): AutonomyTier => {
  const configuredTiers = roleNames
    .map((role) => ROLE_AUTONOMY_TIER_OVERRIDES[role])
    .filter((tier): tier is AutonomyTier => tier !== undefined);

  if (configuredTiers.length === 0) {
    return DEFAULT_AUTONOMY_TIER;
  }

  return configuredTiers.reduce((mostRestrictive, tier) => (
    TIER_RESTRICTIVENESS_RANK[tier] < TIER_RESTRICTIVENESS_RANK[mostRestrictive] ? tier : mostRestrictive
  ));
};

/**
 * DoD (phase doc): an Advisor-only role must never apply a mutation without explicit human
 * confirmation, even when the Policy Engine allows the action — Advisor-only must not auto-apply
 * even when the Policy Engine would otherwise allow it. Only AUTOPILOT allows unattended apply;
 * CO_PILOT and ADVISOR_ONLY both require the existing human-approval step (they differ in how much
 * else the agent may do autonomously before that point — out of this phase's bounded slice).
 */
export const isAutoApplyAllowedForTier = (tier: AutonomyTier): boolean => tier === 'AUTOPILOT';
