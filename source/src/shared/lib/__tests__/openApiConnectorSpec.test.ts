import { describe, expect, it } from 'vitest';
import { fillOpenApiPathParams, parseOpenApiConnectorSpec } from '../openApiConnectorSpec';

const SAMPLE_SPEC = JSON.stringify({
  openapi: '3.0.0',
  info: { title: 'Petstore' },
  servers: [{ url: 'https://petstore.example.com/v1' }],
  paths: {
    '/pets': {
      get: { operationId: 'listPets', summary: 'List all pets' },
      post: { summary: 'Create a pet' },
    },
    '/pets/{petId}': {
      get: { operationId: 'getPet' },
      delete: {},
    },
  },
});

describe('parseOpenApiConnectorSpec', () => {
  it('extracts title, base URL and operations', () => {
    const parsed = parseOpenApiConnectorSpec(SAMPLE_SPEC);
    expect(parsed.title).toBe('Petstore');
    expect(parsed.baseUrl).toBe('https://petstore.example.com/v1');
    expect(parsed.operations).toHaveLength(4);
  });

  it('synthesizes an operationId when the spec omits one', () => {
    const parsed = parseOpenApiConnectorSpec(SAMPLE_SPEC);
    const createPet = parsed.operations.find((op) => op.method === 'POST' && op.path === '/pets');
    expect(createPet?.operationId).toBe('post_/pets');
  });

  it('preserves an explicit operationId', () => {
    const parsed = parseOpenApiConnectorSpec(SAMPLE_SPEC);
    const getPet = parsed.operations.find((op) => op.path === '/pets/{petId}' && op.method === 'GET');
    expect(getPet?.operationId).toBe('getPet');
  });

  it('rejects invalid JSON', () => {
    expect(() => parseOpenApiConnectorSpec('not json')).toThrow('valid JSON');
  });

  it('rejects a spec with no paths/operations', () => {
    expect(() => parseOpenApiConnectorSpec(JSON.stringify({ openapi: '3.0.0', paths: {} }))).toThrow('no operations');
  });
});

describe('fillOpenApiPathParams', () => {
  it('substitutes known placeholders', () => {
    expect(fillOpenApiPathParams('/pets/{petId}/photos/{photoId}', { petId: '42', photoId: '7' }))
      .toBe('/pets/42/photos/7');
  });

  it('leaves unresolved placeholders untouched', () => {
    expect(fillOpenApiPathParams('/pets/{petId}', {})).toBe('/pets/{petId}');
  });

  it('URL-encodes provided values', () => {
    expect(fillOpenApiPathParams('/search/{term}', { term: 'a b/c' })).toBe('/search/a%20b%2Fc');
  });
});
