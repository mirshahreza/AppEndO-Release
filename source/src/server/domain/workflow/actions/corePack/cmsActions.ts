import type { ActionDefinition, ActionExecutor } from '../types';
import type { JsonValue } from '../../awm/types';
import { SETTINGS_PATH } from '../../../../config/settingsFile';
import { getDataSourcesFromSettings } from '../../../../db/dataSourcesStore';
import { DataApiExecutor } from '../../../../services/data-api/dataApiExecutor';
import { getEdgeApiDefinitionByKey } from '../../../../services/data-api/edgeApiStore';
import type { EdgeApiDefinition, EdgeApiOperation } from '../../../../../shared/api/contracts/data-api';

/**
 * CMS Action pack (p-89 ACT-1) — in-process reads/writes against the published `cms-contents`
 * Edge API (DataApiExecutor). Workflow HTTP cannot call `/api/cms/*` (SSRF blocks loopback).
 * Never hardcodes a workflow definition key; only the Edge API key `cms-contents`.
 */

const CMS_CONTENTS_API_KEY = 'cms-contents';

const inlineSchema = (schema: JsonValue = {}) => ({ type: 'INLINE' as const, schema });

const parsePositiveId = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    const n = Number(value.trim());
    return Number.isInteger(n) && n > 0 ? value.trim() : null;
  }
  return null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => (
  value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null
);

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
export const __resetCmsActionExecutorForTests = (): void => {
  executorSingleton = null;
};

const resolvePublishedCmsContentsApi = ():
  | { ok: true; definition: EdgeApiDefinition }
  | { ok: false; errorCode: string; safeMessage: string } => {
  const definition = getEdgeApiDefinitionByKey(CMS_CONTENTS_API_KEY);
  if (!definition) {
    return {
      ok: false,
      errorCode: 'CMS_API_NOT_FOUND',
      safeMessage: `Published Edge API "${CMS_CONTENTS_API_KEY}" was not found. Run CMS Phase 2 first.`,
    };
  }
  if (!definition.publishedAt) {
    return {
      ok: false,
      errorCode: 'CMS_API_NOT_PUBLISHED',
      safeMessage: `Edge API "${CMS_CONTENTS_API_KEY}" exists but is not published.`,
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

const contentSummary = (row: Record<string, unknown> | null) => {
  if (!row) return { found: false as const };
  const idRaw = row.id ?? row.Id;
  const id = typeof idRaw === 'number' || typeof idRaw === 'string' ? idRaw : null;
  return {
    found: true as const,
    id,
    slug: typeof row.slug === 'string' ? row.slug : null,
    title: typeof row.title === 'string' ? row.title : null,
    summary: typeof row.summary === 'string' ? row.summary : null,
    statusCode: typeof row.statusCode === 'string' ? row.statusCode : null,
    languageCode: typeof row.languageCode === 'string' ? row.languageCode : null,
    contentTypeCode: typeof row.contentTypeCode === 'string' ? row.contentTypeCode : null,
    publishedAt: row.publishedAt ?? null,
    body: typeof row.body === 'string' ? row.body : null,
    row,
  };
};

export const cmsContentGetDefinition: ActionDefinition = {
  key: 'cms.content-get',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      contentId: { type: ['integer', 'string'], title: 'Content id', description: 'cms_contents.id' },
    },
    required: ['contentId'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      found: { type: 'boolean' },
      id: { type: ['integer', 'string', 'null'] },
      slug: { type: ['string', 'null'] },
      title: { type: ['string', 'null'] },
      statusCode: { type: ['string', 'null'] },
      publishedAt: {},
    },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'DEDUPLICATED', deduplicationWindowMs: 86400000 },
  cancellationSupport: 'NONE',
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'LOW',
  requiredCapabilities: ['cms.read'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['cms', 'contents'],
};

export const cmsContentGetExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const contentId = parsePositiveId((input as { contentId?: unknown } | null)?.contentId);
    if (!contentId) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.contentId (positive integer).',
      };
    }
    const resolved = resolvePublishedCmsContentsApi();
    if (!resolved.ok) {
      return {
        status: 'FAILED',
        errorCode: resolved.errorCode,
        errorClass: 'NOT_FOUND',
        safeMessage: resolved.safeMessage,
      };
    }
    const op = findOp(resolved.definition, 'getOne');
    if (!op) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_OP_MISSING',
        errorClass: 'CONFIGURATION',
        safeMessage: 'cms-contents getOne operation is not enabled.',
      };
    }
    try {
      const result = await getExecutor().execute({
        edgeApiDefinitionId: resolved.definition.id,
        operationId: op.id,
        params: { pk: contentId },
      });
      const row = asRecord(result.data);
      const summary = contentSummary(row);
      context.writeTraceMetadata({ type: 'CMS_CONTENT_GET', payload: { contentId, found: summary.found } });
      if (!summary.found) {
        return {
          status: 'FAILED',
          errorCode: 'CMS_CONTENT_NOT_FOUND',
          errorClass: 'NOT_FOUND',
          safeMessage: `CMS content ${contentId} was not found.`,
        };
      }
      return { status: 'SUCCEEDED', output: summary };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'CMS content get failed.';
      return {
        status: 'FAILED',
        errorCode: 'CMS_CONTENT_GET_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage,
      };
    }
  },
};

export const cmsContentCreateDefinition: ActionDefinition = {
  key: 'cms.content-create',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      fields: {
        type: 'object',
        description: 'Writable cms_contents columns (camelCase), e.g. title, slug, statusCode.',
      },
    },
    required: ['fields'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      id: { type: ['integer', 'string'] },
      slug: { type: ['string', 'null'] },
      title: { type: ['string', 'null'] },
      statusCode: { type: ['string', 'null'] },
    },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['cms.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['cms', 'contents'],
};

export const cmsContentCreateExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const fields = asRecord((input as { fields?: unknown } | null)?.fields);
    if (!fields || Object.keys(fields).length === 0) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.fields (non-empty object).',
      };
    }
    const resolved = resolvePublishedCmsContentsApi();
    if (!resolved.ok) {
      return {
        status: 'FAILED',
        errorCode: resolved.errorCode,
        errorClass: 'NOT_FOUND',
        safeMessage: resolved.safeMessage,
      };
    }
    const op = findOp(resolved.definition, 'create');
    if (!op) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_OP_MISSING',
        errorClass: 'CONFIGURATION',
        safeMessage: 'cms-contents create operation is not enabled.',
      };
    }
    const actorId = context.effectiveIdentity.type === 'USER' ? context.effectiveIdentity.id : null;
    try {
      const result = await getExecutor().execute({
        edgeApiDefinitionId: resolved.definition.id,
        operationId: op.id,
        body: fields,
        actorUserId: actorId,
      });
      const row = asRecord(result.data);
      const summary = contentSummary(row);
      context.writeTraceMetadata({
        type: 'CMS_CONTENT_CREATE',
        payload: { id: summary.id, slug: summary.slug },
      });
      if (!summary.found) {
        return {
          status: 'FAILED',
          errorCode: 'CMS_CONTENT_CREATE_FAILED',
          errorClass: 'EXTERNAL_ERROR',
          safeMessage: 'Create succeeded but returned no row.',
        };
      }
      return { status: 'SUCCEEDED', output: summary };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'CMS content create failed.';
      return {
        status: 'FAILED',
        errorCode: 'CMS_CONTENT_CREATE_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage,
      };
    }
  },
};

export const cmsContentUpdateDefinition: ActionDefinition = {
  key: 'cms.content-update',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      contentId: { type: ['integer', 'string'], title: 'Content id' },
      fields: {
        type: 'object',
        description: 'Partial writable fields (e.g. statusCode, publishedAt, title).',
      },
    },
    required: ['contentId', 'fields'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      id: { type: ['integer', 'string'] },
      statusCode: { type: ['string', 'null'] },
      publishedAt: {},
      title: { type: ['string', 'null'] },
    },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['cms.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['cms', 'contents'],
};

export const cmsContentUpdateExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = asRecord(input) ?? {};
    const contentId = parsePositiveId(record.contentId);
    const nested = asRecord(record.fields);
    const fields: Record<string, unknown> = nested && Object.keys(nested).length > 0
      ? nested
      : Object.fromEntries(Object.entries(record).filter(([key]) => key !== 'contentId' && key !== 'fields'));
    if (!contentId) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.contentId (positive integer).',
      };
    }
    if (Object.keys(fields).length === 0) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.fields (object) or top-level patch fields alongside contentId.',
      };
    }
    const resolved = resolvePublishedCmsContentsApi();
    if (!resolved.ok) {
      return {
        status: 'FAILED',
        errorCode: resolved.errorCode,
        errorClass: 'NOT_FOUND',
        safeMessage: resolved.safeMessage,
      };
    }
    const op = findOp(resolved.definition, 'update') ?? findOp(resolved.definition, 'patch');
    if (!op) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_OP_MISSING',
        errorClass: 'CONFIGURATION',
        safeMessage: 'cms-contents update operation is not enabled.',
      };
    }
    const actorId = context.effectiveIdentity.type === 'USER' ? context.effectiveIdentity.id : null;
    try {
      const result = await getExecutor().execute({
        edgeApiDefinitionId: resolved.definition.id,
        operationId: op.id,
        params: { pk: contentId },
        body: fields,
        actorUserId: actorId,
      });
      const row = asRecord(result.data) ?? { id: Number(contentId), ...fields };
      const summary = contentSummary({ id: Number(contentId), ...row });
      context.writeTraceMetadata({
        type: 'CMS_CONTENT_UPDATE',
        payload: { contentId, statusCode: summary.statusCode },
      });
      return { status: 'SUCCEEDED', output: summary };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'CMS content update failed.';
      const notFound = /not found/i.test(safeMessage);
      return {
        status: 'FAILED',
        errorCode: notFound ? 'CMS_CONTENT_NOT_FOUND' : 'CMS_CONTENT_UPDATE_FAILED',
        errorClass: notFound ? 'NOT_FOUND' : 'EXTERNAL_ERROR',
        safeMessage,
      };
    }
  },
};

const CMS_REVISIONS_API_KEY = 'cms-revisions';

const resolvePublishedCmsRevisionsApi = ():
  | { ok: true; definition: EdgeApiDefinition }
  | { ok: false; errorCode: string; safeMessage: string } => {
  const definition = getEdgeApiDefinitionByKey(CMS_REVISIONS_API_KEY);
  if (!definition) {
    return {
      ok: false,
      errorCode: 'CMS_API_NOT_FOUND',
      safeMessage: `Published Edge API "${CMS_REVISIONS_API_KEY}" was not found. Run CMS Phase 2 first.`,
    };
  }
  if (!definition.publishedAt) {
    return {
      ok: false,
      errorCode: 'CMS_API_NOT_PUBLISHED',
      safeMessage: `Edge API "${CMS_REVISIONS_API_KEY}" exists but is not published.`,
    };
  }
  return { ok: true, definition };
};

export const cmsRevisionCreateDefinition: ActionDefinition = {
  key: 'cms.revision-create',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      contentId: { type: ['integer', 'string'], title: 'Content id' },
      title: { type: 'string' },
      summary: { type: 'string' },
      body: { type: 'string' },
      revisionNo: { type: 'integer', description: 'Optional; auto next when omitted.' },
      actorUserId: { type: ['integer', 'string'] },
    },
    required: ['contentId'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      id: { type: ['integer', 'string', 'null'] },
      contentId: { type: ['integer', 'string'] },
      revisionNo: { type: 'integer' },
      title: { type: ['string', 'null'] },
    },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['cms.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['cms', 'revisions'],
};

export const cmsRevisionCreateExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = asRecord(input) ?? {};
    const contentId = parsePositiveId(record.contentId);
    if (!contentId) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.contentId (positive integer).',
      };
    }

    let title = typeof record.title === 'string' ? record.title : null;
    let summary = typeof record.summary === 'string' ? record.summary : null;
    let body = typeof record.body === 'string' ? record.body : null;
    if (title === null || body === null || summary === null) {
      const getResult = await cmsContentGetExecutor.execute(context, {}, { contentId: Number(contentId) });
      if (getResult.status !== 'SUCCEEDED') return getResult;
      const snap = asRecord(getResult.output) ?? {};
      title = title ?? (typeof snap.title === 'string' ? snap.title : null);
      summary = summary ?? (typeof snap.summary === 'string' ? snap.summary : null);
      body = body ?? (typeof snap.body === 'string' ? snap.body : null);
    }

    const resolved = resolvePublishedCmsRevisionsApi();
    if (!resolved.ok) {
      return {
        status: 'FAILED',
        errorCode: resolved.errorCode,
        errorClass: 'NOT_FOUND',
        safeMessage: resolved.safeMessage,
      };
    }
    const listOp = findOp(resolved.definition, 'list');
    const createOp = findOp(resolved.definition, 'create');
    if (!createOp) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_OP_MISSING',
        errorClass: 'CONFIGURATION',
        safeMessage: 'cms-revisions create operation is not enabled.',
      };
    }

    let revisionNo =
      typeof record.revisionNo === 'number' && Number.isInteger(record.revisionNo) && record.revisionNo > 0
        ? record.revisionNo
        : null;
    if (revisionNo === null && listOp) {
      try {
        const listed = await getExecutor().execute({
          edgeApiDefinitionId: resolved.definition.id,
          operationId: listOp.id,
          query: {
            filter: JSON.stringify({ contentId: Number(contentId) }),
            sort: '-revisionNo',
            pageSize: 1,
          },
        });
        const rows = Array.isArray(listed.data) ? listed.data : [];
        const top = asRecord(rows[0]);
        const prev = top && typeof top.revisionNo === 'number' ? top.revisionNo : 0;
        revisionNo = prev + 1;
      } catch {
        revisionNo = 1;
      }
    }
    if (revisionNo === null) revisionNo = 1;

    const actorId = context.effectiveIdentity.type === 'USER' ? context.effectiveIdentity.id : null;
    const actorFromInput = parsePositiveId(record.actorUserId);
    try {
      const result = await getExecutor().execute({
        edgeApiDefinitionId: resolved.definition.id,
        operationId: createOp.id,
        body: {
          contentId: Number(contentId),
          revisionNo,
          title,
          summary,
          body,
          ...(actorFromInput ? { createdBy: Number(actorFromInput) } : {}),
        },
        actorUserId: actorId ?? actorFromInput,
      });
      const row = asRecord(result.data) ?? {};
      context.writeTraceMetadata({
        type: 'CMS_REVISION_CREATE',
        payload: { contentId, revisionNo, id: row.id ?? null },
      });
      return {
        status: 'SUCCEEDED',
        output: {
          id: row.id ?? null,
          contentId: Number(contentId),
          revisionNo,
          title: typeof row.title === 'string' ? row.title : title,
          summary: typeof row.summary === 'string' ? row.summary : summary,
          body: typeof row.body === 'string' ? row.body : body,
          row,
        },
      };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'CMS revision create failed.';
      return {
        status: 'FAILED',
        errorCode: 'CMS_REVISION_CREATE_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage,
      };
    }
  },
};

const resolvePublishedApi = (apiKey: string):
  | { ok: true; definition: EdgeApiDefinition }
  | { ok: false; errorCode: string; safeMessage: string } => {
  const definition = getEdgeApiDefinitionByKey(apiKey);
  if (!definition) {
    return {
      ok: false,
      errorCode: 'CMS_API_NOT_FOUND',
      safeMessage: `Published Edge API "${apiKey}" was not found. Run CMS Phase 2 first.`,
    };
  }
  if (!definition.publishedAt) {
    return {
      ok: false,
      errorCode: 'CMS_API_NOT_PUBLISHED',
      safeMessage: `Edge API "${apiKey}" exists but is not published.`,
    };
  }
  return { ok: true, definition };
};

/** ACT-3 — link a Base Info tag code onto a CMS content row (`cms_content_tags`). */
export const cmsTagLinkDefinition: ActionDefinition = {
  key: 'cms.tag-link',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      contentId: { type: ['integer', 'string'] },
      tagCode: { type: 'string', description: 'base_info id under CMS Content Tags' },
    },
    required: ['contentId', 'tagCode'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      contentId: {},
      tagCode: { type: 'string' },
    },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'DEDUPLICATED', deduplicationWindowMs: 86400000 },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'LOW',
  requiredCapabilities: ['cms.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['cms', 'tags'],
};

export const cmsTagLinkExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = asRecord(input) ?? {};
    const contentId = parsePositiveId(record.contentId);
    const tagCode = typeof record.tagCode === 'string' ? record.tagCode.trim() : '';
    if (!contentId || !tagCode) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.contentId and input.tagCode.',
      };
    }
    const resolved = resolvePublishedApi('cms-tags');
    if (!resolved.ok) {
      return { status: 'FAILED', errorCode: resolved.errorCode, errorClass: 'NOT_FOUND', safeMessage: resolved.safeMessage };
    }
    const op = findOp(resolved.definition, 'create');
    if (!op) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_OP_MISSING',
        errorClass: 'CONFIGURATION',
        safeMessage: 'cms-tags create operation is not enabled.',
      };
    }
    try {
      const result = await getExecutor().execute({
        edgeApiDefinitionId: resolved.definition.id,
        operationId: op.id,
        body: { contentId: Number(contentId), tagCode },
      });
      const row = asRecord(result.data) ?? { contentId: Number(contentId), tagCode };
      context.writeTraceMetadata({ type: 'CMS_TAG_LINK', payload: { contentId, tagCode } });
      return {
        status: 'SUCCEEDED',
        output: {
          contentId: row.contentId ?? Number(contentId),
          tagCode: typeof row.tagCode === 'string' ? row.tagCode : tagCode,
          row,
        },
      };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'CMS tag link failed.';
      // Unique violation → treat as idempotent success
      if (/unique|duplicate/i.test(safeMessage)) {
        return {
          status: 'SUCCEEDED',
          output: { contentId: Number(contentId), tagCode, alreadyLinked: true },
        };
      }
      return {
        status: 'FAILED',
        errorCode: 'CMS_TAG_LINK_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage,
      };
    }
  },
};

/** ACT-3 — create an undirected relation between two contents (ordered A < B). */
export const cmsRelationCreateDefinition: ActionDefinition = {
  key: 'cms.relation-create',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      contentIdA: { type: ['integer', 'string'] },
      contentIdB: { type: ['integer', 'string'] },
      note: { type: 'string' },
    },
    required: ['contentIdA', 'contentIdB'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      id: {},
      contentIdA: {},
      contentIdB: {},
      note: {},
    },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'LOW',
  requiredCapabilities: ['cms.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['cms', 'relations'],
};

export const cmsRelationCreateExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = asRecord(input) ?? {};
    const a = parsePositiveId(record.contentIdA);
    const b = parsePositiveId(record.contentIdB);
    if (!a || !b) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected input.contentIdA and contentIdB.',
      };
    }
    if (a === b) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'contentIdA and contentIdB must differ.',
      };
    }
    const contentIdA = Number(a) < Number(b) ? Number(a) : Number(b);
    const contentIdB = Number(a) < Number(b) ? Number(b) : Number(a);
    const note = typeof record.note === 'string' ? record.note : null;
    const resolved = resolvePublishedApi('cms-relations');
    if (!resolved.ok) {
      return { status: 'FAILED', errorCode: resolved.errorCode, errorClass: 'NOT_FOUND', safeMessage: resolved.safeMessage };
    }
    const op = findOp(resolved.definition, 'create');
    if (!op) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_OP_MISSING',
        errorClass: 'CONFIGURATION',
        safeMessage: 'cms-relations create operation is not enabled.',
      };
    }
    try {
      const result = await getExecutor().execute({
        edgeApiDefinitionId: resolved.definition.id,
        operationId: op.id,
        body: { contentIdA, contentIdB, note },
      });
      const row = asRecord(result.data) ?? { contentIdA, contentIdB, note };
      context.writeTraceMetadata({
        type: 'CMS_RELATION_CREATE',
        payload: { contentIdA, contentIdB, id: row.id ?? null },
      });
      return {
        status: 'SUCCEEDED',
        output: {
          id: row.id ?? null,
          contentIdA: row.contentIdA ?? contentIdA,
          contentIdB: row.contentIdB ?? contentIdB,
          note: row.note ?? note,
          row,
        },
      };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'CMS relation create failed.';
      return {
        status: 'FAILED',
        errorCode: 'CMS_RELATION_CREATE_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage,
      };
    }
  },
};

/** ACT-3 — attach a binary asset to a content (BYTEA via base64). */
export const cmsAssetCreateDefinition: ActionDefinition = {
  key: 'cms.asset-create',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      contentId: { type: ['integer', 'string'] },
      fileName: { type: 'string' },
      fileMime: { type: 'string' },
      fileBase64: { type: 'string', description: 'Raw file bytes as base64 (Data API BLOB encoding).' },
      sha256: { type: 'string' },
      sortOrder: { type: 'integer' },
      actorUserId: { type: ['integer', 'string'] },
    },
    required: ['contentId', 'fileName', 'fileMime', 'fileBase64'],
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      id: {},
      contentId: {},
      fileName: { type: 'string' },
      fileSize: { type: 'integer' },
      sha256: {},
    },
  }),
  executionTimeoutMs: 30000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'MEDIUM',
  requiredCapabilities: ['cms.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['cms', 'assets'],
};

export const cmsAssetCreateExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = asRecord(input) ?? {};
    const contentId = parsePositiveId(record.contentId);
    const fileName = typeof record.fileName === 'string' ? record.fileName.trim() : '';
    const fileMime = typeof record.fileMime === 'string' ? record.fileMime.trim() : '';
    const fileBase64 = typeof record.fileBase64 === 'string' ? record.fileBase64.trim() : '';
    if (!contentId || !fileName || !fileMime || !fileBase64) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected contentId, fileName, fileMime, and fileBase64.',
      };
    }
    let buffer: Buffer;
    try {
      buffer = Buffer.from(fileBase64, 'base64');
    } catch {
      return {
        status: 'FAILED',
        errorCode: 'CMS_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'fileBase64 is not valid base64.',
      };
    }
    if (buffer.length === 0) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Decoded file is empty.',
      };
    }
    const crypto = await import('node:crypto');
    const sha256 = typeof record.sha256 === 'string' && record.sha256.trim()
      ? record.sha256.trim()
      : crypto.createHash('sha256').update(buffer).digest('hex');
    const sortOrder = typeof record.sortOrder === 'number' && Number.isInteger(record.sortOrder)
      ? record.sortOrder
      : 0;
    const resolved = resolvePublishedApi('cms-assets');
    if (!resolved.ok) {
      return { status: 'FAILED', errorCode: resolved.errorCode, errorClass: 'NOT_FOUND', safeMessage: resolved.safeMessage };
    }
    const op = findOp(resolved.definition, 'create');
    if (!op) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_OP_MISSING',
        errorClass: 'CONFIGURATION',
        safeMessage: 'cms-assets create operation is not enabled.',
      };
    }
    const actorFromInput = parsePositiveId(record.actorUserId);
    const actorId = context.effectiveIdentity.type === 'USER'
      ? context.effectiveIdentity.id
      : actorFromInput;
    try {
      const result = await getExecutor().execute({
        edgeApiDefinitionId: resolved.definition.id,
        operationId: op.id,
        body: {
          contentId: Number(contentId),
          fileName,
          fileMime,
          fileSize: buffer.length,
          sha256,
          sortOrder,
          file: fileBase64,
          ...(actorFromInput ? { createdBy: Number(actorFromInput) } : {}),
        },
        actorUserId: actorId,
      });
      const row = asRecord(result.data) ?? {};
      context.writeTraceMetadata({
        type: 'CMS_ASSET_CREATE',
        payload: { contentId, fileName, id: row.id ?? null, sha256 },
      });
      return {
        status: 'SUCCEEDED',
        output: {
          id: row.id ?? null,
          contentId: Number(contentId),
          fileName: typeof row.fileName === 'string' ? row.fileName : fileName,
          fileSize: typeof row.fileSize === 'number' ? row.fileSize : buffer.length,
          sha256: typeof row.sha256 === 'string' ? row.sha256 : sha256,
          row,
        },
      };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'CMS asset create failed.';
      return {
        status: 'FAILED',
        errorCode: 'CMS_ASSET_CREATE_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage,
      };
    }
  },
};

const CMS_SETTINGS_API_KEY = 'cms-settings';
const CMS_SETTINGS_PK = '1';

const resolvePublishedCmsSettingsApi = ():
  | { ok: true; definition: EdgeApiDefinition }
  | { ok: false; errorCode: string; safeMessage: string } => {
  const definition = getEdgeApiDefinitionByKey(CMS_SETTINGS_API_KEY);
  if (!definition) {
    return {
      ok: false,
      errorCode: 'CMS_API_NOT_FOUND',
      safeMessage: `Published Edge API "${CMS_SETTINGS_API_KEY}" was not found. Run CMS Phase 2 first.`,
    };
  }
  if (!definition.publishedAt) {
    return {
      ok: false,
      errorCode: 'CMS_API_NOT_PUBLISHED',
      safeMessage: `Edge API "${CMS_SETTINGS_API_KEY}" exists but is not published.`,
    };
  }
  return { ok: true, definition };
};

const settingsSummary = (row: Record<string, unknown> | null) => {
  if (!row) return { found: false as const };
  const pickBool = (a: unknown, b: unknown): boolean | null => {
    if (typeof a === 'boolean') return a;
    if (typeof b === 'boolean') return b;
    return null;
  };
  const pickStr = (a: unknown, b: unknown): string | null => {
    if (typeof a === 'string') return a;
    if (typeof b === 'string') return b;
    return null;
  };
  const pickNum = (a: unknown, b: unknown): number | null => {
    if (typeof a === 'number' && Number.isFinite(a)) return a;
    if (typeof b === 'number' && Number.isFinite(b)) return b;
    if (typeof a === 'string' && /^\d+$/.test(a)) return Number(a);
    if (typeof b === 'string' && /^\d+$/.test(b)) return Number(b);
    return null;
  };
  return {
    found: true as const,
    id: 1,
    commentsEnabled: pickBool(row.commentsEnabled, row.comments_enabled),
    commentsPolicyCode: pickStr(row.commentsPolicyCode, row.comments_policy_code),
    commentsBodyFormatCode: pickStr(row.commentsBodyFormatCode, row.comments_body_format_code),
    publicCacheTtlSeconds: pickNum(row.publicCacheTtlSeconds, row.public_cache_ttl_seconds),
  };
};

export const cmsSettingsGetDefinition: ActionDefinition = {
  key: 'cms.settings-get',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({ type: 'object', properties: {} }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      found: { type: 'boolean' },
      id: { type: 'integer' },
      commentsEnabled: { type: ['boolean', 'null'] },
      commentsPolicyCode: { type: ['string', 'null'] },
      commentsBodyFormatCode: { type: ['string', 'null'] },
      publicCacheTtlSeconds: { type: ['integer', 'null'] },
    },
  }),
  executionTimeoutMs: 10000,
  idempotency: { guarantee: 'DEDUPLICATED', deduplicationWindowMs: 86400000 },
  cancellationSupport: 'NONE',
  sideEffectClass: 'READ_EXTERNAL',
  riskClass: 'LOW',
  requiredCapabilities: ['cms.read'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['cms', 'settings'],
};

export const cmsSettingsGetExecutor: ActionExecutor = {
  async execute(context) {
    const resolved = resolvePublishedCmsSettingsApi();
    if (!resolved.ok) {
      return {
        status: 'FAILED',
        errorCode: resolved.errorCode,
        errorClass: 'NOT_FOUND',
        safeMessage: resolved.safeMessage,
      };
    }
    const op = findOp(resolved.definition, 'getOne');
    if (!op) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_OP_MISSING',
        errorClass: 'CONFIGURATION',
        safeMessage: 'cms-settings getOne operation is not enabled.',
      };
    }
    try {
      const result = await getExecutor().execute({
        edgeApiDefinitionId: resolved.definition.id,
        operationId: op.id,
        params: { pk: CMS_SETTINGS_PK },
      });
      const summary = settingsSummary(asRecord(result.data));
      context.writeTraceMetadata({ type: 'CMS_SETTINGS_GET', payload: { found: summary.found } });
      if (!summary.found) {
        return {
          status: 'FAILED',
          errorCode: 'CMS_SETTINGS_NOT_FOUND',
          errorClass: 'NOT_FOUND',
          safeMessage: 'CMS settings singleton row was not found.',
        };
      }
      return { status: 'SUCCEEDED', output: summary };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'CMS settings get failed.';
      return {
        status: 'FAILED',
        errorCode: 'CMS_SETTINGS_GET_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage,
      };
    }
  },
};

export const cmsSettingsUpdateDefinition: ActionDefinition = {
  key: 'cms.settings-update',
  version: '1',
  contributor: { type: 'CORE', id: 'core' },
  configSchema: inlineSchema(),
  inputSchema: inlineSchema({
    type: 'object',
    properties: {
      commentsEnabled: { type: 'boolean' },
      commentsPolicyCode: { type: 'string' },
      commentsBodyFormatCode: { type: 'string' },
      publicCacheTtlSeconds: { type: 'integer' },
      fields: {
        type: 'object',
        description: 'Partial patch; merged onto current singleton before update.',
      },
      actorUserId: { type: ['integer', 'string'] },
    },
  }),
  outputSchema: inlineSchema({
    type: 'object',
    properties: {
      id: { type: 'integer' },
      commentsEnabled: { type: ['boolean', 'null'] },
      commentsPolicyCode: { type: ['string', 'null'] },
      commentsBodyFormatCode: { type: ['string', 'null'] },
      publicCacheTtlSeconds: { type: ['integer', 'null'] },
    },
  }),
  executionTimeoutMs: 15000,
  idempotency: { guarantee: 'NONE' },
  cancellationSupport: 'NONE',
  sideEffectClass: 'WRITE_EXTERNAL',
  riskClass: 'HIGH',
  requiredCapabilities: ['cms.write'],
  requiredPermissions: [],
  secretReferenceFields: [],
  availability: 'AVAILABLE',
  executionMode: 'DETERMINISTIC',
  tags: ['cms', 'settings'],
};

export const cmsSettingsUpdateExecutor: ActionExecutor = {
  async execute(context, _config, input) {
    const record = asRecord(input) ?? {};
    const nested = asRecord(record.fields) ?? {};
    const patch: Record<string, unknown> = { ...nested };
    for (const key of [
      'commentsEnabled',
      'commentsPolicyCode',
      'commentsBodyFormatCode',
      'publicCacheTtlSeconds',
    ] as const) {
      if (record[key] !== undefined) patch[key] = record[key];
    }
    if (Object.keys(patch).length === 0) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_INVALID_INPUT',
        errorClass: 'VALIDATION',
        safeMessage: 'Expected at least one settings field to update.',
      };
    }
    const resolved = resolvePublishedCmsSettingsApi();
    if (!resolved.ok) {
      return {
        status: 'FAILED',
        errorCode: resolved.errorCode,
        errorClass: 'NOT_FOUND',
        safeMessage: resolved.safeMessage,
      };
    }
    const getOp = findOp(resolved.definition, 'getOne');
    const updateOp = findOp(resolved.definition, 'update') ?? findOp(resolved.definition, 'patch');
    if (!getOp || !updateOp) {
      return {
        status: 'FAILED',
        errorCode: 'CMS_OP_MISSING',
        errorClass: 'CONFIGURATION',
        safeMessage: 'cms-settings getOne/update operations are not enabled.',
      };
    }
    const actorFromInput = parsePositiveId(record.actorUserId);
    const actorId = context.effectiveIdentity.type === 'USER'
      ? context.effectiveIdentity.id
      : actorFromInput ? Number(actorFromInput) : null;
    try {
      const currentResult = await getExecutor().execute({
        edgeApiDefinitionId: resolved.definition.id,
        operationId: getOp.id,
        params: { pk: CMS_SETTINGS_PK },
      });
      const current = settingsSummary(asRecord(currentResult.data));
      if (!current.found) {
        return {
          status: 'FAILED',
          errorCode: 'CMS_SETTINGS_NOT_FOUND',
          errorClass: 'NOT_FOUND',
          safeMessage: 'CMS settings singleton row was not found.',
        };
      }
      const body = {
        commentsEnabled: patch.commentsEnabled !== undefined
          ? Boolean(patch.commentsEnabled)
          : current.commentsEnabled,
        commentsPolicyCode: patch.commentsPolicyCode !== undefined
          ? String(patch.commentsPolicyCode)
          : current.commentsPolicyCode,
        commentsBodyFormatCode: patch.commentsBodyFormatCode !== undefined
          ? String(patch.commentsBodyFormatCode)
          : current.commentsBodyFormatCode,
        publicCacheTtlSeconds: patch.publicCacheTtlSeconds !== undefined
          ? Number(patch.publicCacheTtlSeconds)
          : current.publicCacheTtlSeconds,
      };
      if (
        typeof body.commentsEnabled !== 'boolean'
        || typeof body.commentsPolicyCode !== 'string'
        || typeof body.commentsBodyFormatCode !== 'string'
        || !Number.isFinite(body.publicCacheTtlSeconds)
      ) {
        return {
          status: 'FAILED',
          errorCode: 'CMS_INVALID_INPUT',
          errorClass: 'VALIDATION',
          safeMessage: 'Merged CMS settings payload is incomplete.',
        };
      }
      const result = await getExecutor().execute({
        edgeApiDefinitionId: resolved.definition.id,
        operationId: updateOp.id,
        params: { pk: CMS_SETTINGS_PK },
        body,
        actorUserId: actorId,
      });
      const summary = settingsSummary(asRecord(result.data) ?? { id: 1, ...body });
      context.writeTraceMetadata({
        type: 'CMS_SETTINGS_UPDATE',
        payload: { publicCacheTtlSeconds: summary.found ? summary.publicCacheTtlSeconds : null },
      });
      return { status: 'SUCCEEDED', output: summary.found ? summary : { id: 1, ...body } };
    } catch (error) {
      const safeMessage = error instanceof Error ? error.message : 'CMS settings update failed.';
      return {
        status: 'FAILED',
        errorCode: 'CMS_SETTINGS_UPDATE_FAILED',
        errorClass: 'EXTERNAL_ERROR',
        safeMessage,
      };
    }
  },
};
