import type { ModelCtor, Sequelize } from 'sequelize';
import type { EdgeApiOperation } from '../../../shared/api/contracts/data-api';
import type { EdgeModelDefinition } from '../../../shared/api/contracts/data-api';
import type { StoredDataSource } from '../../db/dataSourcesStore';
import { getEdgeModelById } from './edgeModelStore';
import { loadAssociationContext } from './sequelize/associationRegistry';
import type { FieldEnrichmentDeps } from './dataApiFieldEnrichment';
import { EdgeSequelizeFactory } from './sequelize/edgeSequelizeFactory';

export type PublishedEdgeModelContext = {
  Model: ModelCtor;
  model: EdgeModelDefinition;
  source: StoredDataSource;
  sequelize: Sequelize;
};

let sequelizeFactory: EdgeSequelizeFactory | null = null;
let getDataSourcesRef: (() => StoredDataSource[]) | null = null;

export const configureDataApiPublishedRuntime = (
  getDataSources: () => StoredDataSource[],
): void => {
  getDataSourcesRef = getDataSources;
  sequelizeFactory = new EdgeSequelizeFactory({ getDataSources });
};

export const resetDataApiPublishedRuntimeForTests = async (): Promise<void> => {
  sequelizeFactory = null;
  getDataSourcesRef = null;
};

export const resolvePublishedEdgeModel = async (
  edgeModelId: string,
): Promise<PublishedEdgeModelContext> => {
  if (!sequelizeFactory || !getDataSourcesRef) {
    throw new Error('Data API published runtime is not configured.');
  }

  const model = getEdgeModelById(edgeModelId);
  if (!model) {
    throw new Error(`Edge model not found: ${edgeModelId}`);
  }

  const source = getDataSourcesRef().find((item) => item.id === model.dataSourceId);
  if (!source) {
    throw new Error(`Data source not found: ${model.dataSourceId}`);
  }

  const { defs } = loadAssociationContext(model.id);
  const graphDefs = defs.length > 0 ? defs : [model];
  const sequelize = await sequelizeFactory.getOrCreate(model.dataSourceId);
  const models = sequelizeFactory.buildModelGraph(graphDefs);
  const Model = models.get(model.id);
  if (!Model) {
    throw new Error('Failed to build Edge Sequelize model.');
  }

  return { Model, model, source, sequelize };
};

const collectJoinLookupModelDefs = (
  rootModel: EdgeModelDefinition,
  graphDefs: EdgeModelDefinition[],
  operation: EdgeApiOperation,
): EdgeModelDefinition[] => {
  const joinLookups = operation.enrichments?.filter((item) => item.kind === 'join_lookup') ?? [];
  if (joinLookups.length === 0) {
    return graphDefs;
  }

  const merged = [...graphDefs];
  const knownIds = new Set(merged.map((item) => item.id));
  for (const enrichment of joinLookups) {
    if (knownIds.has(enrichment.targetModelId)) {
      continue;
    }
    const targetModel = getEdgeModelById(enrichment.targetModelId);
    if (!targetModel || targetModel.dataSourceId !== rootModel.dataSourceId) {
      continue;
    }
    merged.push(targetModel);
    knownIds.add(targetModel.id);
  }
  return merged;
};

export const resolveFieldEnrichmentDeps = async (
  edgeModelId: string,
  operation: EdgeApiOperation,
): Promise<FieldEnrichmentDeps | undefined> => {
  const joinLookups = operation.enrichments?.filter((item) => item.kind === 'join_lookup') ?? [];
  if (joinLookups.length === 0) {
    return undefined;
  }

  if (!sequelizeFactory || !getDataSourcesRef) {
    throw new Error('Data API published runtime is not configured.');
  }

  const model = getEdgeModelById(edgeModelId);
  if (!model) {
    throw new Error(`Edge model not found: ${edgeModelId}`);
  }

  const { defs } = loadAssociationContext(model.id);
  const graphDefs = defs.length > 0 ? defs : [model];
  const mergedDefs = collectJoinLookupModelDefs(model, graphDefs, operation);
  await sequelizeFactory.getOrCreate(model.dataSourceId);
  const modelGraph = sequelizeFactory.buildModelGraph(mergedDefs);

  return {
    getTargetModelById: (targetModelId) => modelGraph.get(targetModelId),
  };
};
