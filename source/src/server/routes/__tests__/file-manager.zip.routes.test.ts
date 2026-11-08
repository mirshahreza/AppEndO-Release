import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'http';
import express from 'express';
import AdmZip from 'adm-zip';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FILE_MANAGER_WORKSPACE_DIR } from '../../domain/file-manager/pathScope';

vi.mock('../../middleware/builtInFunctionAccess.middleware', () => ({
  createBuiltInRouteGuard: () => (_req: express.Request, _res: express.Response, next: express.NextFunction) => next(),
}));

describe('file-manager zip routes', () => {
  let server: http.Server;
  let baseUrl = '';
  let tmpDir = '';
  let originalCwd = '';

  beforeAll(async () => {
    originalCwd = process.cwd();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'appendo-file-manager-zip-routes-'));
    process.chdir(tmpDir);
    fs.mkdirSync(FILE_MANAGER_WORKSPACE_DIR, { recursive: true });

    const app = express();
    const { createJsonBodyParserMiddleware } = await import('../../middleware/jsonBodyParser.middleware');
    app.use(createJsonBodyParserMiddleware());
    const { mountFileManagerRoutes } = await import('../file-manager.routes');
    mountFileManagerRoutes(app);

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
    const zip = new AdmZip();
    zip.addFile('readme.txt', Buffer.from('hello zip'));
    zip.addFile('nested/child.txt', Buffer.from('nested content'));
    zip.writeZip(path.join(FILE_MANAGER_WORKSPACE_DIR, 'sample.zip'));
    fs.writeFileSync(path.join(FILE_MANAGER_WORKSPACE_DIR, 'import-me.txt'), 'import this');
  });

  afterAll(async () => {
    process.chdir(originalCwd);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  });

  it('lists zip entries as a nested tree', async () => {
    const response = await fetch(
      `${baseUrl}/api/file-manager/zip/entries?archivePath=workspace/sample.zip&scope=workspace`,
    );

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.data.entryCount).toBeGreaterThan(0);
    expect(payload.data.entries.some((entry: { name: string }) => entry.name === 'nested')).toBe(true);
  });

  it('reads, writes, moves, imports, and deletes zip entries', async () => {
    const contentResponse = await fetch(
      `${baseUrl}/api/file-manager/zip/content?archivePath=workspace/sample.zip&entryPath=readme.txt&scope=workspace`,
    );
    expect(contentResponse.status).toBe(200);
    await expect(contentResponse.json()).resolves.toMatchObject({
      success: true,
      data: { content: 'hello zip', kind: 'text' },
    });

    const writeResponse = await fetch(`${baseUrl}/api/file-manager/zip/content`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        archivePath: 'workspace/sample.zip',
        entryPath: 'readme.txt',
        content: 'updated zip content',
        scope: 'workspace',
      }),
    });
    expect(writeResponse.status).toBe(200);

    const importResponse = await fetch(`${baseUrl}/api/file-manager/zip/import`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        archivePath: 'workspace/sample.zip',
        destinationParentPath: 'nested',
        sourcePath: 'workspace/import-me.txt',
        scope: 'workspace',
      }),
    });
    expect(importResponse.status).toBe(201);

    const moveResponse = await fetch(`${baseUrl}/api/file-manager/zip/move`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        archivePath: 'workspace/sample.zip',
        entryPath: 'nested/child.txt',
        destinationParentPath: '',
        scope: 'workspace',
      }),
    });
    expect(moveResponse.status).toBe(200);

    const deleteResponse = await fetch(`${baseUrl}/api/file-manager/zip/entry`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        archivePath: 'workspace/sample.zip',
        entryPath: 'readme.txt',
        scope: 'workspace',
      }),
    });
    expect(deleteResponse.status).toBe(200);
  });
});
