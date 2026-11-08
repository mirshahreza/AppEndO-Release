import type { ControlPlaneDatabaseSettings } from './controlPlaneDatabase';
import { ensureDbEnrichmentRunProgressLogColumn } from './controlPlaneEnrichmentSchemaPatches';
import {
  CONTROL_PLANE_BOOT_MARKER_KEYS,
  CONTROL_PLANE_RUNTIME_PATCHES_VERSION,
  isControlPlaneBootMarkerCurrent,
  markControlPlaneBootApplied,
} from './controlPlaneBootMarkers';
import { ensureUserProfileLegalEntityColumns, ensureNationalCodeCheckDropped } from './controlPlaneProfileSchemaPatches';
import { ensureSqlServerPerformanceIndexes } from './controlPlaneSqlServerIndexes';
import { ensureSqlServerUnicodeTextColumns } from './controlPlaneSqlServerUnicode';
import { ensureSampleMockSchema } from './ensureSampleMockSchema';
import { ensureHwyCoursesActivitiesSchema } from '../domain/vx/ensureHwyCoursesActivitiesSchema';
import { ensureHwyGeoResponsibilitySchema } from '../domain/vx/ensureHwyGeoResponsibilitySchema';
import { ensureHwyMemberDossierSatellitesSchema } from '../domain/vx/ensureHwyMemberDossierSatellitesSchema';
import { ensureHwyMemberImageFixEditorSchema } from '../domain/vx/ensureHwyMemberImageFixEditorSchema';
import { ensureHwyMembersSelfRegistrationSchema } from '../domain/vx/ensureHwyMembersSelfRegistrationSchema';
import { ensureHwyNakhebinPhoneSchema } from '../domain/vx/ensureHwyNakhebinPhoneSchema';

/**
 * Idempotent runtime DDL (sample mock, MSSQL unicode/index, profile/enrichment patches).
 * Skipped on normal restart when the boot marker matches {@link CONTROL_PLANE_RUNTIME_PATCHES_VERSION}.
 */
export const ensureControlPlaneRuntimePatches = async (
  settings: ControlPlaneDatabaseSettings,
  options: { force?: boolean },
): Promise<(() => void) | undefined> => {
  const { provider } = settings;
  if (
    !options.force
    && await isControlPlaneBootMarkerCurrent(
      provider,
      CONTROL_PLANE_BOOT_MARKER_KEYS.runtimePatches,
      CONTROL_PLANE_RUNTIME_PATCHES_VERSION,
    )
  ) {
    return undefined;
  }

  const restoreSchema = await ensureSampleMockSchema(settings);

  await ensureSqlServerUnicodeTextColumns(provider);
  await ensureSqlServerPerformanceIndexes(provider);
  await ensureUserProfileLegalEntityColumns(provider);
  await ensureDbEnrichmentRunProgressLogColumn(provider);
  await ensureNationalCodeCheckDropped(provider);
  await ensureHwyNakhebinPhoneSchema(provider);
  await ensureHwyMembersSelfRegistrationSchema();
  await ensureHwyMemberImageFixEditorSchema();
  await ensureHwyMemberDossierSatellitesSchema();
  await ensureHwyCoursesActivitiesSchema();
  await ensureHwyGeoResponsibilitySchema();

  await markControlPlaneBootApplied(
    provider,
    CONTROL_PLANE_BOOT_MARKER_KEYS.runtimePatches,
    CONTROL_PLANE_RUNTIME_PATCHES_VERSION,
  );

  return restoreSchema;
};
