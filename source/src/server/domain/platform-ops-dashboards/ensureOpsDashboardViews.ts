import { QueryTypes } from 'sequelize';
import type { ControlPlaneDbProvider } from '../../db/controlPlaneDatabase';
import {
  CONTROL_PLANE_BOOT_MARKER_KEYS,
  CONTROL_PLANE_OPS_DASHBOARD_VIEWS_VERSION,
  isControlPlaneBootMarkerCurrent,
  markControlPlaneBootApplied,
} from '../../db/controlPlaneBootMarkers';
import { getControlPlaneSequelize } from '../../db/controlPlaneSequelize';
import { logger } from '../../../core/logging/Logger';
import {
  buildOpsDashboardViewStatements,
  opsDashboardSqlDialectForProvider,
} from './opsDashboardViews';

export const ensureOpsDashboardViews = async (
  provider: ControlPlaneDbProvider,
): Promise<void> => {
  if (
    await isControlPlaneBootMarkerCurrent(
      provider,
      CONTROL_PLANE_BOOT_MARKER_KEYS.opsDashboardViews,
      CONTROL_PLANE_OPS_DASHBOARD_VIEWS_VERSION,
    )
  ) {
    return;
  }

  const dialect = opsDashboardSqlDialectForProvider(provider);
  const sequelize = getControlPlaneSequelize();
  const statements = buildOpsDashboardViewStatements(dialect);

  for (const statement of statements) {
    try {
      if (statement.dropSql) {
        await sequelize.query(statement.dropSql, { type: QueryTypes.RAW });
      }
      await sequelize.query(statement.ensureSql, { type: QueryTypes.RAW });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      logger.warn('Server', `Could not ensure ops dashboard view ${statement.name}: ${message}`);
      throw error;
    }
  }

  await markControlPlaneBootApplied(
    provider,
    CONTROL_PLANE_BOOT_MARKER_KEYS.opsDashboardViews,
    CONTROL_PLANE_OPS_DASHBOARD_VIEWS_VERSION,
  );
};
