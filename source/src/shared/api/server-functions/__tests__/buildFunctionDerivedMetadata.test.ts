import { describe, expect, it } from 'vitest';
import {
  buildCodeFingerprint,
  buildTestPayloadFromScript,
  ensureFunctionDerivedMetadata,
  resolveEffectiveTestPayloadJson,
} from '../buildFunctionDerivedMetadata';

const CRUD_GEN_POST = `// CRUD-Gen Table route — demo_products
// POST /api/products
// Create row
const DATA_SOURCE_ID = "ds_test";
const PRIMARY_KEY = "id";
const SQL_INSERT = \`INSERT INTO demo_products (title, price) VALUES (?, ?)\`;

const VALIDATION_SCHEMA = {
  "type": "object",
  "properties": {
    "title": { "type": "string" },
    "price": { "type": "number" }
  },
  "required": ["title"]
} as const;

async function handler() {}
void handler();`;

const GET_LIST = `// GET /api/orders
const SQL_SELECT_LIST = \`SELECT id, total FROM orders LIMIT ? OFFSET ?\`;
async function handler() {}
void handler();`;

const PUT_BY_ID = `// PUT /api/orders/:id
const VALIDATION_SCHEMA = {
  "type": "object",
  "properties": {
    "total": { "type": "number" }
  }
} as const;
async function handler() {}
void handler();`;

describe('buildFunctionDerivedMetadata', () => {
  it('builds POST body from VALIDATION_SCHEMA', () => {
    const payload = buildTestPayloadFromScript(CRUD_GEN_POST, 'POST', '/api/products');

    expect(payload).toEqual({
      title: '',
      price: 0,
    });
  });

  it('builds GET list query defaults', () => {
    const payload = buildTestPayloadFromScript(GET_LIST, 'GET', '/api/orders');

    expect(payload).toEqual({
      query: {
        limit: 10,
        page: 1,
      },
    });
  });

  it('builds params and body for PUT routes', () => {
    const payload = buildTestPayloadFromScript(PUT_BY_ID, 'PUT', '/api/orders/:id');

    expect(payload).toEqual({
      params: { id: 1 },
      total: 0,
    });
  });

  it('ensureFunctionDerivedMetadata materializes derived metadata and test payload', () => {
    const result = ensureFunctionDerivedMetadata({
      code: CRUD_GEN_POST,
      method: 'POST',
      path: '/api/products',
      metadataJson: null,
      testPayload: '{}',
      now: () => '2026-06-16T00:00:00.000Z',
    });

    expect(result.changed).toBe(true);
    expect(result.testPayload).toContain('"title"');
    expect(JSON.parse(result.metadataJson ?? '{}')).toMatchObject({
      derived: {
        codeFingerprint: buildCodeFingerprint(CRUD_GEN_POST),
        generatedAt: '2026-06-16T00:00:00.000Z',
      },
      testPayloadSource: 'generated',
    });
  });

  it('does not overwrite manual test payloads when code fingerprint changes', () => {
    const manualPayload = JSON.stringify({ body: { title: 'Custom' } }, null, 2);
    const result = ensureFunctionDerivedMetadata({
      code: CRUD_GEN_POST,
      method: 'POST',
      path: '/api/products',
      metadataJson: { testPayloadSource: 'manual' },
      testPayload: manualPayload,
    });

    expect(result.changed).toBe(true);
    expect(result.testPayload).toBe(manualPayload);
    expect(JSON.parse(result.metadataJson ?? '{}').testPayloadSource).toBe('manual');
  });

  it('resolveEffectiveTestPayloadJson derives from script when stored payload is empty', () => {
    const json = resolveEffectiveTestPayloadJson({
      code: CRUD_GEN_POST,
      method: 'POST',
      path: '/api/products',
      testPayload: '{}',
      metadataJson: null,
    });

    expect(JSON.parse(json)).toEqual({
      title: '',
      price: 0,
    });
  });
});
