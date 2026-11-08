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
  ensureHwyNakhebinPhoneSchema: vi.fn(),
  ensureHwyMembersSelfRegistrationSchema: vi.fn(),
  ensureHwyMemberDossierSatellitesSchema: vi.fn(),
  ensureHwyCoursesActivitiesSchema: vi.fn(),
  ensureHwyGeoResponsibilitySchema: vi.fn(),
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

vi.mock('../../domain/hwy/ensureHwyNakhebinPhoneSchema', () => ({
  ensureHwyNakhebinPhoneSchema: patchMocks.ensureHwyNakhebinPhoneSchema,
}));

vi.mock('../../domain/hwy/ensureHwyMembersSelfRegistrationSchema', () => ({
  ensureHwyMembersSelfRegistrationSchema: patchMocks.ensureHwyMembersSelfRegistrationSchema,
}));

vi.mock('../../domain/hwy/ensureHwyMemberDossierSatellitesSchema', () => ({
  ensureHwyMemberDossierSatellitesSchema: patchMocks.ensureHwyMemberDossierSatellitesSchema,
}));

vi.mock('../../domain/hwy/ensureHwyCoursesActivitiesSchema', () => ({
  ensureHwyCoursesActivitiesSchema: patchMocks.ensureHwyCoursesActivitiesSchema,
}));

vi.mock('../../domain/hwy/ensureHwyGeoResponsibilitySchema', () => ({
  ensureHwyGeoResponsibilitySchema: patchMocks.ensureHwyGeoResponsibilitySchema,
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
    patchMocks.ensureHwyNakhebinPhoneSchema.mockReset();
    patchMocks.ensureHwyMembersSelfRegistrationSchema.mockReset();
    patchMocks.ensureHwyMemberDossierSatellitesSchema.mockReset();
    patchMocks.ensureHwyCoursesActivitiesSchema.mockReset();
    patchMocks.ensureHwyGeoResponsibilitySchema.mockReset();

    patchMocks.ensureSampleMockSchema.mockResolvedValue(undefined);
    patchMocks.ensureHwyNakhebinPhoneSchema.mockResolvedValue(undefined);
    patchMocks.ensureHwyMembersSelfRegistrationSchema.mockResolvedValue(undefined);
    patchMocks.ensureHwyMemberDossierSatellitesSchema.mockResolvedValue(undefined);
    patchMocks.ensureHwyCoursesActivitiesSchema.mockResolvedValue(undefined);
    patchMocks.ensureHwyGeoResponsibilitySchema.mockResolvedValue(undefined);
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
