import { describe, expect, it } from 'vitest';
import {
  resolveEndpointResponseFieldsFromOpenApi,
  resolveEndpointFormFieldsFromOpenApi,
  resolveRowFieldNamesFromApiPayload,
} from '../apiFieldSchema';
import { buildManagedFunctionOpenApiDocument } from '../../../shared/api/openapi/buildManagedFunctionOpenApi';

describe('resolveEndpointResponseFieldsFromOpenApi', () => {
  it('reads list row fields from the managed-function data array schema', () => {
    const spec = {
      paths: {
        '/api/contact/messages': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              topic_label: { type: 'string' },
                              title: { type: 'string' },
                              note: { type: 'string' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    expect(resolveEndpointResponseFieldsFromOpenApi(spec, 'GET')).toEqual([
      'id',
      'topic_label',
      'title',
      'note',
    ]);
  });

  it('reads detail object fields from the data property', () => {
    const spec = {
      paths: {
        '/api/contact/messages/{id}': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'object',
                          properties: {
                            id: { type: 'string' },
                            title: { type: 'string' },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    expect(resolveEndpointResponseFieldsFromOpenApi(spec, 'GET')).toEqual(['id', 'title']);
  });

  it('reads list row fields from an items array payload', () => {
    const spec = {
      paths: {
        '/api/users': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        items: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'integer' },
                              email: { type: 'string' },
                              username: { type: 'string' },
                              roles: { type: 'array', items: { type: 'string' } },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    expect(resolveEndpointResponseFieldsFromOpenApi(spec, 'GET')).toEqual([
      'id',
      'email',
      'username',
      'roles',
    ]);
  });

  it('reads row fields from a response example when schema properties are open', () => {
    const spec = {
      paths: {
        '/api/users': {
          get: {
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        success: { type: 'boolean' },
                        items: { type: 'array', items: { type: 'object', additionalProperties: true } },
                      },
                    },
                    example: {
                      success: true,
                      items: [
                        { id: 1, email: 'a@example.com', username: 'alpha', roles: ['USER'] },
                      ],
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    expect(resolveEndpointResponseFieldsFromOpenApi(spec, 'GET')).toEqual([
      'id',
      'email',
      'username',
      'roles',
    ]);
  });

  it('ignores pagination query objects when no row collection is present', () => {
    expect(resolveRowFieldNamesFromApiPayload({ limit: 10, page: 1 })).toEqual([]);
    expect(resolveRowFieldNamesFromApiPayload({ success: true, query: { limit: 10, page: 1 } })).toEqual([]);
  });

  it('reads all role list columns from the roles OpenAPI script', () => {
    const rolesListScript = `// GET /api/roles
async function handler() {
  const roles = await db.query(
    "SELECT r.id, r.name, r.note, r.created_at, r.created_by, " +
    "creator.username AS created_by_username, r.updated_at, r.updated_by, " +
    "updater.username AS updated_by_username " +
    "FROM base_roles r " +
    "LEFT JOIN base_users creator ON creator.id = r.created_by " +
    "LEFT JOIN base_users updater ON updater.id = r.updated_by " +
    "ORDER BY r.name ASC"
  );
  return res.json({ success: true, items: roles || [] });
}

handler();`;

    const spec = buildManagedFunctionOpenApiDocument({
      id: 'fn-roles-list',
      name: 'list-roles',
      folder: 'roles',
      method: 'GET',
      path: '/api/roles',
      code: rolesListScript,
      metadata_json: null,
      engine_type: 'SANDBOX_JS',
      is_built_in: true,
    });

    expect(resolveEndpointResponseFieldsFromOpenApi(spec, 'GET')).toEqual(
      expect.arrayContaining([
        'id',
        'name',
        'note',
        'created_at',
        'created_by',
        'created_by_username',
        'updated_at',
        'updated_by',
        'updated_by_username',
      ]),
    );
  });
});

describe('resolveEndpointFormFieldsFromOpenApi', () => {
  it('falls back to response row fields when GET list only exposes limit/page/params/body', () => {
    const spec = {
      paths: {
        '/api/base-contact-messages-v': {
          get: {
            parameters: [
              { name: 'limit', in: 'query', schema: { type: 'integer' } },
              { name: 'page', in: 'query', schema: { type: 'integer' } },
              { name: 'params', in: 'query', schema: { type: 'string' } },
            ],
            requestBody: {
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      body: { type: 'object', additionalProperties: true },
                    },
                  },
                },
              },
            },
            responses: {
              '200': {
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        data: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              topic_label: { type: 'string' },
                              title: { type: 'string' },
                              note: { type: 'string' },
                              created_by_username: { type: 'string' },
                              created_at: { type: 'string', format: 'date-time' },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    expect(resolveEndpointFormFieldsFromOpenApi(spec, 'GET').map((field) => field.name)).toEqual([
      'topic_label',
      'title',
      'note',
    ]);
  });

  it('keeps explicit POST body fields from validation schema', () => {
    const spec = {
      paths: {
        '/api/contact/messages': {
          post: {
            requestBody: {
              required: true,
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      topic_code: { type: 'string' },
                      title: { type: 'string' },
                      note: { type: 'string' },
                    },
                    required: ['topic_code', 'title'],
                  },
                },
              },
            },
            responses: { '200': { description: 'OK' } },
          },
        },
      },
    };

    expect(resolveEndpointFormFieldsFromOpenApi(spec, 'POST').map((field) => field.name).sort()).toEqual([
      'note',
      'title',
      'topic_code',
    ]);
  });
});
