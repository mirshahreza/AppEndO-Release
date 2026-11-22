import { resolveActiveSettingsPath } from '../config/settingsFile';
import type { ControlPlaneDatabaseSettings } from './controlPlaneDatabase';
import { readControlPlaneDatabaseSettings } from './controlPlaneDatabase';
import { parseSqlServerConnectionUrl } from './sqlServerControlPlaneUrl';
import { isPortalxRuntimeEnabled } from '../../oss/excludedModuleStub';
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
import { ensureExtxCoursesActivitiesSchema } from '../../oss/excludedModuleStub';
import { ensureExtxGeoResponsibilitySchema } from '../../oss/excludedModuleStub';
import { ensureExtxMemberDossierSatellitesSchema } from '../../oss/excludedModuleStub';
import { ensureExtxMemberImageFixEditorSchema } from '../../oss/excludedModuleStub';
import { ensureExtxMembersSelfRegistrationSchema } from '../../oss/excludedModuleStub';
import { ensureExtxNakhebinPhoneSchema } from '../../oss/excludedModuleStub';

const shouldRunPortalxRuntimePatches = (): boolean => {
  if (!isPortalxRuntimeEnabled()) {
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
  return database.includes('portalx');
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
  if (shouldRunPortalxRuntimePatches()) {
    await ensureExtxNakhebinPhoneSchema(provider);
    await ensureExtxMembersSelfRegistrationSchema();
    await ensureExtxMemberImageFixEditorSchema();
    await ensureExtxMemberDossierSatellitesSchema();
    await ensureExtxCoursesActivitiesSchema();
    await ensureExtxGeoResponsibilitySchema();
  }

  await markControlPlaneBootApplied(
    provider,
    CONTROL_PLANE_BOOT_MARKER_KEYS.runtimePatches,
    CONTROL_PLANE_RUNTIME_PATCHES_VERSION,
  );

  return restoreSchema;
};
