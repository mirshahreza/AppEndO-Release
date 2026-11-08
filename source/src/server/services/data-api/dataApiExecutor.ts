import { Op, QueryTypes, type ModelCtor, type WhereOptions } from 'sequelize';
import type {
  EdgeApiDefinition,
  EdgeApiOperation,
  EdgeModelDefinition,
  PivotSpec,
} from '../../../shared/api/contracts/data-api';
import type { StoredDataSource } from '../../db/dataSourcesStore';
import { getEdgeApiDefinitionById } from './edgeApiStore';
import {
  applyBinaryPreviewToRows,
  extendAttributesForBinaryPreview,
} from './dataApiBinaryPreview';
import { getEdgeModelById, listEdgeModels } from './edgeModelStore';
import {
  buildIncludeOptionsFromOperation,
  buildQueryAttributes,
  buildSearchWhere,
  buildWhereFromFilter,
  parseFilterQuery,
  parseIncludeAliases,
  parsePositiveInt,
  parseSearchQuery,
  parseSortQuery,
  resolveLookupWhere,
  resolveReadableAttributes,
  resolveSearchableFields,
} from './dataApiQuery';
import { applyFieldEnrichments, resolveDataApiLang } from './dataApiFieldEnrichment';
import { resolveDataApiListIncludeCount } from './dataApiListCount';
import { isHwyMemberDirectoryDataApiOperation, isHwyNakhebinListDataApiOperation,
  resolveHwyPortalDataApiQueryLang,
} from '../../domain/hwy/hwyMemberDirectoryQueryLang';
import {
  enrichHwyMemberDirectoryListRows,
  enrichHwyMemberDirectoryRows,
} from '../../domain/hwy/hwyMemberDirectoryDetailDisplay';
import { enrichHwyNakhebinListRows } from '../../domain/hwy/hwyNakhebinRegionDisplay';
import { executeHwyMemberDirectoryList } from '../../domain/hwy/executeHwyMemberDirectoryList';
import { executeHwyMemberDirectoryGetOne } from '../../domain/hwy/executeHwyMemberDirectoryGetOne';
import { shouldEnrichMemberInstitutesSummaryForListScope } from '../../../domain/hwy/hwyMemberInstitutesGridColumn';
import { parseHwyMemberDirectoryListScopeQuery } from '../../domain/hwy/hwyMemberDirectoryListScope.service';
import { resolveListMembershipOnRegistrationFallback } from '../../../domain/hwy/hwyMemberSegmentListCatalog';
import {
  shouldEnrichImageFixRegistrationThumbsForListScope,
  shouldEnrichListFaceAvatarsFromRegistrationForListScope,
} from '../../../domain/hwy/hwyMemberImageFixCatalog';
import { applyDataApiAuditFields } from './dataApiAuditFields';
import { invalidateDataApiDefinitionCache } from './dataApiRuntimePolicy';
import { loadAssociationContext } from './sequelize/associationRegistry';
import {
  resolvePrimaryKeyField,
  resolvePrimaryKeyWhere,
} from './sequelize/buildDynamicModel';
import { mapDataSourceTypeToSequelizeDialect } from './sequelize/dialectConfig';
import { EdgeSequelizeFactory } from './sequelize/edgeSequelizeFactory';
import {
  applyRecordPolicies,
  assertCreatePayloadInScope,
  assertLoadedRecordInScope,
} from '../record-policy/applyRecordPolicies';
import { resolveSessionScope, type SessionScopeSnapshot } from '../record-policy/sessionScope.service';
import { getSessionContextForUser } from '../attributes/sessionContext.service';
import { mergeWhereAnd } from '../record-policy/whereMerge';
import {
  listWhereTreeToIr,
  parseListWhereTreeParam,
} from '../../../shared/ui/list-filter/listWhereFilter';
import { listWhereIrToSequelize } from '../../../shared/ui/list-filter/listWhereQuery';
import { DEFAULT_WHERE_OPERATORS } from '../../../shared/ui/where-builder/whereBuilderModel';
import type { WhereField } from '../../../shared/ui/where-builder/whereBuilderModel';
import { edgeModelListWhereColumns } from './edgeModelListWhere';
import { executePivot } from './pivotExecute';
import { getEdgeModelStudioMeta } from './edgeModelStudioMetaStore';
import {
  buildListWhereColumnMap,
  buildListWhereFields,
  compileQueryPresetWhere,
  parsePresetsQuery,
  readQuerySurfacesDocument,
  resolveSelectedPresetIds,
  sanitizeListWhereForModel,
  visibleQueryPresets,
} from '../../domain/data-api/querySurfaceRuntime';
import { resolveCmsContentsQuerySurfacesDocument } from '../../domain/data-api/cmsQuerySurfacePresets';
import { getQuerySurfaceBindingOrDefault } from '../query-surface/querySurfaceBindingStore';
import type { JsonFieldExtraction } from '../../domain/data-api/jsonFieldExtraction';
import {
  emitDataApiAccessDenied,
  emitDataApiHistory,
  prepareDataApiWriteBody,
} from '../../domain/record-events/dataApiHistory';
import { getControlPlaneSequelize } from '../../db/controlPlaneSequelize';
import {
  validateCubeAnnotation,
  type CubeAnnotation,
  type CubeDerivedMeasure,
} from '../../domain/data-api/rolapStarSchemaCompiler';
import {
  applyHwyInstitutesLogoFromDataApiBody,
  attachHwyInstituteLogoUrlToRow,
  attachHwyInstituteLogoUrlsToRows,
  isHwyInstitutesEdgeModel,
  stripHwyInstituteLogoFieldsFromSequelizePayload,
} from '../../domain/hwy/hwyInstitutesDataApiLogo';
import { unwrapDataApiWriteRequestBody } from './dataApiRequestBody';

const DATA_API_WRITE_KINDS = new Set(['create', 'update', 'patch', 'delete', 'routine']);

const jsonExtractionsFromOperation = (operation: EdgeApiOperation): JsonFieldExtraction[] => (
  (operation.computedFields ?? [])
    .filter((field) => field.kind === 'json_path' && field.sourceField)
    .map((field) => ({
      outputField: field.outputField,
      sourceColumn: field.sourceField as string,
      jsonPath: field.expression,
    }))
);

const cubeAnnotationFromStudioMeta = (modelId: string): CubeAnnotation | undefined => {
  const meta = getEdgeModelStudioMeta(modelId);
  const measures: CubeAnnotation['measures'] = {};
  for (const column of meta.columnMeta) {
    const cubeMeasure = (column as { cubeMeasure?: CubeAnnotation['measures'][string] }).cubeMeasure;
    if (cubeMeasure) {
      measures[column.columnName] = cubeMeasure;
    }
  }
  const dimensions: CubeAnnotation['dimensions'] = {};
  for (const association of meta.associationMeta) {
    const cubeDimension = (association as { cubeDimension?: CubeAnnotation['dimensions'][string] }).cubeDimension;
    if (cubeDimension) {
      dimensions[association.relationKey] = cubeDimension;
    }
  }
  const derivedMeasures = Array.isArray((meta.extensions as { cubeDerivedMeasures?: CubeDerivedMeasure[] }).cubeDerivedMeasures)
    ? (meta.extensions as { cubeDerivedMeasures?: CubeDerivedMeasure[] }).cubeDerivedMeasures ?? []
    : [];
  if (Object.keys(measures).length === 0) {
    return undefined;
  }
  const annotation: CubeAnnotation = {
    factModelId: modelId,
    measures,
    dimensions,
    derivedMeasures,
  };
  try {
    validateCubeAnnotation(annotation);
    return annotation;
  } catch {
    return undefined;
  }
};

const pivotFiltersToQuery = (filters: PivotSpec['filters']): Record<string, unknown> => {
  if (!filters) {
    return {};
  }
  const nested: Record<string, Record<string, string>> = {};
  for (const [field, operators] of Object.entries(filters)) {
    nested[field] = {};
    for (const [operator, value] of Object.entries(operators)) {
      nested[field][operator] = Array.isArray(value) ? value.join(',') : String(value);
    }
  }
  return { filter: nested };
};

export type DataApiExecutionContext = {
  edgeApiDefinitionId: string;
  operationId?: string;
  params?: Record<string, string>;
  query?: Record<string, unknown>;
  body?: unknown;
  actorUserId?: string | number | null;
  actorEmail?: string | null;
  actorRoles?: string[];
  actorIsAdmin?: boolean;
  skipPublishCheck?: boolean;
  req?: import('express').Request;
  source?: 'patch' | 'workflow' | 'status-log';
  correlationId?: string;
};

export type DataApiExecutorDeps = {
  getDataSources: () => StoredDataSource[];
};

const asRecord = (value: unknown): Record<string, unknown> => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
);

const decodeBlobPayloadValue = (value: unknown): unknown => {
  if (Buffer.isBuffer(value) || value === null || value === undefined) {
    return value;
  }
  if (typeof value !== 'string') {
    return value;
  }
  const trimmed = value.trim();
  const dataUrlMatch = /^data:[^;,]+;base64,(.+)$/s.exec(trimmed);
  const encoded = dataUrlMatch?.[1] ?? trimmed;
  return Buffer.from(encoded, 'base64');
};

const coerceDataApiIntegerWriteValue = (value: unknown): unknown => {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) {
      return null;
    }
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
  }
  return value;
};

export const normalizeDataApiWritePayload = (
  model: EdgeModelDefinition,
  value: unknown,
): Record<string, unknown> => {
  const payload = unwrapDataApiWriteRequestBody(value);
  const next = { ...payload };
  for (const column of model.columns) {
    const isIntegerColumn = column.sequelizeType === 'INTEGER' || column.sequelizeType === 'BIGINT';
    for (const key of [column.field, column.name]) {
      if (!(key in next)) {
        continue;
      }
      if (column.sequelizeType === 'BLOB') {
        next[key] = decodeBlobPayloadValue(next[key]);
      } else if (isIntegerColumn) {
        next[key] = coerceDataApiIntegerWriteValue(next[key]);
      }
    }
  }
  return next;
};

const buildRoutineSql = (
  model: EdgeModelDefinition,
  operation: EdgeApiOperation,
  dialect: string | null,
): string => {
  const routine = operation.routine;
  if (!routine) {
    throw new Error('Routine configuration is missing.');
  }

  const qualifiedName = model.schema
    ? `${model.schema}.${model.objectName}`
    : model.objectName;
  const bindings = Object.values(routine.paramMap);
  const placeholders = bindings.map((_, index) => {
    if (dialect === 'postgres') {
      return `$${index + 1}`;
    }
    if (dialect === 'mssql') {
      return `@p${index + 1}`;
    }
    return '?';
  });

  if (routine.objectType === 'PROCEDURE') {
    if (dialect === 'postgres') {
      return `CALL ${qualifiedName}(${placeholders.join(', ')})`;
    }
    if (dialect === 'mssql') {
      return `EXEC ${qualifiedName} ${placeholders.join(', ')}`;
    }
    return `CALL ${qualifiedName}(${placeholders.join(', ')})`;
  }

  if (dialect === 'postgres') {
    return `SELECT * FROM ${qualifiedName}(${placeholders.join(', ')})`;
  }
  return `SELECT ${qualifiedName}(${placeholders.join(', ')})`;
};

export class DataApiExecutor {
  private readonly sequelizeFactory: EdgeSequelizeFactory;

  private readonly getDataSources: () => StoredDataSource[];

  constructor(deps: DataApiExecutorDeps) {
    this.getDataSources = deps.getDataSources;
    this.sequelizeFactory = new EdgeSequelizeFactory({
      getDataSources: deps.getDataSources,
    });
  }

  private resolveDefinitionRecord(definitionId: string, skipPublishCheck = false): EdgeApiDefinition {
    const definition = getEdgeApiDefinitionById(definitionId);
    if (!definition) {
      throw new Error('Data API definition was not found.');
    }
    if (!skipPublishCheck && !definition.publishedAt) {
      throw new Error('Published Data API definition was not found.');
    }
    return definition;
  }

  resolveOperation(
    definitionId: string,
    method: string,
    requestPath: string,
    skipPublishCheck = false,
  ): { definition: EdgeApiDefinition; model: EdgeModelDefinition; operation: EdgeApiOperation } {
    const definition = this.resolveDefinitionRecord(definitionId, skipPublishCheck);
    const model = getEdgeModelById(definition.edgeModelId);
    if (!model) {
      throw new Error('Edge model for Data API was not found.');
    }

    const normalizedMethod = method.toUpperCase();
    const operation = definition.operations.find((item) => (
      item.enabled
      && item.method === normalizedMethod
      && requestPath.startsWith(item.pathPattern || definition.basePath)
    ));

    if (!operation) {
      throw new Error(`No enabled Data API operation matches ${method} ${requestPath}.`);
    }

    return { definition, model, operation };
  }

  private async resolveModelContext(rootModel: EdgeModelDefinition): Promise<{
    source: StoredDataSource;
    ModelCtor: ModelCtor;
    associationDefs: EdgeModelDefinition[];
    modelGraph: Map<string, ModelCtor>;
  }> {
    const source = this.getDataSources().find((item) => item.id === rootModel.dataSourceId);
    if (!source) {
      throw new Error(`Data source not found: ${rootModel.dataSourceId}`);
    }

    const { defs } = loadAssociationContext(rootModel.id);
    const graphDefs = defs.length > 0 ? defs : [rootModel];
    await this.sequelizeFactory.getOrCreate(rootModel.dataSourceId);
    const models = this.sequelizeFactory.buildModelGraph(graphDefs);
    const ModelCtor = models.get(rootModel.id);
    if (!ModelCtor) {
      throw new Error('Failed to build Edge model.');
    }

    return { source, ModelCtor, associationDefs: graphDefs, modelGraph: models };
  }

  async execute(context: DataApiExecutionContext): Promise<Record<string, unknown>> {
    const definition = this.resolveDefinitionRecord(
      context.edgeApiDefinitionId,
      context.skipPublishCheck,
    );
    const model = getEdgeModelById(definition.edgeModelId);
    if (!model) {
      throw new Error('Edge model for Data API was not found.');
    }

    const operation = context.operationId
      ? definition.operations.find((item) => item.id === context.operationId)
      : definition.operations.find((item) => item.enabled);

    if (!operation || !operation.enabled) {
      throw new Error('Data API operation is not enabled.');
    }

    const { source, ModelCtor, associationDefs, modelGraph } = await this.resolveModelContext(model);
    const dialect = mapDataSourceTypeToSequelizeDialect(source.type);
    const query = context.query ?? {};
    const viewName = typeof query.view === 'string' ? query.view.trim() : undefined;
    const readableAttributes = resolveReadableAttributes(operation, model, viewName);
    const allowedFilterFields = new Set(readableAttributes ?? []);
    const page = parsePositiveInt(query.page, 1);
    const pageSize = Math.min(
      parsePositiveInt(query.pageSize, operation.query?.defaultPageSize ?? 20),
      operation.query?.maxPageSize ?? 100,
    );
    const offset = (page - 1) * pageSize;
    const studioMeta = getEdgeModelStudioMeta(model.id);
    const querySurfaceBinding = getQuerySurfaceBindingOrDefault(model.id);

    let session: SessionScopeSnapshot | null = null;
    const actorUserId = context.actorUserId != null && context.actorUserId !== ''
      ? Number(context.actorUserId)
      : NaN;
    const roles = (context.actorRoles ?? []).map((role) => role.toUpperCase());
    const isAdmin = Boolean(context.actorIsAdmin) || roles.includes('ADMIN');
    if (Number.isFinite(actorUserId) && actorUserId > 0) {
      const sessionContext = await getSessionContextForUser(actorUserId, roles[0]);
      session = await resolveSessionScope({
        userId: actorUserId,
        roles: roles.length > 0 ? roles : ['USER'],
        isAdmin,
        email: context.actorEmail ?? null,
        serverContext: sessionContext.serverContext as Record<string, unknown>,
      });
    }

    const queryPrincipal = {
      userId: Number.isFinite(actorUserId) ? actorUserId : undefined,
      roleIds: roles,
      isAdmin,
    };

    const filterWhere = operation.query?.allowFilter === false
      ? {}
      : buildWhereFromFilter(parseFilterQuery(query), allowedFilterFields, model.columns);
    const searchWhere = operation.query?.allowFilter === false
      ? {}
      : buildSearchWhere(
        parseSearchQuery(query),
        resolveSearchableFields(allowedFilterFields, model.columns, studioMeta.columnMeta),
      );
    const listWhereFields: WhereField[] = operation.query?.allowFilter === false
      ? []
      : buildListWhereFields(
        model,
        studioMeta.columnMeta,
        querySurfaceBinding,
        queryPrincipal,
        allowedFilterFields,
      );
    const listWhereColumnMap = operation.query?.allowFilter === false
      ? {}
      : buildListWhereColumnMap(
        model,
        studioMeta.columnMeta,
        querySurfaceBinding,
        queryPrincipal,
        allowedFilterFields,
      );
    const fullColumnMapForPresets = edgeModelListWhereColumns(model);
    let listWhere: WhereOptions = {};
    if (operation.query?.allowFilter !== false && typeof query.where === 'string' && query.where.trim()) {
      const tree = parseListWhereTreeParam(query.where, listWhereFields, DEFAULT_WHERE_OPERATORS);
      const sanitized = tree
        ? sanitizeListWhereForModel(tree, listWhereFields)
        : null;
      const compiled = listWhereIrToSequelize(
        sanitized ? listWhereTreeToIr(sanitized, DEFAULT_WHERE_OPERATORS) : null,
        listWhereColumnMap,
        Op as unknown as Record<string, symbol>,
      );
      if (compiled) {
        listWhere = compiled as WhereOptions;
      }
    }
    let querySurfacesDoc = readQuerySurfacesDocument(studioMeta);
    if (model.objectName === 'cms_contents') {
      querySurfacesDoc = await resolveCmsContentsQuerySurfacesDocument(querySurfacesDoc);
    }
    const visiblePresets = visibleQueryPresets(querySurfacesDoc, querySurfaceBinding, queryPrincipal);
    const operationForcedPresetIds = operation.query?.forcedPresetIds ?? [];
    const selectedPresetIds = operation.query?.allowFilter === false
      ? resolveSelectedPresetIds(visiblePresets, [], operationForcedPresetIds)
      : resolveSelectedPresetIds(
        visiblePresets,
        parsePresetsQuery(query),
        operationForcedPresetIds,
      );
    const presetWhere = operation.query?.allowFilter === false
      ? {}
      : compileQueryPresetWhere(
        querySurfacesDoc,
        selectedPresetIds,
        fullColumnMapForPresets,
        Op as unknown as Record<string, symbol>,
        model.columns,
      );

    const recordPolicyOverride = {
      bypassRecordPolicy: Boolean(operation.bypassRecordPolicy),
      recordPolicyId: operation.recordPolicyId,
    };
    const policyApplied = applyRecordPolicies({
      model,
      operationKind: operation.kind,
      session,
      ...recordPolicyOverride,
      baseWhere: mergeWhereAnd(
        definition.defaultWhere as WhereOptions | undefined,
        presetWhere,
        filterWhere,
        searchWhere,
        listWhere,
      ),
    });
    const where = policyApplied.where;
    const order = operation.query?.allowSort === false
      ? undefined
      : parseSortQuery(query, allowedFilterFields, model.columns);
    const includeAliases = parseIncludeAliases(query, operation);
    const include = buildIncludeOptionsFromOperation(
      includeAliases,
      operation,
      model,
      associationDefs,
    );
    let attributes = buildQueryAttributes(
      readableAttributes,
      operation.computedFields,
      model,
      dialect,
    );
    if (operation.binaryPreview) {
      attributes = extendAttributesForBinaryPreview(
        attributes,
        operation.binaryPreview,
        readableAttributes,
      );
    }
    const queryLang = operation.query?.allowLangParam === false
      ? 'en'
      : resolveHwyPortalDataApiQueryLang(operation, query, context.req)
        ?? resolveDataApiLang(query);

    const enrichRows = async (rows: Record<string, unknown>[]) => {
      const enriched = await applyFieldEnrichments(rows, operation.enrichments, queryLang, {
        getTargetModelById: (modelId) => {
          if (modelGraph.has(modelId)) {
            return modelGraph.get(modelId);
          }
          const targetDef = getEdgeModelById(modelId);
          if (!targetDef || targetDef.dataSourceId !== model.dataSourceId) {
            return undefined;
          }
          const extendedGraph = this.sequelizeFactory.buildModelGraph([
            ...associationDefs,
            targetDef,
          ]);
          return extendedGraph.get(modelId);
        },
      });
      if (isHwyNakhebinListDataApiOperation(operation)) {
        await enrichHwyNakhebinListRows(enriched, queryLang);
      }
      if (isHwyMemberDirectoryDataApiOperation(operation)) {
        if (operation.kind === 'list') {
          const listScopeLegacy = parseHwyMemberDirectoryListScopeQuery(query);
          await enrichHwyMemberDirectoryListRows(enriched, queryLang, {
            includeElectoralDivisionPath: true,
            includeMemberInstitutesSummary: shouldEnrichMemberInstitutesSummaryForListScope(listScopeLegacy),
            includeListMembershipOnRegistrationFallback: resolveListMembershipOnRegistrationFallback(listScopeLegacy),
            includeImageFixRegistrationThumbs: shouldEnrichImageFixRegistrationThumbsForListScope(listScopeLegacy),
            includeListFaceAvatarsFromRegistration: shouldEnrichListFaceAvatarsFromRegistrationForListScope(listScopeLegacy),
            includeSingleViewStats: false,
            listScopeLegacy,
          });
        } else {
          await enrichHwyMemberDirectoryRows(enriched, queryLang);
        }
      }
      return enriched;
    };

    // Workflow Actions (and any non-HTTP caller) write through this executor and would
    // otherwise leave HTTP GET list/detail responses cached until TTL — e.g. CMS
    // auto-comment create after an empty Comments hydrate.
    const finishWrite = async (result: Record<string, unknown>) => {
      if (DATA_API_WRITE_KINDS.has(operation.kind)) {
        await invalidateDataApiDefinitionCache(definition.id);
      }
      return result;
    };

    const rawWriteBody = context.body;
    if (DATA_API_WRITE_KINDS.has(operation.kind)) {
      context.body = prepareDataApiWriteBody(context.body);
    }

    const emitHistory = async (
      kind: EdgeApiOperation['kind'],
      before: Record<string, unknown> | null,
      after: Record<string, unknown> | null,
      transaction?: import('sequelize').Transaction,
    ) => {
      await emitDataApiHistory({
        model,
        definition,
        operationKind: kind,
        operation,
        before,
        after,
        req: context.req,
        source: context.source ?? 'patch',
        transaction,
        correlationId: context.correlationId,
      });
    };

    const denyAccess = (subjectId: string | null) => {
      emitDataApiAccessDenied(model, subjectId, context.req);
    };

    const sharedHistoryTransaction = ModelCtor.sequelize === getControlPlaneSequelize();

    switch (operation.kind) {
      case 'list': {
        if (isHwyMemberDirectoryDataApiOperation(operation)) {
          return executeHwyMemberDirectoryList({
            operation,
            model,
            source,
            ModelCtor,
            query,
            req: context.req,
            edgeModelId: definition.edgeModelId,
            session,
          });
        }
        const listCount = resolveDataApiListIncludeCount(query, operation);
        const findOptions = {
          where,
          limit: pageSize,
          offset,
          attributes,
          order,
          include: include.length > 0 ? include : undefined,
          distinct: include.length > 0,
        };
        let plainRows: Record<string, unknown>[];
        let totalCount: number | undefined;
        if (listCount.includeCount) {
          const result = await ModelCtor.findAndCountAll(findOptions);
          plainRows = result.rows.map((row) => row.get({ plain: true }) as Record<string, unknown>);
          totalCount = result.count;
        } else {
          plainRows = (await ModelCtor.findAll(findOptions)).map(
            (row) => row.get({ plain: true }) as Record<string, unknown>,
          );
        }
        const enrichedRows = await enrichRows(plainRows);
        const previewRows = operation.binaryPreview
          ? await applyBinaryPreviewToRows(enrichedRows, operation.binaryPreview)
          : enrichedRows;
        const data = isHwyInstitutesEdgeModel(model)
          ? await attachHwyInstituteLogoUrlsToRows(previewRows)
          : previewRows;
        return {
          success: true,
          data,
          ...(totalCount !== undefined ? { count: totalCount } : {}),
          meta: {
            page,
            pageSize,
            lang: queryLang,
            countMode: listCount.countMode,
          },
          source: { id: source.id, name: source.name, type: source.type },
        };
      }
      case 'getOne': {
        if (
          isHwyMemberDirectoryDataApiOperation(operation)
          && operation.kind === 'getOne'
        ) {
          return executeHwyMemberDirectoryGetOne({
            operation,
            model,
            source,
            ModelCtor,
            query,
            params: context.params ?? {},
            req: context.req,
            edgeModelId: definition.edgeModelId,
            where,
            session,
            recordPolicyOverride,
            policyEnforced: policyApplied.enforced,
          });
        }
        const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, context.params);
        const row = await ModelCtor.findOne({
          where: mergeWhereAnd(pkWhere, where),
          attributes,
          include: include.length > 0 ? include : undefined,
        });
        const plainRow = row ? row.get({ plain: true }) as Record<string, unknown> : null;
        if (policyApplied.enforced) {
          assertLoadedRecordInScope(model, plainRow, session, 'read', recordPolicyOverride);
        }
        const enrichedRow = plainRow ? (await enrichRows([plainRow]))[0] : null;
        const data = isHwyInstitutesEdgeModel(model)
          ? await attachHwyInstituteLogoUrlToRow(enrichedRow)
          : enrichedRow;
        return {
          success: true,
          data,
          meta: { lang: queryLang },
          source: { id: source.id, name: source.name, type: source.type },
        };
      }
      case 'lookup': {
        const lookupWhere = resolveLookupWhere(
          operation,
          query,
          context.params,
          model.columns,
        );
        const row = await ModelCtor.findOne({
          where: mergeWhereAnd(lookupWhere, where),
          attributes: readableAttributes,
        });
        const plainLookup = row ? row.get({ plain: true }) as Record<string, unknown> : null;
        if (policyApplied.enforced) {
          assertLoadedRecordInScope(model, plainLookup, session, 'read', recordPolicyOverride);
        }
        return {
          success: true,
          data: plainLookup,
          source: { id: source.id, name: source.name, type: source.type },
        };
      }
      case 'create': {
        const normalizedPayload = normalizeDataApiWritePayload(model, context.body);
        if (isHwyInstitutesEdgeModel(model)) {
          stripHwyInstituteLogoFieldsFromSequelizePayload(normalizedPayload);
        }
        const payload = applyDataApiAuditFields(
          normalizedPayload,
          operation.fields?.write ?? model.columns.map((column) => column.field),
          'create',
          context.actorUserId,
        );
        if (policyApplied.enforced && session) {
          try {
            assertCreatePayloadInScope(model, payload as Record<string, unknown>, session, recordPolicyOverride);
          } catch (error) {
            denyAccess(null);
            throw error;
          }
        }
        const persistCreate = async (transaction?: import('sequelize').Transaction) => {
          const created = await ModelCtor.create(payload, transaction ? { transaction } : undefined);
          const plain = created.get({ plain: true }) as Record<string, unknown>;
          await emitHistory('create', null, plain, transaction);
          const createdId = Number(plain.id);
          if (isHwyInstitutesEdgeModel(model)) {
            await applyHwyInstitutesLogoFromDataApiBody(createdId, rawWriteBody);
          }
          const responseData = isHwyInstitutesEdgeModel(model)
            ? await attachHwyInstituteLogoUrlToRow(plain)
            : plain;
          return finishWrite({
            success: true,
            data: responseData,
            source: { id: source.id, name: source.name, type: source.type },
          });
        };
        if (sharedHistoryTransaction && ModelCtor.sequelize) {
          return ModelCtor.sequelize.transaction((transaction) => persistCreate(transaction));
        }
        return persistCreate();
      }
      case 'update':
      case 'patch': {
        const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, context.params);
        const normalizedPayload = normalizeDataApiWritePayload(model, context.body);
        if (isHwyInstitutesEdgeModel(model)) {
          stripHwyInstituteLogoFieldsFromSequelizePayload(normalizedPayload);
        }
        const payload = applyDataApiAuditFields(
          normalizedPayload,
          operation.fields?.write ?? model.columns.map((column) => column.field),
          operation.kind,
          context.actorUserId,
        );
        const persistUpdate = async (transaction?: import('sequelize').Transaction) => {
          const row = await ModelCtor.findOne({
            where: mergeWhereAnd(pkWhere, where),
            transaction,
          });
          if (!row) {
            throw new Error('Record not found.');
          }
          const before = row.get({ plain: true }) as Record<string, unknown>;
          if (policyApplied.enforced) {
            try {
              assertLoadedRecordInScope(
                model,
                before,
                session,
                'update',
                recordPolicyOverride,
              );
            } catch (error) {
              denyAccess(String(before[resolvePrimaryKeyField(model.columns, model.primaryKey)] ?? before.id ?? ''));
              throw error;
            }
          }
          await row.update(payload, transaction ? { transaction } : undefined);
          const plain = row.get({ plain: true }) as Record<string, unknown>;
          await emitHistory(operation.kind, before, plain, transaction);
          const instituteId = Number(plain.id ?? (pkWhere as Record<string, unknown>).id);
          if (isHwyInstitutesEdgeModel(model)) {
            await applyHwyInstitutesLogoFromDataApiBody(instituteId, rawWriteBody);
          }
          const readableAttributes = resolveReadableAttributes(operation, model);
          const responseData = readableAttributes
            ? Object.fromEntries(
              readableAttributes
                .filter((field) => plain[field] !== undefined)
                .map((field) => [field, plain[field]]),
            )
            : plain;
          const data = isHwyInstitutesEdgeModel(model)
            ? await attachHwyInstituteLogoUrlToRow(responseData)
            : responseData;
          return finishWrite({
            success: true,
            data,
            source: { id: source.id, name: source.name, type: source.type },
          });
        };
        if (sharedHistoryTransaction && ModelCtor.sequelize) {
          return ModelCtor.sequelize.transaction((transaction) => persistUpdate(transaction));
        }
        return persistUpdate();
      }
      case 'delete': {
        const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, context.params);
        const persistDelete = async (transaction?: import('sequelize').Transaction) => {
          const existing = await ModelCtor.findOne({
            where: mergeWhereAnd(pkWhere, where),
            transaction,
          });
          if (!existing) {
            throw new Error('Record not found.');
          }
          const before = existing.get({ plain: true }) as Record<string, unknown>;
          if (policyApplied.enforced) {
            try {
              assertLoadedRecordInScope(
                model,
                before,
                session,
                'delete',
                recordPolicyOverride,
              );
            } catch (error) {
              denyAccess(String(before[resolvePrimaryKeyField(model.columns, model.primaryKey)] ?? before.id ?? ''));
              throw error;
            }
          }
          const deleted = await existing.destroy({ transaction });
          await emitHistory('delete', before, null, transaction);
          return finishWrite({
            success: true,
            data: { deleted: deleted ? 1 : 0 },
            source: { id: source.id, name: source.name, type: source.type },
          });
        };
        if (sharedHistoryTransaction && ModelCtor.sequelize) {
          return ModelCtor.sequelize.transaction((transaction) => persistDelete(transaction));
        }
        return persistDelete();
      }
      case 'routine': {
        const sequelize = await this.sequelizeFactory.getOrCreate(model.dataSourceId);
        const dialect = mapDataSourceTypeToSequelizeDialect(source.type);
        const routine = operation.routine;
        if (!routine) {
          throw new Error('Routine configuration is missing.');
        }

        const payload = {
          ...asRecord(context.body),
          ...Object.fromEntries(
            Object.entries(query).filter(([key]) => !key.startsWith('filter[')),
          ),
        };
        const replacements = Object.entries(routine.paramMap).map(([paramName, sourceKey]) => {
          const value = payload[sourceKey] ?? context.params?.[sourceKey] ?? query[sourceKey];
          if (value === undefined) {
            throw new Error(`Routine parameter "${paramName}" is required.`);
          }
          return value;
        });
        const sql = buildRoutineSql(model, operation, dialect);
        const results = await sequelize.query(sql, {
          replacements,
          type: QueryTypes.SELECT,
        });
        return finishWrite({
          success: true,
          data: results,
          source: { id: source.id, name: source.name, type: source.type },
        });
      }
      case 'pivot': {
        const sequelize = await this.sequelizeFactory.getOrCreate(model.dataSourceId);
        const specBody = asRecord(context.body);
        const specFilters = specBody.filters as PivotSpec['filters'];
        const extraFilterWhere = operation.query?.allowFilter === false
          ? {}
          : buildWhereFromFilter(
            parseFilterQuery(pivotFiltersToQuery(specFilters)),
            allowedFilterFields,
            model.columns,
          );
        const pivotPolicy = applyRecordPolicies({
          model,
          operationKind: operation.kind,
          session,
          ...recordPolicyOverride,
          baseWhere: mergeWhereAnd(
            definition.defaultWhere as WhereOptions | undefined,
            extraFilterWhere,
          ),
        });
        const allowedFields = new Set([
          ...(readableAttributes ?? model.columns.map((column) => column.field)),
          ...jsonExtractionsFromOperation(operation).map((item) => item.outputField),
        ]);
        return executePivot({
          spec: context.body,
          dataSource: source,
          policyContextKey: [
            pivotPolicy.scopeHash ?? 'anon',
            operation.recordPolicyId ?? '',
            pivotPolicy.bypassed ? 'bypass' : 'enforced',
          ].join(':'),
          allowedFields,
          jsonExtractions: jsonExtractionsFromOperation(operation),
          where: pivotPolicy.where,
          ModelCtor,
          sequelize,
          dialect: dialect ?? 'sqlite',
          cubeAnnotation: cubeAnnotationFromStudioMeta(model.id),
          noCache: Boolean(specBody.noCache) || query.noCache === '1' || query.noCache === true,
        });
      }
      default:
        throw new Error(`Operation kind "${operation.kind}" is not implemented yet.`);
    }
  }

  listPublishedModels(): EdgeModelDefinition[] {
    return listEdgeModels();
  }
}
