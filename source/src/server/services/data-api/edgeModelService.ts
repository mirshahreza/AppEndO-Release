import type { EdgeDbQueryFn } from '../server-function.service';
import type { StoredDataSource } from '../../db/dataSourcesStore';
import {
  listDataSourceObjectFields,
  listDataSourceObjectRelations,
  listDataSourceSchemaObjects,
  type SchemaObjectType,
} from '../../utils/dataSourceSchemaIntrospection';
import type {
  EdgeModelAssociation,
  EdgeModelColumn,
  EdgeModelDefinition,
  ImportEdgeModelInput,
  UpsertEdgeModelStudioMetaInput,
} from '../../../shared/api/contracts/data-api';
import {
  buildAddColumnStatement,
  buildDropColumnStatement,
  resolveNewTableColumns,
  resolveRemovedTableColumnNames,
} from '../../../shared/lib/schemaObjectAlteration';
import { assertControlPlaneEdgeModelPatchAllowed } from '../../../shared/lib/controlPlaneEdgeModelGuards';
import { annotateEdgeModelColumnsWithForeignKeys } from '../../../shared/lib/edgeModelForeignKeys';
import { computeSchemaFingerprint } from './fingerprint';
import { EdgeSequelizeFactory } from './sequelize/edgeSequelizeFactory';
import { buildModelDefinitionDraft } from './sequelize/buildDynamicModel';
import {
  createEdgeModelId,
  getEdgeModelById,
  listEdgeModels,
  saveEdgeModel,
} from './edgeModelStore';
import {
  getEdgeModelStudioMeta,
  upsertEdgeModelStudioMeta,
} from './edgeModelStudioMetaStore';
import { attachStudioMetaForEdgeModel } from './edgeModelStudioMetaAttach';
import { emitRecordEventBestEffort } from '../../domain/record-events/emitRecordEvent';
import {
  collapseEdgeModelsForSchemaObject,
  deleteEdgeModelCascade,
  findPrimaryEdgeModelForSchemaObject,
} from './edgeCapabilityDeleteCleanup';
import type { EdgeModelStudioMeta } from '../../../shared/api/contracts/data-api';

const historySignature = (meta: EdgeModelStudioMeta): string => JSON.stringify({
  history: meta.history ?? null,
  columns: meta.columnMeta.map((column) => ({ name: column.columnName, history: column.history ?? null })),
  associations: meta.associationMeta.map((item) => ({ key: item.relationKey, history: item.history ?? null })),
});

const emitHistoryConfigChanged = (
  model: EdgeModelDefinition,
  before: EdgeModelStudioMeta,
  after: EdgeModelStudioMeta,
): void => {
  if (historySignature(before) === historySignature(after)) {
    return;
  }
  void emitRecordEventBestEffort({
    subjectKind: model.objectName,
    subjectId: model.id,
    eventKind: 'config.changed',
    source: 'patch',
    field: 'history.enabled',
    fromValue: { value: before.history ?? null },
    toValue: { value: after.history ?? null },
    historyEnabled: true,
  });
};

export type EdgeModelServiceDeps = {
  settingsPath: string;
  edgeDbQuery: EdgeDbQueryFn;
  getDataSources: () => StoredDataSource[];
};

const resolvePrimaryKeyAfterColumnChange = (
  primaryKey: EdgeModelDefinition['primaryKey'],
  columns: ReadonlyArray<Pick<EdgeModelColumn, 'name'>>,
): EdgeModelDefinition['primaryKey'] => {
  const columnNames = new Set(columns.map((column) => column.name));
  const previous = (Array.isArray(primaryKey) ? primaryKey : [primaryKey])
    .map((name) => name.trim())
    .filter(Boolean);
  const next = previous.filter((name) => columnNames.has(name));
  if (next.length === 0) {
    const fromColumns = columns
      .filter((column) => 'isPrimaryKey' in column && Boolean((column as EdgeModelColumn).isPrimaryKey))
      .map((column) => column.name);
    if (fromColumns.length === 1) {
      return fromColumns[0]!;
    }
    if (fromColumns.length > 1) {
      return fromColumns;
    }
    throw new Error('Cannot save table model without a primary key column.');
  }
  return next.length === 1 ? next[0]! : next;
};

/** Drop belongsTo associations whose FK column was removed from this (source) table. */
const pruneBelongsToAssociationsForRemovedColumns = (
  associations: ReadonlyArray<EdgeModelAssociation>,
  removedColumnNames: ReadonlySet<string>,
): EdgeModelAssociation[] => {
  if (removedColumnNames.size === 0) {
    return [...associations];
  }
  return associations.filter((association) => {
    if (association.kind !== 'belongsTo') {
      return true;
    }
    return !removedColumnNames.has(association.foreignKey);
  });
};

export class EdgeModelService {
  private readonly edgeDbQuery: EdgeDbQueryFn;

  private readonly getDataSources: () => StoredDataSource[];

  private readonly sequelizeFactory: EdgeSequelizeFactory;

  constructor(deps: EdgeModelServiceDeps) {
    this.edgeDbQuery = deps.edgeDbQuery;
    this.getDataSources = deps.getDataSources;
    this.sequelizeFactory = new EdgeSequelizeFactory({
      getDataSources: deps.getDataSources,
    });
  }

  listModels(): EdgeModelDefinition[] {
    return listEdgeModels();
  }

  getModel(id: string): EdgeModelDefinition | null {
    return getEdgeModelById(id);
  }

  private async resolveColumnsWithForeignKeys(
    draft: Pick<EdgeModelDefinition, 'dataSourceId' | 'objectName' | 'objectType' | 'columns'>,
    sourceType: string,
  ): Promise<EdgeModelDefinition['columns']> {
    if (draft.objectType !== 'TABLE') {
      return draft.columns;
    }

    try {
      const relationsSnapshot = await listDataSourceObjectRelations(
        this.edgeDbQuery,
        sourceType,
        'TABLE',
        draft.objectName,
        { dataSourceId: draft.dataSourceId },
      );

      return annotateEdgeModelColumnsWithForeignKeys(draft.columns, {
        objectName: draft.objectName,
        dataSourceId: draft.dataSourceId,
        relations: relationsSnapshot.relations,
        models: listEdgeModels(),
      });
    } catch {
      // Field import/refresh should still succeed when FK catalog is unavailable.
      return draft.columns;
    }
  }

  async listCatalogObjects(
    dataSourceId: string,
    objectType: SchemaObjectType = 'TABLE',
  ): Promise<string[]> {
    const source = this.getDataSources().find((item) => item.id === dataSourceId);
    if (!source) {
      throw new Error(`Data source not found: ${dataSourceId}`);
    }

    return listDataSourceSchemaObjects(
      this.edgeDbQuery,
      source.type,
      objectType,
      { dataSourceId },
    );
  }

  async importModel(input: ImportEdgeModelInput): Promise<EdgeModelDefinition> {
    const source = this.getDataSources().find((item) => item.id === input.dataSourceId);
    if (!source) {
      throw new Error(`Data source not found: ${input.dataSourceId}`);
    }

    const objectType = input.objectType ?? 'TABLE';
    const fields = await listDataSourceObjectFields(
      this.edgeDbQuery,
      source.type,
      objectType,
      input.objectName,
      { dataSourceId: input.dataSourceId },
    );

    if (fields.length === 0) {
      throw new Error(`No columns found for ${objectType} ${input.objectName}.`);
    }

    const draft = buildModelDefinitionDraft({
      dataSourceId: input.dataSourceId,
      schema: input.schema ?? null,
      objectName: input.objectName,
      objectType,
      fields,
    });

    const columns = await this.resolveColumnsWithForeignKeys(draft, source.type);

    const existing = findPrimaryEdgeModelForSchemaObject({
      dataSourceId: input.dataSourceId,
      objectName: input.objectName,
      objectType,
    });
    if (existing) {
      collapseEdgeModelsForSchemaObject({
        dataSourceId: input.dataSourceId,
        objectName: input.objectName,
        objectType,
        keepId: existing.id,
      });
      return this.refreshModel(existing.id);
    }

    const now = new Date().toISOString();
    const model: EdgeModelDefinition = {
      ...draft,
      columns,
      id: createEdgeModelId(),
      associations: [],
      schemaFingerprint: computeSchemaFingerprint({
        dataSourceId: draft.dataSourceId,
        schema: draft.schema,
        objectName: draft.objectName,
        columns,
        primaryKey: draft.primaryKey,
      }),
      status: 'ready',
      created_at: now,
      updated_at: now,
    };

    const saved = saveEdgeModel(model);
    attachStudioMetaForEdgeModel(saved);
    return saved;
  }

  async refreshModel(id: string): Promise<EdgeModelDefinition> {
    const existing = getEdgeModelById(id);
    if (!existing) {
      throw new Error(`Edge model not found: ${id}`);
    }

    const source = this.getDataSources().find((item) => item.id === existing.dataSourceId);
    if (!source) {
      throw new Error(`Data source not found: ${existing.dataSourceId}`);
    }

    const fields = await listDataSourceObjectFields(
      this.edgeDbQuery,
      source.type,
      existing.objectType,
      existing.objectName,
      { dataSourceId: existing.dataSourceId },
    );

    const draft = buildModelDefinitionDraft({
      dataSourceId: existing.dataSourceId,
      schema: existing.schema,
      objectName: existing.objectName,
      objectType: existing.objectType,
      fields,
    });

    const columns = await this.resolveColumnsWithForeignKeys(draft, source.type);

    const fingerprint = computeSchemaFingerprint({
      dataSourceId: draft.dataSourceId,
      schema: draft.schema,
      objectName: draft.objectName,
      columns,
      primaryKey: draft.primaryKey,
    });

    // Refresh replaces columns/PK from the live DB, so the persisted model matches
    // the source schema. Always clear sticky `stale` — prior logic kept/set stale
    // even after a successful pull, which made Sync Models warn while the modeler
    // still "felt" fine (green toast / local draft reload).
    const refreshed: EdgeModelDefinition = {
      ...existing,
      columns,
      primaryKey: draft.primaryKey,
      schemaFingerprint: fingerprint,
      status: 'ready',
      updated_at: new Date().toISOString(),
    };

    const saved = saveEdgeModel(refreshed);
    attachStudioMetaForEdgeModel(saved);
    return saved;
  }

  async updateModel(
    id: string,
    patch: Partial<Pick<EdgeModelDefinition, 'labels' | 'columns' | 'associations' | 'readOnly'>>,
  ): Promise<EdgeModelDefinition> {
    const existing = getEdgeModelById(id);
    if (!existing) {
      throw new Error(`Edge model not found: ${id}`);
    }

    assertControlPlaneEdgeModelPatchAllowed(existing, patch);

    let nextColumns = patch.columns ?? existing.columns;

    if (patch.columns && existing.objectType === 'TABLE' && !existing.readOnly) {
      nextColumns = await this.applyTableColumnDiff(existing, patch.columns);
    }

    const nextPrimaryKey = patch.columns
      ? resolvePrimaryKeyAfterColumnChange(existing.primaryKey, nextColumns)
      : existing.primaryKey;

    const removedFromModel = patch.columns
      ? new Set(
        existing.columns
          .map((column) => column.name)
          .filter((name) => !nextColumns.some((column) => column.name === name)),
      )
      : new Set<string>();

    const nextAssociations = patch.associations
      ?? (patch.columns
        ? pruneBelongsToAssociationsForRemovedColumns(existing.associations, removedFromModel)
        : existing.associations);

    const updated: EdgeModelDefinition = {
      ...existing,
      ...patch,
      labels: patch.labels ? { ...existing.labels, ...patch.labels } : existing.labels,
      columns: nextColumns,
      primaryKey: nextPrimaryKey,
      associations: nextAssociations,
      schemaFingerprint: computeSchemaFingerprint({
        dataSourceId: existing.dataSourceId,
        schema: existing.schema,
        objectName: existing.objectName,
        columns: nextColumns,
        primaryKey: nextPrimaryKey,
      }),
      status: patch.columns ? 'ready' : existing.status,
      updated_at: new Date().toISOString(),
    };

    return saveEdgeModel(updated);
  }

  private async applyTableColumnDiff(
    model: EdgeModelDefinition,
    desiredColumns: EdgeModelDefinition['columns'],
  ): Promise<EdgeModelDefinition['columns']> {
    const source = this.getDataSources().find((item) => item.id === model.dataSourceId);
    if (!source) {
      throw new Error(`Data source not found: ${model.dataSourceId}`);
    }

    if (desiredColumns.length === 0) {
      throw new Error('A table must keep at least one column.');
    }

    const fields = await listDataSourceObjectFields(
      this.edgeDbQuery,
      source.type,
      model.objectType,
      model.objectName,
      { dataSourceId: model.dataSourceId },
    );

    const existingNames = new Set(fields.map((field) => field.name));
    const newColumns = resolveNewTableColumns(desiredColumns, existingNames);
    const removedNames = resolveRemovedTableColumnNames(desiredColumns, existingNames);

    if (removedNames.length > 0) {
      const primaryKeys = new Set(
        (Array.isArray(model.primaryKey) ? model.primaryKey : [model.primaryKey])
          .map((name) => name.trim())
          .filter(Boolean),
      );
      const blockedPk = removedNames.filter((name) => primaryKeys.has(name));
      if (blockedPk.length > 0) {
        throw new Error(
          `Cannot drop primary-key column${blockedPk.length === 1 ? '' : 's'} ${blockedPk.map((name) => `"${name}"`).join(', ')}.`,
        );
      }
    }

    if (newColumns.length === 0 && removedNames.length === 0) {
      return desiredColumns;
    }

    for (const column of newColumns) {
      const statement = buildAddColumnStatement(source.type, model.objectName, column);
      await this.edgeDbQuery(statement, [], { dataSourceId: model.dataSourceId });
    }

    for (const columnName of removedNames) {
      const statement = buildDropColumnStatement(source.type, model.objectName, columnName);
      await this.edgeDbQuery(statement, [], { dataSourceId: model.dataSourceId });
    }

    this.sequelizeFactory.invalidate(model.dataSourceId);
    return desiredColumns;
  }

  deleteModel(id: string): void {
    if (!deleteEdgeModelCascade(id)) {
      throw new Error(`Edge model not found: ${id}`);
    }
  }

  getStudioMeta(edgeModelId: string) {
    const model = getEdgeModelById(edgeModelId);
    if (!model) {
      throw new Error(`Edge model not found: ${edgeModelId}`);
    }
    attachStudioMetaForEdgeModel(model);
    return getEdgeModelStudioMeta(edgeModelId);
  }

  upsertStudioMeta(edgeModelId: string, input: UpsertEdgeModelStudioMetaInput) {
    const model = getEdgeModelById(edgeModelId);
    if (!model) {
      throw new Error(`Edge model not found: ${edgeModelId}`);
    }
    const before = getEdgeModelStudioMeta(edgeModelId);
    const next = upsertEdgeModelStudioMeta(edgeModelId, input);
    void emitHistoryConfigChanged(model, before, next);
    return next;
  }

  async smokeFindAll(modelId: string, limit = 20): Promise<unknown[]> {
    const model = getEdgeModelById(modelId);
    if (!model) {
      throw new Error(`Edge model not found: ${modelId}`);
    }

    await this.sequelizeFactory.getOrCreate(model.dataSourceId);
    const ModelCtor = this.sequelizeFactory.buildModel(model);
    const rows = await ModelCtor.findAll({ limit });
    return rows.map((row) => row.get({ plain: true }));
  }

  invalidateDataSource(dataSourceId: string): void {
    this.sequelizeFactory.invalidate(dataSourceId);
  }
}
