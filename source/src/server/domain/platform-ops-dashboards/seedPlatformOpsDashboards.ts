import { readControlPlaneDatabaseSettings } from '../../db/controlPlaneDatabase';
import { getDataSourcesFromSettings } from '../../db/dataSourcesStore';
import { logger } from '../../../core/logging/Logger';
import { ensureOpsDashboardViews } from './ensureOpsDashboardViews';
import { seedOpsDashboardCanvases } from './opsDashboardCanvasSeed';
import { seedOpsDashboardEdgeLayer } from './opsDashboardEdgeSeed';

export const seedPlatformOpsDashboards = async (settingsPath: string): Promise<void> => {
  const dataSource = getDataSourcesFromSettings(settingsPath).find((item) => item.isDefault);
  if (!dataSource) {
    logger.info('Server', 'Ops dashboards skipped Edge/canvas seed: no default data source.');
    return;
  }

  const models = seedOpsDashboardEdgeLayer(dataSource);
  await seedOpsDashboardCanvases(dataSource, models);
};

/** Views + Edge + canvases + Insights routes. Safe to call on every boot. */
export const ensurePlatformOpsDashboards = async (settingsPath: string): Promise<void> => {
  const settings = readControlPlaneDatabaseSettings(settingsPath);
  await ensureOpsDashboardViews(settings.provider);
  await seedPlatformOpsDashboards(settingsPath);
};
