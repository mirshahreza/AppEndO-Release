import { describe, expect, it } from 'vitest';
import {
  assertV1LegacyE2eSuiteAllowed,
  ENGINEERING_PIPELINE_E2E_TEST_SUITE_IDS,
  isLegacyE2eInCriticalPath,
  probeV1LegacyE2eMigration,
  V1_LEGACY_E2E_MIGRATION_STATUS,
  V1_LEGACY_E2E_TEST_SUITE_IDS,
} from '../appendooV1E2eMigration';

describe('appendooV1E2eMigration', () => {
  it('tracks legacy and engineering pipeline e2e suites', () => {
    expect(V1_LEGACY_E2E_TEST_SUITE_IDS).toHaveLength(4);
    expect(ENGINEERING_PIPELINE_E2E_TEST_SUITE_IDS).toHaveLength(4);
    expect(probeV1LegacyE2eMigration().ok).toBe(true);
  });

  it('marks every legacy suite as MIGRATED with replacement id', () => {
    for (const suiteId of V1_LEGACY_E2E_TEST_SUITE_IDS) {
      const entry = V1_LEGACY_E2E_MIGRATION_STATUS[suiteId];
      expect(entry.status).toBe('MIGRATED');
      expect(ENGINEERING_PIPELINE_E2E_TEST_SUITE_IDS).toContain(entry.replacementSuiteId);
    }
  });

  it('allows legacy e2e only in test environment', () => {
    expect(() => assertV1LegacyE2eSuiteAllowed('e2e41WritePipelineSmoke')).not.toThrow();
  });

  it('excludes legacy e2e from critical path after migration', () => {
    expect(isLegacyE2eInCriticalPath()).toBe(false);
  });
});
