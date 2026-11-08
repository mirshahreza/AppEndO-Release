import { isAppendooTestEnvironment } from './appendooCutover';

export const APPENDOO_V1_E2E_MIGRATION_VERSION = '1.1.0';

/** AE-22.5/22.6 — legacy p-50 e2e suites migrated to engineering-pipeline parity. */
export const V1_LEGACY_E2E_TEST_SUITE_IDS = [
  'e2eVibeServerFunctionWf1',
  'e2eVibeDesignerWf3',
  'e2eVibeFullStackWf4',
  'e2e41WritePipelineSmoke',
] as const;

export type V1LegacyE2eTestSuiteId = typeof V1_LEGACY_E2E_TEST_SUITE_IDS[number];

export const ENGINEERING_PIPELINE_E2E_TEST_SUITE_IDS = [
  'e2eEngineeringPipelineWf1',
  'e2eEngineeringPipelineWf3',
  'e2eEngineeringPipelineWf4',
  'e2eEngineeringPipelineWf41',
] as const;

export type EngineeringPipelineE2eTestSuiteId = typeof ENGINEERING_PIPELINE_E2E_TEST_SUITE_IDS[number];

export type V1LegacyE2eMigrationStatus = 'MIGRATED' | 'DEPRECATED';

export const V1_LEGACY_E2E_MIGRATION_STATUS: Record<
  V1LegacyE2eTestSuiteId,
  { status: V1LegacyE2eMigrationStatus; replacementSuiteId: EngineeringPipelineE2eTestSuiteId }
> = {
  e2eVibeServerFunctionWf1: {
    status: 'MIGRATED',
    replacementSuiteId: 'e2eEngineeringPipelineWf1',
  },
  e2eVibeDesignerWf3: {
    status: 'MIGRATED',
    replacementSuiteId: 'e2eEngineeringPipelineWf3',
  },
  e2eVibeFullStackWf4: {
    status: 'MIGRATED',
    replacementSuiteId: 'e2eEngineeringPipelineWf4',
  },
  e2e41WritePipelineSmoke: {
    status: 'MIGRATED',
    replacementSuiteId: 'e2eEngineeringPipelineWf41',
  },
};

export const V1_LEGACY_E2E_MIGRATION_TARGET =
  'engineeringPipelineService.runScaffold / executeApprovedBinding';

/**
 * @deprecated p-50 VibeHarness e2e — engineering-pipeline suites are canonical (AE-22.6).
 */
export const assertV1LegacyE2eSuiteAllowed = (suiteId: V1LegacyE2eTestSuiteId): void => {
  if (!isAppendooTestEnvironment()) {
    throw new Error(
      `Legacy v1 e2e suite "${suiteId}" is test-only. Target migration: ${V1_LEGACY_E2E_MIGRATION_TARGET}.`,
    );
  }
};

export const summarizeV1LegacyE2eMigration = () => ({
  version: APPENDOO_V1_E2E_MIGRATION_VERSION,
  suiteCount: V1_LEGACY_E2E_TEST_SUITE_IDS.length,
  engineeringPipelineSuiteCount: ENGINEERING_PIPELINE_E2E_TEST_SUITE_IDS.length,
  migratedCount: Object.values(V1_LEGACY_E2E_MIGRATION_STATUS)
    .filter((entry) => entry.status === 'MIGRATED').length,
  migrationTarget: V1_LEGACY_E2E_MIGRATION_TARGET,
  testEnvironmentOnly: true,
});

export const probeV1LegacyE2eMigration = (): { ok: boolean; reason?: string } => {
  const summary = summarizeV1LegacyE2eMigration();
  if (summary.suiteCount < 4) {
    return { ok: false, reason: 'Legacy e2e migration registry incomplete.' };
  }
  if (summary.engineeringPipelineSuiteCount < 4) {
    return { ok: false, reason: 'Engineering pipeline e2e suite registry incomplete.' };
  }
  if (summary.migratedCount < 4) {
    return { ok: false, reason: 'Not all legacy e2e suites are marked MIGRATED.' };
  }
  if (!summary.migrationTarget.includes('engineeringPipeline')) {
    return { ok: false, reason: 'Migration target must reference engineering pipeline scaffold.' };
  }
  return { ok: true };
};

export const isLegacyE2eInCriticalPath = (): boolean => false;
