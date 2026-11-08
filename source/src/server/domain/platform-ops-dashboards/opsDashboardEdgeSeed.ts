import {
  defaultEdgeApiRuntimeSettings,
  type EdgeApiDefinition,
  type EdgeModelColumn,
  type EdgeModelDefinition,
} from '../../../shared/api/contracts/data-api';
import {
  OPS_DASHBOARD_MODELS,
  assertOpsDashboardExposedFields,
  opsDashboardExposedFields,
  type OpsDashboardColumnKind,
  type OpsDashboardModelSpec,
} from '../../../shared/lib/opsDashboardCatalog';
import { computeSchemaFingerprint } from '../../services/data-api/fingerprint';
import { getEdgeModelById, listEdgeModels, saveEdgeModel } from '../../services/data-api/edgeModelStore';
import {
  getEdgeApiDefinitionById,
  getEdgeApiDefinitionByKey,
  saveEdgeApiDefinition,
} from '../../services/data-api/edgeApiStore';
import { isEdgeApiPublishCurrent, publishEdgeApiDefinition } from '../../services/data-api/edgeApiPublisher';
import { toPascalCaseModelName } from '../../services/data-api/sequelize/typeMapping';
import type { StoredDataSource } from '../../db/dataSourcesStore';

const columnType = (kind: OpsDashboardColumnKind): { dataType: string; sequelizeType: string } => {
  switch (kind) {
    case 'id':
    case 'bigint':
      return { dataType: 'bigint', sequelizeType: 'INTEGER' };
    case 'int':
    case 'bool':
      return { dataType: 'integer', sequelizeType: 'INTEGER' };
    case 'date':
      return { dataType: 'timestamp', sequelizeType: 'DATE' };
    case 'string':
    default:
      return { dataType: 'nvarchar', sequelizeType: 'STRING' };
  }
};

const isPrimary = (spec: OpsDashboardModelSpec, name: string): boolean => (
  Array.isArray(spec.primaryKey) ? spec.primaryKey.includes(name) : spec.primaryKey === name
);

export const buildOpsDashboardEdgeColumns = (spec: OpsDashboardModelSpec): EdgeModelColumn[] => (
  spec.columns.map((column) => {
    const types = columnType(column.kind);
    return {
      name: column.name,
      field: column.name,
      dataType: types.dataType,
      sequelizeType: types.sequelizeType,
      allowNull: column.allowNull === true || !isPrimary(spec, column.name),
      isPrimaryKey: isPrimary(spec, column.name),
      isForeignKey: false,
    };
  })
);

const findExistingModel = (spec: OpsDashboardModelSpec, dataSourceId: string): EdgeModelDefinition | null => {
  const byId = getEdgeModelById(spec.edgeModelId);
  if (byId && byId.dataSourceId === dataSourceId) {
    return byId;
  }
  return listEdgeModels().find((model) => (
    model.dataSourceId === dataSourceId && model.objectName === spec.objectName
  )) ?? null;
};

export const upsertOpsDashboardEdgeModel = (
  spec: OpsDashboardModelSpec,
  dataSource: StoredDataSource,
): EdgeModelDefinition => {
  const columns = buildOpsDashboardEdgeColumns(spec);
  assertOpsDashboardExposedFields(columns.map((column) => column.name));
  const existing = findExistingModel(spec, dataSource.id);
  const now = new Date().toISOString();
  const primaryKey = Array.isArray(spec.primaryKey) ? [...spec.primaryKey] : spec.primaryKey;
  const schemaFingerprint = computeSchemaFingerprint({
    dataSourceId: dataSource.id,
    schema: null,
    objectName: spec.objectName,
    columns,
    primaryKey,
  });
  if (
    existing
    && existing.schemaFingerprint === schemaFingerprint
    && existing.objectName === spec.objectName
    && existing.readOnly === true
    && existing.status === 'ready'
  ) {
    return existing;
  }

  const model: EdgeModelDefinition = {
    id: existing?.id ?? spec.edgeModelId,
    dataSourceId: dataSource.id,
    schema: null,
    objectName: spec.objectName,
    objectType: spec.objectType,
    sequelize: {
      modelName: toPascalCaseModelName(spec.objectName),
      tableName: spec.objectName,
    },
    columns,
    primaryKey,
    associations: existing?.associations ?? [],
    schemaFingerprint,
    readOnly: true,
    labels: { title: spec.label },
    status: 'ready',
    created_at: existing?.created_at ?? now,
    updated_at: now,
  };
  return saveEdgeModel(model);
};

const adminAccess = () => ({
  accessMode: 'specific' as const,
  allowRoles: ['ADMIN'],
  allowUsers: [] as string[],
  denyRoles: [] as string[],
  denyUsers: [] as string[],
});

export const upsertOpsDashboardPivotApi = (
  spec: OpsDashboardModelSpec,
  model: EdgeModelDefinition,
): EdgeApiDefinition => {
  const readFields = assertOpsDashboardExposedFields(opsDashboardExposedFields(spec));
  const existing = getEdgeApiDefinitionById(spec.apiId) ?? getEdgeApiDefinitionByKey(spec.apiKey);
  const definition: EdgeApiDefinition = {
    id: existing?.id ?? spec.apiId,
    edgeModelId: model.id,
    key: spec.apiKey,
    label: `${spec.label} pivot`,
    basePath: `/api/ops/${spec.id}`,
    operations: [{
      id: `${spec.id}-pivot`,
      method: 'POST',
      kind: 'pivot',
      pathPattern: `/api/ops/${spec.id}/pivot`,
      enabled: true,
      fields: { read: readFields },
      query: {
        allowFilter: true,
        allowSort: false,
        maxPageSize: 1000,
        defaultPageSize: 100,
      },
    }],
    accessControl: adminAccess(),
    openapi: { tags: ['Ops Insights'], summary: `${spec.label} pivot` },
    publishedAt: existing?.publishedAt ?? null,
    version: existing?.version ?? 1,
    runtime: existing?.runtime ?? defaultEdgeApiRuntimeSettings(),
    managedFunctionId: existing?.managedFunctionId,
  };
  const saved = saveEdgeApiDefinition(definition);
  const enabledOps = saved.operations.filter((operation) => operation.enabled);
  if (isEdgeApiPublishCurrent(saved, model, enabledOps)) {
    return saved;
  }
  return publishEdgeApiDefinition(saved.id);
};

export const seedOpsDashboardEdgeLayer = (dataSource: StoredDataSource): Map<string, EdgeModelDefinition> => {
  const models = new Map<string, EdgeModelDefinition>();
  for (const spec of OPS_DASHBOARD_MODELS) {
    const model = upsertOpsDashboardEdgeModel(spec, dataSource);
    upsertOpsDashboardPivotApi(spec, model);
    models.set(spec.id, model);
  }
  return models;
};
