import { CONTROL_PLANE_SCHEMA_LAYER_IDS } from '../../config/controlPlaneSchemaOwnership';
import { SETTINGS_PATH } from '../config/settingsFile';
import { installHwySchemaSqlServer } from '../../../scripts/vx-phase1/install-vx-schema-sqlserver';
import { ensureHwyCoursesActivitiesSchema } from '../domain/vx/ensureHwyCoursesActivitiesSchema';
import { ensureHwyGeoResponsibilitySchema } from '../domain/vx/ensureHwyGeoResponsibilitySchema';
import { ensureHwyMemberDossierSatellitesSchema } from '../domain/vx/ensureHwyMemberDossierSatellitesSchema';
import { ensureHwyMemberImageFixEditorSchema } from '../domain/vx/ensureHwyMemberImageFixEditorSchema';
import { ensureHwyMemberPhoneRequestsSchema } from '../domain/vx/ensureHwyMemberPhoneRequestsSchema';
import { ensureHwyMembersSelfRegistrationSchema } from '../domain/vx/ensureHwyMembersSelfRegistrationSchema';
import { ensureHwyNakhebinPhoneSchema } from '../domain/vx/ensureHwyNakhebinPhoneSchema';
import {
  ensureHwyDbObjects,
  resetHwyDbObjectsInstallState,
} from '../domain/vx/ensureHwyDbObjects';
import { ensureControlPlaneInitialized } from './controlPlaneInit';
import { readControlPlaneDatabaseSettings } from './controlPlaneDatabase';
import { ensureControlPlaneFeatureTables } from './ensureControlPlaneFeatureTables';

export type InstallControlPlaneExtensionSchemaOptions = {
  settingsPath?: string;
  /** Apply Vertical core DDL, satellite patches, and dbo.vx_* objects (SQL Server only). */
  vx?: boolean;
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

const VX_SATELLITE_ENSURES: Array<{ id: string; run: () => Promise<void> }> = [
  { id: 'vx-geo-responsibility', run: ensureHwyGeoResponsibilitySchema },
  { id: 'vx-courses-activities', run: ensureHwyCoursesActivitiesSchema },
  { id: 'vx-member-dossier-satellites', run: ensureHwyMemberDossierSatellitesSchema },
  { id: 'vx-member-phone-requests', run: ensureHwyMemberPhoneRequestsSchema },
  { id: 'vx-members-self-registration', run: ensureHwyMembersSelfRegistrationSchema },
  { id: 'vx-member-image-fix-editor', run: ensureHwyMemberImageFixEditorSchema },
  { id: 'vx-nakhebin-phone', run: ensureHwyNakhebinPhoneSchema },
];

/**
 * Canonical operator path for non-Prisma control-plane schema (feature tables + optional Vertical).
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

  if (!options.vx) {
    return { steps };
  }

  const { provider } = readControlPlaneDatabaseSettings(settingsPath);
  if (provider !== 'sqlserver') {
    throw new Error(
      `Vertical extension schema requires sqlserver control plane (got ${provider}).`,
    );
  }

  const tableNames = await installHwySchemaSqlServer();
  steps.push({
    layerId: CONTROL_PLANE_SCHEMA_LAYER_IDS.vxPackageCoreDdl,
    detail: `core tables (${tableNames.length} vx_* present)`,
  });

  for (const satellite of VX_SATELLITE_ENSURES) {
    await satellite.run();
    steps.push({
      layerId: CONTROL_PLANE_SCHEMA_LAYER_IDS.vxPackageSatelliteDdl,
      detail: satellite.id,
    });
  }

  if (options.force) {
    resetHwyDbObjectsInstallState();
  }
  await ensureHwyDbObjects();
  steps.push({
    layerId: CONTROL_PLANE_SCHEMA_LAYER_IDS.vxPackageDbObjects,
    detail: 'dbo.vx_* procedures/views (ensureHwyDbObjects)',
  });

  return { steps };
}
