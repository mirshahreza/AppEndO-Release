import { resolveActiveSettingsPath } from '../config/settingsFile';
import type { ControlPlaneDatabaseSettings } from './controlPlaneDatabase';
import { readControlPlaneDatabaseSettings } from './controlPlaneDatabase';
import { parseSqlServerConnectionUrl } from './sqlServerControlPlaneUrl';
import { isHawietyRuntimeEnabled } from '../services/hawiety/hawietyRuntime';
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
import { ensureHwyCoursesActivitiesSchema } from '../domain/hwy/ensureHwyCoursesActivitiesSchema';
import { ensureHwyGeoResponsibilitySchema } from '../domain/hwy/ensureHwyGeoResponsibilitySchema';
import { ensureHwyMemberDossierSatellitesSchema } from '../domain/hwy/ensureHwyMemberDossierSatellitesSchema';
import { ensureHwyMemberImageFixEditorSchema } from '../domain/hwy/ensureHwyMemberImageFixEditorSchema';
import { ensureHwyMembersSelfRegistrationSchema } from '../domain/hwy/ensureHwyMembersSelfRegistrationSchema';
import { ensureHwyNakhebinPhoneSchema } from '../domain/hwy/ensureHwyNakhebinPhoneSchema';

const shouldRunHawietyRuntimePatches = (): boolean => {
  if (!isHawietyRuntimeEnabled()) {
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
  return database.includes('hawiety');
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
  if (shouldRunHawietyRuntimePatches()) {
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
