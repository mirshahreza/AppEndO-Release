import { ensureBaseInfoCultureTextTable } from '../domain/base-info/baseInfoCultureTextSequelizeModel';
import { ensureBaseInfoTitlePathTable } from '../domain/base-info/baseInfoTitlePathSequelizeModel';
import { ensureComponentUsageTables } from '../domain/component-usage/componentUsageSequelizeModels';
import { ensureDashboardCanvasTables } from '../domain/dashboard-canvas/dashboardCanvasSequelizeModels';
import { ensureEdgeDataSourcesTable } from '../domain/data-sources/edgeDataSourceSequelizeModel';
import { ensureProductIdeaTable } from '../domain/idea-foundry/ideaFoundrySequelizeModel';
import { ensureRecordEventTables } from '../domain/record-events/recordEventSequelizeModels';
import { ensureCredentialVaultTable } from '../domain/security/credentialVault/credentialVaultSequelizeModel';
import { ensureUserMessageDispatchTables } from '../domain/user-message-dispatches/userMessageDispatchSequelizeModels';
import { ensurePersonalInboxArchivedTables } from '../domain/personal-inbox/personalInboxArchivedSequelizeModels';
import { ensurePersonalInboxFolderTables } from '../domain/personal-inbox/personalInboxFolderSequelizeModels';
import { ensurePersonalInboxSeenTable } from '../domain/personal-inbox/personalInboxSeenSequelizeModels';
import { ensurePersonalInboxCorrespondenceTable } from '../domain/personal-inbox/personalInboxCorrespondenceSequelizeModels';
import { ensurePersonalInboxProjectionTables } from '../domain/personal-inbox/personalInboxProjectionSequelizeModels';
import { ensureWorkbookTable } from '../domain/workbooks/workbookSequelizeModel';
import { ensureHwyBusinessRuleDocTable } from '../domain/hwy/hwyBusinessRuleDocsSequelizeModel';
import { ensureDirectMessageTables } from '../domain/direct-messages/directMessageSequelizeModels';
import {
  CONTROL_PLANE_BOOT_MARKER_KEYS,
  CONTROL_PLANE_SEQUELIZE_FEATURE_SCHEMA_VERSION,
  isControlPlaneBootMarkerCurrent,
  markControlPlaneBootApplied,
} from './controlPlaneBootMarkers';
import { readControlPlaneDatabaseSettings } from './controlPlaneDatabase';

const FEATURE_TABLE_ENSURES: Array<() => Promise<void>> = [
  ensureBaseInfoCultureTextTable,
  ensureBaseInfoTitlePathTable,
  ensureWorkbookTable,
  ensureProductIdeaTable,
  ensureCredentialVaultTable,
  ensureEdgeDataSourcesTable,
  ensureDashboardCanvasTables,
  ensureRecordEventTables,
  ensureUserMessageDispatchTables,
  ensurePersonalInboxProjectionTables,
  ensurePersonalInboxArchivedTables,
  ensurePersonalInboxFolderTables,
  ensurePersonalInboxSeenTable,
  ensurePersonalInboxCorrespondenceTable,
  ensureComponentUsageTables,
  ensureHwyBusinessRuleDocTable,
  ensureDirectMessageTables,
];

export type EnsureControlPlaneFeatureTablesOptions = {
  /** Skip boot marker and re-apply all feature ensures (operator / CI). */
  force?: boolean;
};

/** Idempotent Sequelize feature tables — parallel on server engines, serial on SQLite. */
export async function ensureControlPlaneFeatureTables(
  settingsPath: string,
  options?: EnsureControlPlaneFeatureTablesOptions,
): Promise<void> {
  const { provider } = readControlPlaneDatabaseSettings(settingsPath);
  if (
    !options?.force
    && (await isControlPlaneBootMarkerCurrent(
      provider,
      CONTROL_PLANE_BOOT_MARKER_KEYS.sequelizeFeatureTables,
      CONTROL_PLANE_SEQUELIZE_FEATURE_SCHEMA_VERSION,
    ))
  ) {
    return;
  }
  if (provider === 'sqlite') {
    for (const ensure of FEATURE_TABLE_ENSURES) {
      await ensure();
    }
    await markControlPlaneBootApplied(
      provider,
      CONTROL_PLANE_BOOT_MARKER_KEYS.sequelizeFeatureTables,
      CONTROL_PLANE_SEQUELIZE_FEATURE_SCHEMA_VERSION,
    );
    return;
  }
  await Promise.all(FEATURE_TABLE_ENSURES.map((ensure) => ensure()));
  await markControlPlaneBootApplied(
    provider,
    CONTROL_PLANE_BOOT_MARKER_KEYS.sequelizeFeatureTables,
    CONTROL_PLANE_SEQUELIZE_FEATURE_SCHEMA_VERSION,
  );
}
