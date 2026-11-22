import { CONTROL_PLANE_SCHEMA_LAYER_IDS } from '../../config/controlPlaneSchemaOwnership';
import { SETTINGS_PATH } from '../config/settingsFile';
import { installExtxSchemaSqlServer } from '../../oss/excludedModuleStub';
import { ensureExtxCoursesActivitiesSchema } from '../../oss/excludedModuleStub';
import { ensureExtxGeoResponsibilitySchema } from '../../oss/excludedModuleStub';
import { ensureExtxMemberDossierSatellitesSchema } from '../../oss/excludedModuleStub';
import { ensureExtxMemberImageFixEditorSchema } from '../../oss/excludedModuleStub';
import { ensureExtxMemberPhoneRequestsSchema } from '../../oss/excludedModuleStub';
import { ensureExtxMembersSelfRegistrationSchema } from '../../oss/excludedModuleStub';
import { ensureExtxNakhebinPhoneSchema } from '../../oss/excludedModuleStub';
import {
  ensureExtxDbObjects,
  resetExtxDbObjectsInstallState,
} from '../../oss/excludedModuleStub';
import { ensureControlPlaneInitialized } from './controlPlaneInit';
import { readControlPlaneDatabaseSettings } from './controlPlaneDatabase';
import { ensureControlPlaneFeatureTables } from './ensureControlPlaneFeatureTables';

export type InstallControlPlaneExtensionSchemaOptions = {
  settingsPath?: string;
  /** Apply Portalx core DDL, satellite patches, and dbo.extx_* objects (SQL Server only). */
  extx?: boolean;
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

const EXTX_SATELLITE_ENSURES: Array<{ id: string; run: () => Promise<void> }> = [
  { id: 'extx-geo-responsibility', run: ensureExtxGeoResponsibilitySchema },
  { id: 'extx-courses-activities', run: ensureExtxCoursesActivitiesSchema },
  { id: 'extx-member-dossier-satellites', run: ensureExtxMemberDossierSatellitesSchema },
  { id: 'extx-member-phone-requests', run: ensureExtxMemberPhoneRequestsSchema },
  { id: 'extx-members-self-registration', run: ensureExtxMembersSelfRegistrationSchema },
  { id: 'extx-member-image-fix-editor', run: ensureExtxMemberImageFixEditorSchema },
  { id: 'extx-nakhebin-phone', run: ensureExtxNakhebinPhoneSchema },
];

/**
 * Canonical operator path for non-Prisma control-plane schema (feature tables + optional Portalx).
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

  if (!options.extx) {
    return { steps };
  }

  const { provider } = readControlPlaneDatabaseSettings(settingsPath);
  if (provider !== 'sqlserver') {
    throw new Error(
      `Portalx extension schema requires sqlserver control plane (got ${provider}).`,
    );
  }

  const tableNames = await installExtxSchemaSqlServer();
  steps.push({
    layerId: CONTROL_PLANE_SCHEMA_LAYER_IDS.extxPackageCoreDdl,
    detail: `core tables (${tableNames.length} extx_* present)`,
  });

  for (const satellite of EXTX_SATELLITE_ENSURES) {
    await satellite.run();
    steps.push({
      layerId: CONTROL_PLANE_SCHEMA_LAYER_IDS.extxPackageSatelliteDdl,
      detail: satellite.id,
    });
  }

  if (options.force) {
    resetExtxDbObjectsInstallState();
  }
  await ensureExtxDbObjects();
  steps.push({
    layerId: CONTROL_PLANE_SCHEMA_LAYER_IDS.extxPackageDbObjects,
    detail: 'dbo.extx_* procedures/views (ensureExtxDbObjects)',
  });

  return { steps };
}
