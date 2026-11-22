import { beforeEach, describe, expect, it, vi } from 'vitest';

const markerMocks = vi.hoisted(() => ({
  isControlPlaneBootMarkerCurrent: vi.fn(),
  markControlPlaneBootApplied: vi.fn(),
}));

const patchMocks = vi.hoisted(() => ({
  ensureSampleMockSchema: vi.fn(),
  ensureSqlServerUnicodeTextColumns: vi.fn(),
  ensureSqlServerPerformanceIndexes: vi.fn(),
  ensureUserProfileLegalEntityColumns: vi.fn(),
  ensureDbEnrichmentRunProgressLogColumn: vi.fn(),
  ensureNationalCodeCheckDropped: vi.fn(),
  ensureExtxNakhebinPhoneSchema: vi.fn(),
  ensureExtxMembersSelfRegistrationSchema: vi.fn(),
  ensureExtxMemberDossierSatellitesSchema: vi.fn(),
  ensureExtxCoursesActivitiesSchema: vi.fn(),
  ensureExtxGeoResponsibilitySchema: vi.fn(),
}));

vi.mock('../controlPlaneBootMarkers', () => ({
  CONTROL_PLANE_BOOT_MARKER_KEYS: { runtimePatches: 'runtime_patches' },
  CONTROL_PLANE_RUNTIME_PATCHES_VERSION: '7',
  isControlPlaneBootMarkerCurrent: markerMocks.isControlPlaneBootMarkerCurrent,
  markControlPlaneBootApplied: markerMocks.markControlPlaneBootApplied,
}));

vi.mock('../ensureSampleMockSchema', () => ({
  ensureSampleMockSchema: patchMocks.ensureSampleMockSchema,
}));

vi.mock('../controlPlaneSqlServerUnicode', () => ({
  ensureSqlServerUnicodeTextColumns: patchMocks.ensureSqlServerUnicodeTextColumns,
}));

vi.mock('../controlPlaneSqlServerIndexes', () => ({
  ensureSqlServerPerformanceIndexes: patchMocks.ensureSqlServerPerformanceIndexes,
}));

vi.mock('../controlPlaneProfileSchemaPatches', () => ({
  ensureUserProfileLegalEntityColumns: patchMocks.ensureUserProfileLegalEntityColumns,
  ensureNationalCodeCheckDropped: patchMocks.ensureNationalCodeCheckDropped,
}));

vi.mock('../controlPlaneEnrichmentSchemaPatches', () => ({
  ensureDbEnrichmentRunProgressLogColumn: patchMocks.ensureDbEnrichmentRunProgressLogColumn,
}));

vi.mock('../../domain/extx/ensureExtxNakhebinPhoneSchema', () => ({
  ensureExtxNakhebinPhoneSchema: patchMocks.ensureExtxNakhebinPhoneSchema,
}));

vi.mock('../../domain/extx/ensureExtxMembersSelfRegistrationSchema', () => ({
  ensureExtxMembersSelfRegistrationSchema: patchMocks.ensureExtxMembersSelfRegistrationSchema,
}));

vi.mock('../../domain/extx/ensureExtxMemberDossierSatellitesSchema', () => ({
  ensureExtxMemberDossierSatellitesSchema: patchMocks.ensureExtxMemberDossierSatellitesSchema,
}));

vi.mock('../../domain/extx/ensureExtxCoursesActivitiesSchema', () => ({
  ensureExtxCoursesActivitiesSchema: patchMocks.ensureExtxCoursesActivitiesSchema,
}));

vi.mock('../../domain/extx/ensureExtxGeoResponsibilitySchema', () => ({
  ensureExtxGeoResponsibilitySchema: patchMocks.ensureExtxGeoResponsibilitySchema,
}));

import { ensureControlPlaneRuntimePatches } from '../controlPlaneRuntimePatches';

describe('ensureControlPlaneRuntimePatches', () => {
  const settings = {
    provider: 'sqlserver' as const,
    url: 'sqlserver://localhost;database=AppEnd',
    engine: 'prisma' as const,
  };

  beforeEach(() => {
    markerMocks.isControlPlaneBootMarkerCurrent.mockReset();
    markerMocks.markControlPlaneBootApplied.mockReset();
    patchMocks.ensureSampleMockSchema.mockReset();
    patchMocks.ensureSqlServerUnicodeTextColumns.mockReset();
    patchMocks.ensureSqlServerPerformanceIndexes.mockReset();
    patchMocks.ensureUserProfileLegalEntityColumns.mockReset();
    patchMocks.ensureDbEnrichmentRunProgressLogColumn.mockReset();
    patchMocks.ensureNationalCodeCheckDropped.mockReset();
    patchMocks.ensureExtxNakhebinPhoneSchema.mockReset();
    patchMocks.ensureExtxMembersSelfRegistrationSchema.mockReset();
    patchMocks.ensureExtxMemberDossierSatellitesSchema.mockReset();
    patchMocks.ensureExtxCoursesActivitiesSchema.mockReset();
    patchMocks.ensureExtxGeoResponsibilitySchema.mockReset();

    patchMocks.ensureSampleMockSchema.mockResolvedValue(undefined);
    patchMocks.ensureExtxNakhebinPhoneSchema.mockResolvedValue(undefined);
    patchMocks.ensureExtxMembersSelfRegistrationSchema.mockResolvedValue(undefined);
    patchMocks.ensureExtxMemberDossierSatellitesSchema.mockResolvedValue(undefined);
    patchMocks.ensureExtxCoursesActivitiesSchema.mockResolvedValue(undefined);
    patchMocks.ensureExtxGeoResponsibilitySchema.mockResolvedValue(undefined);
    markerMocks.markControlPlaneBootApplied.mockResolvedValue(undefined);
  });

  it('skips DDL when the boot marker matches', async () => {
    markerMocks.isControlPlaneBootMarkerCurrent.mockResolvedValue(true);

    await ensureControlPlaneRuntimePatches(settings, {});

    expect(patchMocks.ensureSampleMockSchema).not.toHaveBeenCalled();
    expect(patchMocks.ensureSqlServerUnicodeTextColumns).not.toHaveBeenCalled();
  });

  it('runs DDL and records the marker when stale', async () => {
    markerMocks.isControlPlaneBootMarkerCurrent.mockResolvedValue(false);

    await ensureControlPlaneRuntimePatches(settings, {});

    expect(patchMocks.ensureSampleMockSchema).toHaveBeenCalledTimes(1);
    expect(patchMocks.ensureSqlServerUnicodeTextColumns).toHaveBeenCalledWith('sqlserver');
    expect(markerMocks.markControlPlaneBootApplied).toHaveBeenCalled();
  });

  it('ignores the marker when force is true', async () => {
    markerMocks.isControlPlaneBootMarkerCurrent.mockResolvedValue(true);

    await ensureControlPlaneRuntimePatches(settings, { force: true });

    expect(patchMocks.ensureSampleMockSchema).toHaveBeenCalledTimes(1);
  });
});
