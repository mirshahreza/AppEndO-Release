import { ModelCtor, Sequelize } from 'sequelize';
import type { StoredDataSource } from '../../../db/dataSourcesStore';
import type { EdgeModelDefinition } from '../../../../shared/api/contracts/data-api';
import { buildSequelizeOptions } from './dialectConfig';
import { defineDynamicModel } from './buildDynamicModel';
import { registerModelAssociations } from './associationRegistry';

type EdgeSequelizeFactoryDeps = {
  getDataSources: () => StoredDataSource[];
};

const sequelizeCache = new Map<string, Sequelize>();

export class EdgeSequelizeFactory {
  private readonly getDataSources: () => StoredDataSource[];

  constructor(deps: EdgeSequelizeFactoryDeps) {
    this.getDataSources = deps.getDataSources;
  }

  private resolveDataSource(dataSourceId: string): StoredDataSource {
    const source = this.getDataSources().find((item) => item.id === dataSourceId);
    if (!source) {
      throw new Error(`Data source not found: ${dataSourceId}`);
    }
    return source;
  }

  async getOrCreate(dataSourceId: string): Promise<Sequelize> {
    const cached = sequelizeCache.get(dataSourceId);
    if (cached) {
      return cached;
    }

    const source = this.resolveDataSource(dataSourceId);
    const options = buildSequelizeOptions(source);
    const sequelize = new Sequelize(options);

    await sequelize.authenticate();
    sequelizeCache.set(dataSourceId, sequelize);
    return sequelize;
  }

  invalidate(dataSourceId: string): void {
    const cached = sequelizeCache.get(dataSourceId);
    if (!cached) {
      return;
    }

    sequelizeCache.delete(dataSourceId);
    void cached.close().catch(() => {
      // Ignore close failures during invalidation.
    });
  }

  buildModel(def: EdgeModelDefinition): ModelCtor {
    const sequelize = sequelizeCache.get(def.dataSourceId);
    if (!sequelize) {
      throw new Error(`Sequelize instance is not initialized for data source: ${def.dataSourceId}`);
    }

    return defineDynamicModel(sequelize, def);
  }

  registerAssociations(
    models: Map<string, ModelCtor>,
    defs: EdgeModelDefinition[],
  ): void {
    registerModelAssociations(models, defs);
  }

  buildModelGraph(defs: EdgeModelDefinition[]): Map<string, ModelCtor> {
    const models = new Map<string, ModelCtor>();
    for (const def of defs) {
      models.set(def.id, this.buildModel(def));
    }
    this.registerAssociations(models, defs);
    return models;
  }
}

export const resetEdgeSequelizeFactoryCache = async (): Promise<void> => {
  const instances = [...sequelizeCache.values()];
  sequelizeCache.clear();
  await Promise.all(instances.map((instance) => instance.close().catch(() => undefined)));
};
