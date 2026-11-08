import { Sequelize } from 'sequelize';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  configureComponentUsageSequelizeForTests,
  ensureComponentUsageTables,
  getComponentUsageSummaryModel,
} from '../../../domain/component-usage/componentUsageSequelizeModels';
import {
  flushComponentUsagePersistence,
  initComponentUsagePersistence,
  lookupComponentUsageLastHits,
  recordComponentUsageHit,
  shutdownComponentUsagePersistence,
} from '../componentUsagePersistence.service';

let sequelize: Sequelize;

beforeEach(async () => {
  sequelize = new Sequelize({ dialect: 'sqlite', storage: ':memory:', logging: false });
  configureComponentUsageSequelizeForTests(sequelize);
  await ensureComponentUsageTables(sequelize);
  initComponentUsagePersistence();
});

afterEach(async () => {
  await shutdownComponentUsagePersistence();
  configureComponentUsageSequelizeForTests(null);
  await sequelize.close();
});

describe('componentUsagePersistence', () => {
  it('coalesces hits and persists last_hit_at', async () => {
    recordComponentUsageHit({ componentName: 'hero-section', kind: 'designer' });
    recordComponentUsageHit({ componentName: 'hero-section', kind: 'designer' });
    await flushComponentUsagePersistence();

    const row = await getComponentUsageSummaryModel(sequelize).findOne({
      where: { componentName: 'hero-section', kind: 'designer' },
    });

    expect(row).not.toBeNull();
    expect(Number(row?.hitCount)).toBe(2);

    const lastHits = await lookupComponentUsageLastHits(['hero-section'], 'designer');
    expect(lastHits.get('hero-section')).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
