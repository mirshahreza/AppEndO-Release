import { describe, expect, it } from 'vitest';
import { buildManagedFunctionOpenApiDocument, buildManagedFunctionOpenApiPaths } from '../buildManagedFunctionOpenApi';
import { parseServerFunctionScriptDoc } from '../parseServerFunctionScriptDoc';
import { resolveEndpointFormFieldsFromOpenApi, resolveEndpointResponseFieldsFromOpenApi } from '../../queries/api-endpoint-schema';

const LOGIN_SCRIPT = `// POST /api/auth/login
async function handler() {
  const payload = req.body || {};
  if (!payload.email || !payload.password) {
    return res.status(400).json({ success: false, error: "email and password are required" });
  }
  return res.json({ success: true, user: payload });
}

handler();`;

const TABLE_INSERT_SCRIPT = `// POST /api/products
// Create row
const DATA_SOURCE_ID = "ds_test";
const PRIMARY_KEY = "id";
const SQL_INSERT = \`INSERT INTO demo_products (title) VALUES (?)\`;

const VALIDATION_SCHEMA = {
  "type": "object",
  "properties": {
    "title": { "type": "string" }
  },
  "required": ["title"]
} as const;

async function handler() {}
void handler();`;

describe('parseServerFunctionScriptDoc', () => {
  it('extracts required body fields and route summary from built-in style scripts', () => {
    const hints = parseServerFunctionScriptDoc(LOGIN_SCRIPT, 'POST', '/api/auth/login');

    expect(hints).toBeTruthy();
    expect(hints?.requiredBodyFields).toEqual(expect.arrayContaining(['email', 'password']));
    expect(hints?.summary).toBe('POST /api/auth/login');
  });

  it('extracts VALIDATION_SCHEMA and SQL output columns from script constants', () => {
    const hints = parseServerFunctionScriptDoc(TABLE_INSERT_SCRIPT, 'POST', '/api/products');

    expect(hints?.validationSchema).toMatchObject({
      type: 'object',
      required: ['title'],
    });
    expect(hints?.summary).toBe('POST /api/products');
  });

  it('extracts SELECT output columns from concatenated SQL strings', () => {
    const usersListScript = `// GET /api/users
async function handler() {
  const users = await db.query(
    "SELECT u.id, u.email, u.created_at, " +
    "COALESCE(array_agg(ur.role_name ORDER BY ur.role_name) FILTER (WHERE ur.role_name IS NOT NULL), ARRAY[]::TEXT[]) AS roles " +
    "FROM base_users u " +
    "LEFT JOIN base_user_roles ur ON ur.user_id = u.id " +
    "GROUP BY u.id, u.email, u.created_at " +
    "ORDER BY u.id DESC"
  );
  return res.json({ success: true, items: users || [] });
}

handler();`;

    const hints = parseServerFunctionScriptDoc(usersListScript, 'GET', '/api/users');

    expect(hints?.outputFieldNames).toEqual(expect.arrayContaining(['id', 'email', 'created_at', 'roles']));
  });

  it('infers request body fields from INSERT column list when VALIDATION_SCHEMA is absent', () => {
    const script = `// POST /api/contact/messages
const SQL_INSERT = \`INSERT INTO base_contact_messages (topic_code, title, note, created_by, updated_by) VALUES (?, ?, ?, ?, ?)\`;

async function handler() {}
void handler();`;

    const hints = parseServerFunctionScriptDoc(script, 'POST', '/api/contact/messages');

    expect(hints?.validationSchema).toMatchObject({
      type: 'object',
      properties: {
        topic_code: { type: 'string' },
        title: { type: 'string' },
        note: { type: 'string' },
      },
    });
    expect(hints?.validationSchema).not.toHaveProperty('properties.created_by');
  });
});

describe('buildManagedFunctionOpenApi script integration', () => {
  it('prefers script-derived request body fields for built-in routes', () => {
    const paths = buildManagedFunctionOpenApiPaths({
      id: 'fn-auth-login',
      name: 'login',
      folder: 'auth',
      method: 'POST',
      path: '/api/auth/login',
      code: LOGIN_SCRIPT,
      test_payload: JSON.stringify({ body: { email: 'admin@append.os', password: 'admin123' } }),
      metadata_json: null,
      is_built_in: true,
    });

    const operation = paths['/api/auth/login']?.post as Record<string, unknown>;
    const requestBody = operation.requestBody as Record<string, Record<string, Record<string, unknown>>>;
    const schema = requestBody.content['application/json'].schema as Record<string, unknown>;

    expect(schema.required).toEqual(expect.arrayContaining(['email', 'password']));
    expect(operation.description).toContain('Built-in system route');
  });

  it('uses VALIDATION_SCHEMA from script over metadata fallback', () => {
    const paths = buildManagedFunctionOpenApiPaths({
      id: 'products.create',
      name: 'products-create',
      folder: 'products',
      method: 'POST',
      path: '/api/products',
      code: TABLE_INSERT_SCRIPT,
      metadata_json: null,
      engine_type: 'SANDBOX_JS',
    });

    const operation = paths['/api/products']?.post as Record<string, unknown>;
    const requestBody = operation.requestBody as Record<string, Record<string, Record<string, unknown>>>;
    const schema = requestBody.content['application/json'].schema as Record<string, unknown>;

    expect(schema.required).toEqual(['title']);
  });

  it('exposes POST body fields from INSERT columns to form wizards', () => {
    const contactPostScript = `// POST /api/contact/messages
const SQL_INSERT = \`INSERT INTO base_contact_messages (topic_code, title, note, created_by, updated_by) VALUES (?, ?, ?, ?, ?)\`;

async function handler() {}
void handler();`;

    const spec = buildManagedFunctionOpenApiDocument({
      id: 'contact.messages.post',
      name: 'contact-messages-post',
      folder: 'contact',
      method: 'POST',
      path: '/api/contact/messages',
      code: contactPostScript,
      metadata_json: null,
      engine_type: 'SANDBOX_JS',
    });

    const fields = resolveEndpointFormFieldsFromOpenApi(spec, 'POST');
    expect(fields.map((field) => field.name).sort()).toEqual(['note', 'title', 'topic_code']);
  });

  it('documents users list output columns under items for bind wizards', () => {
    const usersListScript = `// GET /api/users
async function handler() {
  const users = await db.query(
    "SELECT u.id, u.email, u.created_at, " +
    "COALESCE(array_agg(ur.role_name ORDER BY ur.role_name) FILTER (WHERE ur.role_name IS NOT NULL), ARRAY[]::TEXT[]) AS roles " +
    "FROM base_users u " +
    "LEFT JOIN base_user_roles ur ON ur.user_id = u.id " +
    "GROUP BY u.id, u.email, u.created_at " +
    "ORDER BY u.id DESC"
  );
  return res.json({ success: true, items: users || [] });
}

handler();`;

    const spec = buildManagedFunctionOpenApiDocument({
      id: 'fn-users-list',
      name: 'list-users',
      folder: 'users',
      method: 'GET',
      path: '/api/users',
      code: usersListScript,
      metadata_json: null,
      engine_type: 'SANDBOX_JS',
      is_built_in: true,
    });

    expect(resolveEndpointResponseFieldsFromOpenApi(spec, 'GET')).toEqual(
      expect.arrayContaining(['id', 'email', 'created_at', 'roles']),
    );
  });
});
