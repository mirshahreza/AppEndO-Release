import type {
  EdgeApiDefinition,
  EdgeApiOperation,
  EdgeModelDefinition,
} from '../../../shared/api/contracts/data-api';
import {
  operationSupportsWriteFields,
  resolveDefaultDataApiReadFields,
  resolveDefaultDataApiRequiredFields,
  resolveDefaultDataApiWriteFields,
} from '../../../shared/lib/edgeApiOperations';

export type DataApiRouteCodegenInput = {
  definition: EdgeApiDefinition;
  operation: EdgeApiOperation;
  model: EdgeModelDefinition;
};

const escapeTemplateLiteral = (value: string): string => (
  value.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/\$/g, '\\$')
);

const resolveModelAlias = (model: EdgeModelDefinition): string => {
  const alias = model.sequelize.modelName.trim();
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(alias)) {
    throw new Error(`Unsafe Sequelize model name for codegen: ${alias}`);
  }
  return alias;
};

const buildFileHeader = (
  definition: EdgeApiDefinition,
  operation: EdgeApiOperation,
  model: EdgeModelDefinition,
): string => `/**
 * Data API · ${definition.label} · ${operation.kind}
 *
 * Definition : ${definition.id}
 * Operation  : ${operation.id} (${operation.method} ${operation.pathPattern})
 * Model      : ${model.sequelize.modelName} (${definition.edgeModelId})
 *
 * Runtime engine: DATA_API (Sequelize DataApiExecutor).
 * Custom handlers that bypass DataApiExecutor must call emitRecordEvent.
 * Handler below mirrors the published Sequelize operation implementation.
 */`;

const buildImports = (): string => `import { QueryTypes } from 'sequelize';
import {
  parsePositiveInt,
  parseFilterQuery,
  buildWhereFromFilter,
  parseSearchQuery,
  buildSearchWhere,
  resolveSearchableFields,
  parseSortQuery,
  parseIncludeAliases,
  buildIncludeOptionsFromOperation,
  buildQueryAttributes,
  resolveReadableAttributes,
  resolveLookupWhere,
} from '@/server/services/data-api/dataApiQuery';
import { applyDataApiAuditFields } from '@/server/services/data-api/dataApiAuditFields';
import { applyFieldEnrichments, resolveDataApiLang } from '@/server/services/data-api/dataApiFieldEnrichment';
import { resolveDataApiListIncludeCount } from '@/server/services/data-api/dataApiListCount';
import { resolvePrimaryKeyWhere } from '@/server/services/data-api/sequelize/buildDynamicModel';
import { resolvePublishedEdgeModel, resolveFieldEnrichmentDeps } from '@/server/services/data-api/dataApiPublishedRuntime';
import { executePivot } from '@/server/services/data-api/pivotExecute';`;

const buildSharedConstants = (
  definition: EdgeApiDefinition,
  operation: EdgeApiOperation,
  model: EdgeModelDefinition,
): string => {
  const readFields = operation.fields?.read?.length
    ? operation.fields.read
    : resolveDefaultDataApiReadFields(model);
  const writeFields = operation.fields?.write?.length
    ? operation.fields.write
    : resolveDefaultDataApiWriteFields(model);
  const requiredFields = operation.fields?.required?.length
    ? operation.fields.required
    : resolveDefaultDataApiRequiredFields(model);

  const defaultWhereLiteral = definition.defaultWhere
    ? JSON.stringify(definition.defaultWhere, null, 2)
    : '{}';

  const writeConstants = operationSupportsWriteFields(operation.kind)
    ? `const WRITE_FIELDS = ${JSON.stringify(writeFields)} as const;
const REQUIRED_FIELDS = ${JSON.stringify(requiredFields)} as const;
`
    : '';

  return `const EDGE_MODEL_ID = ${JSON.stringify(definition.edgeModelId)};
const EDGE_API_DEFINITION_ID = ${JSON.stringify(definition.id)};
const EDGE_API_OPERATION_ID = ${JSON.stringify(operation.id)};
const MODEL_ALIAS = ${JSON.stringify(resolveModelAlias(model))};
const READ_FIELDS = ${JSON.stringify(readFields)} as const;
${writeConstants}const DEFAULT_WHERE = ${defaultWhereLiteral};
const MAX_PAGE_SIZE = ${operation.query?.maxPageSize ?? 100};
const DEFAULT_PAGE_SIZE = ${operation.query?.defaultPageSize ?? 20};
const ALLOW_FILTER = ${operation.query?.allowFilter !== false};
const ALLOW_SORT = ${operation.query?.allowSort !== false};`;
};

const buildSourceEnvelope = (): string => `{
    id: source.id,
    name: source.name,
    type: source.type,
  }`;

const buildListHandlerBody = (): string => `const query = req.query ?? {};
  const viewName = typeof query.view === 'string' ? query.view.trim() : undefined;
  const readableAttributes = resolveReadableAttributes(OPERATION, model, viewName);
  const allowedFilterFields = new Set(readableAttributes ?? []);
  const page = parsePositiveInt(query.page, 1);
  const pageSize = Math.min(
    parsePositiveInt(query.pageSize, DEFAULT_PAGE_SIZE),
    MAX_PAGE_SIZE,
  );
  const offset = (page - 1) * pageSize;
  const filterWhere = ALLOW_FILTER
    ? buildWhereFromFilter(parseFilterQuery(query), allowedFilterFields, model.columns)
    : {};
  const searchWhere = ALLOW_FILTER
    ? buildSearchWhere(parseSearchQuery(query), resolveSearchableFields(allowedFilterFields, model.columns, []))
    : {};
  const where = {
    ...DEFAULT_WHERE,
    ...filterWhere,
    ...searchWhere,
  };
  const order = ALLOW_SORT
    ? parseSortQuery(query, allowedFilterFields, model.columns)
    : undefined;
  const include = buildIncludeOptionsFromOperation(parseIncludeAliases(query, OPERATION), OPERATION, model);
  const attributes = buildQueryAttributes(readableAttributes, OPERATION.computedFields, model, sequelize.getDialect());
  const queryLang = OPERATION.query?.allowLangParam === false ? 'en' : resolveDataApiLang(query);

  const listCount = resolveDataApiListIncludeCount(query, OPERATION);
  const findOptions = {
    where,
    limit: pageSize,
    offset,
    attributes,
    order,
    include: include.length > 0 ? include : undefined,
    distinct: include.length > 0,
  };
  let plainRows;
  let totalCount;
  if (listCount.includeCount) {
    const result = await ${'${MODEL_ALIAS}'}.findAndCountAll(findOptions);
    plainRows = result.rows.map((row) => row.get({ plain: true }));
    totalCount = result.count;
  } else {
    plainRows = (await ${'${MODEL_ALIAS}'}.findAll(findOptions)).map((row) => row.get({ plain: true }));
  }
  const enrichmentDeps = await resolveFieldEnrichmentDeps(EDGE_MODEL_ID, OPERATION);
  const enrichedRows = await applyFieldEnrichments(
    plainRows,
    OPERATION.enrichments,
    queryLang,
    enrichmentDeps,
  );

  return res.json({
    success: true,
    data: enrichedRows,
    ...(totalCount !== undefined ? { count: totalCount } : {}),
    meta: { page, pageSize, lang: queryLang, countMode: listCount.countMode },
    source: ${buildSourceEnvelope()},
  });`;

const buildGetOneHandlerBody = (): string => `const query = req.query ?? {};
  const params = req.params ?? {};
  const viewName = typeof query.view === 'string' ? query.view.trim() : undefined;
  const readableAttributes = resolveReadableAttributes(OPERATION, model, viewName);
  const include = buildIncludeOptionsFromOperation(parseIncludeAliases(query, OPERATION), OPERATION, model);
  const attributes = buildQueryAttributes(readableAttributes, OPERATION.computedFields, model, sequelize.getDialect());
  const queryLang = OPERATION.query?.allowLangParam === false ? 'en' : resolveDataApiLang(query);
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const row = await ${'${MODEL_ALIAS}'}.findOne({
    where: pkWhere,
    attributes,
    include: include.length > 0 ? include : undefined,
  });
  const plainRow = row ? row.get({ plain: true }) : null;
  const enrichmentDeps = await resolveFieldEnrichmentDeps(EDGE_MODEL_ID, OPERATION);
  const enrichedRow = plainRow
    ? (await applyFieldEnrichments([plainRow], OPERATION.enrichments, queryLang, enrichmentDeps))[0]
    : null;

  return res.json({
    success: true,
    data: enrichedRow,
    meta: { lang: queryLang },
    source: ${buildSourceEnvelope()},
  });`;

const buildCreateHandlerBody = (): string => `const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};

  for (const field of REQUIRED_FIELDS) {
    if (payload[field] === undefined || payload[field] === null || payload[field] === '') {
      return res.status(400).json({ success: false, error: \`Field "\${field}" is required.\` });
    }
  }

  const writablePayload = Object.fromEntries(
    WRITE_FIELDS
      .filter((field) => payload[field] !== undefined)
      .map((field) => [field, payload[field]]),
  );
  if (Object.keys(writablePayload).length === 0) {
    return res.status(400).json({ success: false, error: 'Request body must include at least one writable field.' });
  }

  const auditedPayload = applyDataApiAuditFields(
    writablePayload,
    WRITE_FIELDS,
    'create',
    req.auth?.userId,
  );
  const created = await ${'${MODEL_ALIAS}'}.create(auditedPayload);
  return res.json({
    success: true,
    data: created.get({ plain: true }),
    source: ${buildSourceEnvelope()},
  });`;

const buildUpdateHandlerBody = (kind: 'update' | 'patch'): string => {
  const partialNote = kind === 'patch'
    ? '// PATCH only updates writable fields present in the request body.'
    : '// PUT updates writable fields present in the request body.';

  return `const params = req.params ?? {};
  const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body)
    ? req.body as Record<string, unknown>
    : {};
  ${partialNote}
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const writablePayload = Object.fromEntries(
    WRITE_FIELDS
      .filter((field) => payload[field] !== undefined)
      .map((field) => [field, payload[field]]),
  );
  if (Object.keys(writablePayload).length === 0) {
    return res.status(400).json({ success: false, error: 'Request body must include at least one updatable field.' });
  }
  const auditedPayload = applyDataApiAuditFields(
    writablePayload,
    WRITE_FIELDS,
    ${JSON.stringify(kind)},
    req.auth?.userId,
  );

  const row = await ${'${MODEL_ALIAS}'}.findOne({ where: pkWhere });
  if (!row) {
    return res.status(404).json({ success: false, error: 'Record not found.' });
  }

  await row.update(auditedPayload);
  const plain = row.get({ plain: true }) as Record<string, unknown>;
  const responseData = Object.fromEntries(
    READ_FIELDS
      .filter((field) => plain[field] !== undefined)
      .map((field) => [field, plain[field]]),
  );
  return res.json({
    success: true,
    data: responseData,
    source: ${buildSourceEnvelope()},
  });`;
};

const buildDeleteHandlerBody = (): string => `const params = req.params ?? {};
  const pkWhere = resolvePrimaryKeyWhere(model.columns, model.primaryKey, params);
  const deleted = await ${'${MODEL_ALIAS}'}.destroy({ where: pkWhere });
  if (!deleted) {
    return res.status(404).json({ success: false, error: 'Record not found.' });
  }

  return res.json({
    success: true,
    data: { deleted },
    source: ${buildSourceEnvelope()},
  });`;

const buildLookupHandlerBody = (): string => `const query = req.query ?? {};
  const params = req.params ?? {};
  const viewName = typeof query.view === 'string' ? query.view.trim() : undefined;
  const readableAttributes = resolveReadableAttributes(OPERATION, model, viewName);
  const lookupWhere = resolveLookupWhere(OPERATION, query, params, model.columns);
  const row = await ${'${MODEL_ALIAS}'}.findOne({
    where: lookupWhere,
    attributes: readableAttributes,
  });

  return res.json({
    success: true,
    data: row ? row.get({ plain: true }) : null,
    source: ${buildSourceEnvelope()},
  });`;

const buildRoutineHandlerBody = (operation: EdgeApiOperation, model: EdgeModelDefinition): string => {
  const routine = operation.routine;
  if (!routine) {
    return `return res.status(500).json({ success: false, error: 'Routine configuration is missing.' });`;
  }

  const qualifiedName = model.schema
    ? `${model.schema}.${model.objectName}`
    : model.objectName;
  const paramEntries = Object.entries(routine.paramMap)
    .map(([paramName, sourceKey]) => `    ${JSON.stringify(paramName)}: payload[${JSON.stringify(sourceKey)}] ?? params?.[${JSON.stringify(sourceKey)}] ?? query?.[${JSON.stringify(sourceKey)}],`)
    .join('\n');

  const placeholders = Object.keys(routine.paramMap).map(() => '?').join(', ');
  const sql = routine.objectType === 'PROCEDURE'
    ? `CALL ${qualifiedName}(${placeholders})`
    : `SELECT * FROM ${qualifiedName}(${placeholders})`;

  return `const query = req.query ?? {};
  const params = req.params ?? {};
  const payload = {
    ...(req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body as Record<string, unknown> : {}),
    ...Object.fromEntries(
      Object.entries(query).filter(([key]) => !key.startsWith('filter[')),
    ),
  };
  const routineParams = {
${paramEntries}
  };
  const replacements = Object.values(routineParams);
  const results = await sequelize.query(${JSON.stringify(sql)}, {
    replacements,
    type: QueryTypes.SELECT,
  });

  return res.json({
    success: true,
    data: results,
    source: ${buildSourceEnvelope()},
  });`;
};

const buildOperationConstant = (operation: EdgeApiOperation): string => (
  `const OPERATION = ${JSON.stringify(operation, null, 2)} as const;`
);

const buildOperationHandlerBody = (
  operation: EdgeApiOperation,
  model: EdgeModelDefinition,
  modelAlias: string,
): string => {
  const withModelAlias = (body: string): string => (
    body.replace(/\$\{MODEL_ALIAS\}/g, modelAlias)
  );

  switch (operation.kind) {
    case 'list':
      return withModelAlias(buildListHandlerBody());
    case 'getOne':
      return withModelAlias(buildGetOneHandlerBody());
    case 'create':
      return withModelAlias(buildCreateHandlerBody());
    case 'update':
      return withModelAlias(buildUpdateHandlerBody('update'));
    case 'patch':
      return withModelAlias(buildUpdateHandlerBody('patch'));
    case 'delete':
      return withModelAlias(buildDeleteHandlerBody());
    case 'lookup':
      return withModelAlias(buildLookupHandlerBody());
    case 'routine':
      return buildRoutineHandlerBody(operation, model);
    case 'pivot':
      return `const result = await executePivot({
    spec: req.body,
    dataSource: source,
    policyContextKey: String(req.auth?.userId ?? 'anon'),
    allowedFields: new Set(resolveReadableAttributes(OPERATION, model) ?? []),
    ModelCtor: ${modelAlias},
    sequelize,
    dialect: source.type,
    noCache: Boolean(req.body?.noCache) || req.query?.noCache === '1',
  });
  return res.json(result);`;
    default:
      return `return res.status(501).json({ success: false, error: 'Operation kind "${escapeTemplateLiteral(operation.kind)}" is not implemented.' });`;
  }
};

export const buildDataApiPublishedRouteCode = ({
  definition,
  operation,
  model,
}: DataApiRouteCodegenInput): string => {
  const modelAlias = resolveModelAlias(model);
  const header = buildFileHeader(definition, operation, model);
  const imports = buildImports();
  const constants = buildSharedConstants(definition, operation, model);
  const operationConstant = buildOperationConstant(operation);
  const body = buildOperationHandlerBody(operation, model, modelAlias);

  return `${header}

${imports}

${constants}
${operationConstant}

export default async function handler(req: any, res: any) {
  const { Model: ${modelAlias}, model, source, sequelize } = await resolvePublishedEdgeModel(EDGE_MODEL_ID);
  ${body}
}
`;
};
