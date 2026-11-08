import { describe, expect, it, vi, beforeEach } from 'vitest';
import { communicationNotificationSendExecutor } from '../communicationActions';
import { integrationEventPublishExecutor } from '../eventActions';
import { cryptoHmacVerifyExecutor, cryptoHmacExecutor } from '../cryptoActions';
import { documentPdfExtractTextExecutor } from '../documentActions';
import { aiEmbeddingExecutor, aiVectorUpsertExecutor, aiVectorSearchExecutor } from '../aiActions';

const createUserNotification = vi.fn(async () => ({ id: 42 }));
const createNotificationsForRole = vi.fn(async () => ({ created: 2, userIds: [10, 11] }));

vi.mock('../../../../../services/notifications/userNotification.service', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../../services/notifications/userNotification.service')>();
  return {
    ...actual,
    createUserNotification: (...args: unknown[]) => createUserNotification(...args),
    createNotificationsForRole: (...args: unknown[]) => createNotificationsForRole(...args),
  };
});

const upsertVectorDocument = vi.fn(async (input: { collection: string; documentKey: string }) => ({
  id: 7, collection: input.collection, documentKey: input.documentKey,
}));
const searchVectorDocuments = vi.fn(async () => [{ documentKey: 'a', text: 'hello', score: 0.9, metadata: null }]);

vi.mock('../../../engine/vectorStore', () => ({
  upsertVectorDocument: (...args: unknown[]) => upsertVectorDocument(...args as never),
  searchVectorDocuments: (...args: unknown[]) => searchVectorDocuments(...args as never),
}));

vi.mock('../../../../../../core/ai/AiManager', () => ({
  aiManager: { resolveModel: () => { throw new Error('no configured embedding model'); } },
}));

vi.mock('../../../../../../core/ai/providers/LocalEmbeddingsProvider', () => ({
  LocalEmbeddingsProvider: class {
    embedTexts = async (texts: string[]) => texts.map((text) => (text.includes('alpha') ? [1, 0] : [0, 1]));
  },
}));

const fakeContext = {
  workflowInstanceId: 'i1',
  nodeInstanceId: 'n1',
  logicalInvocationId: 'l1',
  idempotencyKey: 'k1',
  effectiveIdentity: { type: 'SYSTEM' as const, id: null },
  cancellationSignal: new AbortController().signal,
  resolveSecret: async () => 'secret',
  logger: { info: () => {}, warn: () => {}, error: () => {} },
  writeTraceMetadata: () => {},
};

describe('communication.notification-send', () => {
  beforeEach(() => {
    createUserNotification.mockClear();
    createNotificationsForRole.mockClear();
  });

  it('fails when title/body are missing, or when neither userId nor roleId is provided', async () => {
    expect(await communicationNotificationSendExecutor.execute(fakeContext, {}, { title: 'x' })).toMatchObject({
      status: 'FAILED', errorCode: 'NOTIFICATION_FIELDS_REQUIRED',
    });
    expect(await communicationNotificationSendExecutor.execute(fakeContext, {}, { title: 'Hello', body: 'World' })).toMatchObject({
      status: 'FAILED', errorCode: 'NOTIFICATION_TARGET_REQUIRED',
    });
  });

  it('creates a single-user notification when userId is a numeric string', async () => {
    const result = await communicationNotificationSendExecutor.execute(fakeContext, {}, {
      userId: '7', title: 'Hello', body: 'World', severity: 'warning', href: '/inbox',
    });
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { created: 1, userIds: [7], id: 42 } });
    expect(createUserNotification).toHaveBeenCalledWith({
      userId: 7, title: 'Hello', body: 'World', severity: 'warning', href: '/inbox', source: 'workflow',
    });
  });

  it('fans out to role members and fails when the role has no members', async () => {
    createNotificationsForRole.mockResolvedValueOnce({ created: 2, userIds: [10, 11] });
    const ok = await communicationNotificationSendExecutor.execute(fakeContext, {}, {
      roleId: 'ADMIN', title: 'Ping', body: 'Please review',
    });
    expect(ok).toMatchObject({ status: 'SUCCEEDED', output: { created: 2, userIds: [10, 11] } });

    createNotificationsForRole.mockResolvedValueOnce({ created: 0, userIds: [] });
    const empty = await communicationNotificationSendExecutor.execute(fakeContext, {}, {
      roleId: 'GHOST', title: 'Ping', body: 'Please review',
    });
    expect(empty).toMatchObject({ status: 'FAILED', errorCode: 'NOTIFICATION_ROLE_EMPTY' });
  });
});

describe('integration.event-publish validation', () => {
  it('fails when eventName is blank before touching ingress', async () => {
    const missing = await integrationEventPublishExecutor.execute(fakeContext, {}, { payload: {} });
    expect(missing).toMatchObject({ status: 'FAILED', errorCode: 'EVENT_NAME_REQUIRED' });
    const blank = await integrationEventPublishExecutor.execute(fakeContext, {}, { eventName: '   ' });
    expect(blank).toMatchObject({ status: 'FAILED', errorCode: 'EVENT_NAME_REQUIRED' });
  });
});

describe('crypto.hmac-verify edge cases', () => {
  it('returns valid:false when digest lengths differ (timing-safe path, no throw)', async () => {
    const result = await cryptoHmacVerifyExecutor.execute(fakeContext, {}, {
      data: 'payload', key: 'secret', digest: 'ab', algorithm: 'sha256', encoding: 'hex',
    });
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { valid: false } });
  });

  it('rejects a missing digest the same way hmac rejects a missing key', async () => {
    const result = await cryptoHmacVerifyExecutor.execute(fakeContext, {}, { data: 'payload', key: 'secret' });
    expect(result.status).toBe('FAILED');
  });

  it('round-trips hmac → hmac-verify for base64 encoding', async () => {
    const signed = await cryptoHmacExecutor.execute(fakeContext, {}, { data: 'payload', key: 'secret', encoding: 'base64' });
    expect(signed.status).toBe('SUCCEEDED');
    if (signed.status !== 'SUCCEEDED') throw new Error('unreachable');
    const digest = (signed.output as { digest: string }).digest;
    const ok = await cryptoHmacVerifyExecutor.execute(fakeContext, {}, {
      data: 'payload', key: 'secret', digest, encoding: 'base64',
    });
    expect(ok).toMatchObject({ status: 'SUCCEEDED', output: { valid: true } });
  });
});

describe('document.pdf-extract-text validation', () => {
  it('fails when neither path nor content is provided', async () => {
    const result = await documentPdfExtractTextExecutor.execute(fakeContext, {}, {});
    expect(result).toMatchObject({ status: 'FAILED', errorCode: 'PDF_SOURCE_REQUIRED' });
  });
});

describe('ai.embedding / ai.vector-upsert / ai.vector-search', () => {
  beforeEach(() => {
    upsertVectorDocument.mockClear();
    searchVectorDocuments.mockClear();
  });

  it('embedding fails without text/texts and embeds a batch with local fallback vectors', async () => {
    const missing = await aiEmbeddingExecutor.execute(fakeContext, {}, {});
    expect(missing).toMatchObject({ status: 'FAILED', errorCode: 'EMBEDDING_TEXT_REQUIRED' });

    const result = await aiEmbeddingExecutor.execute(fakeContext, {}, { texts: ['alpha', 'beta'] });
    expect(result.status).toBe('SUCCEEDED');
    if (result.status !== 'SUCCEEDED') throw new Error('unreachable');
    expect(result.output).toMatchObject({
      embedding: [1, 0],
      embeddings: [[1, 0], [0, 1]],
      dimensions: 2,
    });
  });

  it('vector-upsert requires collection/documentKey/text and stores the embedded document', async () => {
    const missing = await aiVectorUpsertExecutor.execute(fakeContext, {}, { collection: 'c' });
    expect(missing).toMatchObject({ status: 'FAILED', errorCode: 'VECTOR_UPSERT_FIELDS_REQUIRED' });

    const result = await aiVectorUpsertExecutor.execute(fakeContext, {}, {
      collection: 'kb', documentKey: 'doc-1', text: 'alpha note', metadata: { src: 'test' },
    });
    expect(result).toMatchObject({
      status: 'SUCCEEDED',
      output: { id: 7, collection: 'kb', documentKey: 'doc-1', dimensions: 2 },
    });
    expect(upsertVectorDocument).toHaveBeenCalledWith({
      collection: 'kb',
      documentKey: 'doc-1',
      text: 'alpha note',
      embedding: [1, 0],
      metadata: { src: 'test' },
    });
  });

  it('vector-search requires collection/query, caps limit, and returns ranked hits', async () => {
    const missing = await aiVectorSearchExecutor.execute(fakeContext, {}, { collection: 'kb' });
    expect(missing).toMatchObject({ status: 'FAILED', errorCode: 'VECTOR_SEARCH_FIELDS_REQUIRED' });

    const result = await aiVectorSearchExecutor.execute(fakeContext, {}, { collection: 'kb', query: 'alpha?', limit: 99 });
    expect(result).toMatchObject({ status: 'SUCCEEDED', output: { hits: [{ documentKey: 'a', text: 'hello', score: 0.9 }] } });
    expect(searchVectorDocuments).toHaveBeenCalledWith({ collection: 'kb', embedding: [1, 0], limit: 50 });
  });
});
