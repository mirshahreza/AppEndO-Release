import { describe, expect, it } from 'vitest';
import {
  aiSettingsBlobNeedsCatalogRepair,
  repairAiSettingsBlob,
} from '../aiSettingsCatalogRepair';

describe('aiSettingsCatalogRepair', () => {
  it('does not treat missing catalog presets as a repair trigger', () => {
    const minimal = {
      enabled: true,
      defaultModelId: '',
      chatRateLimitPerMinute: 20,
      providers: [],
      models: [],
    };

    expect(aiSettingsBlobNeedsCatalogRepair(minimal)).toBe(false);
    expect(repairAiSettingsBlob(minimal).models).toEqual([]);
  });

  it('p-63 — bumps stored legacy agent limits (old defaults) to the new defaults', () => {
    const stored = {
      enabled: true,
      agent: {
        maxToolCallsPerTurn: 5,
        maxTokensPerRun: 80_000,
        contextToolObservationMaxTurns: 4,
      },
    };

    expect(aiSettingsBlobNeedsCatalogRepair(stored)).toBe(true);

    const repaired = repairAiSettingsBlob(stored);
    expect(repaired.agent.maxToolCallsPerTurn).toBe(40);
    expect(repaired.agent.maxTokensPerRun).toBe(200_000);
    expect(repaired.agent.contextToolObservationMaxTurns).toBe(12);
  });

  it('bumps a stored maxToolCallsPerTurn of 20 (the prior repaired default) to the new default', () => {
    const stored = {
      enabled: true,
      agent: {
        maxToolCallsPerTurn: 20,
        maxTokensPerRun: 200_000,
        contextToolObservationMaxTurns: 12,
      },
    };

    expect(aiSettingsBlobNeedsCatalogRepair(stored)).toBe(true);
    const repaired = repairAiSettingsBlob(stored);
    expect(repaired.agent.maxToolCallsPerTurn).toBe(40);
  });

  it('p-63 — keeps operator-customized agent limits untouched', () => {
    const stored = {
      enabled: true,
      agent: {
        maxToolCallsPerTurn: 7,
        maxTokensPerRun: 120_000,
        contextToolObservationMaxTurns: 4,
      },
    };

    const repaired = repairAiSettingsBlob(stored);
    // Only the exact legacy default (4) is bumped; deliberate values survive.
    expect(repaired.agent.maxToolCallsPerTurn).toBe(7);
    expect(repaired.agent.maxTokensPerRun).toBe(120_000);
    expect(repaired.agent.contextToolObservationMaxTurns).toBe(12);
  });
});
