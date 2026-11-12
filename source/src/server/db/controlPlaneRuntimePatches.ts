import { resolveActiveSettingsPath } from '../config/settingsFile';
import type { ControlPlaneDatabaseSettings } from './controlPlaneDatabase';
import { readControlPlaneDatabaseSettings } from './controlPlaneDatabase';
import { parseSqlServerConnectionUrl } from './sqlServerControlPlaneUrl';
import { isVerticalRuntimeEnabled } from '../services/vertical/verticalRuntime';
import { readInstallSettings } from './installSettingsStore';
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

const shouldRunVerticalRuntimePatches = (): boolean => {
  if (!isVerticalRuntimeEnabled()) {
    return false;
  }
  const settingsPath = resolveActiveSettingsPath();
  const install = readInstallSettings(settingsPath);
  if (install.pending === true || install.databaseInitialized !== true) {
    return false;
  }
  const active = readControlPlaneDatabaseSettings(settingsPath);
  if (active.provider !== 'sqlserver') {
    return true;
  }
  const database = parseSqlServerConnectionUrl(active.url).database.trim().toLowerCase();
  return database.includes('vertical');
};

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
  if (shouldRunVerticalRuntimePatches()) {
    await ensureHwyNakhebinPhoneSchema(provider);
    await ensureHwyMembersSelfRegistrationSchema();
    await ensureHwyMemberImageFixEditorSchema();
    await ensureHwyMemberDossierSatellitesSchema();
    await ensureHwyCoursesActivitiesSchema();
    await ensureHwyGeoResponsibilitySchema();
  }

  await markControlPlaneBootApplied(
    provider,
    CONTROL_PLANE_BOOT_MARKER_KEYS.runtimePatches,
    CONTROL_PLANE_RUNTIME_PATCHES_VERSION,
  );

  return restoreSchema;
};
