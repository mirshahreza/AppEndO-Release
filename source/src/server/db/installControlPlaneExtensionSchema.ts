import { CONTROL_PLANE_SCHEMA_LAYER_IDS } from '../../config/controlPlaneSchemaOwnership';
import { SETTINGS_PATH } from '../config/settingsFile';
import { installHwySchemaSqlServer } from '../../../scripts/hwy-phase1/install-hwy-schema-sqlserver';
import { ensureHwyCoursesActivitiesSchema } from '../domain/hwy/ensureHwyCoursesActivitiesSchema';
import { ensureHwyGeoResponsibilitySchema } from '../domain/hwy/ensureHwyGeoResponsibilitySchema';
import { ensureHwyMemberDossierSatellitesSchema } from '../domain/hwy/ensureHwyMemberDossierSatellitesSchema';
import { ensureHwyMemberImageFixEditorSchema } from '../domain/hwy/ensureHwyMemberImageFixEditorSchema';
import { ensureHwyMemberPhoneRequestsSchema } from '../domain/hwy/ensureHwyMemberPhoneRequestsSchema';
import { ensureHwyMembersSelfRegistrationSchema } from '../domain/hwy/ensureHwyMembersSelfRegistrationSchema';
import { ensureHwyNakhebinPhoneSchema } from '../domain/hwy/ensureHwyNakhebinPhoneSchema';
import {
  ensureHwyDbObjects,
  resetHwyDbObjectsInstallState,
} from '../domain/hwy/ensureHwyDbObjects';
import { ensureControlPlaneInitialized } from './controlPlaneInit';
import { readControlPlaneDatabaseSettings } from './controlPlaneDatabase';
import { ensureControlPlaneFeatureTables } from './ensureControlPlaneFeatureTables';

export type InstallControlPlaneExtensionSchemaOptions = {
  settingsPath?: string;
  /** Apply Hawiety core DDL, satellite patches, and dbo.hwy_* objects (SQL Server only). */
  hwy?: boolean;
  /** Re-run Sequelize feature ensures even when boot marker is current. */
  force?: boolean;
  /** Run additive Prisma sync before extensions (default false). */
  pushPrisma?: boolean;
};

export type InstallControlPlaneExtensionSchemaStep = {
  layerId: string;
  detail: string;
};

export type InstallControlPlaneExtensionSchemaResult = {
  steps: InstallControlPlaneExtensionSchemaStep[];
};

const HWY_SATELLITE_ENSURES: Array<{ id: string; run: () => Promise<void> }> = [
  { id: 'hwy-geo-responsibility', run: ensureHwyGeoResponsibilitySchema },
  { id: 'hwy-courses-activities', run: ensureHwyCoursesActivitiesSchema },
  { id: 'hwy-member-dossier-satellites', run: ensureHwyMemberDossierSatellitesSchema },
  { id: 'hwy-member-phone-requests', run: ensureHwyMemberPhoneRequestsSchema },
  { id: 'hwy-members-self-registration', run: ensureHwyMembersSelfRegistrationSchema },
  { id: 'hwy-member-image-fix-editor', run: ensureHwyMemberImageFixEditorSchema },
  { id: 'hwy-nakhebin-phone', run: ensureHwyNakhebinPhoneSchema },
];

/**
 * Canonical operator path for non-Prisma control-plane schema (feature tables + optional Hawiety).
 * Server boot still runs idempotent ensures; prefer this command for upgrades and CI.
 */
export async function installControlPlaneExtensionSchema(
  options: InstallControlPlaneExtensionSchemaOptions = {},
): Promise<InstallControlPlaneExtensionSchemaResult> {
  const settingsPath = options.settingsPath ?? SETTINGS_PATH;
  const steps: InstallControlPlaneExtensionSchemaStep[] = [];

  await ensureControlPlaneInitialized(settingsPath, { pushSchema: options.pushPrisma === true });

  await ensureControlPlaneFeatureTables(settingsPath, { force: options.force === true });
  steps.push({
    layerId: CONTROL_PLANE_SCHEMA_LAYER_IDS.sequelizeFeatureExtensions,
    detail: options.force ? 'feature tables (forced)' : 'feature tables',
  });

  if (!options.hwy) {
    return { steps };
  }

  const { provider } = readControlPlaneDatabaseSettings(settingsPath);
  if (provider !== 'sqlserver') {
    throw new Error(
      `Hawiety extension schema requires sqlserver control plane (got ${provider}).`,
    );
  }

  const tableNames = await installHwySchemaSqlServer();
  steps.push({
    layerId: CONTROL_PLANE_SCHEMA_LAYER_IDS.hwyPackageCoreDdl,
    detail: `core tables (${tableNames.length} hwy_* present)`,
  });

  for (const satellite of HWY_SATELLITE_ENSURES) {
    await satellite.run();
    steps.push({
      layerId: CONTROL_PLANE_SCHEMA_LAYER_IDS.hwyPackageSatelliteDdl,
      detail: satellite.id,
    });
  }

  if (options.force) {
    resetHwyDbObjectsInstallState();
  }
  await ensureHwyDbObjects();
  steps.push({
    layerId: CONTROL_PLANE_SCHEMA_LAYER_IDS.hwyPackageDbObjects,
    detail: 'dbo.hwy_* procedures/views (ensureHwyDbObjects)',
  });

  return { steps };
}
