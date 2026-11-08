import type { ActionDefinition, ActionExecutor, ActionExecutorContext } from '../types';
import type { JsonValue } from '../../awm/types';
import { SETTINGS_PATH } from '../../../../config/settingsFile';
import { getDataSourcesFromSettings } from '../../../../db/dataSourcesStore';
import { DataApiExecutor } from '../../../../services/data-api/dataApiExecutor';
import { getEdgeApiDefinitionByKey } from '../../../../services/data-api/edgeApiStore';
import type { EdgeApiDefinition, EdgeApiOperation } from '../../../../../shared/api/contracts/data-api';

/**
 * Generic Data API record Actions — the missing write surface for workflows (p-89:
 * `data.record-*` did not exist). Writes go in-process through `DataApiExecutor` (field
 * allowlists, audit columns, Record Policy) rather than free-form INSERT SQL or loopback HTTP
 * (SSRF blocks `/api/*` on localhost).
 *
 * Configured by published Edge API **key** (stable across republish), not internal id.
 */

const inlineSchema = (schema: JsonValue = {}) => ({ type: 'INLINE' as const, schema });

export const MAX_RECORD_CREATE_MANY = 1000;

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

const asString = (value: unknown): string | null => {
  if (typeof value === 'string' && value.trim().length > 0) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
};

const rowPk = (row: Record<string, unknown> | null): string | null => {
  if (!row) return null;
  const raw = row.id ?? row.Id ?? row.pk;
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  if (typeof raw === 'string' && raw.trim().length > 0) return raw.trim();
  return null;
};

let executorSingleton: DataApiExecutor | null = null;

const getExecutor = (): DataApiExecutor => {
  if (!executorSingleton) {
    executorSingleton = new DataApiExecutor({
      getDataSources: () => getDataSourcesFromSettings(SETTINGS_PATH),
    });
  }
  return executorSingleton;
};

/** Test seam — reset between unit tests that mock the store. */
export const __resetRecordActionExecutorForTests = (): void => {
  executorSingleton = null;
};

type ResolvedApi =
  | { ok: true; definition: EdgeApiDefinition }
  | { ok: false; errorCode: string; safeMessage: string };

const resolvePublishedApi = (apiKey: unknown): ResolvedApi => {
  const key = asString(apiKey);
  if (!key) {
    return {
      ok: false,
      errorCode: 'RECORD_API_KEY_REQUIRED',
      safeMessage: 'config.apiKey is required (published Data API key, e.g. cms-contents).',
    };
  }
  const definition = getEdgeApiDefinitionByKey(key);
  if (!definition) {
    return {
      ok: false,
      errorCode: 'RECORD_API_NOT_FOUND',
      safeMessage: `Published Edge API "${key}" was not found.`,
    };
  }
  if (!definition.publishedAt) {
    return {
      ok: false,
      errorCode: 'RECORD_API_NOT_PUBLISHED',
      safeMessage: `Edge API "${key}" exists but is not published.`,
    };
  }
  return { ok: true, definition };
};

const findOp = (
  definition: EdgeApiDefinition,
  kind: EdgeApiOperation['kind'],
): EdgeApiOperation | null => (
  definition.operations.find((op) => op.enabled && op.kind === kind) ?? null
);

const actorUserIdOf = (context: ActionExecutorContext): string | number | null => (
  context.effectiveIdentity.type === 'USER' ? context.effectiveIdentity.id : null
);

const failed = (errorCode: string, errorClass: string, safeMessage: string) => ({
  status: 'FAILED' as const,
  errorCode,
  errorClass,
  safeMessage,
});

const missingOp = (kind: string) => failed(
  'RECORD_OP_MISSING',
  'CONFIGURATION',
  `This Data API has no enabled "${kind}" operation.`,
);

const externalFail = (errorCode: string, error: unknown, fallback: string) => failed(
  errorCode,
  'EXTERNAL_ERROR',
  error instanceof Error ? error.message : fallback,
);

const apiKeyConfigSchema = inlineSchema({
  type: 'object',
  properties: {
    apiKey: {
      type: 'string',
      title: 'Data API',
      format: 'edge-api-key',
      description: 'Published Data API key from Data Studio (not a Data Source id).',
    },
  },
  required: ['apiKey'],
});

const writeBase = (tags: string[]): Omit<ActionDefinition, 'key'> => ({
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: apiKeyConfigSchema,
  inputSchema: inlineSchema(),
  outputSchema: inlineSchema(),
  executionTimeoutMs: 30000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['data.record-write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['data', 'record', ...tags],
});

const readBase = (): Omit<ActionDefinition, 'key'> => ({
  ...writeBase(['read']),
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'LOW',
  requiredCapabilities: ['data.record-read'],
  idempotency: { guarantee: 'DEDUPLICATED', deduplicationWindowMs: 86400000 },
});

export const dataRecordGetDefinition: ActionDefinition = {
  key: 'data.record-get',
  ...readBase(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      pk: { type: ['string', 'integer'], title: 'Primary key', description: 'Row id / primary key.' },
    },
    required: ['pk'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      found: { type: 'boolean' },
      pk: { type: ['string', 'null'] },
      record: { type: 'object' },
    },
  }),
};

export const dataRecordGetExecutor: ActionExecutor = {
  async execute(context, config, input) {
    const pk = asString((input as { pk?: unknown } | null)?.pk);
    if (!pk) return failed('RECORD_INVALID_INPUT', 'VALIDATION', 'Expected input.pk.');
    const resolved = resolvePublishedApi((config as { apiKey?: unknown } | null)?.apiKey);
    if (!resolved.ok) return failed(resolved.errorCode, 'NOT_FOUND', resolved.safeMessage);
    const op = findOp(resolved.definition, 'getOne');
    if (!op) return missingOp('getOne');
    try {
      const result = await getExecutor().execute({
        edgeApiDefinitionId: resolved.definition.id,
        operationId: op.id,
        params: { pk },
        actorUserId: actorUserIdOf(context),
        source: 'workflow',
      });
      const record = asRecord(result.data);
      const found = Boolean(record && Object.keys(record).length > 0);
      context.writeTraceMetadata({ type: 'RECORD_GET', payload: { apiKey: resolved.definition.key, pk, found } });
      if (!found) {
        return failed('RECORD_NOT_FOUND', 'NOT_FOUND', `Record ${pk} was not found.`);
      }
      return { status: 'SUCCEEDED', output: { found: true, pk: rowPk(record) ?? pk, record } };
    } catch (error) {
      return externalFail('RECORD_GET_FAILED', error, 'Record get failed.');
    }
  },
};

export const dataRecordCreateDefinition: ActionDefinition = {
  key: 'data.record-create',
  ...writeBase(['create']),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      fields: {
        type: 'object',
        title: 'Fields',
        description: 'Writable columns for one new row (camelCase), typically from data.map-records.',
        format: 'dynamic-record-fields',
        dynamicRecordFieldsSource: 'apiKey',
      },
    },
    required: ['fields'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      pk: { type: ['string', 'null'] },
      record: { type: 'object' },
    },
  }),
};

const createOne = async (
  context: ActionExecutorContext,
  definition: EdgeApiDefinition,
  fields: Record<string, unknown>,
): Promise<{ ok: true; pk: string | null; record: Record<string, unknown> } | { ok: false; safeMessage: string }> => {
  const op = findOp(definition, 'create');
  if (!op) return { ok: false, safeMessage: 'This Data API has no enabled "create" operation.' };
  try {
    const result = await getExecutor().execute({
      edgeApiDefinitionId: definition.id,
      operationId: op.id,
      body: fields,
      actorUserId: actorUserIdOf(context),
      source: 'workflow',
    });
    const record = asRecord(result.data) ?? {};
    return { ok: true, pk: rowPk(record), record };
  } catch (error) {
    return { ok: false, safeMessage: error instanceof Error ? error.message : 'Record create failed.' };
  }
};

export const dataRecordCreateExecutor: ActionExecutor = {
  async execute(context, config, input) {
    const fields = asRecord((input as { fields?: unknown } | null)?.fields);
    if (!fields || Object.keys(fields).length === 0) {
      return failed('RECORD_INVALID_INPUT', 'VALIDATION', 'Expected input.fields (non-empty object).');
    }
    const resolved = resolvePublishedApi((config as { apiKey?: unknown } | null)?.apiKey);
    if (!resolved.ok) return failed(resolved.errorCode, 'NOT_FOUND', resolved.safeMessage);
    const created = await createOne(context, resolved.definition, fields);
    if (!created.ok) return failed('RECORD_CREATE_FAILED', 'EXTERNAL_ERROR', created.safeMessage);
    context.writeTraceMetadata({
      type: 'RECORD_CREATE',
      payload: { apiKey: resolved.definition.key, pk: created.pk },
    });
    return { status: 'SUCCEEDED', output: { pk: created.pk, record: created.record } };
  },
};

export const dataRecordUpdateDefinition: ActionDefinition = {
  key: 'data.record-update',
  ...writeBase(['update']),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      pk: { type: ['string', 'integer'], title: 'Primary key' },
      fields: {
        type: 'object',
        title: 'Fields',
        description: 'Partial writable columns to patch.',
        format: 'dynamic-record-fields',
        dynamicRecordFieldsSource: 'apiKey',
      },
    },
    required: ['pk', 'fields'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      pk: { type: ['string', 'null'] },
      record: { type: 'object' },
    },
  }),
};

const updateOne = async (
  context: ActionExecutorContext,
  definition: EdgeApiDefinition,
  pk: string,
  fields: Record<string, unknown>,
): Promise<{ ok: true; pk: string | null; record: Record<string, unknown> } | { ok: false; errorCode: string; safeMessage: string }> => {
  const op = findOp(definition, 'update') ?? findOp(definition, 'patch');
  if (!op) return { ok: false, errorCode: 'RECORD_OP_MISSING', safeMessage: 'This Data API has no enabled "update" or "patch" operation.' };
  try {
    const result = await getExecutor().execute({
      edgeApiDefinitionId: definition.id,
      operationId: op.id,
      params: { pk },
      body: fields,
      actorUserId: actorUserIdOf(context),
      source: 'workflow',
    });
    const record = asRecord(result.data) ?? {};
    return { ok: true, pk: rowPk(record) ?? pk, record };
  } catch (error) {
    const safeMessage = error instanceof Error ? error.message : 'Record update failed.';
    const errorCode = /not found/i.test(safeMessage) ? 'RECORD_NOT_FOUND' : 'RECORD_UPDATE_FAILED';
    return { ok: false, errorCode, safeMessage };
  }
};

export const dataRecordUpdateExecutor: ActionExecutor = {
  async execute(context, config, input) {
    const pk = asString((input as { pk?: unknown } | null)?.pk);
    const fields = asRecord((input as { fields?: unknown } | null)?.fields);
    if (!pk) return failed('RECORD_INVALID_INPUT', 'VALIDATION', 'Expected input.pk.');
    if (!fields || Object.keys(fields).length === 0) {
      return failed('RECORD_INVALID_INPUT', 'VALIDATION', 'Expected input.fields (non-empty object).');
    }
    const resolved = resolvePublishedApi((config as { apiKey?: unknown } | null)?.apiKey);
    if (!resolved.ok) return failed(resolved.errorCode, 'NOT_FOUND', resolved.safeMessage);
    const updated = await updateOne(context, resolved.definition, pk, fields);
    if (!updated.ok) {
      return failed(updated.errorCode, updated.errorCode === 'RECORD_NOT_FOUND' ? 'NOT_FOUND' : 'EXTERNAL_ERROR', updated.safeMessage);
    }
    context.writeTraceMetadata({
      type: 'RECORD_UPDATE',
      payload: { apiKey: resolved.definition.key, pk: updated.pk },
    });
    return { status: 'SUCCEEDED', output: { pk: updated.pk, record: updated.record } };
  },
};

export const dataRecordDeleteDefinition: ActionDefinition = {
  key: 'data.record-delete',
  ...writeBase(['delete']),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      pk: { type: ['string', 'integer'], title: 'Primary key' },
    },
    required: ['pk'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      pk: { type: 'string' },
      deleted: { type: 'number' },
    },
  }),
};

export const dataRecordDeleteExecutor: ActionExecutor = {
  async execute(context, config, input) {
    const pk = asString((input as { pk?: unknown } | null)?.pk);
    if (!pk) return failed('RECORD_INVALID_INPUT', 'VALIDATION', 'Expected input.pk.');
    const resolved = resolvePublishedApi((config as { apiKey?: unknown } | null)?.apiKey);
    if (!resolved.ok) return failed(resolved.errorCode, 'NOT_FOUND', resolved.safeMessage);
    const op = findOp(resolved.definition, 'delete');
    if (!op) return missingOp('delete');
    try {
      const result = await getExecutor().execute({
        edgeApiDefinitionId: resolved.definition.id,
        operationId: op.id,
        params: { pk },
        actorUserId: actorUserIdOf(context),
        source: 'workflow',
      });
      const data = asRecord(result.data);
      const deleted = typeof data?.deleted === 'number' ? data.deleted : 1;
      context.writeTraceMetadata({ type: 'RECORD_DELETE', payload: { apiKey: resolved.definition.key, pk, deleted } });
      return { status: 'SUCCEEDED', output: { pk, deleted } };
    } catch (error) {
      return externalFail('RECORD_DELETE_FAILED', error, 'Record delete failed.');
    }
  },
};

export const dataRecordCreateManyDefinition: ActionDefinition = {
  key: 'data.record-create-many',
  ...writeBase(['create', 'bulk']),
  executionTimeoutMs: 120000,
  cancellationSupport: 'SUPPORTED',
  configSchema: inlineSchema({
    type: 'object',
    properties: {
      apiKey: {
        type: 'string',
        title: 'Data API',
        format: 'edge-api-key',
        description: 'Published Data API key from Data Studio.',
      },
      onError: {
        type: 'string',
        title: 'On row error',
        enum: ['FAIL', 'CONTINUE'],
        default: 'FAIL',
        description: 'FAIL stops at the first error. CONTINUE skips failed rows and reports them.',
      },
    },
    required: ['apiKey'],
  }),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      records: {
        type: 'array',
        title: 'Records',
        description: `Array of field objects to insert (max ${MAX_RECORD_CREATE_MANY}). Use data.map-records after data.csv-parse.`,
      },
    },
    required: ['records'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      createdCount: { type: 'number' },
      failedCount: { type: 'number' },
      created: { type: 'array' },
      failed: { type: 'array' },
    },
  }),
};

export const dataRecordCreateManyExecutor: ActionExecutor = {
  async execute(context, config, input) {
    const recordsInput = (input as { records?: unknown } | null)?.records;
    if (!Array.isArray(recordsInput)) {
      return failed('RECORD_INVALID_INPUT', 'VALIDATION', 'Expected input.records (array).');
    }
    if (recordsInput.length > MAX_RECORD_CREATE_MANY) {
      return failed(
        'RECORD_CREATE_MANY_LIMIT',
        'VALIDATION',
        `input.records has ${recordsInput.length} items, exceeding the limit of ${MAX_RECORD_CREATE_MANY}.`,
      );
    }
    const resolved = resolvePublishedApi((config as { apiKey?: unknown } | null)?.apiKey);
    if (!resolved.ok) return failed(resolved.errorCode, 'NOT_FOUND', resolved.safeMessage);
    if (!findOp(resolved.definition, 'create')) return missingOp('create');
    const onError = (config as { onError?: unknown } | null)?.onError === 'CONTINUE' ? 'CONTINUE' : 'FAIL';

    const created: Array<{ index: number; pk: string | null }> = [];
    const failedRows: Array<{ index: number; message: string }> = [];

    for (let index = 0; index < recordsInput.length; index += 1) {
      if (context.cancellationSignal.aborted) {
        return failed('RECORD_CREATE_MANY_CANCELLED', 'CANCELLED', 'Bulk create was cancelled.');
      }
      const fields = asRecord(recordsInput[index]);
      if (!fields || Object.keys(fields).length === 0) {
        const message = `Row ${index} is not a non-empty object.`;
        if (onError === 'FAIL') return failed('RECORD_INVALID_INPUT', 'VALIDATION', message);
        failedRows.push({ index, message });
        continue;
      }
      const result = await createOne(context, resolved.definition, fields);
      if (!result.ok) {
        if (onError === 'FAIL') {
          return {
            status: 'FAILED',
            errorCode: 'RECORD_CREATE_MANY_FAILED',
            errorClass: 'EXTERNAL_ERROR',
            safeMessage: `Row ${index} failed: ${result.safeMessage}`,
            classifiedDetails: { createdCount: created.length, failedIndex: index },
          };
        }
        failedRows.push({ index, message: result.safeMessage });
        continue;
      }
      created.push({ index, pk: result.pk });
    }

    context.writeTraceMetadata({
      type: 'RECORD_CREATE_MANY',
      payload: { apiKey: resolved.definition.key, createdCount: created.length, failedCount: failedRows.length },
    });
    return {
      status: 'SUCCEEDED',
      output: {
        createdCount: created.length,
        failedCount: failedRows.length,
        created,
        failed: failedRows,
      },
    };
  },
};

export const dataRecordUpsertDefinition: ActionDefinition = {
  key: 'data.record-upsert',
  ...writeBase(['upsert']),
  executionTimeoutMs: 45000,
  configSchema: inlineSchema({
    type: 'object',
    properties: {
      apiKey: {
        type: 'string',
        title: 'Data API',
        format: 'edge-api-key',
        description: 'Published Data API key from Data Studio.',
      },
      uniqueField: {
        type: 'string',
        title: 'Unique field',
        description: 'Column used to find an existing row (e.g. sku, slug, email). Compared with eq on list.',
      },
    },
    required: ['apiKey', 'uniqueField'],
  }),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      fields: {
        type: 'object',
        title: 'Fields',
        description: 'Writable columns. Must include uniqueField (or pass uniqueValue separately).',
        format: 'dynamic-record-fields',
        dynamicRecordFieldsSource: 'apiKey',
      },
      uniqueValue: {
        description: 'Override for the unique-field lookup when it is not inside fields.',
      },
    },
    required: ['fields'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      pk: { type: ['string', 'null'] },
      created: { type: 'boolean' },
      record: { type: 'object' },
    },
  }),
};

const lookupExistingPk = async (
  context: ActionExecutorContext,
  definition: EdgeApiDefinition,
  uniqueField: string,
  uniqueValue: string,
): Promise<string | null> => {
  const listOp = findOp(definition, 'list');
  if (!listOp) return null;
  const result = await getExecutor().execute({
    edgeApiDefinitionId: definition.id,
    operationId: listOp.id,
    query: {
      filter: { [uniqueField]: { eq: uniqueValue } },
      pageSize: 1,
    },
    actorUserId: actorUserIdOf(context),
  });
  const rows = Array.isArray(result.data) ? result.data : [];
  const first = asRecord(rows[0]);
  return rowPk(first);
};

export const dataRecordUpsertExecutor: ActionExecutor = {
  async execute(context, config, input) {
    const uniqueField = asString((config as { uniqueField?: unknown } | null)?.uniqueField);
    const fields = asRecord((input as { fields?: unknown } | null)?.fields);
    if (!uniqueField) return failed('RECORD_INVALID_INPUT', 'VALIDATION', 'Expected config.uniqueField.');
    if (!fields || Object.keys(fields).length === 0) {
      return failed('RECORD_INVALID_INPUT', 'VALIDATION', 'Expected input.fields (non-empty object).');
    }
    const uniqueValue = asString((input as { uniqueValue?: unknown } | null)?.uniqueValue)
      ?? asString(fields[uniqueField]);
    if (!uniqueValue) {
      return failed(
        'RECORD_INVALID_INPUT',
        'VALIDATION',
        `Unique value is missing — set input.uniqueValue or fields.${uniqueField}.`,
      );
    }
    const resolved = resolvePublishedApi((config as { apiKey?: unknown } | null)?.apiKey);
    if (!resolved.ok) return failed(resolved.errorCode, 'NOT_FOUND', resolved.safeMessage);

    let existingPk: string | null = null;
    try {
      existingPk = await lookupExistingPk(context, resolved.definition, uniqueField, uniqueValue);
    } catch (error) {
      return externalFail('RECORD_UPSERT_LOOKUP_FAILED', error, 'Upsert lookup failed.');
    }

    if (existingPk) {
      const updated = await updateOne(context, resolved.definition, existingPk, fields);
      if (!updated.ok) {
        return failed(updated.errorCode, 'EXTERNAL_ERROR', updated.safeMessage);
      }
      context.writeTraceMetadata({
        type: 'RECORD_UPSERT',
        payload: { apiKey: resolved.definition.key, pk: updated.pk, created: false },
      });
      return { status: 'SUCCEEDED', output: { pk: updated.pk, created: false, record: updated.record } };
    }

    const created = await createOne(context, resolved.definition, fields);
    if (!created.ok) return failed('RECORD_CREATE_FAILED', 'EXTERNAL_ERROR', created.safeMessage);
    context.writeTraceMetadata({
      type: 'RECORD_UPSERT',
      payload: { apiKey: resolved.definition.key, pk: created.pk, created: true },
    });
    return { status: 'SUCCEEDED', output: { pk: created.pk, created: true, record: created.record } };
  },
};
