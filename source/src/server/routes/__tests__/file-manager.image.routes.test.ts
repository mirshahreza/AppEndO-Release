import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'http';
import express from 'express';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FILE_MANAGER_WORKSPACE_DIR } from '../../domain/file-manager/pathScope';

vi.mock('../../middleware/builtInFunctionAccess.middleware', () => ({
  createBuiltInRouteGuard: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

describe('file-manager image routes', () => {
  let server: http.Server;
  let baseUrl = '';
  let tmpDir = '';
  let originalCwd = '';

  beforeAll(async () => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-file-manager-routes-'));
    process.chdir(tmpDir);
    fs.mkdirSync(FILE_MANAGER_WORKSPACE_DIR, { recursive: true });
    fs.writeFileSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

    const app = express();
    const { createJsonBodyParserMiddleware } = await import('../../middleware/jsonBodyParser.middleware');
    app.use(createJsonBodyParserMiddleware());
    const { mountFileManagerRoutes } = await import('../file-manager.routes');
    mountFileManagerRoutes(app);
    app.use('/api', (_req, res) => {
      res.status(404).json({ success: false, error: 'API route not found.' });
    });

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const address = server.address();
        const port = typeof address === 'object' && address ? address.port : 0;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  beforeEach(() => {
    fs.writeFileSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'photo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('accepts POST /api/file-manager/image multipart uploads', async () => {
    const formData = new FormData();
    formData.set('path', 'workspace/photo.png');
    formData.set('scope', 'workspace');
    formData.append('file', new Blob([Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d])], { type: 'image/png' }), 'photo.png');

    const response = await fetch(`${baseUrl}/api/file-manager/image`, {
      method: 'POST',
      body: formData,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { path: 'workspace/photo.png' },
    });
  });

  it('accepts POST /api/file-manager/image/content with base64 payload', async () => {
    const response = await fetch(`${baseUrl}/api/file-manager/image/content`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: 'workspace/photo.png',
        scope: 'workspace',
        contentBase64: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0a]).toString('base64'),
      }),
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      success: true,
      data: { path: 'workspace/photo.png' },
    });
  });
});
