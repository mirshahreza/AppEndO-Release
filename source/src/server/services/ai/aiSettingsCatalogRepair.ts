import { normalizeAiSettings } from '../../../shared/api/contracts/ai/validators';
import type { AiSettings } from '../../../shared/api/contracts/ai/types';

const isRecord = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

/**
 * p-63 Phase A — old shipped agent-limit defaults that starved the agent runtime. A stored
 * value exactly equal to the legacy default is treated as "never deliberately customized" and
 * dropped so normalization fills the new default; any other stored value is operator intent
 * and stays untouched.
 */
const LEGACY_AGENT_LIMIT_DEFAULTS: ReadonlyArray<{ key: string; legacy: number }> = [
  { key: 'maxToolCallsPerTurn', legacy: 5 },
  // p-63 A3's own replacement default (20) still truncated complex multi-call turns — bumped
  // again to 40; a stored 20 is itself now "never deliberately customized" and gets repaired.
  { key: 'maxToolCallsPerTurn', legacy: 20 },
  { key: 'maxTokensPerRun', legacy: 80_000 },
  { key: 'contextToolObservationMaxTurns', legacy: 4 },
];

const listLegacyAgentLimitKeys = (raw: unknown): string[] => {
  if (!isRecord(raw) || !isRecord(raw.agent)) return [];
  const agent = raw.agent;
  return LEGACY_AGENT_LIMIT_DEFAULTS
    .filter(({ key, legacy }) => Number(agent[key]) === legacy)
    .map(({ key }) => key);
};

export const aiSettingsBlobNeedsCatalogRepair = (raw: unknown): boolean => (
  listLegacyAgentLimitKeys(raw).length > 0
);

export const repairAiSettingsBlob = (raw: unknown): AiSettings => {
  const legacyKeys = listLegacyAgentLimitKeys(raw);
  if (legacyKeys.length === 0 || !isRecord(raw) || !isRecord(raw.agent)) {
    return normalizeAiSettings(raw);
  }
  const agent = Object.fromEntries(
    Object.entries(raw.agent).filter(([key]) => !legacyKeys.includes(key)),
  );
  return normalizeAiSettings({ ...raw, agent });
};
