import { describe, expect, it } from 'vitest';
import { compileSandboxSource, invalidateSandboxCompileCache } from '../sandboxCompileCache';
import { normalizeSandboxSource } from '../../../shared/server-functions/sandboxSourceNormalize';
import { buildRequestFromTestPayload } from '../../../shared/server-functions/testPayloadRequest';

describe('sandboxSourceNormalize', () => {
  it('strips export default and leaves handler for worker invocation', () => {
    const source = `export default async function handler(req, res) {
  return res.json({ ok: true });
}`;
    const normalized = normalizeSandboxSource(source);
    expect(normalized).not.toContain('export default');
    expect(normalized).toContain('async function handler()');
    expect(normalized).not.toContain('await handler()');
  });

  it('renames export-default named functions to handler()', () => {
    const source = `export default async function sumTwoNumbers(context) {
  return context;
}`;
    const normalized = normalizeSandboxSource(source);
    expect(normalized).toContain('async function handler()');
    expect(normalized).not.toContain('export default');
  });

  it('compiles export-default agent source without module.exports runtime error', async () => {
    invalidateSandboxCompileCache();
    const source = `export default async function handler(req, res) {
  const body = req.body || {};
  return res.status(200).json({ success: true, sum: Number(body.a) + Number(body.b) });
}`;
    const compiled = await compileSandboxSource(source, 'ts', 'v20.x');
    expect(compiled).not.toContain('module.exports');
    expect(compiled).toContain('handler');
  });

  it('compiles agent source with trailing auto-invoke IIFE stripped', async () => {
    invalidateSandboxCompileCache();
    const source = `async function handler() {
  const body = req.body || {};
  const a = Number(body.a);
  const b = Number(body.b);
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    return res.status(400).json({ ok: false, error: 'a and b must be numbers.' });
  }
  return res.status(200).json({ ok: true, sum: a + b });
}

(async () => {
  await handler();
})();`;
    await expect(compileSandboxSource(source, 'ts', 'v20.x')).resolves.toContain('handler');
  });

  it('compiles agent source with top-level await handler stripped', async () => {
    invalidateSandboxCompileCache();
    const source = `async function handler() {
  return res.status(200).json({ ok: true });
}

await handler();`;
    await expect(compileSandboxSource(source, 'ts', 'v20.x')).resolves.toContain('handler');
  });
});

describe('buildRequestFromTestPayload', () => {
  it('maps Test Console envelope to req parts', () => {
    const request = buildRequestFromTestPayload('POST', {
      body: { a: 1, b: 2 },
    });
    expect(request.body).toEqual({ a: 1, b: 2 });
    expect(request.query).toEqual({});
  });
});
