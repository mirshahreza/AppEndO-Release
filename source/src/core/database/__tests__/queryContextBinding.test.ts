import { describe, expect, it } from 'vitest';
import { bindSessionContextToQuery } from '../queryContextBinding';

describe('bindSessionContextToQuery', () => {
  it('binds :ctx.server.* placeholders to positional params', () => {
    const result = bindSessionContextToQuery(
      'SELECT * FROM orders WHERE tenant_id = :ctx.server.tenantId AND status = ?',
      ['open'],
      { server: { tenantId: 42 }, client: {} },
    );

    expect(result.sql).toBe('SELECT * FROM orders WHERE tenant_id = ? AND status = ?');
    expect(result.params).toEqual(['open', 42]);
  });

  it('binds @session.client.* placeholders', () => {
    const result = bindSessionContextToQuery(
      'SELECT * FROM items WHERE region = @session.client.region',
      [],
      { server: {}, client: { region: 'eu-west' } },
    );

    expect(result.sql).toBe('SELECT * FROM items WHERE region = ?');
    expect(result.params).toEqual(['eu-west']);
  });

  it('rejects non-scalar bindings', () => {
    expect(() => bindSessionContextToQuery(
      'SELECT * FROM items WHERE payload = :ctx.server.meta',
      [],
      { server: { meta: { nested: true } }, client: {} },
    )).toThrow(/scalar/i);
  });
});
